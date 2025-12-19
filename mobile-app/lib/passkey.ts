/**
 * Passkey (WebAuthn) utilities for Keystore Mobile App
 * Handles passkey creation and signing for both native and web platforms
 */

import * as Application from "expo-application";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import * as RNPasskeys from "react-native-passkeys";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Storage key for credentials
const CREDENTIAL_STORAGE_KEY = "keystore_credential";

export interface PasskeyCredential {
  publicKey: Uint8Array;
  credentialId: Uint8Array;
}

export interface StoredCredential {
  credentialId: number[];
  publicKey: number[];
  owner: string; // identity PDA address
}

export interface SignatureResult {
  signature: Uint8Array;
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
}

// Platform detection
const isWeb = Platform.OS === "web";

/**
 * Convert Uint8Array to base64url string
 * Pure JS implementation - no btoa dependency
 */
function base64urlEncode(bytes: Uint8Array): string {
  const base64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let result = "";
  const len = bytes.length;
  
  for (let i = 0; i < len; i += 3) {
    const byte1 = bytes[i];
    const byte2 = i + 1 < len ? bytes[i + 1] : 0;
    const byte3 = i + 2 < len ? bytes[i + 2] : 0;
    
    // Always output first 2 chars
    result += base64chars[byte1 >> 2];
    result += base64chars[((byte1 & 3) << 4) | (byte2 >> 4)];
    
    // Output 3rd char if we have at least 2 bytes
    if (i + 1 < len) {
      result += base64chars[((byte2 & 15) << 2) | (byte3 >> 6)];
    }
    
    // Output 4th char if we have all 3 bytes
    if (i + 2 < len) {
      result += base64chars[byte3 & 63];
    }
  }
  
  return result;
}

/**
 * Convert ArrayBuffer to base64url string
 * Uses base64urlEncode which is pure JS (no btoa dependency)
 */
function bufferToBase64URLString(buffer: ArrayBuffer): string {
  return base64urlEncode(new Uint8Array(buffer));
}

/**
 * Convert base64url string to Uint8Array
 * Pure JS implementation - does NOT rely on atob (which may not work in React Native)
 */
function base64urlDecode(str: string): Uint8Array {
  // Convert base64url to base64
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  while (base64.length % 4) {
    base64 += "=";
  }
  
  // Pure JS base64 decode (no atob dependency)
  const base64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Map<string, number>();
  for (let i = 0; i < base64chars.length; i++) {
    lookup.set(base64chars[i], i);
  }
  
  // Calculate output length (excluding padding)
  let paddingCount = 0;
  if (base64.endsWith("==")) paddingCount = 2;
  else if (base64.endsWith("=")) paddingCount = 1;
  
  const outputLength = (base64.length * 3) / 4 - paddingCount;
  const bytes = new Uint8Array(outputLength);
  
  let byteIndex = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const a = lookup.get(base64[i]) ?? 0;
    const b = lookup.get(base64[i + 1]) ?? 0;
    const c = lookup.get(base64[i + 2]) ?? 0;
    const d = lookup.get(base64[i + 3]) ?? 0;
    
    if (byteIndex < outputLength) bytes[byteIndex++] = (a << 2) | (b >> 4);
    if (byteIndex < outputLength) bytes[byteIndex++] = ((b & 15) << 4) | (c >> 2);
    if (byteIndex < outputLength) bytes[byteIndex++] = ((c & 3) << 6) | d;
  }
  
  return bytes;
}

/**
 * Convert UTF-8 string to ArrayBuffer
 */
function utf8StringToBuffer(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).buffer;
}

/**
 * Compute SHA-256 hash
 * Uses expo-crypto for native, Web Crypto API for web
 */
async function sha256(data: Uint8Array): Promise<ArrayBuffer> {
  if (isWeb) {
    return window.crypto.subtle.digest("SHA-256", data.buffer as ArrayBuffer);
  } else {
    // expo-crypto returns a hex string, convert to ArrayBuffer
    const hexHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Array.from(data).map(b => String.fromCharCode(b)).join(""),
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    // Convert hex to bytes
    const bytes = new Uint8Array(hexHash.length / 2);
    for (let i = 0; i < hexHash.length; i += 2) {
      bytes[i / 2] = parseInt(hexHash.substring(i, i + 2), 16);
    }
    return bytes.buffer;
  }
}

