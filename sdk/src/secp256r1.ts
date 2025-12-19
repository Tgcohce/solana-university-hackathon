import { TransactionInstruction, PublicKey } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";

/**
 * secp256r1 signature verification utilities for Solana
 * 
 * @module secp256r1
 */

/** Solana's secp256r1 signature verification precompile */
export const SECP256R1_PROGRAM_ID = new PublicKey(
  "Secp256r1SigVerify1111111111111111111111111"
);

// secp256r1 curve order N (for signature normalization)
const SECP256R1_N = BigInt(
  "0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551"
);
const SECP256R1_HALF_N = SECP256R1_N / 2n;

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
export function buildSecp256r1Instruction(
  pubkey: Uint8Array,
  authenticatorData: Uint8Array,
  clientDataJSON: Uint8Array,
  signature: Uint8Array
): { instruction: TransactionInstruction; signedData: Uint8Array } {
  // Validate inputs
  if (pubkey.length !== 33) {
    throw new Error(`Invalid pubkey length: ${pubkey.length}, expected 33`);
  }
  if (signature.length !== 64) {
    throw new Error(`Invalid signature length: ${signature.length}, expected 64`);
  }

  // Build the signed data: authenticatorData || SHA256(clientDataJSON)
  const clientDataHash = sha256(clientDataJSON);
  const signedData = new Uint8Array(authenticatorData.length + clientDataHash.length);
  signedData.set(authenticatorData, 0);
  signedData.set(clientDataHash, authenticatorData.length);
  
  // Normalize signature to low-S form (required by Solana)
  const normalizedSig = normalizeSignature(signature);
  
  // Build instruction data per SIMD-0075 format
  const headerSize = 2;
  const offsetsSize = 14; // 7 x u16 = 14 bytes
  const dataStart = headerSize + offsetsSize;
  
  // Data layout: pubkey first, then signature, then message
  const pkOffset = dataStart;
  const sigOffset = pkOffset + 33;
  const msgOffset = sigOffset + 64;
  const totalSize = msgOffset + signedData.length;
  
  const data = new Uint8Array(totalSize);
  const view = new DataView(data.buffer);
  
  // Header
  data[0] = 1;    // num_signatures
  data[1] = 0;    // padding
  
  // Signature offsets struct (14 bytes, all u16 little-endian)
  let offset = 2;
  view.setUint16(offset, sigOffset, true);          // signature_offset
  offset += 2;
  view.setUint16(offset, 0xFFFF, true);             // signature_instruction_index (this instruction)
  offset += 2;
  view.setUint16(offset, pkOffset, true);           // public_key_offset
  offset += 2;
  view.setUint16(offset, 0xFFFF, true);             // public_key_instruction_index (this instruction)
  offset += 2;
  view.setUint16(offset, msgOffset, true);          // message_data_offset
  offset += 2;
  view.setUint16(offset, signedData.length, true);  // message_data_size
  offset += 2;
  view.setUint16(offset, 0xFFFF, true);             // message_instruction_index (this instruction)
  
  // Data section
  data.set(pubkey, pkOffset);
  data.set(normalizedSig, sigOffset);
  data.set(signedData, msgOffset);
  
  return {
    instruction: new TransactionInstruction({
      keys: [],
      programId: SECP256R1_PROGRAM_ID,
      data: Buffer.from(data),
    }),
    signedData,
  };
}

/**
 * Normalize signature to low-S form
 * 
 * Some implementations require S < N/2 to prevent signature malleability.
 * This is required by Solana's secp256r1 precompile.
 * 
 * @param signature - 64-byte raw signature (r || s)
 * @returns Normalized signature with low-S
 */
function normalizeSignature(signature: Uint8Array): Uint8Array {
  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);
  
  // Convert S to BigInt
  let sValue = BigInt(0);
  for (let i = 0; i < 32; i++) {
    sValue = (sValue << 8n) | BigInt(s[i]);
  }
  
  // If S > N/2, compute N - S
  if (sValue > SECP256R1_HALF_N) {
    sValue = SECP256R1_N - sValue;
    
    // Convert back to bytes
    const normalizedS = new Uint8Array(32);
    let temp = sValue;
    for (let i = 31; i >= 0; i--) {
      normalizedS[i] = Number(temp & 0xffn);
      temp = temp >> 8n;
    }
    
    const normalizedSig = new Uint8Array(64);
    normalizedSig.set(r, 0);
    normalizedSig.set(normalizedS, 32);
    return normalizedSig;
  }
  
  return signature;
}

