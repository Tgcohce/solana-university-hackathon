use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions as ix_sysvar;
use std::str::FromStr;

// secp256r1 program ID
const SECP256R1_PROGRAM_ID: &str = "Secp256r1SigVerify1111111111111111111111111";

/// Verify a secp256r1 signature by checking the Instructions sysvar
/// 
/// The secp256r1 precompile MUST be called in the same transaction BEFORE this instruction.
/// If the precompile instruction succeeds, the signature is valid.
/// If it fails, the entire transaction fails.
/// 
/// This function simply verifies that a secp256r1 instruction was present
/// with matching pubkey, message hash, and signature.
/// 
/// NOTE: expected_message should already be the SHA-256 hash (32 bytes)
pub fn verify_secp256r1_signature(
    instructions_sysvar: &AccountInfo,
    expected_pubkey: &[u8; 33],
    expected_message_hash: &[u8],
    expected_signature: &[u8; 64],
) -> Result<()> {
    // Load current instruction index
    let current_idx = ix_sysvar::load_current_index_checked(instructions_sysvar)
        .map_err(|_| error!(crate::error::KeystoreError::InvalidSecp256r1Instruction))?;
    
    // secp256r1 program ID
    let secp256r1_id = Pubkey::from_str(SECP256R1_PROGRAM_ID).unwrap();
    
    // Look backwards for secp256r1 instruction
    for i in (0..current_idx).rev() {
        let ix = ix_sysvar::load_instruction_at_checked(i as usize, instructions_sysvar)
            .map_err(|_| error!(crate::error::KeystoreError::InvalidSecp256r1Instruction))?;
        
        // Check if this is a secp256r1 instruction
        if ix.program_id != secp256r1_id {
            continue;
        }
        
        // The secp256r1 instruction data format:
        // [num_signatures: u8] [signature_offset: u16] [signature_instruction_index: u8]
        // [pubkey_offset: u16] [pubkey_instruction_index: u8]
        // [message_offset: u16] [message_size: u16] [message_instruction_index: u8]
        // [signature: 64 bytes] [pubkey: 33 bytes] [message_hash: 32 bytes]
        
        // Minimum size check
        if ix.data.len() < 12 + 64 + 33 + 32 {
            msg!("secp256r1 instruction data too short");
            continue;
        }
        
        // Extract signature (starts at offset 12, 64 bytes)
        let sig_start = 12;
        let sig = &ix.data[sig_start..sig_start + 64];
        
        // Extract pubkey (starts after signature, 33 bytes)
        let pk_start = sig_start + 64;
        let pk = &ix.data[pk_start..pk_start + 33];
        
        // Extract message hash (starts after pubkey, 32 bytes)
        let msg_start = pk_start + 33;
        let msg = &ix.data[msg_start..msg_start + 32];
        
        // Verify all components match
        if pk == expected_pubkey.as_slice() 
            && sig == expected_signature.as_slice()
            && msg == expected_message_hash 
        {
            msg!("Found valid secp256r1 instruction");
            return Ok(());
        }
    }
    
    msg!("No matching secp256r1 instruction found");
    Err(error!(crate::error::KeystoreError::InvalidSecp256r1Instruction))
}

/// Build a secp256r1 verification instruction for the client
/// 
/// This instruction MUST be included in the transaction BEFORE the execute instruction.
/// 
/// NOTE: message_hash should be the SHA-256 hash of the message (32 bytes)
pub fn build_secp256r1_instruction(
    pubkey: &[u8; 33],
    message_hash: &[u8; 32],
    signature: &[u8; 64],
) -> anchor_lang::solana_program::instruction::Instruction {
    use anchor_lang::solana_program::instruction::Instruction;
    
    // Build instruction data
    // Format: [header: 12 bytes] [signature: 64 bytes] [pubkey: 33 bytes] [message_hash: 32 bytes]
    let mut data = Vec::with_capacity(12 + 64 + 33 + 32);
    
    // Header (12 bytes)
    data.push(1); // num_signatures = 1
    data.extend_from_slice(&12u16.to_le_bytes()); // signature_offset = 12 (after header)
    data.push(0xFF); // signature_instruction_index = 0xFF (current instruction)
    data.extend_from_slice(&76u16.to_le_bytes()); // pubkey_offset = 12 + 64 = 76
    data.push(0xFF); // pubkey_instruction_index = 0xFF (current instruction)
    data.extend_from_slice(&109u16.to_le_bytes()); // message_offset = 76 + 33 = 109
    data.extend_from_slice(&32u16.to_le_bytes()); // message_size = 32 (SHA-256 hash)
    data.push(0xFF); // message_instruction_index = 0xFF (current instruction)
    
    // Data
    data.extend_from_slice(signature); // 64 bytes
    data.extend_from_slice(pubkey); // 33 bytes
    data.extend_from_slice(message_hash); // 32 bytes
    
    Instruction {
        program_id: Pubkey::from_str(SECP256R1_PROGRAM_ID).unwrap(),
        accounts: vec![],
        data,
    }
}

