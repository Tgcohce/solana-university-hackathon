use anchor_lang::prelude::*;
use crate::error::KeystoreError;

// secp256r1 precompile program ID
pub const SECP256R1_PROGRAM_ID: Pubkey = pubkey!("Secp256r1SigVerify1111111111111111111111111");

/// secp256r1 instruction data format:
/// The instruction data contains offsets to signature, pubkey, and message
/// that are included in the instruction data or other instructions.
///
/// Format (simplified):
/// - u8: number of signatures (we expect 1)
/// - u16: signature offset
/// - u8: signature instruction index (0xFF = current instruction)
/// - u16: public key offset  
/// - u8: public key instruction index
/// - u16: message data offset
/// - u16: message data size
/// - u8: message instruction index
/// - u8: recovery_id (for secp256r1, typically 0 or 1)

#[derive(Debug)]
pub struct Secp256r1InstructionData {
    pub num_signatures: u8,
    pub signature_offset: u16,
    pub signature_ix_index: u8,
    pub pubkey_offset: u16,
    pub pubkey_ix_index: u8,
    pub message_offset: u16,
    pub message_size: u16,
    pub message_ix_index: u8,
}

impl Secp256r1InstructionData {
    /// Parse secp256r1 instruction data
    /// 
    /// Note: This is a simplified parser. The actual format may vary.
    /// For production, consult the official Solana secp256r1 documentation.
    pub fn try_from_slice(data: &[u8]) -> Result<Self> {
        if data.len() < 13 {
            return Err(KeystoreError::InvalidSecp256r1Instruction.into());
        }
        
        let num_signatures = data[0];
        if num_signatures != 1 {
            return Err(KeystoreError::InvalidSecp256r1Instruction.into());
        }
        
        Ok(Self {
            num_signatures,
            signature_offset: u16::from_le_bytes([data[1], data[2]]),
            signature_ix_index: data[3],
            pubkey_offset: u16::from_le_bytes([data[4], data[5]]),
            pubkey_ix_index: data[6],
            message_offset: u16::from_le_bytes([data[7], data[8]]),
            message_size: u16::from_le_bytes([data[9], data[10]]),
            message_ix_index: data[11],
        })
    }
    
    /// Extract signature from instruction data or referenced instruction
    pub fn extract_signature<'a>(
        &self,
        instruction_data: &'a [u8],
        instructions_sysvar: &AccountInfo,
    ) -> Result<&'a [u8]> {
        msg!("Extracting signature from secp256r1 instruction");
        if self.signature_ix_index == 0xFF {
            // Signature is in current instruction
            let start = self.signature_offset as usize;
            let end = start + 64;
            require!(
                instruction_data.len() >= end,
                KeystoreError::InvalidSecp256r1Instruction
            );
            msg!("Signature extracted");
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
        msg!("Extracting pubkey from secp256r1 instruction");
        if self.pubkey_ix_index == 0xFF {
            // Pubkey is in current instruction
            let start = self.pubkey_offset as usize;
            let end = start + 33; // Compressed secp256r1 key
            require!(
                instruction_data.len() >= end,
                KeystoreError::InvalidSecp256r1Instruction
            );
            msg!("Pubkey extracted");
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
        msg!("Extracting message from secp256r1 instruction");
        if self.message_ix_index == 0xFF {
            // Message is in current instruction
            let start = self.message_offset as usize;
            let end = start + self.message_size as usize;
            require!(
                instruction_data.len() >= end,
                KeystoreError::InvalidSecp256r1Instruction
            );
            msg!("Message extracted");
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
        
        // For production: Parse and verify instruction data
        // For demo: We'll do basic verification
        
        // Check instruction has sufficient data
        if ix.data.len() < 13 {
            msg!("secp256r1 instruction data too short");
            continue;
        }
        
        // Parse instruction data
        msg!("Parsing & checking secp256r1 instruction data");
        match Secp256r1InstructionData::try_from_slice(&ix.data) {
            Ok(parsed) => {
                // Extract components
                if let (Ok(sig), Ok(pk), Ok(msg)) = (
                    parsed.extract_signature(&ix.data, instructions_sysvar),
                    parsed.extract_pubkey(&ix.data, instructions_sysvar),
                    parsed.extract_message(&ix.data, instructions_sysvar),
                ) {
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
                    
                    // Verify message hash matches
                    // The precompile expects SHA-256 hash of the original message
                    let expected_hash = anchor_lang::solana_program::hash::hash(expected_message);
                    
                    if msg.len() != 32 {
                        msg!("Message hash wrong length: {}", msg.len());
                        continue;
                    }
                    
                    if msg != expected_hash.as_ref() {
                        msg!("Message hash mismatch");
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

