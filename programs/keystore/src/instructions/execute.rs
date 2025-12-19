use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::sysvar::instructions as ix_sysvar;
use anchor_lang::solana_program::hash::hash;
use crate::state::*;
use crate::error::KeystoreError;
use crate::{Action, SignatureData, WebAuthnSignatureData};
use crate::secp256r1;
use std::collections::HashSet;

#[derive(Accounts)]
pub struct Execute<'info> {
    #[account(mut)]
    pub identity: Account<'info, Identity>,
    
    #[account(
        mut,
        seeds = [b"vault", identity.key().as_ref()],
        bump = identity.vault_bump,
    )]
    /// CHECK: PDA vault
    pub vault: SystemAccount<'info>,
    
    /// CHECK: Optional recipient for Send action
    #[account(mut)]
    pub recipient: Option<AccountInfo<'info>>,
    
    /// CHECK: Instructions sysvar for verifying secp256r1 precompile
    #[account(address = ix_sysvar::ID)]
    pub instructions: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Execute>,
    action: Action,
    sigs: Vec<SignatureData>,
) -> Result<()> {
    let identity = &mut ctx.accounts.identity;
    
    // Validate signatures array
    require!(
        !sigs.is_empty(),
        KeystoreError::ThresholdNotMet
    );
    
    // Check threshold
    require!(
        sigs.len() >= identity.threshold as usize,
        KeystoreError::ThresholdNotMet
    );
    
    // Check for duplicate key indices
    let mut used_keys = std::collections::HashSet::new();
    for sig in &sigs {
        require!(
            used_keys.insert(sig.key_index),
            KeystoreError::SignatureVerificationFailed
        );
    }
    
    // Build message that was signed (action + nonce)
    let message = build_message(&action, identity.nonce)?;
    
    // Verify each signature via secp256r1 precompile introspection
    for sig in &sigs {
        let key = identity.keys
            .get(sig.key_index as usize)
            .ok_or(KeystoreError::InvalidKeyIndex)?;
        
        secp256r1::verify_secp256r1_signature(
            &ctx.accounts.instructions,
            &key.pubkey,
            &message,
            &sig.signature,
        )?;
    }
    
    // Increment nonce (before execution to prevent reentrancy)
    identity.nonce += 1;
    
    // Execute action
    match action {
        Action::Send { to, lamports } => {
            let recipient = ctx.accounts.recipient
                .as_ref()
                .ok_or(KeystoreError::InvalidAccountData)?;
            
            if recipient.key() != to {
                return Err(KeystoreError::InvalidAccountData.into());
            }
            
            // Check vault has sufficient balance
            let vault_balance = ctx.accounts.vault.lamports();
            require!(
                vault_balance >= lamports,
                KeystoreError::InsufficientFunds
            );
            
            // Ensure we maintain rent exemption (if needed)
            let rent = Rent::get()?;
            let min_balance = rent.minimum_balance(0);
            require!(
                vault_balance.saturating_sub(lamports) >= min_balance || lamports == vault_balance,
                KeystoreError::InsufficientFunds
            );
            
            let identity_key = identity.key();
            let seeds: &[&[u8]] = &[
                b"vault",
                identity_key.as_ref(),
                &[identity.vault_bump],
            ];
            
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: recipient.to_account_info(),
                    },
                    &[seeds],
                ),
                lamports,
            )?;
            
            msg!("Sent {} lamports to {}", lamports, to);
        }
        Action::SetThreshold { threshold } => {
            require!(threshold > 0, KeystoreError::InvalidThreshold);
            require!(
                threshold as usize <= identity.keys.len(),
                KeystoreError::InvalidThreshold
            );
            identity.threshold = threshold;
            msg!("Threshold set to {}", threshold);
        }
    }
    
    Ok(())
}

fn build_message(action: &Action, nonce: u64) -> Result<Vec<u8>> {
    let mut message = action.try_to_vec()?;
    message.extend_from_slice(&nonce.to_le_bytes());
    Ok(message)
}

