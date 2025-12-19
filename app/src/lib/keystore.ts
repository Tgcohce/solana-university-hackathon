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

export const PROGRAM_ID = new PublicKey("4DS5K64SuWK6PmN1puZVtPouLWCqQDA3aE58MPPuDXu2");
export const SECP256R1_PROGRAM_ID = new PublicKey("Secp256r1SigVerify1111111111111111111111111");

/**
 * Compute Anchor instruction discriminator
 * Anchor uses first 8 bytes of SHA256("global:<instruction_name>")
 */
function getDiscriminator(instructionName: string): Buffer {
  const hash = sha256(`global:${instructionName}`);
  return Buffer.from(hash.slice(0, 8));
}

// Pre-computed discriminators (will be verified at runtime)
const DISCRIMINATORS = {
  createIdentity: getDiscriminator("create_identity"),
  addKey: getDiscriminator("add_key"),
  execute: getDiscriminator("execute"),
  registerCredential: getDiscriminator("register_credential"),
};

/**
 * Build a proper secp256r1 verification instruction
 * This instruction must precede the execute instruction in the transaction
 */
function buildSecp256r1Instruction(
  pubkey: Uint8Array,    // 33 bytes compressed public key
  message: Uint8Array,   // The message that was signed
  signature: Uint8Array  // 64 bytes raw signature (r || s)
): TransactionInstruction {
  // secp256r1 instruction format:
  // Header (12 bytes):
  //   - num_signatures: u8 (1)
  //   - signature_offset: u16 (offset to signature in data)
  //   - signature_instruction_index: u8 (0xFF = this instruction)
  //   - pubkey_offset: u16 (offset to pubkey in data)
  //   - pubkey_instruction_index: u8 (0xFF = this instruction)
  //   - message_offset: u16 (offset to message in data)
  //   - message_size: u16 (size of message)
  //   - message_instruction_index: u8 (0xFF = this instruction)
  // Data:
  //   - signature: 64 bytes
  //   - pubkey: 33 bytes (compressed)
  //   - message: variable length (usually 32 bytes hash)
  
  // For secp256r1, the message should be the SHA-256 hash
  const messageHash = sha256(message);
  
  const headerSize = 12;
  const sigOffset = headerSize;
  const pkOffset = sigOffset + 64;
  const msgOffset = pkOffset + 33;
  const totalSize = msgOffset + messageHash.length;
  
  const data = new Uint8Array(totalSize);
  const view = new DataView(data.buffer);
  
  // Header
  data[0] = 1; // num_signatures
  view.setUint16(1, sigOffset, true); // signature_offset
  data[3] = 0xff; // signature in this instruction
  view.setUint16(4, pkOffset, true); // pubkey_offset
  data[6] = 0xff; // pubkey in this instruction
  view.setUint16(7, msgOffset, true); // message_offset
  view.setUint16(9, messageHash.length, true); // message_size
  data[11] = 0xff; // message in this instruction
  
  // Data
  data.set(signature, sigOffset);
  data.set(pubkey, pkOffset);
  data.set(messageHash, msgOffset);
  
  return new TransactionInstruction({
    keys: [],
    programId: SECP256R1_PROGRAM_ID,
    data: Buffer.from(data),
  });
}

