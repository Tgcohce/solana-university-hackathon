import * as Application from "expo-application";
import { Platform } from 'react-native';
import * as RNPasskeys from 'react-native-passkeys';

export interface PasskeyCredential {
  publicKey: Uint8Array;
  credentialId: Uint8Array;
  debug?: {
    challenge: string;
    userId: string;
    challengeLength: number;
    userIdLength: number;
  };
}

export interface StoredCredential {
  credentialId: number[];
  publicKey: number[];
  owner: string;
}

// Platform detection
const isWeb = Platform.OS === 'web';

// Helper: Convert Uint8Array to base64url (React Native compatible)
function base64urlEncode(bytes: Uint8Array): string {
  const base64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  
  // Process 3 bytes at a time
  while (i < bytes.length) {
    const byte1 = bytes[i++];
    const byte2 = i < bytes.length ? bytes[i++] : 0;
    const byte3 = i < bytes.length ? bytes[i++] : 0;
    
    const encoded1 = byte1 >> 2;
    const encoded2 = ((byte1 & 3) << 4) | (byte2 >> 4);
    const encoded3 = ((byte2 & 15) << 2) | (byte3 >> 6);
    const encoded4 = byte3 & 63;
    
    result += base64chars[encoded1];
    result += base64chars[encoded2];
    result += i - 2 < bytes.length ? base64chars[encoded3] : '';
    result += i - 1 < bytes.length ? base64chars[encoded4] : '';
  }
  
  // Convert to base64url (URL-safe)
  return result.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Helper: Convert ArrayBuffer to base64url (Safe team's proven approach)
function bufferToBase64URLString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  
  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }
  
  const base64String = btoa(str);
  
  return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function utf8StringToBuffer(value: string): ArrayBuffer {
	return new TextEncoder().encode(value).buffer;
}

// Web-specific helper
function ensureWebEnvironment() {
  if (!isWeb) {
    throw new Error('This function is web-only');
  }
  if (typeof window === 'undefined') {
    throw new Error('Window is not available');
  }
  if (!window.crypto || !window.crypto.getRandomValues) {
    throw new Error('Web Crypto API is not available');
  }
  if (!navigator.credentials) {
    throw new Error('WebAuthn is not supported in this browser');
  }
}

async function createPasskeyNative(username: string): Promise<PasskeyCredential> {
    const bundleId = Application.applicationId?.split(".").reverse().join(".");

    // the example app is running on the web.app domain but the bundleId is com.web.react-native-passkeys
    // so we need to replace the last part of the bundleId with the domain
    const hostname = bundleId?.replaceAll("web.com", "web.app")?.replaceAll("_", "-");
    console.log("hostname", hostname);

    const rp = {
        // id: Platform.select({
        //     web: undefined,
        //     ios: hostname,
        //     android: hostname,
        // }),
        id: "solana-university-hackathon.vercel.app",
        name: "ReactNativePasskeys",
    } satisfies PublicKeyCredentialRpEntity;

    // Don't do this in production!
    const challenge = bufferToBase64URLString(utf8StringToBuffer("fizz"));

    const user = {
        id: bufferToBase64URLString(utf8StringToBuffer("290283490")),
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
        // Remove extensions for now to simplify debugging
        // extensions: {
        //     ...(Platform.OS !== "android" && { largeBlob: { support: "required" } }),
        //     prf: {},
        // },
    };
    
    console.log("=== PASSKEY CREATE REQUEST ===");
    console.log("Challenge:", challenge);
    console.log("Challenge length:", challenge.length);
    console.log("RP:", JSON.stringify(rp, null, 2));
    console.log("User:", JSON.stringify(user, null, 2));
    console.log("User ID length:", user.id.length);
    console.log("Full request:", JSON.stringify(requestParams, null, 2));
    console.log("================================");

    try {
        const json = await RNPasskeys.create(requestParams);

        console.log("creation json -", json);

        if (!json) {
            throw new Error('Failed to create passkey');
        }
        
        // Extract public key from response
        const publicKeyBase64 = json.response?.publicKey || '';
        const publicKeyBytes = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));

        return {
            publicKey: publicKeyBytes,
            credentialId: Uint8Array.from(atob(json.rawId), c => c.charCodeAt(0)),
            debug: {
            challenge,
            userId: "12345",
            challengeLength: challenge.length,
            userIdLength: 3,
            },
        };
    } catch (e: any) {
        console.error("create error", e);
        
        // Capture full error details for debugging
        const errorDetails = {
            message: e?.message || 'Unknown error',
            name: e?.name || 'Unknown',
            code: e?.code,
            stack: e?.stack,
            raw: JSON.stringify(e, null, 2)
        };
        
        console.error("Full error details:", errorDetails);
        
        throw new Error(
            'Passkey creation failed:\n' +
            `Type: ${errorDetails.name}\n` +
            `Message: ${errorDetails.message}\n` +
            `Code: ${errorDetails.code || 'N/A'}\n` +
            `Raw: ${errorDetails.raw}`
        );
    }
}

// // Native implementation using react-native-passkeys
// async function createPasskeyNative(username: string): Promise<PasskeyCredential> {
//   // Check if passkeys are supported on this device
//   const supported = await RNPasskeys.isSupported();
//   if (!supported) {
//     throw new Error('Passkeys are not supported on this device');
//   }

//   // Generate challenge as base64url (using Safe team's proven approach)
//   // Use a constant challenge string like the Safe example
//   const challengeString = 'passkey-challenge-' + Date.now();
//   const challengeBuffer = new TextEncoder().encode(challengeString);
//   //const challenge = bufferToBase64URLString(challengeBuffer.buffer);
//   const challenge = bufferToBase64URLString(utf8StringToBuffer("fizz"));
  