/// Handler for WebAuthn signatures
/// 
/// WebAuthn signs: authenticatorData || SHA256(clientDataJSON)
/// The clientDataJSON contains a "challenge" field which is base64url(SHA256(our_message))
pub fn handler_webauthn(
    ctx: Context<Execute>,
    action: Action,
    webauthn_sig: WebAuthnSignatureData,
) -> Result<()> {
    let identity = &mut ctx.accounts.identity;
    
    // Build expected message (action + nonce)
    let expected_message = build_message(&action, identity.nonce)?;
    let expected_challenge = hash(&expected_message);
    
    // Verify the challenge in clientDataJSON matches our expected message
    verify_webauthn_challenge(&webauthn_sig.client_data_json, expected_challenge.as_ref())?;
    
    // Get the key for this signature
    let key = identity.keys
        .get(webauthn_sig.key_index as usize)
        .ok_or(KeystoreError::InvalidKeyIndex)?;
    
    // Build the actual signed message: authenticatorData || SHA256(clientDataJSON)
    let client_data_hash = hash(&webauthn_sig.client_data_json);
    let mut signed_message = webauthn_sig.authenticator_data.clone();
    signed_message.extend_from_slice(client_data_hash.as_ref());
    
    // Verify signature via secp256r1 precompile introspection
    secp256r1::verify_secp256r1_signature(
        &ctx.accounts.instructions,
        &key.pubkey,
        &signed_message,
        &webauthn_sig.signature,
    )?;
    
    // Increment nonce (before execution to prevent reentrancy)
    identity.nonce += 1;
    
    // Execute action (same as regular handler)
    match action {
        Action::Send { to, lamports } => {
            let recipient = ctx.accounts.recipient
                .as_ref()
                .ok_or(KeystoreError::InvalidAccountData)?;
            
            if recipient.key() != to {
                return Err(KeystoreError::InvalidAccountData.into());
            }
            
            let vault_balance = ctx.accounts.vault.lamports();
            require!(
                vault_balance >= lamports,
                KeystoreError::InsufficientFunds
            );
            
            let rent = Rent::get()?;
            let min_balance = rent.minimum_balance(0);
            require!(
                vault_balance.saturating_sub(lamports) >= min_balance || lamports == vault_balance,
                KeystoreError::InsufficientFunds
            );
            
            let identity_key = identity.key();
            let seeds: &[&[u8]] = &[
                b"vault",
                identity_key.as_ref(),
                &[identity.vault_bump],
            ];
            
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: recipient.to_account_info(),
                    },
                    &[seeds],
                ),
                lamports,
            )?;
            
            msg!("Sent {} lamports to {}", lamports, to);
        }
        Action::SetThreshold { threshold } => {
            require!(threshold > 0, KeystoreError::InvalidThreshold);
            require!(
                threshold as usize <= identity.keys.len(),
                KeystoreError::InvalidThreshold
            );
            identity.threshold = threshold;
            msg!("Threshold set to {}", threshold);
        }
    }
    
    Ok(())
}

/// Verify that the challenge in clientDataJSON matches our expected hash
fn verify_webauthn_challenge(client_data_json: &[u8], expected_hash: &[u8]) -> Result<()> {
    // Parse clientDataJSON to extract challenge
    // clientDataJSON is like: {"type":"webauthn.get","challenge":"base64url_encoded_challenge",...}
    
    let json_str = std::str::from_utf8(client_data_json)
        .map_err(|_| KeystoreError::InvalidWebAuthnData)?;
    
    // Find challenge field - simple parsing without full JSON parser
    let challenge_prefix = "\"challenge\":\"";
    let start = json_str.find(challenge_prefix)
        .ok_or(KeystoreError::InvalidWebAuthnData)?;
    let start = start + challenge_prefix.len();
    let end = json_str[start..].find('"')
        .ok_or(KeystoreError::InvalidWebAuthnData)?;
    let challenge_b64 = &json_str[start..start+end];
    
    // Decode base64url
    let challenge = base64url_decode(challenge_b64)
        .map_err(|_| KeystoreError::InvalidWebAuthnData)?;
    
    // Compare with expected hash
    if challenge.as_slice() != expected_hash {
        msg!("Challenge mismatch!");
        msg!("Expected: {:?}", expected_hash);
        msg!("Got: {:?}", challenge.as_slice());
        return Err(KeystoreError::InvalidWebAuthnData.into());
    }
    
    msg!("WebAuthn challenge verified!");
    Ok(())
}

/// Decode base64url (no padding variant used by WebAuthn)
fn base64url_decode(input: &str) -> std::result::Result<Vec<u8>, ()> {
    // Base64url alphabet: A-Z a-z 0-9 - _
    let mut output = Vec::with_capacity(input.len() * 3 / 4);
    let mut buffer: u32 = 0;
    let mut bits_collected = 0;
    
    for c in input.chars() {
        let val = match c {
            'A'..='Z' => c as u32 - 'A' as u32,
            'a'..='z' => c as u32 - 'a' as u32 + 26,
            '0'..='9' => c as u32 - '0' as u32 + 52,
            '-' => 62,
            '_' => 63,
            '=' => continue, // padding
            _ => return Err(()),
        };
        
        buffer = (buffer << 6) | val;
        bits_collected += 6;
        
        if bits_collected >= 8 {
            bits_collected -= 8;
            output.push((buffer >> bits_collected) as u8);
            buffer &= (1 << bits_collected) - 1;
        }
    }
    
    Ok(output)
}

