use anchor_lang::prelude::*;
use crate::error::KeystoreError;

// secp256r1 precompile program ID
pub const SECP256R1_PROGRAM_ID: Pubkey = pubkey!("Secp256r1SigVerify1111111111111111111111111");

/// secp256r1 instruction data format (SIMD-0075):
/// 
/// Header (2 bytes):
///   - u8: number of signatures (we expect 1)
///   - u8: padding
///
/// Per-signature offsets (14 bytes - all u16):
///   - u16: signature_offset
///   - u16: signature_instruction_index (0xFFFF = current instruction)
///   - u16: public_key_offset  
///   - u16: public_key_instruction_index (0xFFFF = current instruction)
///   - u16: message_data_offset
///   - u16: message_data_size
///   - u16: message_instruction_index (0xFFFF = current instruction)
///
/// Data section (following header + offsets):
///   - pubkey: 33 bytes (compressed secp256r1)
///   - signature: 64 bytes (r || s)
///   - message: variable length

#[derive(Debug)]
pub struct Secp256r1InstructionData {
    pub num_signatures: u8,
    pub signature_offset: u16,
    pub signature_ix_index: u16,
    pub pubkey_offset: u16,
    pub pubkey_ix_index: u16,
    pub message_offset: u16,
    pub message_size: u16,
    pub message_ix_index: u16,
}

impl Secp256r1InstructionData {
    /// Parse secp256r1 instruction data
    /// 
    /// Format: 2-byte header + 14-byte offsets struct
    /// Header: [num_signatures: u8, padding: u8]
    /// Offsets: 7 x u16 = 14 bytes
    pub fn try_from_slice(data: &[u8]) -> Result<Self> {
        msg!("Parsing secp256r1 instruction, data len: {}", data.len());
        
        // Log first 20 bytes for debugging
        if data.len() >= 16 {
            msg!("First 16 bytes: {:02x} {:02x} {:02x} {:02x} {:02x} {:02x} {:02x} {:02x} {:02x} {:02x} {:02x} {:02x} {:02x} {:02x} {:02x} {:02x}",
                data[0], data[1], data[2], data[3], data[4], data[5], data[6], data[7],
                data[8], data[9], data[10], data[11], data[12], data[13], data[14], data[15]);
        }
        
        // Minimum size: 2 (header) + 14 (offsets) = 16 bytes
        if data.len() < 16 {
            msg!("Data too short: {} < 16", data.len());
            return Err(KeystoreError::InvalidSecp256r1Instruction.into());
        }
        
        let num_signatures = data[0];
        msg!("num_signatures: {}", num_signatures);
        if num_signatures != 1 {
            msg!("Expected 1 signature, got {}", num_signatures);
            return Err(KeystoreError::InvalidSecp256r1Instruction.into());
        }
        
        // Parse offsets (all u16, little-endian)
        // Offset 0: num_signatures (u8)
        // Offset 1: padding (u8)
        // Offset 2-3: signature_offset
        // Offset 4-5: signature_instruction_index
        // Offset 6-7: public_key_offset
        // Offset 8-9: public_key_instruction_index
        // Offset 10-11: message_data_offset
        // Offset 12-13: message_data_size
        // Offset 14-15: message_instruction_index
        
        let sig_offset = u16::from_le_bytes([data[2], data[3]]);
        let sig_ix = u16::from_le_bytes([data[4], data[5]]);
        let pk_offset = u16::from_le_bytes([data[6], data[7]]);
        let pk_ix = u16::from_le_bytes([data[8], data[9]]);
        let msg_offset = u16::from_le_bytes([data[10], data[11]]);
        let msg_size = u16::from_le_bytes([data[12], data[13]]);
        let msg_ix = u16::from_le_bytes([data[14], data[15]]);
        
        msg!("Parsed offsets: sig_offset={}, sig_ix={:#06x}, pk_offset={}, pk_ix={:#06x}, msg_offset={}, msg_size={}, msg_ix={:#06x}",
            sig_offset, sig_ix, pk_offset, pk_ix, msg_offset, msg_size, msg_ix);
        
        Ok(Self {
            num_signatures,
            signature_offset: sig_offset,
            signature_ix_index: sig_ix,
            pubkey_offset: pk_offset,
            pubkey_ix_index: pk_ix,
            message_offset: msg_offset,
            message_size: msg_size,
            message_ix_index: msg_ix,
        })
    }
    
