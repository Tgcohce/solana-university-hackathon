import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction, 
  SystemProgram, 
  Keypair,
  SYSVAR_INSTRUCTIONS_PUBKEY
} from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";

// IMPORTANT: Update this after deploying the program
// Must match the program ID in programs/keystore/src/lib.rs and Anchor.toml
export const PROGRAM_ID = new PublicKey("6AjfeA3Pv24sGgLfDLQ3DD1zUHxHPPDNbGLMcarnCcBC");
export const SECP256R1_PROGRAM_ID = new PublicKey("Secp256r1SigVerify1111111111111111111111111");

/**
 * Compute Anchor instruction discriminator
 * Anchor uses first 8 bytes of SHA256("global:<instruction_name>")
 */
function getDiscriminator(instructionName: string): Buffer {
  const hash = sha256(`global:${instructionName}`);
  return Buffer.from(hash.slice(0, 8));
}

const DISCRIMINATORS = {
  createIdentity: getDiscriminator("create_identity"),
  execute: getDiscriminator("execute"),
  executeWebauthn: getDiscriminator("execute_webauthn"),
};

export function getIdentityPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("identity"), owner.toBuffer()],
    PROGRAM_ID
  );
}

// Derive identity PDA from a 33-byte passkey public key
export function getIdentityPDAFromPasskey(passkey: Uint8Array): [PublicKey, number] {
  // Use sha256 hash of passkey to get 32 bytes for seed
  const hash = sha256(passkey);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("identity"), Buffer.from(hash)],
    PROGRAM_ID
  );
}

export function getVaultPDA(identity: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), identity.toBuffer()],
    PROGRAM_ID
  );
}

export interface IdentityAccount {
  bump: number;
  vaultBump: number;
  threshold: number;
  nonce: number;
  keys: Array<{
    pubkey: Uint8Array;
    name: string;
    addedAt: number;
  }>;
}

export class KeystoreClient {
  constructor(private connection: Connection) {}

  buildMessage(
    action: { type: "send"; to: PublicKey; lamports: number } | { type: "setThreshold"; threshold: number },
    nonce: number
  ): Uint8Array {
    const data: number[] = [];
    
    if (action.type === "send") {
      data.push(0);
      data.push(...Array.from(action.to.toBytes()));
      const lamportBytes = new ArrayBuffer(8);
      new DataView(lamportBytes).setBigUint64(0, BigInt(action.lamports), true);
      data.push(...Array.from(new Uint8Array(lamportBytes)));
    } else {
      data.push(1);
      data.push(action.threshold);
    }
    
    const nonceBytes = new ArrayBuffer(8);
    new DataView(nonceBytes).setBigUint64(0, BigInt(nonce), true);
    data.push(...Array.from(new Uint8Array(nonceBytes)));
    
    return new Uint8Array(data);
  }

