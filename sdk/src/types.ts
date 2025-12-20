import { PublicKey } from "@solana/web3.js";

// ============================================================================
// Core Types
// ============================================================================

/**
 * Passkey credential returned after registration
 */
export interface PasskeyCredential {
  /** 33-byte compressed secp256r1 public key */
  publicKey: Uint8Array;
  /** WebAuthn credential ID for future authentication */
  credentialId: Uint8Array;
}

/**
 * Stored credential for persistence (localStorage, etc.)
 */
export interface StoredCredential {
  credentialId: number[];
  publicKey: number[];
  /** Identity PDA address (base58) */
  identity: string;
  /** Vault PDA address (base58) */
  vault: string;
}

/**
 * Passkey signature result from WebAuthn assertion
 */
export interface PasskeySignature {
  /** 64-byte raw signature (r || s) */
  signature: Uint8Array;
  /** WebAuthn authenticator data */
  authenticatorData: Uint8Array;
  /** WebAuthn client data JSON */
  clientDataJSON: Uint8Array;
}

// ============================================================================
// Action Types
// ============================================================================

/**
 * Send SOL action
 */
export interface SendAction {
  type: "send";
  /** Recipient Solana address */
  to: PublicKey;
  /** Amount in lamports (1 SOL = 1,000,000,000 lamports) */
  lamports: number;
}

/**
 * Set multi-sig threshold action
 */
export interface SetThresholdAction {
  type: "setThreshold";
  /** Number of signatures required (1-5) */
  threshold: number;
}

/**
 * Union of all supported actions
 */
export type Action = SendAction | SetThresholdAction;

// ============================================================================
// Signature Types
// ============================================================================

/**
 * Signature data for transaction execution
 */
export interface SignatureData {
  /** Index of the key in the identity's key array (0-based) */
  keyIndex: number;
  /** 64-byte raw signature (r || s) */
  signature: Uint8Array;
  /** Recovery ID (typically 0 or 1) */
  recoveryId: number;
}

// ============================================================================
// Account Types
// ============================================================================

/**
 * Registered key in an identity account
 */
export interface RegisteredKey {
  /** 33-byte compressed secp256r1 public key */
  pubkey: Uint8Array;
  /** Human-readable device name */
  name: string;
  /** Unix timestamp when key was added */
  addedAt: number;
}

/**
 * Identity account data
 */
export interface IdentityAccount {
  /** PDA bump seed */
  bump: number;
  /** Vault PDA bump seed */
  vaultBump: number;
  /** Number of signatures required for transactions */
  threshold: number;
  /** Replay protection nonce */
  nonce: number;
  /** Array of registered keys (max 5) */
  keys: RegisteredKey[];
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response from creating a new identity
 */
export interface CreateIdentityResult {
  /** Transaction signature */
  signature: string;
  /** Identity PDA address */
  identity: PublicKey;
  /** Vault PDA address (where SOL is stored) */
  vault: PublicKey;
  /** The passkey public key that was registered */
  publicKey: Uint8Array;
}

/**
 * Response from executing a transaction
 */
export interface ExecuteResult {
  /** Transaction signature */
  signature: string;
  /** Updated nonce after execution */
  newNonce: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * SDK configuration options
 */
export interface KeylessConfig {
  /** Solana RPC endpoint URL */
  rpcUrl: string;
  /** Program ID (defaults to deployed Keyless program) */
  programId?: string;
  /** Custom Anchor IDL (optional, uses built-in IDL by default) */
  idl?: any;
  /** Relying party name for WebAuthn */
  rpName?: string;
  /** Relying party ID (defaults to window.location.hostname) */
  rpId?: string;
}

/**
 * Options for creating a passkey
 */
export interface CreatePasskeyOptions {
  /** Username/identifier for the passkey */
  username: string;
  /** Human-readable device name */
  deviceName?: string;
}

/**
 * Options for signing with a passkey
 */
export interface SignOptions {
  /** Credential ID to use for signing */
  credentialId: Uint8Array;
  /** Message to sign (will be hashed) */
  message: Uint8Array;
}

