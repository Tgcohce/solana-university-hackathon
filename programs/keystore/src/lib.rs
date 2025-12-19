use anchor_lang::prelude::*;

pub mod state;
pub mod error;
pub mod instructions;
pub mod secp256r1;

use instructions::*;

declare_id!("4DS5K64SuWK6PmN1puZVtPouLWCqQDA3aE58MPPuDXu2");

#[program]
pub mod keystore {
    use super::*;

    pub fn create_identity(
        ctx: Context<CreateIdentity>,
        pubkey: [u8; 33],
        device_name: String,
    ) -> Result<()> {
        instructions::create::handler(ctx, pubkey, device_name)
    }

    pub fn add_key(
        ctx: Context<AddKey>,
        new_pubkey: [u8; 33],
        device_name: String,
    ) -> Result<()> {
        instructions::add_key::handler(ctx, new_pubkey, device_name)
    }

    pub fn execute(
        ctx: Context<Execute>,
        action: Action,
        sigs: Vec<SignatureData>,
        signed_data: Vec<u8>,
    ) -> Result<()> {
        instructions::execute::handler(ctx, action, sigs, signed_data)
    }

    pub fn register_credential(
        ctx: Context<RegisterCredential>,
        credential_id: Vec<u8>,
        device_name: String,
    ) -> Result<()> {
        instructions::register_credential::handler(ctx, credential_id, device_name)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum Action {
    Send { to: Pubkey, lamports: u64 },
    SetThreshold { threshold: u8 },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SignatureData {
    pub key_index: u8,
    pub signature: [u8; 64],
    pub recovery_id: u8,
}

