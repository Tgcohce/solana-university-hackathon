import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import { Buffer } from 'buffer';
import { PROGRAM_ID, getIdentityPDA, getVaultPDA } from "./solana";
import { signWithPasskey } from "./passkey";

export class KeystoreClient {
  constructor(private connection: Connection) {}

  /**
   * Create a new identity with the first passkey
   */
  async createIdentity(
    ownerPublicKey: PublicKey,
    passkeyPublicKey: Uint8Array,
    deviceName: string
  ): Promise<{ identity: PublicKey; vault: PublicKey; transaction: Transaction }> {
    const [identity] = getIdentityPDA(ownerPublicKey);
    const [vault] = getVaultPDA(identity);

    // Serialize pubkey (33 bytes) and device name
    const deviceNameBytes = Buffer.from(deviceName, "utf8");
    const deviceNameLen = Buffer.alloc(4);
    deviceNameLen.writeUInt32LE(deviceNameBytes.length, 0);

    const data = Buffer.concat([
      Buffer.from([0]), // instruction discriminator for create_identity
      Buffer.from(passkeyPublicKey),
      deviceNameLen,
      deviceNameBytes,
    ]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: ownerPublicKey, isSigner: true, isWritable: true },
        { pubkey: identity, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    });

    const transaction = new Transaction().add(instruction);
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = ownerPublicKey;

    return { identity, vault, transaction };
  }

  /**
   * Build message for signing (matches on-chain format)
   */
  buildMessage(
    action: { type: "send"; to: PublicKey; lamports: number },
    nonce: number
  ): Uint8Array {
    const actionBytes =
      action.type === "send"
        ? Buffer.concat([
            Buffer.from([0]), // Send variant
            action.to.toBuffer(),
            Buffer.from(new BigUint64Array([BigInt(action.lamports)]).buffer),
          ])
        : Buffer.from([]);

    const nonceBytes = Buffer.from(new BigUint64Array([BigInt(nonce)]).buffer);
    return new Uint8Array(Buffer.concat([actionBytes, nonceBytes]));
  }

  /**
   * Execute a transaction with passkey signatures
   */
  async sendTransaction(
    identity: PublicKey,
    vault: PublicKey,
    to: PublicKey,
    lamports: number,
    nonce: number,
    credentialId: Uint8Array,
    publicKey: Uint8Array
  ): Promise<string> {
    // Build message to sign
    const message = this.buildMessage({ type: "send", to, lamports }, nonce);

    // Sign with passkey (triggers biometric prompt)
    const signature = await signWithPasskey(credentialId, message);

    // Build secp256r1 verify instruction
    const verifyIx = this.buildSecp256r1VerifyInstruction(
      publicKey,
      signature,
      message
    );

    // Build execute instruction
    const executeData = Buffer.concat([
      Buffer.from([2]), // execute discriminator
      Buffer.from([0]), // Send action
      to.toBuffer(),
      Buffer.from(new BigUint64Array([BigInt(lamports)]).buffer),
      Buffer.from([1]), // 1 signature
      Buffer.from([0]), // key index 0
      Buffer.from(signature),
    ]);

    const executeIx = new TransactionInstruction({
      keys: [
        { pubkey: identity, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: to, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: executeData,
    });

    // Build transaction with verify instruction first
    const tx = new Transaction();
    tx.add(verifyIx);
    tx.add(executeIx);

    // Note: This requires a relayer or user to sign as fee payer
    // For demo, you'd need to implement relayer support
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    // Send transaction (requires fee payer signature)
    const signature_tx = await this.connection.sendRawTransaction(tx.serialize());
    await this.connection.confirmTransaction(signature_tx);

    return signature_tx;
  }

  /**
   * Build secp256r1 verify instruction for the precompile
   */
  private buildSecp256r1VerifyInstruction(
    publicKey: Uint8Array,
    signature: Uint8Array,
    message: Uint8Array
  ): TransactionInstruction {
    const SECP256R1_PROGRAM_ID = new PublicKey(
      "Secp256r1SigVerify1111111111111111111111111"
    );

    // Hash the message with SHA-256
    const msgHash = new Uint8Array(32); // You'd use crypto.subtle.digest in browser

    const data = Buffer.concat([
      Buffer.from([1]), // number of signatures
      Buffer.from([0]), // padding
      Buffer.from([0, 0]), // signature offset (u16)
      Buffer.from([0]), // signature instruction index
      Buffer.from([0, 0]), // pubkey offset (u16)
      Buffer.from([0]), // pubkey instruction index
      Buffer.from([0, 0]), // message offset (u16)
      Buffer.from([0, 0]), // message size (u16)
      Buffer.from([0]), // message instruction index
      Buffer.from(signature), // 64 bytes
      Buffer.from(publicKey), // 33 bytes
      Buffer.from(msgHash), // 32 bytes
    ]);

    return new TransactionInstruction({
      keys: [],
      programId: SECP256R1_PROGRAM_ID,
      data,
    });
  }
}

