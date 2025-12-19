import { PublicKey } from "@solana/web3.js";
import type { Action } from "./types";

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
export function buildMessage(action: Action, nonce: number): Uint8Array {
  const data: number[] = [];

  if (action.type === "send") {
    // Send variant = 0
    data.push(0);
    // to: Pubkey (32 bytes)
    data.push(...action.to.toBytes());
    // lamports: u64 (8 bytes, little-endian)
    const lamportBytes = new ArrayBuffer(8);
    new DataView(lamportBytes).setBigUint64(0, BigInt(action.lamports), true);
    data.push(...new Uint8Array(lamportBytes));
  } else {
    // SetThreshold variant = 1
    data.push(1);
    // threshold: u8 (1 byte)
    data.push(action.threshold);
  }

  // Append nonce (u64, little-endian)
  const nonceBytes = new ArrayBuffer(8);
  new DataView(nonceBytes).setBigUint64(0, BigInt(nonce), true);
  data.push(...new Uint8Array(nonceBytes));

  return new Uint8Array(data);
}

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
export function solToLamports(sol: number): number {
  return Math.floor(sol * 1_000_000_000);
}

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
export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