    /// Extract signature from instruction data or referenced instruction
    pub fn extract_signature<'a>(
        &self,
        instruction_data: &'a [u8],
        instructions_sysvar: &AccountInfo,
    ) -> Result<&'a [u8]> {
        msg!("Extracting signature: ix_index={:#06x} (expected 0xFFFF), offset={}", 
            self.signature_ix_index, self.signature_offset);
        if self.signature_ix_index == 0xFFFF {
            // Signature is in current instruction
            let start = self.signature_offset as usize;
            let end = start + 64;
            require!(
                instruction_data.len() >= end,
                KeystoreError::InvalidSecp256r1Instruction
            );
            msg!("Signature extracted from offset {}", start);
            Ok(&instruction_data[start..end])
        } else {
            // Signature is in another instruction (not implemented for simplicity)
            msg!("Cross-instruction signature references not yet supported");
            Err(KeystoreError::InvalidSecp256r1Instruction.into())
        }
    }
    
    /// Extract public key from instruction data or referenced instruction
    pub fn extract_pubkey<'a>(
        &self,
        instruction_data: &'a [u8],
        instructions_sysvar: &AccountInfo,
    ) -> Result<&'a [u8]> {
        msg!("Extracting pubkey: ix_index={:#06x} (expected 0xFFFF), offset={}", 
            self.pubkey_ix_index, self.pubkey_offset);
        if self.pubkey_ix_index == 0xFFFF {
            // Pubkey is in current instruction
            let start = self.pubkey_offset as usize;
            let end = start + 33; // Compressed secp256r1 key
            require!(
                instruction_data.len() >= end,
                KeystoreError::InvalidSecp256r1Instruction
            );
            msg!("Pubkey extracted from offset {}", start);
            Ok(&instruction_data[start..end])
        } else {
            // Pubkey is in another instruction (not implemented for simplicity)
            msg!("Cross-instruction pubkey references not yet supported");
            Err(KeystoreError::InvalidSecp256r1Instruction.into())
        }
    }
    
    /// Extract message from instruction data or referenced instruction
    pub fn extract_message<'a>(
        &self,
        instruction_data: &'a [u8],
        instructions_sysvar: &AccountInfo,
    ) -> Result<&'a [u8]> {
        msg!("Extracting message: ix_index={:#06x} (expected 0xFFFF), offset={}, size={}", 
            self.message_ix_index, self.message_offset, self.message_size);
        if self.message_ix_index == 0xFFFF {
            // Message is in current instruction
            let start = self.message_offset as usize;
            let end = start + self.message_size as usize;
            require!(
                instruction_data.len() >= end,
                KeystoreError::InvalidSecp256r1Instruction
            );
            msg!("Message extracted from offset {}, size {}", start, self.message_size);
            Ok(&instruction_data[start..end])
        } else {
            // Message is in another instruction (not implemented for simplicity)
            msg!("Cross-instruction message references not yet supported");
            Err(KeystoreError::InvalidSecp256r1Instruction.into())
        }
    }
}