//   // Generate userId as base64url
//   const userIdString = 'user-' + Date.now();
//   const userIdBuffer = new TextEncoder().encode(userIdString);
//   //const userId = bufferToBase64URLString(userIdBuffer.buffer);
//   const userId = bufferToBase64URLString(utf8StringToBuffer("290283490"));

//   // Generate RP ID from bundle identifier
//   const bundleId = Application.applicationId?.split(".").reverse().join(".");
//   // the example app is running on the web.app domain but the bundleId is com.web.react-native-passkeys
//   // so we need to replace the last part of the bundleId with the domain
//   const hostname = bundleId?.replaceAll("web.com", "web.app")?.replaceAll("_", "-");
//   const rp = {
// 	id: Platform.select({
// 		web: undefined,
// 		ios: hostname,
// 		android: hostname,
// 	}),
// 	name: "ReactNativePasskeys",
//   } satisfies PublicKeyCredentialRpEntity;


//   const result = await RNPasskeys.create({
//     challenge,
//     rp,
//     // rp: {
//     //   // Signature generated through the main website
//     //   id: 'solana-university-hackathon.vercel.app', 
//     //   name: 'Keystore App',
//     // },
//     user: {
//       id: userId,
//       name: username,
//       displayName: username,
//     },
//     pubKeyCredParams: [
//       {
//         type: 'public-key',
//         alg: -7, // ES256 (secp256r1)
//       },
//     ],
//     timeout: 60000,
//     attestation: 'none',
//     authenticatorSelection: {
//       authenticatorAttachment: 'platform',
//       userVerification: 'required',
//     },
//   });

//   if (!result) {
//     throw new Error('Failed to create passkey');
//   }

//   // Extract public key from response
//   const publicKeyBase64 = result.response?.publicKey || '';
//   const publicKeyBytes = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));

//   return {
//     publicKey: publicKeyBytes,
//     credentialId: Uint8Array.from(atob(result.rawId), c => c.charCodeAt(0)),
//     debug: {
//       challenge,
//       userId,
//       challengeLength: challenge.length,
//       userIdLength: userId.length,
//     },
//   };
// }

// Web implementation using browser WebAuthn
async function createPasskeyWeb(username: string): Promise<PasskeyCredential> {
  ensureWebEnvironment();
  
  const challenge = window.crypto.getRandomValues(new Uint8Array(32));
  
  const credential = await navigator.credentials.create({
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
  }) as PublicKeyCredential;
  
  const response = credential.response as AuthenticatorAttestationResponse;
  const publicKey = extractPublicKey(response.getPublicKey()!);
  
  return {
    publicKey,
    credentialId: new Uint8Array(credential.rawId),
  };
}

// Unified API
export async function createPasskey(username: string): Promise<PasskeyCredential> {
  if (isWeb) {
    return createPasskeyWeb(username);
  } else {
    return createPasskeyNative(username);
  }
}

// Native signing
async function signWithPasskeyNative(
  credentialId: Uint8Array,
  message: Uint8Array
): Promise<Uint8Array> {
  // For native, we need to use the challenge directly
  const challengeBase64 = btoa(String.fromCharCode(...message));
  
  const result = await RNPasskeys.get({
    challenge: challengeBase64,
    rpId: 'solana-university-hackathon.vercel.app', // Must match creation
    timeout: 60000,
    userVerification: 'required',
  });

  if (!result || !result.response?.signature) {
    throw new Error('Failed to sign with passkey');
  }

  const signatureBase64 = result.response.signature;
  return Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
}

// Web signing
async function signWithPasskeyWeb(
  credentialId: Uint8Array,
  message: Uint8Array
): Promise<Uint8Array> {
  ensureWebEnvironment();
  
  // Hash the message to 32 bytes for the challenge
  const msgHash = await window.crypto.subtle.digest("SHA-256", message as BufferSource);
  
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array(msgHash) as BufferSource,
      rpId: window.location.hostname,
      allowCredentials: [{
        id: credentialId as BufferSource,
        type: "public-key",
      }],
      userVerification: "required",
      timeout: 60000,
    },
  }) as PublicKeyCredential;
  
  const response = credential.response as AuthenticatorAssertionResponse;
  return derToRaw(new Uint8Array(response.signature));
}

// Unified signing API
export async function signWithPasskey(
  credentialId: Uint8Array,
  message: Uint8Array
): Promise<Uint8Array> {
  if (isWeb) {
    return signWithPasskeyWeb(credentialId, message);
  } else {
    return signWithPasskeyNative(credentialId, message);
  }
}

// Helper functions (web-only)
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

// Export platform check for external use
export function isPasskeySupported(): boolean {
  if (isWeb) {
    return typeof window !== 'undefined' && 
           !!window.crypto && 
           !!navigator.credentials;
  } else {
    // For native, this should be checked asynchronously
    // Use RNPasskeys.isSupported() instead
    return true; // Assume supported, check async in actual implementation
  }
}

// Storage (web-only for now, could use AsyncStorage for native)
export function storeCredential(cred: StoredCredential) {
  if (isWeb && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem("keystore_credential", JSON.stringify(cred));
  } else if (!isWeb) {
    // For native, you'd want to use AsyncStorage or SecureStore
    console.warn('Native storage not implemented yet. Use AsyncStorage or SecureStore.');
    // TODO: Implement native storage
  } else {
    throw new Error('localStorage is not available');
  }
}

export function getStoredCredential(): StoredCredential | null {
  if (isWeb && typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem("keystore_credential");
    return stored ? JSON.parse(stored) : null;
  }
  // For native, retrieve from AsyncStorage
  return null;
}

