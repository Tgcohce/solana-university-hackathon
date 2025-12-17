use anchor_lang::prelude::*;

#[error_code]
pub enum KeystoreError {
    #[msg("Threshold not met")]
    ThresholdNotMet,
    #[msg("Invalid key index")]
    InvalidKeyIndex,
    #[msg("Max keys reached (limit: 5)")]
    MaxKeysReached,
    #[msg("Invalid threshold value")]
    InvalidThreshold,
    #[msg("Signature verification failed or duplicate key used")]
    SignatureVerificationFailed,
    #[msg("Invalid secp256r1 instruction format")]
    InvalidSecp256r1Instruction,
    #[msg("Duplicate public key not allowed")]
    DuplicateKey,
    #[msg("Invalid public key format")]
    InvalidPublicKey,
    #[msg("Invalid device name (must be 1-32 chars)")]
    InvalidDeviceName,
    #[msg("Invalid public key format (must be compressed secp256r1)")]
    InvalidPublicKeyFormat,
    #[msg("Credential already registered")]
    CredentialAlreadyRegistered,
    #[msg("Max credentials reached")]
    MaxCredentialsReached,
}

