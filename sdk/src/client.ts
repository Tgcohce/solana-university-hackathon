import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Keypair,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { buildSecp256r1Instruction } from "./secp256r1";
import { buildMessage } from "./message";
import type {
  Action,
  SignatureData,
  IdentityAccount,
  CreateIdentityResult,
  ExecuteResult,
  KeylessConfig,
  PasskeySignature,
} from "./types";

// IDL type (minimal subset needed)
interface KeystoreIDL {
  address: string;
  metadata: { name: string; version: string; spec: string };
  instructions: any[];
  accounts: any[];
  errors: any[];
  types: any[];
}

// Default IDL - matches the deployed program
const KEYSTORE_IDL: KeystoreIDL = {
  "address": "A3TmryC5ojiCpB6zHmeTTDw4VcSfqYtMKAFrb68mYeyV",
  "metadata": { "name": "keystore", "version": "0.1.0", "spec": "0.1.0" },
  "instructions": [
    {
      "name": "create_identity",
      "discriminator": [12, 253, 209, 41, 176, 51, 195, 179],
      "accounts": [
        { "name": "payer", "writable": true, "signer": true },
        { "name": "identity", "writable": true },
        { "name": "vault", "pda": { "seeds": [{ "kind": "const", "value": [118, 97, 117, 108, 116] }, { "kind": "account", "path": "identity" }] } },
        { "name": "system_program", "address": "11111111111111111111111111111111" }
      ],
      "args": [
        { "name": "pubkey", "type": { "array": ["u8", 33] } },
        { "name": "device_name", "type": "string" }
      ]
    },
    {
      "name": "execute",
      "discriminator": [130, 221, 242, 154, 13, 193, 189, 29],
      "accounts": [
        { "name": "identity", "writable": true },
        { "name": "vault", "writable": true, "pda": { "seeds": [{ "kind": "const", "value": [118, 97, 117, 108, 116] }, { "kind": "account", "path": "identity" }] } },
        { "name": "recipient", "writable": true, "optional": true },
        { "name": "instructions", "address": "Sysvar1nstructions1111111111111111111111111" },
        { "name": "system_program", "address": "11111111111111111111111111111111" }
      ],
      "args": [
        { "name": "action", "type": { "defined": { "name": "action" } } },
        { "name": "sigs", "type": { "vec": { "defined": { "name": "signature_data" } } } },
        { "name": "signed_data", "type": "bytes" }
      ]
    }
  ],
  "accounts": [
    { "name": "identity", "discriminator": [58, 132, 5, 12, 176, 164, 85, 112] }
  ],
  "errors": [],
  "types": [
    {
      "name": "action",
      "type": {
        "kind": "enum",
        "variants": [
          { "name": "send", "fields": [{ "name": "to", "type": "pubkey" }, { "name": "lamports", "type": "u64" }] },
          { "name": "setThreshold", "fields": [{ "name": "threshold", "type": "u8" }] }
        ]
      }
    },
    {
      "name": "signature_data",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "key_index", "type": "u8" },
          { "name": "signature", "type": { "array": ["u8", 64] } },
          { "name": "recovery_id", "type": "u8" }
        ]
      }
    }
  ]
};

/**
 * Keyless SDK Client
 * 
 * Main client for interacting with the Keyless program on Solana.
 * Uses Anchor for proper instruction serialization.
 * 
 * @example
 * ```typescript
 * import { KeylessClient } from "@keyless/sdk";
 * 
 * const client = new KeylessClient({
 *   rpcUrl: "https://api.devnet.solana.com",
 * });
 * 
 * // Create a new wallet
 * const result = await client.createIdentity(publicKey, "My Device", adminKeypair);
 * console.log("Vault address:", result.vault.toBase58());
 * ```
 */
export class KeylessClient {
  private connection: Connection;
  private program: Program<any>;

