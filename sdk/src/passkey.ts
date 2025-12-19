import type { PasskeyCredential, PasskeySignature, StoredCredential } from "./types";

/**
 * WebAuthn/Passkey utilities for Keyless SDK
 * 
 * @module passkey
 */

// ============================================================================
// Passkey Creation
// ============================================================================

/**
 * Create a new passkey using WebAuthn
 * 
 * This registers a new credential with the device's secure enclave (TouchID, FaceID, etc.)
 * and returns the secp256r1 public key that can be used to create an on-chain identity.
 * 
 * @param username - Unique identifier for the user (used by WebAuthn)
 * @param rpName - Relying party name (displayed to user)
 * @param rpId - Relying party ID (defaults to current hostname)
 * @returns The passkey credential containing public key and credential ID
 * 
 * @example
 * ```typescript
 * const credential = await createPasskey("user@example.com", "My App");
 * console.log("Public key:", credential.publicKey);
 * console.log("Credential ID:", credential.credentialId);
 * ```
 */
export async function createPasskey(
  username: string,
  rpName: string = "Keyless",
  rpId?: string
): Promise<PasskeyCredential> {
  // Generate random challenge
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: rpName,
        id: rpId || window.location.hostname,
      },
      user: {
        id: new TextEncoder().encode(username),
        name: username,
        displayName: username,
      },
      // ES256 = ECDSA with P-256 (secp256r1)
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

// ============================================================================
// Passkey Signing
// ============================================================================

/**
 * Sign a message using a passkey
 * 
 * This triggers biometric authentication (TouchID, FaceID, etc.) and returns
 * the signature along with WebAuthn authenticator data needed for on-chain verification.
 * 
 * @param credentialId - The credential ID from passkey creation
 * @param message - The message to sign (will be SHA-256 hashed for the challenge)
 * @param rpId - Relying party ID (must match creation)
 * @returns The signature and WebAuthn data
 * 
 * @example
 * ```typescript
 * const message = keyless.buildMessage({ type: "send", to, lamports }, nonce);
 * const sig = await signWithPasskey(credentialId, message);
 * ```
 */
export async function signWithPasskey(
  credentialId: Uint8Array,
  message: Uint8Array,
  rpId?: string
): Promise<PasskeySignature> {
  // Copy to new ArrayBuffer to avoid SharedArrayBuffer issues
  const messageBuffer = new ArrayBuffer(message.length);
  new Uint8Array(messageBuffer).set(message);
  
  const credIdBuffer = new ArrayBuffer(credentialId.length);
  new Uint8Array(credIdBuffer).set(credentialId);
  
  // Hash the message to 32 bytes for the challenge
  const msgHash = await crypto.subtle.digest("SHA-256", messageBuffer);
  
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array(msgHash),
      rpId: rpId || window.location.hostname,
      allowCredentials: [{
        id: credIdBuffer,
        type: "public-key",
      }],
      userVerification: "required",
      timeout: 60000,
    },
  }) as PublicKeyCredential;
  
  const response = credential.response as AuthenticatorAssertionResponse;
  
  return {
    signature: derToRaw(new Uint8Array(response.signature)),
    authenticatorData: new Uint8Array(response.authenticatorData),
    clientDataJSON: new Uint8Array(response.clientDataJSON),
  };
}

// ============================================================================
// Credential Storage
// ============================================================================

const STORAGE_KEY = "keyless_credential";

/**
 * Store a credential in localStorage
 * 
 * @param credential - The credential to store
 * 
 * @example
 * ```typescript
 * storeCredential({
 *   credentialId: Array.from(cred.credentialId),
 *   publicKey: Array.from(cred.publicKey),
 *   identity: identityPDA.toBase58(),
 *   vault: vaultPDA.toBase58(),
 * });
 * ```
 */
export function storeCredential(credential: StoredCredential): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credential));
}

/**
 * Retrieve stored credential from localStorage
 * 
 * @returns The stored credential or null if not found
 * 
 * @example
 * ```typescript
 * const stored = getStoredCredential();
 * if (stored) {
 *   console.log("Found existing wallet:", stored.identity);
 * }
 * ```
 */
export function getStoredCredential(): StoredCredential | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}

/**
 * Clear stored credential from localStorage
 * 
 * @example
 * ```typescript
 * clearStoredCredential();
 * console.log("Wallet disconnected");
 * ```
 */
export function clearStoredCredential(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if a credential is stored
 * 
 * @returns true if a credential exists in storage
 */
export function hasStoredCredential(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

// ============================================================================
// Internal Utilities
// ============================================================================

/**
 * Extract and compress the public key from SPKI format
 * WebAuthn returns SPKI format, we need compressed secp256r1 (33 bytes)
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
 * Convert DER-encoded signature to raw r||s format
 * WebAuthn returns DER format, Solana needs raw 64-byte format
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