/**
 * Ensure we're running in a web environment
 */
function ensureWebEnvironment() {
  if (!isWeb) {
    throw new Error("This function is web-only");
  }
  if (typeof window === "undefined") {
    throw new Error("Window is not available");
  }
  if (!window.crypto || !window.crypto.getRandomValues) {
    throw new Error("Web Crypto API is not available");
  }
  if (!navigator.credentials) {
    throw new Error("WebAuthn is not supported in this browser");
  }
}

/**
 * Extract compressed public key from SPKI format
 */
function extractPublicKey(spki: ArrayBuffer): Uint8Array {
  const raw = new Uint8Array(spki);
  // SPKI for P-256: skip 26-byte header, get 65-byte uncompressed point
  const uncompressed = raw.slice(-65);
  // Compress: 0x02 if y even, 0x03 if odd
  const x = uncompressed.slice(1, 33);
  const y = uncompressed.slice(33, 65);
  const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03;
  const compressed = new Uint8Array(33);
  compressed[0] = prefix;
  compressed.set(x, 1);
  return compressed;
}

/**
 * Convert DER signature to raw 64-byte format
 */
function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 [len] 0x02 [rLen] [r] 0x02 [sLen] [s]
  let offset = 2;
  const rLen = der[offset + 1];
  const r = der.slice(offset + 2, offset + 2 + rLen);
  offset += 2 + rLen;
  const sLen = der[offset + 1];
  const s = der.slice(offset + 2, offset + 2 + sLen);

  const raw = new Uint8Array(64);
  // Pad/trim r and s to 32 bytes each
  if (r.length > 32) {
    raw.set(r.slice(-32), 0);
  } else {
    raw.set(r, 32 - r.length);
  }
  if (s.length > 32) {
    raw.set(s.slice(-32), 32);
  } else {
    raw.set(s, 64 - s.length);
  }
  return raw;
}

/**
 * Create passkey using native platform APIs
 */
async function createPasskeyNative(username: string): Promise<PasskeyCredential> {
  const bundleId = Application.applicationId?.split(".").reverse().join(".");
  const hostname = bundleId?.replaceAll("web.com", "web.app")?.replaceAll("_", "-");

  console.log("Creating native passkey for hostname:", hostname);

  const rp = {
    id: "solana-university-hackathon.vercel.app",
    name: "Keystore Wallet",
  } satisfies PublicKeyCredentialRpEntity;

  const challenge = bufferToBase64URLString(utf8StringToBuffer("keystore-challenge"));
  const userId = bufferToBase64URLString(utf8StringToBuffer(username));

  const user = {
    id: userId,
    displayName: username,
    name: username,
  } satisfies PublicKeyCredentialUserEntityJSON;

  const authenticatorSelection = {
    userVerification: "required",
    residentKey: "required",
  } satisfies AuthenticatorSelectionCriteria;

  const requestParams = {
    challenge,
    pubKeyCredParams: [{ alg: -7, type: "public-key" as const }],
    rp,
    user,
    authenticatorSelection,
  };

  console.log("Passkey create request:", JSON.stringify(requestParams, null, 2));

  try {
    const json = await RNPasskeys.create(requestParams);

    console.log("Passkey creation response:", json);

    if (!json) {
      throw new Error("Failed to create passkey - no response");
    }

    // Extract and compress public key
    const publicKeyBase64 = json.response?.publicKey;
    if (!publicKeyBase64) {
      throw new Error("No public key in passkey response");
    }

    // Decode the public key from base64
    const publicKeyBytes = base64urlDecode(publicKeyBase64);
    console.log("Public key bytes length:", publicKeyBytes.length);
    
    // Extract and compress the public key
    let compressedPubkey: Uint8Array;
    
    if (publicKeyBytes.length === 91) {
      // SPKI format (26-byte header + 65-byte uncompressed point)
      // Extract the uncompressed point from the end
      const uncompressed = publicKeyBytes.slice(-65);
      if (uncompressed[0] !== 0x04) {
        throw new Error("Invalid uncompressed public key format");
      }
      const x = uncompressed.slice(1, 33);
      const y = uncompressed.slice(33, 65);
      const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03;
      compressedPubkey = new Uint8Array(33);
      compressedPubkey[0] = prefix;
      compressedPubkey.set(x, 1);
    } else if (publicKeyBytes.length === 65 && publicKeyBytes[0] === 0x04) {
      // Uncompressed format - compress it
      const x = publicKeyBytes.slice(1, 33);
      const y = publicKeyBytes.slice(33, 65);
      const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03;
      compressedPubkey = new Uint8Array(33);
      compressedPubkey[0] = prefix;
      compressedPubkey.set(x, 1);
    } else if (publicKeyBytes.length === 33) {
      // Already compressed
      compressedPubkey = publicKeyBytes;
    } else {
      throw new Error(`Unexpected public key length: ${publicKeyBytes.length}. Raw bytes: ${Array.from(publicKeyBytes.slice(0, 10)).join(", ")}...`);
    }
    
    console.log("Compressed public key length:", compressedPubkey.length);

    // Store the rawId directly as-is (base64url string from the authenticator)
    // DO NOT decode and re-encode - just keep the original
    console.log("Original rawId from authenticator:", json.rawId);
    const credentialId = base64urlDecode(json.rawId);
    console.log("Decoded credentialId length:", credentialId.length);
    console.log("Re-encoded credentialId:", base64urlEncode(credentialId));
    console.log("Do they match?", json.rawId === base64urlEncode(credentialId));

    return {
      publicKey: compressedPubkey,
      credentialId,
    };
  } catch (e: any) {
    console.error("Passkey creation error:", e);
    throw new Error(`Passkey creation failed: ${e?.message || "Unknown error"}`);
  }
}

