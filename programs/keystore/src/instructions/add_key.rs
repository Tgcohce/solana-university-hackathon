use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::KeystoreError;

#[derive(Accounts)]
pub struct AddKey<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"identity", authority.key().as_ref()],
        bump = identity.bump,
    )]
    pub identity: Account<'info, Identity>,
}

pub fn handler(
    ctx: Context<AddKey>,
    new_pubkey: [u8; 33],
    device_name: String,
) -> Result<()> {
    let identity = &mut ctx.accounts.identity;
    let clock = Clock::get()?;
    
    // Validate input
    require!(
        device_name.len() <= 32,
        KeystoreError::InvalidArgument
    );
    
    require!(
        !device_name.is_empty(),
        KeystoreError::InvalidArgument
    );
    
    // Validate pubkey (compressed secp256r1: must start with 0x02 or 0x03)
    require!(
        new_pubkey[0] == 0x02 || new_pubkey[0] == 0x03,
        KeystoreError::InvalidPublicKey
    );
    
    require!(
        identity.keys.len() < Identity::MAX_KEYS,
        KeystoreError::MaxKeysReached
    );
    
    // Check for duplicate public keys
    for key in &identity.keys {
        require!(
            key.pubkey != new_pubkey,
            KeystoreError::DuplicateKey
        );
    }
    
    identity.keys.push(RegisteredKey {
        pubkey: new_pubkey,
        name: device_name,
        added_at: clock.unix_timestamp,
    });
    
    msg!("Key added. Total keys: {}", identity.keys.len());
    Ok(())
}