  /**
   * Create a new KeylessClient instance
   * 
   * @param config - Configuration options
   */
  constructor(config: KeylessConfig) {
    this.connection = new Connection(config.rpcUrl, "confirmed");
    
    // Create Anchor provider (read-only, no wallet needed for queries)
    const provider = { connection: this.connection } as AnchorProvider;
    
    // Use custom IDL if provided, otherwise use default
    const idl = config.idl || KEYSTORE_IDL;
    if (config.programId) {
      idl.address = config.programId;
    }
    
    this.program = new Program(idl as any, provider);
  }

  /**
   * Get the program ID
   */
  get programId(): PublicKey {
    return this.program.programId;
  }

  // ============================================================================
  // PDA Derivation
  // ============================================================================

  /**
   * Derive the identity PDA from a passkey public key
   * 
   * The identity PDA is derived using seeds: ["identity", pubkey[1:33]]
   * (excluding the first byte which is the compression prefix)
   * 
   * @param pubkey - 33-byte compressed secp256r1 public key
   * @returns The identity PDA address
   */
  getIdentityPDA(pubkey: Uint8Array): PublicKey {
    if (pubkey.length !== 33) {
      throw new Error("Public key must be 33 bytes (compressed secp256r1)");
    }
    return PublicKey.findProgramAddressSync(
      [Buffer.from("identity"), pubkey.slice(1)],
      this.program.programId
    )[0];
  }

