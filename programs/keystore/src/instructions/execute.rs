use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::sysvar::instructions as ix_sysvar;
use crate::state::*;
use crate::error::KeystoreError;
use crate::{Action, SignatureData};
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
    pub vault: UncheckedAccount<'info>,
    
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
    signed_data: Vec<u8>,
) -> Result<()> {
    let identity = &mut ctx.accounts.identity;

    msg!("execute");
    msg!("Action: {:?}", action);
    msg!("signatures: {:?}", sigs);
    
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
    
    msg!("checking duplicate key indices");
    // Check for duplicate key indices
    let mut used_keys = std::collections::HashSet::new();
    for sig in &sigs {
        msg!("sig key index: {}", sig.key_index);
        msg!("signature: {:?}", sig.signature);
        msg!("sig recovery id: {}", sig.recovery_id);
        require!(
            used_keys.insert(sig.key_index),
            KeystoreError::SignatureVerificationFailed
        );
    }
    
    // Verify each signature via secp256r1 precompile introspection
    msg!("verifying signatures");
    for sig in &sigs {
        let key = identity.keys
            .get(sig.key_index as usize)
            .ok_or(KeystoreError::InvalidKeyIndex)?;
        
        msg!("verifying signature for key index {}", sig.key_index);
        secp256r1::verify_secp256r1_signature(
            &ctx.accounts.instructions,
            &key.pubkey,
            &signed_data,
            &sig.signature,
        )?;
        msg!("signature verification passed");
    }
    
    // Increment nonce (before execution to prevent reentrancy)
    identity.nonce += 1;
    
    msg!("executing action");
    msg!("vault key: {}", ctx.accounts.vault.key());
    // Execute action
    match action {
        Action::Send { to, lamports } => {
            let recipient = ctx.accounts.recipient
                .as_ref()
                .ok_or(KeystoreError::InvalidAccountData)?;
            
            if recipient.key() != to {
                return Err(KeystoreError::InvalidAccountData.into());
            }

            msg!("vault balance: {}", ctx.accounts.vault.lamports());
            msg!("sending {} lamports to {}", lamports, to);
            
            // Check vault has sufficient balance
            let vault_balance = ctx.accounts.vault.lamports();
            require!(
                vault_balance >= lamports,
                KeystoreError::InsufficientFunds
            );
            
            msg!("checking rent exemption");
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
            
            msg!("transferring lamports");
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

