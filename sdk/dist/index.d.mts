import { PublicKey, Keypair, TransactionInstruction } from '@solana/web3.js';
export { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

/**
 * Passkey credential returned after registration
 */
interface PasskeyCredential {
    /** 33-byte compressed secp256r1 public key */
    publicKey: Uint8Array;
    /** WebAuthn credential ID for future authentication */
    credentialId: Uint8Array;
}
/**
 * Stored credential for persistence (localStorage, etc.)
 */
interface StoredCredential {
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
interface PasskeySignature {
    /** 64-byte raw signature (r || s) */
    signature: Uint8Array;
    /** WebAuthn authenticator data */
    authenticatorData: Uint8Array;
    /** WebAuthn client data JSON */
    clientDataJSON: Uint8Array;
}
/**
 * Send SOL action
 */
interface SendAction {
    type: "send";
    /** Recipient Solana address */
    to: PublicKey;
    /** Amount in lamports (1 SOL = 1,000,000,000 lamports) */
    lamports: number;
}
/**
 * Set multi-sig threshold action
 */
interface SetThresholdAction {
    type: "setThreshold";
    /** Number of signatures required (1-5) */
    threshold: number;
}
/**
 * Union of all supported actions
 */
type Action = SendAction | SetThresholdAction;
/**
 * Signature data for transaction execution
 */
interface SignatureData {
    /** Index of the key in the identity's key array (0-based) */
    keyIndex: number;
    /** 64-byte raw signature (r || s) */
    signature: Uint8Array;
    /** Recovery ID (typically 0 or 1) */
    recoveryId: number;
}
/**
 * Registered key in an identity account
 */
interface RegisteredKey {
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
interface IdentityAccount {
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
/**
 * Response from creating a new identity
 */
interface CreateIdentityResult {
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
interface ExecuteResult {
    /** Transaction signature */
    signature: string;
    /** Updated nonce after execution */
    newNonce: number;
}
/**
 * SDK configuration options
 */
interface KeylessConfig {
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
interface CreatePasskeyOptions {
    /** Username/identifier for the passkey */
    username: string;
    /** Human-readable device name */
    deviceName?: string;
}
/**
 * Options for signing with a passkey
 */
interface SignOptions {
    /** Credential ID to use for signing */
    credentialId: Uint8Array;
    /** Message to sign (will be hashed) */
    message: Uint8Array;
}

/**
 * Keyless SDK Client
 *
 * Main client for interacting with the Keyless program on Solana.
 * Uses Anchor for proper instruction serialization.
 *
 * @example
 * ```typescript
 * import { KeylessClient } from "@keyless/sdk";
 *
 * const client = new KeylessClient({
 *   rpcUrl: "https://api.devnet.solana.com",
 * });
 *
 * // Create a new wallet
 * const result = await client.createIdentity(publicKey, "My Device", adminKeypair);
 * console.log("Vault address:", result.vault.toBase58());
 * ```
 */
declare class KeylessClient {
    private connection;
    private program;
    /**
     * Create a new KeylessClient instance
     *
     * @param config - Configuration options
     */
    constructor(config: KeylessConfig);
    /**
     * Get the program ID
     */
    get programId(): PublicKey;
    /**
     * Derive the identity PDA from a passkey public key
     *
     * The identity PDA is derived using seeds: ["identity", pubkey[1:33]]
     * (excluding the first byte which is the compression prefix)
     *
     * @param pubkey - 33-byte compressed secp256r1 public key
     * @returns The identity PDA address
     */
    getIdentityPDA(pubkey: Uint8Array): PublicKey;
    /**
     * Derive the vault PDA from an identity PDA
     *
     * @param identity - The identity PDA address
     * @returns The vault PDA address
     */
    getVaultPDA(identity: PublicKey): PublicKey;
    /**
     * Fetch identity account data
     *
     * @param identity - The identity PDA address
     * @returns The identity account data or null if not found
     */
    getIdentity(identity: PublicKey): Promise<IdentityAccount | null>;
    /**
     * Get the SOL balance of a vault
     *
     * @param vault - The vault PDA address
     * @returns Balance in lamports
     */
    getVaultBalance(vault: PublicKey): Promise<number>;
    /**
     * Check if an identity exists on-chain
     *
     * @param identity - The identity PDA address
     * @returns true if the identity exists
     */
    identityExists(identity: PublicKey): Promise<boolean>;
    /**
     * Build the message that needs to be signed for an action
     *
     * @param action - The action to execute
     * @param nonce - The current nonce from the identity account
     * @returns The message bytes to sign
     */
    buildMessage(action: Action, nonce: number): Uint8Array;
    /**
     * Create a new identity on-chain
     *
     * This creates the identity PDA and vault PDA for a new passkey.
     * The payer (admin wallet) pays for account rent.
     *
     * @param pubkey - 33-byte compressed secp256r1 public key from passkey
     * @param deviceName - Human-readable device name
     * @param payer - Keypair to pay for transaction (admin wallet)
     * @returns The created identity details
     */
    createIdentity(pubkey: Uint8Array, deviceName: string, payer: Keypair): Promise<CreateIdentityResult>;
    /**
     * Execute a transaction (send SOL or change threshold)
     *
     * This builds and sends a transaction that:
     * 1. Verifies the secp256r1 signature via the precompile
     * 2. Executes the action on the identity account
     *
     * @param identity - The identity PDA address
     * @param action - The action to execute
     * @param pubkey - 33-byte public key that signed
     * @param signature - Passkey signature result
     * @param payer - Keypair to pay for transaction
     * @returns The transaction result
     */
    execute(identity: PublicKey, action: Action, pubkey: Uint8Array, signature: PasskeySignature, payer: Keypair): Promise<ExecuteResult>;
    private confirmTransaction;
}

/**
 * WebAuthn/Passkey utilities for Keyless SDK
 *
 * @module passkey
 */
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
declare function createPasskey(username: string, rpName?: string, rpId?: string): Promise<PasskeyCredential>;
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
declare function signWithPasskey(credentialId: Uint8Array, message: Uint8Array, rpId?: string): Promise<PasskeySignature>;
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
declare function storeCredential(credential: StoredCredential): void;
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
declare function getStoredCredential(): StoredCredential | null;
/**
 * Clear stored credential from localStorage
 *
 * @example
 * ```typescript
 * clearStoredCredential();
 * console.log("Wallet disconnected");
 * ```
 */
declare function clearStoredCredential(): void;
/**
 * Check if a credential is stored
 *
 * @returns true if a credential exists in storage
 */
declare function hasStoredCredential(): boolean;

/**
 * Message building utilities for Keyless SDK
 *
 * These functions create the message format that matches the on-chain program's
 * expected format for signature verification.
 *
 * @module message
 */
/**
 * Build a message for signing that matches the on-chain program's format
 *
 * The message format is: action.try_to_vec() + nonce.to_le_bytes()
 * This is exactly what the Rust program expects for signature verification.
 *
 * @param action - The action to execute (send or setThreshold)
 * @param nonce - The current nonce from the identity account
 * @returns The serialized message ready for signing
 *
 * @example
 * ```typescript
 * // Build message for sending SOL
 * const message = buildMessage(
 *   { type: "send", to: recipientPubkey, lamports: 100000000 },
 *   currentNonce
 * );
 *
 * // Sign with passkey
 * const sig = await signWithPasskey(credentialId, message);
 * ```
 */
declare function buildMessage(action: Action, nonce: number): Uint8Array;
/**
 * Helper to convert SOL to lamports
 *
 * @param sol - Amount in SOL
 * @returns Amount in lamports
 *
 * @example
 * ```typescript
 * const lamports = solToLamports(1.5); // 1500000000
 * ```
 */
declare function solToLamports(sol: number): number;
/**
 * Helper to convert lamports to SOL
 *
 * @param lamports - Amount in lamports
 * @returns Amount in SOL
 *
 * @example
 * ```typescript
 * const sol = lamportsToSol(1500000000); // 1.5
 * ```
 */
declare function lamportsToSol(lamports: number): number;

/**
 * secp256r1 signature verification utilities for Solana
 *
 * @module secp256r1
 */
/** Solana's secp256r1 signature verification precompile */
declare const SECP256R1_PROGRAM_ID: PublicKey;
/**
 * Build a secp256r1 signature verification instruction for WebAuthn signatures
 *
 * This instruction must be included in the transaction BEFORE the execute instruction.
 * It tells Solana's secp256r1 precompile to verify the signature.
 *
 * WebAuthn signature process:
 * 1. clientDataHash = SHA256(clientDataJSON)
 * 2. signedData = authenticatorData || clientDataHash
 * 3. signature = ECDSA_sign(SHA256(signedData))
 *
 * @param pubkey - 33-byte compressed secp256r1 public key
 * @param authenticatorData - WebAuthn authenticator data
 * @param clientDataJSON - WebAuthn client data JSON
 * @param signature - 64-byte raw signature (r || s)
 * @returns The verification instruction and the signed data
 *
 * @example
 * ```typescript
 * const { instruction, signedData } = buildSecp256r1Instruction(
 *   publicKey,
 *   sig.authenticatorData,
 *   sig.clientDataJSON,
 *   sig.signature
 * );
 * transaction.add(instruction);
 * ```
 */
declare function buildSecp256r1Instruction(pubkey: Uint8Array, authenticatorData: Uint8Array, clientDataJSON: Uint8Array, signature: Uint8Array): {
    instruction: TransactionInstruction;
    signedData: Uint8Array;
};

export { type Action, type CreateIdentityResult, type CreatePasskeyOptions, type ExecuteResult, type IdentityAccount, KeylessClient, type KeylessConfig, type PasskeyCredential, type PasskeySignature, type RegisteredKey, SECP256R1_PROGRAM_ID, type SendAction, type SetThresholdAction, type SignOptions, type SignatureData, type StoredCredential, buildMessage, buildSecp256r1Instruction, clearStoredCredential, createPasskey, getStoredCredential, hasStoredCredential, lamportsToSol, signWithPasskey, solToLamports, storeCredential };
