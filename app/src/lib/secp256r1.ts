import { TransactionInstruction, PublicKey } from '@solana/web3.js';
import { sha256 } from "@noble/hashes/sha256";

export const SECP256R1_PROGRAM_ID = new PublicKey("Secp256r1SigVerify1111111111111111111111111");

// secp256r1 curve order N
const SECP256R1_N = BigInt("0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551");
const SECP256R1_HALF_N = SECP256R1_N / 2n;

/**
 * Normalize signature to low-S form
 * Some implementations require S < N/2 to prevent signature malleability
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

/**
 * Build a proper secp256r1 verification instruction for WebAuthn signatures
 * This instruction must precede the execute instruction in the transaction
 * 
 * WebAuthn signature process:
 * 1. clientDataHash = SHA256(clientDataJSON)
 * 2. signedData = authenticatorData || clientDataHash  
 * 3. signature = sign(SHA256(signedData))
 * 
 * The secp256r1 precompile expects the 32-byte message hash that was signed.
 * So we need to compute: SHA256(authenticatorData || SHA256(clientDataJSON))
 * 
 * Format (per SIMD-0075):
 * Header (2 bytes):
 *   - num_signatures: u8
 *   - padding: u8
 * 
 * Per signature (11 bytes):
 *   - signature_offset: u16 LE
 *   - signature_instruction_index: u8 (0xFF = this instruction)
 *   - public_key_offset: u16 LE
 *   - public_key_instruction_index: u8 (0xFF = this instruction)
 *   - message_offset: u16 LE
 *   - message_size: u16 LE
 *   - message_instruction_index: u8 (0xFF = this instruction)
 * 
 * Data:
 *   - signature: 64 bytes (r || s, each 32 bytes)
 *   - public_key: 33 bytes (compressed secp256r1)
 *   - message: 32 bytes (the hash that was signed)
 */
export function buildSecp256r1Instruction(
  pubkey: Uint8Array,           // 33 bytes compressed public key
  authenticatorData: Uint8Array, // authenticatorData from WebAuthn
  clientDataJSON: Uint8Array,    // clientDataJSON from WebAuthn
  signature: Uint8Array          // 64 bytes raw signature (r || s)
): { instruction: TransactionInstruction; signedData: Uint8Array } {
  // Validate inputs
  if (pubkey.length !== 33) {
    throw new Error(`Invalid pubkey length: ${pubkey.length}, expected 33`);
  }
  if (signature.length !== 64) {
    throw new Error(`Invalid signature length: ${signature.length}, expected 64`);
  }

  // WebAuthn signing process:
  // 1. clientDataHash = SHA256(clientDataJSON)
  // 2. signedData = authenticatorData || clientDataHash
  // 3. The signature is over SHA256(signedData) for ECDSA
  // 
  // The precompile computes SHA256(message) internally and verifies against that.
  // So we pass the raw signedData, and the precompile will hash it.
  const clientDataHash = sha256(clientDataJSON);
  const signedData = new Uint8Array(authenticatorData.length + clientDataHash.length);
  signedData.set(authenticatorData, 0);
  signedData.set(clientDataHash, authenticatorData.length);
  
  // Normalize signature to low-S form (required by some implementations)
  const normalizedSig = normalizeSignature(signature);
  
  // secp256r1 instruction format (per SIMD-0075):
  // Header: 2 bytes
  //   - num_signatures: u8
  //   - padding: u8
  // 
  // Offsets struct (14 bytes per signature - uses u16 for all fields):
  //   - signature_offset: u16
  //   - signature_instruction_index: u16 (0xFFFF = this instruction)
  //   - public_key_offset: u16
  //   - public_key_instruction_index: u16 (0xFFFF = this instruction)
  //   - message_data_offset: u16
  //   - message_data_size: u16
  //   - message_instruction_index: u16 (0xFFFF = this instruction)
  //
  // Data section (following Solana's convention: pubkey first, then signature, then message):
  //   - pubkey: 33 bytes (compressed secp256r1)
  //   - signature: 64 bytes (r || s)
  //   - message: variable length
  
  const headerSize = 2;
  const offsetsSize = 14;  // 7 x u16 = 14 bytes
  const dataStart = headerSize + offsetsSize;
  
  // Data layout: pubkey first, then signature, then message (per Solana test code)
  const pkOffset = dataStart;                    // pubkey at DATA_START
  const sigOffset = pkOffset + 33;               // signature after pubkey
  const msgOffset = sigOffset + 64;              // message after signature
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
  
  // Data section: pubkey first, then signature, then message
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
 * Simple version that takes a pre-computed message hash
 * Use this when you have the raw 32-byte hash that was signed
 * 
 * NOTE: The secp256r1 precompile hashes the message internally with SHA256.
 * So if you already have SHA256(authenticatorData || SHA256(clientDataJSON)),
 * this function should NOT be used - use buildSecp256r1Instruction instead.
 * 
 * This function is for cases where you want the precompile to hash your message.
 */
export function buildSecp256r1InstructionWithHash(
  pubkey: Uint8Array,    // 33 bytes compressed public key
  message: Uint8Array,   // The message to be hashed and verified (NOT the hash itself)
  signature: Uint8Array  // 64 bytes raw signature (r || s)
): TransactionInstruction {
  // Validate inputs
  if (pubkey.length !== 33) {
    throw new Error(`Invalid pubkey length: ${pubkey.length}, expected 33`);
  }
  if (signature.length !== 64) {
    throw new Error(`Invalid signature length: ${signature.length}, expected 64`);
  }
  
  // Normalize signature to low-S form
  const normalizedSig = normalizeSignature(signature);
  
  // secp256r1 instruction format (per SIMD-0075):
  // Header: 2 bytes
  // Offsets struct: 14 bytes (7 x u16)
  // Data: pubkey (33) + signature (64) + message (variable)
  const headerSize = 2;
  const offsetsSize = 14;  // 7 x u16 = 14 bytes
  const dataStart = headerSize + offsetsSize;
  
  // Data layout: pubkey first, then signature, then message
  const pkOffset = dataStart;
  const sigOffset = pkOffset + 33;
  const msgOffset = sigOffset + 64;
  const totalSize = msgOffset + message.length;
  
  const data = new Uint8Array(totalSize);
  const view = new DataView(data.buffer);
  
  // Header
  data[0] = 1;    // num_signatures
  data[1] = 0;    // padding
  
  // Signature offsets struct (14 bytes, all u16 little-endian)
  let offset = 2;
  view.setUint16(offset, sigOffset, true);          // signature_offset
  offset += 2;
  view.setUint16(offset, 0xFFFF, true);             // signature_instruction_index
  offset += 2;
  view.setUint16(offset, pkOffset, true);           // public_key_offset
  offset += 2;
  view.setUint16(offset, 0xFFFF, true);             // public_key_instruction_index
  offset += 2;
  view.setUint16(offset, msgOffset, true);          // message_data_offset
  offset += 2;
  view.setUint16(offset, message.length, true);     // message_data_size
  offset += 2;
  view.setUint16(offset, 0xFFFF, true);             // message_instruction_index
  
  // Data section: pubkey first, then signature, then message
  data.set(pubkey, pkOffset);
  data.set(normalizedSig, sigOffset);
  data.set(message, msgOffset);
  
  return new TransactionInstruction({
    keys: [],
    programId: SECP256R1_PROGRAM_ID,
    data: Buffer.from(data),
  });
}