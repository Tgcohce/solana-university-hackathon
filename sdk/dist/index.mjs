// src/client.ts
import {
  Connection,
  PublicKey as PublicKey2,
  Transaction
} from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";

// src/secp256r1.ts
import { TransactionInstruction, PublicKey } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";
var SECP256R1_PROGRAM_ID = new PublicKey(
  "Secp256r1SigVerify1111111111111111111111111"
);
var SECP256R1_N = BigInt(
  "0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551"
);
var SECP256R1_HALF_N = SECP256R1_N / 2n;
function buildSecp256r1Instruction(pubkey, authenticatorData, clientDataJSON, signature) {
  if (pubkey.length !== 33) {
    throw new Error(`Invalid pubkey length: ${pubkey.length}, expected 33`);
  }
  if (signature.length !== 64) {
    throw new Error(`Invalid signature length: ${signature.length}, expected 64`);
  }
  const clientDataHash = sha256(clientDataJSON);
  const signedData = new Uint8Array(authenticatorData.length + clientDataHash.length);
  signedData.set(authenticatorData, 0);
  signedData.set(clientDataHash, authenticatorData.length);
  const normalizedSig = normalizeSignature(signature);
  const headerSize = 2;
  const offsetsSize = 14;
  const dataStart = headerSize + offsetsSize;
  const pkOffset = dataStart;
  const sigOffset = pkOffset + 33;
  const msgOffset = sigOffset + 64;
  const totalSize = msgOffset + signedData.length;
  const data = new Uint8Array(totalSize);
  const view = new DataView(data.buffer);
  data[0] = 1;
  data[1] = 0;
  let offset = 2;
  view.setUint16(offset, sigOffset, true);
  offset += 2;
  view.setUint16(offset, 65535, true);
  offset += 2;
  view.setUint16(offset, pkOffset, true);
  offset += 2;
  view.setUint16(offset, 65535, true);
  offset += 2;
  view.setUint16(offset, msgOffset, true);
  offset += 2;
  view.setUint16(offset, signedData.length, true);
  offset += 2;
  view.setUint16(offset, 65535, true);
  data.set(pubkey, pkOffset);
  data.set(normalizedSig, sigOffset);
  data.set(signedData, msgOffset);
  return {
    instruction: new TransactionInstruction({
      keys: [],
      programId: SECP256R1_PROGRAM_ID,
      data: Buffer.from(data)
    }),
    signedData
  };
}
function normalizeSignature(signature) {
  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);
  let sValue = BigInt(0);
  for (let i = 0; i < 32; i++) {
    sValue = sValue << 8n | BigInt(s[i]);
  }
  if (sValue > SECP256R1_HALF_N) {
    sValue = SECP256R1_N - sValue;
    const normalizedS = new Uint8Array(32);
    let temp = sValue;
    for (let i = 31; i >= 0; i--) {
      normalizedS[i] = Number(temp & 0xffn);
      temp = temp >> 8n;
    }
    const normalizedSig = new Uint8Array(64);
    normalizedSig.set(r, 0);
    normalizedSig.set(normalizedS, 32);
    return normalizedSig;
  }
  return signature;
}

// src/message.ts
function buildMessage(action, nonce) {
  const data = [];
  if (action.type === "send") {
    data.push(0);
    data.push(...action.to.toBytes());
    const lamportBytes = new ArrayBuffer(8);
    new DataView(lamportBytes).setBigUint64(0, BigInt(action.lamports), true);
    data.push(...new Uint8Array(lamportBytes));
  } else {
    data.push(1);
    data.push(action.threshold);
  }
  const nonceBytes = new ArrayBuffer(8);
  new DataView(nonceBytes).setBigUint64(0, BigInt(nonce), true);
  data.push(...new Uint8Array(nonceBytes));
  return new Uint8Array(data);
}
function solToLamports(sol) {
  return Math.floor(sol * 1e9);
}
function lamportsToSol(lamports) {
  return lamports / 1e9;
}

