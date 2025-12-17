use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::KeystoreError;

#[derive(Accounts)]
pub struct CreateIdentity<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(
        init,
        payer = payer,
        space = 8 + Identity::SIZE,
        seeds = [b"identity", payer.key().as_ref()],
        bump,
    )]
    pub identity: Account<'info, Identity>,
    
    #[account(
        seeds = [b"vault", identity.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA vault for holding funds
    pub vault: SystemAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateIdentity>,
    pubkey: [u8; 33],
    device_name: String,
) -> Result<()> {
    let identity = &mut ctx.accounts.identity;
    let clock = Clock::get()?;
    
    // Validate input
    require!(
        device_name.len() <= 32 && !device_name.is_empty(),
        KeystoreError::InvalidDeviceName
    );
    
    // Validate pubkey (compressed secp256r1: must start with 0x02 or 0x03)
    require!(
        pubkey[0] == 0x02 || pubkey[0] == 0x03,
        KeystoreError::InvalidPublicKeyFormat
    );
    
    identity.bump = ctx.bumps.identity;
    identity.vault_bump = ctx.bumps.vault;
    identity.threshold = 1;
    identity.nonce = 0;
    identity.keys = vec![RegisteredKey {
        pubkey,
        name: device_name,
        added_at: clock.unix_timestamp,
    }];
    
    msg!("Identity created with 1 key");
    Ok(())
}

