use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::sysvar::instructions as ix_sysvar;
use crate::state::*;
use crate::error::KeystoreError;
use crate::{Action, SignatureData};
use crate::secp256r1;

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
                .ok_or(KeystoreError::InvalidKeyIndex)?;
            
            require!(
                recipient.key() == to,
                KeystoreError::InvalidKeyIndex
            );
            
            // Check vault has sufficient balance
            let vault_balance = ctx.accounts.vault.lamports();
            require!(
                vault_balance >= lamports,
                KeystoreError::InvalidThreshold
            );
            
            // Ensure we maintain rent exemption (if needed)
            let rent = Rent::get()?;
            let min_balance = rent.minimum_balance(0);
            require!(
                vault_balance.saturating_sub(lamports) >= min_balance || lamports == vault_balance,
                KeystoreError::InvalidThreshold
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