// src/client.ts
var KEYSTORE_IDL = {
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
var KeylessClient = class {
  /**
   * Create a new KeylessClient instance
   * 
   * @param config - Configuration options
   */
  constructor(config) {
    this.connection = new Connection(config.rpcUrl, "confirmed");
    const provider = { connection: this.connection };
    const idl = config.idl || KEYSTORE_IDL;
    if (config.programId) {
      idl.address = config.programId;
    }
    this.program = new Program(idl, provider);
  }
  /**
   * Get the program ID
   */
  get programId() {
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
  getIdentityPDA(pubkey) {
    if (pubkey.length !== 33) {
      throw new Error("Public key must be 33 bytes (compressed secp256r1)");
    }
    return PublicKey2.findProgramAddressSync(
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
  getVaultPDA(identity) {
    return PublicKey2.findProgramAddressSync(
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
  async getIdentity(identity) {
    try {
      const account = await this.connection.getAccountInfo(identity);
      if (!account) return null;
      const data = account.data;
      return {
        bump: data[8],
        vaultBump: data[9],
        threshold: data[10],
        nonce: Number(new DataView(data.buffer, data.byteOffset).getBigUint64(11, true)),
        keys: []
        // TODO: Full key parsing
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
  async getVaultBalance(vault) {
    return await this.connection.getBalance(vault);
  }
  /**
   * Check if an identity exists on-chain
   * 
   * @param identity - The identity PDA address
   * @returns true if the identity exists
   */
  async identityExists(identity) {
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
  buildMessage(action, nonce) {
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
  async createIdentity(pubkey, deviceName, payer) {
    if (pubkey.length !== 33) {
      throw new Error("Public key must be 33 bytes (compressed secp256r1)");
    }
    const identity = this.getIdentityPDA(pubkey);
    const vault = this.getVaultPDA(identity);
    const exists = await this.identityExists(identity);
    if (exists) {
      return {
        signature: "existing",
        identity,
        vault,
        publicKey: pubkey
      };
    }
    const createIx = await this.program.methods.createIdentity(
      Array.from(pubkey),
      deviceName
    ).accounts({
      payer: payer.publicKey,
      identity
    }).instruction();
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    const tx = new Transaction({
      feePayer: payer.publicKey,
      recentBlockhash: blockhash
    }).add(createIx);
    tx.sign(payer);
    const signature = await this.connection.sendRawTransaction(tx.serialize());
    await this.confirmTransaction(signature, lastValidBlockHeight);
    return {
      signature,
      identity,
      vault,
      publicKey: pubkey
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
  async execute(identity, action, pubkey, signature, payer) {
    if (pubkey.length !== 33) {
      throw new Error("Public key must be 33 bytes");
    }
    const vault = this.getVaultPDA(identity);
    const identityAccount = await this.getIdentity(identity);
    if (!identityAccount) {
      throw new Error("Identity account not found");
    }
    const { instruction: verifyIx, signedData } = buildSecp256r1Instruction(
      pubkey,
      signature.authenticatorData,
      signature.clientDataJSON,
      signature.signature
    );
    const anchorAction = action.type === "send" ? { send: { to: action.to, lamports: new BN(action.lamports) } } : { setThreshold: { threshold: action.threshold } };
    const anchorSigs = [{
      keyIndex: 0,
      signature: Array.from(signature.signature),
      recoveryId: 0
    }];
    const recipient = action.type === "send" ? action.to : null;
    const executeIx = await this.program.methods.execute(anchorAction, anchorSigs, Buffer.from(signedData)).accounts({
      identity,
      vault,
      recipient
    }).instruction();
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    const tx = new Transaction({
      feePayer: payer.publicKey,
      recentBlockhash: blockhash
    });
    tx.add(verifyIx);
    tx.add(executeIx);
    tx.sign(payer);
    const sig = await this.connection.sendRawTransaction(tx.serialize());
    await this.confirmTransaction(sig, lastValidBlockHeight);
    return {
      signature: sig,
      newNonce: identityAccount.nonce + 1
    };
  }
  // ============================================================================
  // Internal Helpers
  // ============================================================================
  async confirmTransaction(signature, lastValidBlockHeight, maxRetries = 30) {
    for (let i = 0; i < maxRetries; i++) {
      const status = await this.connection.getSignatureStatus(signature);
      if (status.value !== null) {
        if (status.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }
        if (status.value.confirmationStatus === "confirmed" || status.value.confirmationStatus === "finalized") {
          return;
        }
      }
      const blockHeight = await this.connection.getBlockHeight();
      if (blockHeight > lastValidBlockHeight) {
        throw new Error("Transaction expired: blockhash no longer valid");
      }
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    }
    throw new Error("Transaction confirmation timeout");
  }
};

// src/passkey.ts
async function createPasskey(username, rpName = "Keyless", rpId) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: rpName,
        id: rpId || window.location.hostname
      },
      user: {
        id: new TextEncoder().encode(username),
        name: username,
        displayName: username
      },
      // ES256 = ECDSA with P-256 (secp256r1)
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "required"
      },
      timeout: 6e4
    }
  });
  const response = credential.response;
  const publicKey = extractPublicKey(response.getPublicKey());
  return {
    publicKey,
    credentialId: new Uint8Array(credential.rawId)
  };
}
async function signWithPasskey(credentialId, message, rpId) {
  const messageBuffer = new ArrayBuffer(message.length);
  new Uint8Array(messageBuffer).set(message);
  const credIdBuffer = new ArrayBuffer(credentialId.length);
  new Uint8Array(credIdBuffer).set(credentialId);
  const msgHash = await crypto.subtle.digest("SHA-256", messageBuffer);
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array(msgHash),
      rpId: rpId || window.location.hostname,
      allowCredentials: [{
        id: credIdBuffer,
        type: "public-key"
      }],
      userVerification: "required",
      timeout: 6e4
    }
  });
  const response = credential.response;
  return {
    signature: derToRaw(new Uint8Array(response.signature)),
    authenticatorData: new Uint8Array(response.authenticatorData),
    clientDataJSON: new Uint8Array(response.clientDataJSON)
  };
}
var STORAGE_KEY = "keyless_credential";
function storeCredential(credential) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credential));
}
function getStoredCredential() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}
function clearStoredCredential() {
  localStorage.removeItem(STORAGE_KEY);
}
function hasStoredCredential() {
  return localStorage.getItem(STORAGE_KEY) !== null;
}
function extractPublicKey(spki) {
  const raw = new Uint8Array(spki);
  const uncompressed = raw.slice(-65);
  const x = uncompressed.slice(1, 33);
  const y = uncompressed.slice(33, 65);
  const prefix = (y[31] & 1) === 0 ? 2 : 3;
  const compressed = new Uint8Array(33);
  compressed[0] = prefix;
  compressed.set(x, 1);
  return compressed;
}
function derToRaw(der) {
  let offset = 2;
  const rLen = der[offset + 1];
  const r = der.slice(offset + 2, offset + 2 + rLen);
  offset += 2 + rLen;
  const sLen = der[offset + 1];
  const s = der.slice(offset + 2, offset + 2 + sLen);
  const raw = new Uint8Array(64);
  if (r.length > 32) {
    raw.set(r.slice(-32), 0);
  } else {
    raw.set(r, 32 - r.length);
  }
  if (s.length > 32) {
    raw.set(s.slice(-32), 32);
  } else {
    raw.set(s, 64 - s.length);
  }
  return raw;
}

// src/index.ts
import { PublicKey as PublicKey3, Keypair as Keypair2, LAMPORTS_PER_SOL } from "@solana/web3.js";
export {
  KeylessClient,
  Keypair2 as Keypair,
  LAMPORTS_PER_SOL,
  PublicKey3 as PublicKey,
  SECP256R1_PROGRAM_ID,
  buildMessage,
  buildSecp256r1Instruction,
  clearStoredCredential,
  createPasskey,
  getStoredCredential,
  hasStoredCredential,
  lamportsToSol,
  signWithPasskey,
  solToLamports,
  storeCredential
};