/**
 * Create passkey using web browser WebAuthn
 */
async function createPasskeyWeb(username: string): Promise<PasskeyCredential> {
  ensureWebEnvironment();

  const challenge = window.crypto.getRandomValues(new Uint8Array(32));

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: "Keystore",
        id: window.location.hostname,
      },
      user: {
        id: new TextEncoder().encode(username),
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "required",
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential;

  const response = credential.response as AuthenticatorAttestationResponse;
  const publicKey = extractPublicKey(response.getPublicKey()!);

  return {
    publicKey,
    credentialId: new Uint8Array(credential.rawId),
  };
}

/**
 * Unified passkey creation API
 */
export async function createPasskey(username: string): Promise<PasskeyCredential> {
  if (isWeb) {
    return createPasskeyWeb(username);
  } else {
    return createPasskeyNative(username);
  }
}

/**
 * Sign with passkey using native platform APIs
 * Returns signature along with authenticatorData and clientDataJSON for WebAuthn verification
 */
async function signWithPasskeyNative(
  credentialId: Uint8Array,
  message: Uint8Array
): Promise<SignatureResult> {
  // Hash the message to 32 bytes for the challenge (same as web implementation)
  const msgHash = await sha256(message);
  const msgHashBase64 = base64urlEncode(new Uint8Array(msgHash));

  // Use the same rpId as the web app - must match what's in assetlinks.json
  const rpId = "solana-university-hackathon.vercel.app";
  const credentialIdBase64 = base64urlEncode(credentialId);

  console.log("signWithPasskeyNative called:");
  console.log("  - rpId:", rpId);
  console.log("  - credentialId length:", credentialId.length);
  console.log("  - credentialId (base64url):", credentialIdBase64);
  console.log("  - challenge (base64url):", msgHashBase64);

  const getParams = {
    challenge: msgHashBase64,
    rpId,
    timeout: 60000,
    userVerification: "required" as const,
    allowCredentials: [
      {
        id: credentialIdBase64,
        type: "public-key" as const,
      },
    ],
  };

  console.log("RNPasskeys.get params:", JSON.stringify(getParams, null, 2));

  try {
    const result = await RNPasskeys.get(getParams);

    console.log("RNPasskeys.get result:", JSON.stringify(result, null, 2));

    if (!result || !result.response?.signature) {
      throw new Error("Failed to sign with passkey - no signature in response");
    }

    // Decode signature and convert from DER to raw format
    const signatureBytes = base64urlDecode(result.response.signature);
    const rawSignature = derToRaw(signatureBytes);

    // Decode authenticatorData and clientDataJSON
    const authenticatorData = result.response.authenticatorData
      ? base64urlDecode(result.response.authenticatorData)
      : new Uint8Array(0);

    const clientDataJSON = result.response.clientDataJSON
      ? base64urlDecode(result.response.clientDataJSON)
      : new Uint8Array(0);

    return {
      signature: rawSignature,
      authenticatorData,
      clientDataJSON,
    };
  } catch (e: any) {
    console.error("signWithPasskeyNative error:", e);
    throw new Error(`Passkey signing failed: ${e?.message || "Unknown error"}`);
  }
}

