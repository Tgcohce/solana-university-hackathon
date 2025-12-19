/**
 * # Keyless SDK
 * 
 * Biometric wallet infrastructure for Solana using passkeys (WebAuthn) and secp256r1.
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { KeylessClient, createPasskey, signWithPasskey, storeCredential } from "@keyless/sdk";
 * 
 * // Initialize the client
 * const client = new KeylessClient({
 *   rpcUrl: "https://api.devnet.solana.com",
 * });
 * 
 * // Create a new passkey (triggers biometric)
 * const credential = await createPasskey("user@example.com");
 * 
 * // Create on-chain identity
 * const result = await client.createIdentity(
 *   credential.publicKey,
 *   "My Device",
 *   adminKeypair
 * );
 * 
 * // Store for future use
 * storeCredential({
 *   credentialId: Array.from(credential.credentialId),
 *   publicKey: Array.from(credential.publicKey),
 *   identity: result.identity.toBase58(),
 *   vault: result.vault.toBase58(),
 * });
 * 
 * // Send SOL (triggers biometric)
 * const action = { type: "send", to: recipientPubkey, lamports: 100000000 };
 * const message = client.buildMessage(action, nonce);
 * const sig = await signWithPasskey(credential.credentialId, message);
 * 
 * await client.execute(result.identity, action, credential.publicKey, sig, adminKeypair);
 * ```
 * 
 * @packageDocumentation
 */

// Main client
export { KeylessClient } from "./client";

// Passkey utilities
export {
  createPasskey,
  signWithPasskey,
  storeCredential,
  getStoredCredential,
  clearStoredCredential,
  hasStoredCredential,
} from "./passkey";

// Message building
export { buildMessage, solToLamports, lamportsToSol } from "./message";

// secp256r1 utilities
export { buildSecp256r1Instruction, SECP256R1_PROGRAM_ID } from "./secp256r1";

// Types
export type {
  // Core types
  PasskeyCredential,
  StoredCredential,
  PasskeySignature,
  
  // Actions
  Action,
  SendAction,
  SetThresholdAction,
  
  // Signatures
  SignatureData,
  
  // Accounts
  RegisteredKey,
  IdentityAccount,
  
  // Results
  CreateIdentityResult,
  ExecuteResult,
  
  // Config
  KeylessConfig,
  CreatePasskeyOptions,
  SignOptions,
} from "./types";

// Re-export useful Solana types for convenience
export { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