  /**
   * Derive the vault PDA from an identity PDA
   * 
   * @param identity - The identity PDA address
   * @returns The vault PDA address
   */
  getVaultPDA(identity: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), identity.toBuffer()],
      this.program.programId
    )[0];
  }

  // ============================================================================
  // Account Queries
  // ============================================================================

  /**
   * Fetch identity account data
   * 
   * @param identity - The identity PDA address
   * @returns The identity account data or null if not found
   */
  async getIdentity(identity: PublicKey): Promise<IdentityAccount | null> {
    try {
      const account = await this.connection.getAccountInfo(identity);
      if (!account) return null;
      
      const data = account.data;
      // Parse account data (Anchor format with 8-byte discriminator)
      return {
        bump: data[8],
        vaultBump: data[9],
        threshold: data[10],
        nonce: Number(new DataView(data.buffer, data.byteOffset).getBigUint64(11, true)),
        keys: [], // TODO: Full key parsing
      };
    } catch (e) {
      console.error("Failed to fetch identity:", e);
      return null;
    }
  }

  /**
   * Get the SOL balance of a vault
   * 
   * @param vault - The vault PDA address
   * @returns Balance in lamports
   */
  async getVaultBalance(vault: PublicKey): Promise<number> {
    return await this.connection.getBalance(vault);
  }

  /**
   * Check if an identity exists on-chain
   * 
   * @param identity - The identity PDA address
   * @returns true if the identity exists
   */
  async identityExists(identity: PublicKey): Promise<boolean> {
    const account = await this.connection.getAccountInfo(identity);
    return account !== null;
  }

  // ============================================================================
  // Transaction Building
  // ============================================================================

  /**
   * Build the message that needs to be signed for an action
   * 
   * @param action - The action to execute
   * @param nonce - The current nonce from the identity account
   * @returns The message bytes to sign
   */
  buildMessage(action: Action, nonce: number): Uint8Array {
    return buildMessage(action, nonce);
  }

  /**
   * Create a new identity on-chain
   * 
   * This creates the identity PDA and vault PDA for a new passkey.
   * The payer (admin wallet) pays for account rent.
   * 
   * @param pubkey - 33-byte compressed secp256r1 public key from passkey
   * @param deviceName - Human-readable device name
   * @param payer - Keypair to pay for transaction (admin wallet)
   * @returns The created identity details
   */
  async createIdentity(
    pubkey: Uint8Array,
    deviceName: string,
    payer: Keypair
  ): Promise<CreateIdentityResult> {
    if (pubkey.length !== 33) {
      throw new Error("Public key must be 33 bytes (compressed secp256r1)");
    }

    const identity = this.getIdentityPDA(pubkey);
    const vault = this.getVaultPDA(identity);

    // Check if already exists
    const exists = await this.identityExists(identity);
    if (exists) {
      return {
        signature: "existing",
        identity,
        vault,
        publicKey: pubkey,
      };
    }

    // Build instruction using Anchor
    const createIx = await (this.program.methods as any)
      .createIdentity(
        Array.from(pubkey) as unknown as number[],
        deviceName
      )
      .accounts({
        payer: payer.publicKey,
        identity: identity,
      })
      .instruction();

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    const tx = new Transaction({
      feePayer: payer.publicKey,
      recentBlockhash: blockhash,
    }).add(createIx);

    tx.sign(payer);

    const signature = await this.connection.sendRawTransaction(tx.serialize());
    await this.confirmTransaction(signature, lastValidBlockHeight);

    return {
      signature,
      identity,
      vault,
      publicKey: pubkey,
    };
  }

  /**
   * Execute a transaction (send SOL or change threshold)
   * 
   * This builds and sends a transaction that:
   * 1. Verifies the secp256r1 signature via the precompile
   * 2. Executes the action on the identity account
   * 
   * @param identity - The identity PDA address
   * @param action - The action to execute
   * @param pubkey - 33-byte public key that signed
   * @param signature - Passkey signature result
   * @param payer - Keypair to pay for transaction
   * @returns The transaction result
   */
  async execute(
    identity: PublicKey,
    action: Action,
    pubkey: Uint8Array,
    signature: PasskeySignature,
    payer: Keypair
  ): Promise<ExecuteResult> {
    if (pubkey.length !== 33) {
      throw new Error("Public key must be 33 bytes");
    }

    const vault = this.getVaultPDA(identity);
    
    // Get current nonce
    const identityAccount = await this.getIdentity(identity);
    if (!identityAccount) {
      throw new Error("Identity account not found");
    }

    // Build secp256r1 verify instruction
    const { instruction: verifyIx, signedData } = buildSecp256r1Instruction(
      pubkey,
      signature.authenticatorData,
      signature.clientDataJSON,
      signature.signature
    );

    // Convert action to Anchor format
    const anchorAction = action.type === "send"
      ? { send: { to: action.to, lamports: new BN(action.lamports) } }
      : { setThreshold: { threshold: action.threshold } };

    // Convert signature to Anchor format
    const anchorSigs = [{
      keyIndex: 0,
      signature: Array.from(signature.signature) as unknown as number[],
      recoveryId: 0,
    }];

    // Determine recipient for Send action
    const recipient = action.type === "send" ? action.to : null;

    // Build execute instruction using Anchor
    const executeIx = await (this.program.methods as any)
      .execute(anchorAction, anchorSigs, Buffer.from(signedData))
      .accounts({
        identity: identity,
        vault: vault,
        recipient: recipient,
      })
      .instruction();

    // Build and send transaction
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    const tx = new Transaction({
      feePayer: payer.publicKey,
      recentBlockhash: blockhash,
    });

    // Add verify instruction BEFORE execute instruction
    tx.add(verifyIx);
    tx.add(executeIx);
    tx.sign(payer);

    const sig = await this.connection.sendRawTransaction(tx.serialize());
    await this.confirmTransaction(sig, lastValidBlockHeight);

    return {
      signature: sig,
      newNonce: identityAccount.nonce + 1,
    };
  }

  // ============================================================================
  // Internal Helpers
  // ============================================================================

  private async confirmTransaction(
    signature: string,
    lastValidBlockHeight: number,
    maxRetries = 30
  ): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      const status = await this.connection.getSignatureStatus(signature);
      
      if (status.value !== null) {
        if (status.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }
        if (
          status.value.confirmationStatus === "confirmed" ||
          status.value.confirmationStatus === "finalized"
        ) {
          return;
        }
      }
      
      const blockHeight = await this.connection.getBlockHeight();
      if (blockHeight > lastValidBlockHeight) {
        throw new Error("Transaction expired: blockhash no longer valid");
      }
      
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Transaction confirmation timeout");
  }
}