  async createIdentity(
    pubkey: Uint8Array,
    deviceName: string,
  ): Promise<{ tx: string; identity: PublicKey; vault: PublicKey; userKeypair: Keypair }> {
    // Admin wallet pays for transaction fees (relayer pattern)
    const adminWallet = await this.getFundedKeypair();
    
    // Identity PDA is derived from the passkey x-coordinate
    // This ties the on-chain identity to the user's biometric key
    const passkeyX = pubkey.slice(1, 33);
    const [identity] = PublicKey.findProgramAddressSync(
      [Buffer.from("identity"), Buffer.from(passkeyX)],
      PROGRAM_ID
    );
    const [vault] = getVaultPDA(identity);
    
    console.log("🔐 Creating Keyless wallet...");
    console.log("   Identity:", identity.toBase58());
    console.log("   Vault:", vault.toBase58());
    
    // Check if identity already exists
    const existingIdentity = await this.connection.getAccountInfo(identity);
    if (existingIdentity) {
      console.log("✅ Identity already exists, returning existing");
      return { tx: "existing", identity, vault, userKeypair: adminWallet };
    }
    
    // Build instruction data manually matching Anchor format:
    // - 8 bytes discriminator
    // - 33 bytes pubkey (fixed array)
    // - 4 bytes string length + string bytes
    
    const nameBytes = new TextEncoder().encode(deviceName);
    const dataLength = 8 + 33 + 4 + nameBytes.length;
    const data = new Uint8Array(dataLength);
    
    // Discriminator (8 bytes)
    data.set(DISCRIMINATORS.createIdentity, 0);
    
    // Pubkey (33 bytes - fixed array, no length prefix)
    data.set(pubkey, 8);
    
    // Device name (4-byte length prefix + bytes)
    const view = new DataView(data.buffer);
    view.setUint32(8 + 33, nameBytes.length, true);
    data.set(nameBytes, 8 + 33 + 4);
    
    const ix = new TransactionInstruction({
      keys: [
        { pubkey: adminWallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: identity, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: Buffer.from(data),
    });
    
    const tx = new Transaction().add(ix);
    
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = adminWallet.publicKey;
    tx.sign(adminWallet);
    
    const simulation = await this.connection.simulateTransaction(tx);
    if (simulation.value.err) {
      throw new Error(`Transaction failed: ${simulation.value.logs?.join('\n')}`);
    }
    
    const signature = await this.connection.sendTransaction(tx, [adminWallet]);
    await this.connection.confirmTransaction(signature, 'confirmed');
    
    const identityInfo = await this.connection.getAccountInfo(identity);
    if (!identityInfo) {
      throw new Error("Identity account was not created");
    }
    
    console.log("✅ Wallet created! Vault:", vault.toBase58());
    
    return { tx: signature, identity, vault, userKeypair: adminWallet };
  }

  async execute(
    identity: PublicKey,
    vault: PublicKey,
    params: {
      type: "send";
      to: PublicKey;
      lamports: number;
      nonce: number;
      pubkey: Uint8Array;
      signatures: { 
        keyIndex: number; 
        signature: Uint8Array; 
        signedMessage: Uint8Array;
        authenticatorData: Uint8Array;
        clientDataJSON: Uint8Array;
      }[];
    },
  ): Promise<string> {
    const adminWallet = await this.getFundedKeypair();
    const sig = params.signatures[0];
    
    // Build secp256r1 verify instruction for the actual signed data
    // WebAuthn signs: authenticatorData || SHA256(clientDataJSON)
    const verifyIx = this.buildSecp256r1Instruction(
      params.pubkey,
      sig.signedMessage,
      sig.signature
    );
    
    // Build action data (Send variant)
    const actionData = new Uint8Array(1 + 32 + 8);
    actionData[0] = 0; // Send variant
    actionData.set(params.to.toBytes(), 1);
    new DataView(actionData.buffer).setBigUint64(33, BigInt(params.lamports), true);
    
    // Build WebAuthnSignatureData struct:
    // - key_index: u8
    // - signature: [u8; 64]
    // - authenticator_data: Vec<u8> (4-byte length prefix + data)
    // - client_data_json: Vec<u8> (4-byte length prefix + data)
    const webauthnSigData = Buffer.concat([
      Buffer.from([sig.keyIndex]),
      Buffer.from(sig.signature),
      this.encodeVec(sig.authenticatorData),
      this.encodeVec(sig.clientDataJSON),
    ]);
    
    const executeData = Buffer.concat([
      DISCRIMINATORS.executeWebauthn,
      Buffer.from(actionData),
      webauthnSigData,
    ]);
    
    const executeIx = new TransactionInstruction({
      keys: [
        { pubkey: identity, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: params.to, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: executeData,
    });
    
    const tx = new Transaction();
    tx.add(verifyIx);
    tx.add(executeIx);
    
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = adminWallet.publicKey;
    tx.sign(adminWallet);
    
    // Simulate first to get better error messages
    const simulation = await this.connection.simulateTransaction(tx);
    if (simulation.value.err) {
      console.error("Simulation failed:", simulation.value.logs);
      throw new Error(`Transaction simulation failed: ${simulation.value.logs?.join('\n')}`);
    }
    
    const signature = await this.connection.sendTransaction(tx, [adminWallet]);
    await this.connection.confirmTransaction(signature);
    
    return signature;
  }

  private encodeVec(data: Uint8Array): Buffer {
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(data.length, 0);
    return Buffer.concat([lenBuf, Buffer.from(data)]);
  }

  private buildSecp256r1Instruction(
    pubkey: Uint8Array,
    message: Uint8Array,
    signature: Uint8Array
  ): TransactionInstruction {
    const messageHash = sha256(message);
    
    const headerSize = 12;
    const sigOffset = headerSize;
    const pkOffset = sigOffset + 64;
    const msgOffset = pkOffset + 33;
    const totalSize = msgOffset + messageHash.length;
    
    const data = new Uint8Array(totalSize);
    const view = new DataView(data.buffer);
    
    data[0] = 1;
    view.setUint16(1, sigOffset, true);
    data[3] = 0xff;
    view.setUint16(4, pkOffset, true);
    data[6] = 0xff;
    view.setUint16(7, msgOffset, true);
    view.setUint16(9, messageHash.length, true);
    data[11] = 0xff;
    
    data.set(signature, sigOffset);
    data.set(pubkey, pkOffset);
    data.set(messageHash, msgOffset);
    
    return new TransactionInstruction({
      keys: [],
      programId: SECP256R1_PROGRAM_ID,
      data: Buffer.from(data),
    });
  }

  async getIdentity(identityPDA: PublicKey): Promise<IdentityAccount | null> {
    try {
      const account = await this.connection.getAccountInfo(identityPDA);
      if (!account) return null;
      
      const data = account.data;
      return {
        bump: data[8],
        vaultBump: data[9],
        threshold: data[10],
        nonce: Number(new DataView(data.buffer, data.byteOffset).getBigUint64(11, true)),
        keys: [],
      };
    } catch (e) {
      console.error("Failed to fetch identity:", e);
      return null;
    }
  }

  async getFundedKeypair(): Promise<Keypair> {
    try {
      const response = await fetch('/admin-wallet.json');
      if (!response.ok) {
        throw new Error('Relayer wallet not found');
      }
      
      const secretKeyArray = await response.json();
      const keypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
      
      const balance = await this.connection.getBalance(keypair.publicKey);
      if (balance < 10000000) { // 0.01 SOL minimum
        throw new Error(`Relayer wallet needs more SOL. Current: ${balance / 1e9} SOL`);
      }
      
      return keypair;
    } catch (e: any) {
      throw new Error("Relayer service unavailable. Please try again later.");
    }
  }
}
