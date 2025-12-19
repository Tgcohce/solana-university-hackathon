import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Keypair,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";
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

/**
 * Keyless SDK Client
 * 
 * Main client for interacting with the Keyless program on Solana.
 * Provides methods for creating identities, executing transactions,
 * and managing passkey-based wallets.
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
 * const result = await client.createIdentity(publicKey, "My Device");
 * console.log("Vault address:", result.vault.toBase58());
 * ```
 */
export class KeylessClient {
  private connection: Connection;
  private programId: PublicKey;

  /**
   * Create a new KeylessClient instance
   * 
   * @param config - Configuration options
   */
  constructor(config: KeylessConfig) {
    this.connection = new Connection(config.rpcUrl, "confirmed");
    this.programId = new PublicKey(
      config.programId || "A3TmryC5ojiCpB6zHmeTTDw4VcSfqYtMKAFrb68mYeyV"
    );
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
   * 
   * @example
   * ```typescript
   * const identityPDA = client.getIdentityPDA(publicKey);
   * ```
   */
  getIdentityPDA(pubkey: Uint8Array): PublicKey {
    if (pubkey.length !== 33) {
      throw new Error("Public key must be 33 bytes (compressed secp256r1)");
    }
    return PublicKey.findProgramAddressSync(
      [Buffer.from("identity"), pubkey.slice(1)],
      this.programId
    )[0];
  }

  /**
   * Derive the vault PDA from an identity PDA
   * 
   * The vault is where the user's SOL is stored.
   * Seeds: ["vault", identity]
   * 
   * @param identity - The identity PDA address
   * @returns The vault PDA address
   * 
   * @example
   * ```typescript
   * const vaultPDA = client.getVaultPDA(identityPDA);
   * ```
   */
  getVaultPDA(identity: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), identity.toBuffer()],
      this.programId
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
   * 
   * @example
   * ```typescript
   * const account = await client.getIdentity(identityPDA);
   * if (account) {
   *   console.log("Nonce:", account.nonce);
   *   console.log("Threshold:", account.threshold);
   * }
   * ```
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
   * 
   * @example
   * ```typescript
   * const balance = await client.getVaultBalance(vaultPDA);
   * console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");
   * ```
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
   * This is a convenience method that wraps the message builder.
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
   * 
   * @example
   * ```typescript
   * const result = await client.createIdentity(
   *   credential.publicKey,
   *   "iPhone 15",
   *   adminKeypair
   * );
   * console.log("Identity:", result.identity.toBase58());
   * console.log("Vault:", result.vault.toBase58());
   * ```
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

    // Build instruction data
    const discriminator = this.getDiscriminator("create_identity");
    const nameBytes = new TextEncoder().encode(deviceName);
    const dataLength = 8 + 33 + 4 + nameBytes.length;
    const data = new Uint8Array(dataLength);
    
    data.set(discriminator, 0);
    data.set(pubkey, 8);
    const view = new DataView(data.buffer);
    view.setUint32(8 + 33, nameBytes.length, true);
    data.set(nameBytes, 8 + 33 + 4);

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: identity, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from(data),
    });

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    const tx = new Transaction({
      feePayer: payer.publicKey,
      recentBlockhash: blockhash,
    }).add(ix);

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
   * 
   * @example
   * ```typescript
   * // Sign the message with passkey
   * const message = client.buildMessage(action, nonce);
   * const sig = await signWithPasskey(credentialId, message);
   * 
   * // Execute on-chain
   * const result = await client.execute(
   *   identityPDA,
   *   { type: "send", to: recipient, lamports: 100000000 },
   *   publicKey,
   *   sig,
   *   adminKeypair
   * );
   * ```
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

    // Build execute instruction
    const executeIx = await this.buildExecuteInstruction(
      identity,
      vault,
      action,
      [{ keyIndex: 0, signature: signature.signature, recoveryId: 0 }],
      signedData,
      action.type === "send" ? action.to : null
    );

    // Build and send transaction
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    const tx = new Transaction({
      feePayer: payer.publicKey,
      recentBlockhash: blockhash,
    });

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

  private getDiscriminator(instructionName: string): Uint8Array {
    const hash = sha256(`global:${instructionName}`);
    return hash.slice(0, 8);
  }

  private async buildExecuteInstruction(
    identity: PublicKey,
    vault: PublicKey,
    action: Action,
    sigs: SignatureData[],
    signedData: Uint8Array,
    recipient: PublicKey | null
  ): Promise<TransactionInstruction> {
    const discriminator = this.getDiscriminator("execute");

    // Build action data
    let actionData: Uint8Array;
    if (action.type === "send") {
      actionData = new Uint8Array(1 + 32 + 8);
      actionData[0] = 0; // Send variant
      actionData.set(action.to.toBytes(), 1);
      new DataView(actionData.buffer).setBigUint64(33, BigInt(action.lamports), true);
    } else {
      actionData = new Uint8Array(2);
      actionData[0] = 1; // SetThreshold variant
      actionData[1] = action.threshold;
    }

    // Build signatures data
    const sigsData = new Uint8Array(4 + sigs.length * 66);
    new DataView(sigsData.buffer).setUint32(0, sigs.length, true);
    let offset = 4;
    for (const sig of sigs) {
      sigsData[offset++] = sig.keyIndex;
      sigsData.set(sig.signature, offset);
      offset += 64;
      sigsData[offset++] = sig.recoveryId;
    }

    // Build signed data with length prefix
    const signedDataWithLen = new Uint8Array(4 + signedData.length);
    new DataView(signedDataWithLen.buffer).setUint32(0, signedData.length, true);
    signedDataWithLen.set(signedData, 4);

    const data = Buffer.concat([
      Buffer.from(discriminator),
      Buffer.from(actionData),
      Buffer.from(sigsData),
      Buffer.from(signedDataWithLen),
    ]);

    const keys = [
      { pubkey: identity, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: recipient || identity, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      keys,
      programId: this.programId,
      data,
    });
  }

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

