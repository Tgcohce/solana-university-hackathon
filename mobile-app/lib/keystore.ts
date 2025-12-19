/**
 * Keystore client utilities for Mobile App
 * This file is now a thin wrapper since we use the hosted API
 */

import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";

// Program ID matches the deployed program
export const PROGRAM_ID = new PublicKey("A3TmryC5ojiCpB6zHmeTTDw4VcSfqYtMKAFrb68mYeyV");

/**
 * Derive Identity PDA from secp256r1 public key
 */
export function getIdentityPDA(pubkey: Uint8Array): PublicKey {
  // Derive identity PDA using "identity" seed and the public key (excluding first byte)
  const [identityPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("identity"), pubkey.slice(1)],
    PROGRAM_ID
  );
  return identityPDA;
}

/**
 * Derive Vault PDA from Identity PDA
 */
export function getVaultPDA(identity: PublicKey): PublicKey {
  const [vaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), identity.toBuffer()],
    PROGRAM_ID
  );
  return vaultPDA;
}