/// Verify a secp256r1 signature using the precompile
/// 
/// This function:
/// 1. Finds the secp256r1 instruction in the transaction
/// 2. Parses its data to extract pubkey, signature, and message
/// 3. Verifies they match what we expect
/// 4. Trusts that the precompile verified the signature (it fails tx if invalid)
pub fn verify_secp256r1_signature(
    instructions_sysvar: &AccountInfo,
    expected_pubkey: &[u8; 33],
    expected_message: &[u8],
    expected_signature: &[u8; 64],
) -> Result<()> {
    msg!("Verifying secp256r1 signature via precompile");
    use anchor_lang::solana_program::sysvar::instructions as ix_sysvar;
    
    // Load current instruction index
    msg!("Loading current instruction index");
    let current_idx = ix_sysvar::load_current_index_checked(instructions_sysvar)
        .map_err(|_| KeystoreError::InvalidSecp256r1Instruction)?;
    msg!("Current instruction index: {}", current_idx);

    // Look backwards for secp256r1 instruction
    let mut found_valid = false;
    
    for i in (0..current_idx).rev() {
        msg!("Checking instruction at index {}", i);
        let ix = ix_sysvar::load_instruction_at_checked(i as usize, instructions_sysvar)
            .map_err(|_| KeystoreError::InvalidSecp256r1Instruction)?;
        msg!("instruction loaded, checking");
        
        // Check if this is a secp256r1 instruction
        if ix.program_id != SECP256R1_PROGRAM_ID {
            continue;
        }
        
        // Check instruction has sufficient data (2-byte header + 14-byte offsets = 16 minimum)
        if ix.data.len() < 16 {
            msg!("secp256r1 instruction data too short: {} bytes", ix.data.len());
            continue;
        }
        
        // Parse instruction data
        msg!("Parsing secp256r1 instruction data");
        match Secp256r1InstructionData::try_from_slice(&ix.data) {
            Ok(parsed) => {
                // Extract components
                if let (Ok(sig), Ok(pk), Ok(msg_data)) = (
                    parsed.extract_signature(&ix.data, instructions_sysvar),
                    parsed.extract_pubkey(&ix.data, instructions_sysvar),
                    parsed.extract_message(&ix.data, instructions_sysvar),
                ) {
                    // Debug: Log first few bytes
                    msg!("Extracted signature length: {}, pubkey length: {}, message length: {}", sig.len(), pk.len(), msg_data.len());
                    msg!("extracted_signature: {:?}", sig);
                    msg!("expected_signature: {:?}", expected_signature);
                    msg!("extracted_pubkey: {:?}", pk);
                    msg!("expected_pubkey: {:?}", expected_pubkey);
                    msg!("extracted_message: {:?}", msg_data);
                    msg!("expected_message: {:?}", expected_message);
                    
                    // Verify public key matches
                    if pk.len() != 33 || pk != expected_pubkey.as_slice() {
                        msg!("Public key mismatch");
                        continue;
                    }
                    
                    // Verify signature matches
                    if sig.len() != 64 || sig != expected_signature.as_slice() {
                        msg!("Signature mismatch");
                        continue;
                    }
                    
                    // Verify message matches
                    if msg_data != expected_message {
                        msg!("Message mismatch");
                        continue;
                    }
                    
                    // All checks passed - the precompile verified the crypto
                    msg!("Found valid matching secp256r1 instruction");
                    found_valid = true;
                    break;
                }
                else {
                    msg!("Failed to extract secp256r1 components");
                    continue;
                }
            }
            Err(e) => {
                msg!("Failed to parse secp256r1 instruction: {:?}", e);
                continue;
            }
        }
    }
    
    if !found_valid {
        return Err(KeystoreError::SignatureVerificationFailed.into());
    }
    
    Ok(())
}

/// Build a secp256r1 verification instruction
/// 
/// This is a helper for clients to build the verification instruction
/// that must precede the execute instruction.
pub fn build_secp256r1_instruction(
    pubkey: &[u8; 33],
    message: &[u8],
    signature: &[u8; 64],
) -> anchor_lang::solana_program::instruction::Instruction {
    // Build instruction data
    // Format: [num_sigs, sig_offset, sig_ix, pk_offset, pk_ix, msg_offset, msg_size, msg_ix, data...]
    
    let mut data = Vec::with_capacity(13 + 33 + 64 + message.len());
    
    // Header
    data.push(1); // num_signatures = 1
    data.extend_from_slice(&(13u16).to_le_bytes()); // signature_offset = after header
    data.push(0xFF); // signature_ix_index = current instruction
    data.extend_from_slice(&(77u16).to_le_bytes()); // pubkey_offset = after sig
    data.push(0xFF); // pubkey_ix_index = current instruction
    data.extend_from_slice(&(110u16).to_le_bytes()); // message_offset = after pk
    data.extend_from_slice(&(message.len() as u16).to_le_bytes()); // message_size
    data.push(0xFF); // message_ix_index = current instruction
    
    // Actual data
    data.extend_from_slice(signature);
    data.extend_from_slice(pubkey);
    data.extend_from_slice(message);
    
    anchor_lang::solana_program::instruction::Instruction {
        program_id: SECP256R1_PROGRAM_ID,
        accounts: vec![],
        data,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_instruction_data() {
        let data = vec![
            1, // num_sigs
            13, 0, // sig_offset
            0xFF, // sig_ix
            77, 0, // pk_offset
            0xFF, // pk_ix
            110, 0, // msg_offset
            32, 0, // msg_size
            0xFF, // msg_ix
        ];
        
        let parsed = Secp256r1InstructionData::try_from_slice(&data).unwrap();
        assert_eq!(parsed.num_signatures, 1);
        assert_eq!(parsed.signature_offset, 13);
        assert_eq!(parsed.message_size, 32);
    }
}