export function getIdentityPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("identity"), owner.toBuffer()],
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
      data.push(0); // Send variant
      data.push(...action.to.toBytes());
      const lamportBytes = new ArrayBuffer(8);
      new DataView(lamportBytes).setBigUint64(0, BigInt(action.lamports), true);
      data.push(...new Uint8Array(lamportBytes));
    } else {
      data.push(1); // SetThreshold variant
      data.push(action.threshold);
    }
    
    // Add nonce
    const nonceBytes = new ArrayBuffer(8);
    new DataView(nonceBytes).setBigUint64(0, BigInt(nonce), true);
    data.push(...new Uint8Array(nonceBytes));
    
    return new Uint8Array(data);
  }

  async createIdentity(
    pubkey: Uint8Array,
    deviceName: string,
    payer?: Keypair
  ): Promise<{ tx: string; identity: PublicKey; vault: PublicKey }> {
    // For hackathon demo: use hardcoded funded keypair or request one
    // In production: use relayer service
    const actualPayer = payer || await this.getFundedKeypair();
    
    const [identity] = getIdentityPDA(actualPayer.publicKey);
    const [vault] = getVaultPDA(identity);
    
    // Encode device name as string (4-byte length prefix + UTF-8 bytes)
    const nameEncoded = new TextEncoder().encode(deviceName);
    const nameBuffer = new Uint8Array(4 + nameEncoded.length);
    new DataView(nameBuffer.buffer).setUint32(0, nameEncoded.length, true);
    nameBuffer.set(nameEncoded, 4);
    
    // Use properly computed Anchor discriminator
    const data = Buffer.concat([
      DISCRIMINATORS.createIdentity,
      Buffer.from(pubkey),
      nameBuffer,
    ]);
    
    const ix = new TransactionInstruction({
      keys: [
        { pubkey: actualPayer.publicKey, isSigner: true, isWritable: true },
        { pubkey: identity, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    });
    
    const tx = new Transaction().add(ix);
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = actualPayer.publicKey;
    tx.sign(actualPayer);
    
    const signature = await this.connection.sendTransaction(tx, [actualPayer]);
    await this.connection.confirmTransaction(signature);
    
    return { tx: signature, identity, vault };
  }

  async addKey(
    identity: PublicKey,
    newPubkey: Uint8Array,
    deviceName: string,
    payer?: Keypair
  ): Promise<string> {
    const actualPayer = payer || await this.getFundedKeypair();
    
    const nameEncoded = new TextEncoder().encode(deviceName);
    const nameBuffer = new Uint8Array(4 + nameEncoded.length);
    new DataView(nameBuffer.buffer).setUint32(0, nameEncoded.length, true);
    nameBuffer.set(nameEncoded, 4);
    
    // Use properly computed Anchor discriminator
    const data = Buffer.concat([
      DISCRIMINATORS.addKey,
      Buffer.from(newPubkey),
      nameBuffer,
    ]);
    
    const ix = new TransactionInstruction({
      keys: [
        { pubkey: actualPayer.publicKey, isSigner: true, isWritable: true },
        { pubkey: identity, isSigner: false, isWritable: true },
      ],
      programId: PROGRAM_ID,
      data,
    });
    
    const tx = new Transaction().add(ix);
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = actualPayer.publicKey;
    tx.sign(actualPayer);
    
    const signature = await this.connection.sendTransaction(tx, [actualPayer]);
    await this.connection.confirmTransaction(signature);
    
    return signature;
  }

  async execute(
    identity: PublicKey,
    vault: PublicKey,
    params: {
      type: "send";
      to: PublicKey;
      lamports: number;
      nonce: number;
      pubkey: Uint8Array;  // The secp256r1 public key that signed
      signatures: { keyIndex: number; signature: Uint8Array }[];
    },
    payer?: Keypair
  ): Promise<string> {
    const actualPayer = payer || await this.getFundedKeypair();
    
    // Build the message that was signed (action + nonce)
    const message = this.buildMessage({ type: "send", to: params.to, lamports: params.lamports }, params.nonce);
    
    // Build REAL secp256r1 verify instruction for each signature
    // Each signature needs its own verification instruction
    const verifyInstructions: TransactionInstruction[] = [];
    for (const sig of params.signatures) {
      const verifyIx = buildSecp256r1Instruction(
        params.pubkey,
        message,
        sig.signature
      );
      verifyInstructions.push(verifyIx);
    }
    
    // Encode action (Send variant)
    const actionData = new Uint8Array(1 + 32 + 8);
    actionData[0] = 0; // Send variant
    actionData.set(params.to.toBytes(), 1);
    new DataView(actionData.buffer).setBigUint64(33, BigInt(params.lamports), true);
    
    // Encode signatures vector
    const sigsData = new Uint8Array(4 + params.signatures.length * 66);
    new DataView(sigsData.buffer).setUint32(0, params.signatures.length, true);
    let offset = 4;
    for (const sig of params.signatures) {
      sigsData[offset++] = sig.keyIndex;
      sigsData.set(sig.signature, offset);
      offset += 64;
      sigsData[offset++] = 0; // recovery_id
    }
    
    // Use properly computed Anchor discriminator
    const executeData = Buffer.concat([
      DISCRIMINATORS.execute,
      Buffer.from(actionData),
      Buffer.from(sigsData),
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
    
    // Add all verify instructions BEFORE execute instruction
    const tx = new Transaction();
    for (const verifyIx of verifyInstructions) {
      tx.add(verifyIx);
    }
    tx.add(executeIx);
    
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = actualPayer.publicKey;
    tx.sign(actualPayer);
    
    const signature = await this.connection.sendTransaction(tx, [actualPayer]);
    await this.connection.confirmTransaction(signature);
    
    return signature;
  }

  async getIdentity(identityPDA: PublicKey): Promise<IdentityAccount | null> {
    try {
      const account = await this.connection.getAccountInfo(identityPDA);
      if (!account) return null;
      
      // Parse account data (simplified for demo)
      // In production, use Anchor's IDL-based deserialization
      const data = account.data;
      return {
        bump: data[8],
        vaultBump: data[9],
        threshold: data[10],
        nonce: Number(new DataView(data.buffer).getBigUint64(11, true)),
        keys: [], // TODO: Parse keys vector
      };
    } catch (e) {
      console.error("Failed to fetch identity:", e);
      return null;
    }
  }

  private async getFundedKeypair(): Promise<Keypair> {
    // For hackathon demo: generate and airdrop
    // In production: use relayer service
    const keypair = Keypair.generate();
    
    try {
      console.log("Requesting airdrop for:", keypair.publicKey.toBase58());
      const signature = await this.connection.requestAirdrop(
        keypair.publicKey,
        1000000000 // 1 SOL
      );
      
      // Wait for confirmation with retries
      const latestBlockhash = await this.connection.getLatestBlockhash();
      await this.connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed');
      
      // Verify balance
      const balance = await this.connection.getBalance(keypair.publicKey);
      console.log("Airdrop successful, balance:", balance / 1e9, "SOL");
      
      if (balance === 0) {
        throw new Error("Airdrop completed but balance is still 0");
      }
    } catch (e: any) {
      console.error("Airdrop failed:", e);
      throw new Error(
        "Failed to fund transaction payer. " +
        "Devnet airdrop may be rate limited. " +
        "Please try again in a few moments or use a pre-funded keypair."
      );
    }
    
    return keypair;
  }
}