/**
 * Sign with passkey using web browser WebAuthn
 */
async function signWithPasskeyWeb(
  credentialId: Uint8Array,
  message: Uint8Array
): Promise<SignatureResult> {
  ensureWebEnvironment();

  // Hash the message to 32 bytes for the challenge
  const msgHash = await window.crypto.subtle.digest("SHA-256", message.buffer as ArrayBuffer);

  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array(msgHash),
      rpId: window.location.hostname,
      allowCredentials: [
        {
          id: credentialId.buffer as ArrayBuffer,
          type: "public-key",
        },
      ],
      userVerification: "required",
      timeout: 60000,
    },
  })) as PublicKeyCredential;

  const response = credential.response as AuthenticatorAssertionResponse;

  return {
    signature: derToRaw(new Uint8Array(response.signature)),
    authenticatorData: new Uint8Array(response.authenticatorData),
    clientDataJSON: new Uint8Array(response.clientDataJSON),
  };
}

/**
 * Unified passkey signing API
 * Returns signature along with authenticatorData and clientDataJSON
 */
export async function signWithPasskey(
  credentialId: Uint8Array,
  message: Uint8Array
): Promise<SignatureResult> {
  if (isWeb) {
    return signWithPasskeyWeb(credentialId, message);
  } else {
    return signWithPasskeyNative(credentialId, message);
  }
}

/**
 * Check if passkeys are supported on this platform
 */
export function isPasskeySupported(): boolean {
  if (isWeb) {
    return typeof window !== "undefined" && !!window.crypto && !!navigator.credentials;
  }
  // For native, assume supported - check async with RNPasskeys.isSupported() if needed
  return true;
}

/**
 * Store credential persistently
 * Uses localStorage for web, AsyncStorage for native
 */
export async function storeCredential(cred: StoredCredential): Promise<void> {
  if (isWeb && typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(cred));
  } else if (!isWeb) {
    await AsyncStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(cred));
  } else {
    throw new Error("Storage is not available");
  }
}

/**
 * Get stored credential
 */
export async function getStoredCredential(): Promise<StoredCredential | null> {
  try {
    if (isWeb && typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem(CREDENTIAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } else if (!isWeb) {
      const stored = await AsyncStorage.getItem(CREDENTIAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  } catch (e) {
    console.error("Failed to get stored credential:", e);
    return null;
  }
}

/**
 * Clear stored credential
 */
export async function clearStoredCredential(): Promise<void> {
  if (isWeb && typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
  } else if (!isWeb) {
    await AsyncStorage.removeItem(CREDENTIAL_STORAGE_KEY);
  }
}

/**
 * Get device name based on platform
 */
export function getDeviceName(): string {
  if (isWeb) {
    const ua = navigator.userAgent;
    if (ua.includes("iPhone")) return "iPhone";
    if (ua.includes("iPad")) return "iPad";
    if (ua.includes("Mac")) return "MacBook";
    if (ua.includes("Windows")) return "Windows PC";
    if (ua.includes("Android")) return "Android";
    return "Device";
  }
  // For native
  if (Platform.OS === "ios") return "iPhone";
  if (Platform.OS === "android") return "Android";
  return "Mobile Device";
}

