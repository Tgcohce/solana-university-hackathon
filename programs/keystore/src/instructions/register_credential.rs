use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::KeystoreError;

#[derive(Accounts)]
pub struct RegisterCredential<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"identity", authority.key().as_ref()],
        bump = identity.bump,
    )]
    pub identity: Account<'info, Identity>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + CredentialRegistry::SIZE,
        seeds = [b"credential", identity.key().as_ref(), &[identity.keys.len() as u8]],
        bump,
    )]
    pub credential_registry: Account<'info, CredentialRegistry>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterCredential>,
    credential_id: Vec<u8>,
    device_name: String,
) -> Result<()> {
    let credential_registry = &mut ctx.accounts.credential_registry;
    let identity = &ctx.accounts.identity;
    
    // Validate inputs
    require!(
        credential_id.len() <= 256,
        KeystoreError::InvalidArgument
    );
    
    require!(
        !credential_id.is_empty(),
        KeystoreError::InvalidArgument
    );
    
    require!(
        device_name.len() <= 32 && !device_name.is_empty(),
        KeystoreError::InvalidArgument
    );
    
    // Get the key index (last key added)
    let key_index = (identity.keys.len() - 1) as u8;
    
    credential_registry.bump = ctx.bumps.credential_registry;
    credential_registry.identity = identity.key();
    credential_registry.key_index = key_index;
    credential_registry.credential_id = credential_id;
    credential_registry.device_name = device_name;
    credential_registry.registered_at = Clock::get()?.unix_timestamp;
    
    msg!("Credential registered for key index {}", key_index);
    Ok(())
}

