use anchor_lang::prelude::*;

pub mod state;
pub mod error;
pub mod instructions;
pub mod secp256r1;

use instructions::*;

// IMPORTANT: After deployment, update this ID in THREE places:
// 1. This file (declare_id! below)
// 2. app/src/lib/keystore.ts (PROGRAM_ID constant)
// 3. Anchor.toml (programs.devnet.keystore)
declare_id!("6AjfeA3Pv24sGgLfDLQ3DD1zUHxHPPDNbGLMcarnCcBC");

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
    ) -> Result<()> {
        instructions::execute::handler(ctx, action, sigs)
    }

    /// Execute with WebAuthn signature format
    pub fn execute_webauthn(
        ctx: Context<Execute>,
        action: Action,
        webauthn_sig: WebAuthnSignatureData,
    ) -> Result<()> {
        instructions::execute::handler_webauthn(ctx, action, webauthn_sig)
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

/// WebAuthn signature data for execute instruction
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct WebAuthnSignatureData {
    pub key_index: u8,
    pub signature: [u8; 64],
    pub authenticator_data: Vec<u8>,
    pub client_data_json: Vec<u8>,
}

