"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  KeylessClient: () => KeylessClient,
  Keypair: () => import_web33.Keypair,
  LAMPORTS_PER_SOL: () => import_web33.LAMPORTS_PER_SOL,
  PublicKey: () => import_web33.PublicKey,
  SECP256R1_PROGRAM_ID: () => SECP256R1_PROGRAM_ID,
  buildMessage: () => buildMessage,
  buildSecp256r1Instruction: () => buildSecp256r1Instruction,
  clearStoredCredential: () => clearStoredCredential,
  createPasskey: () => createPasskey,
  getStoredCredential: () => getStoredCredential,
  hasStoredCredential: () => hasStoredCredential,
  lamportsToSol: () => lamportsToSol,
  signWithPasskey: () => signWithPasskey,
  solToLamports: () => solToLamports,
  storeCredential: () => storeCredential
});
module.exports = __toCommonJS(index_exports);

// src/client.ts
var import_web32 = require("@solana/web3.js");
var import_sha2562 = require("@noble/hashes/sha256");

// src/secp256r1.ts
var import_web3 = require("@solana/web3.js");
var import_sha256 = require("@noble/hashes/sha256");
var SECP256R1_PROGRAM_ID = new import_web3.PublicKey(
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
  const clientDataHash = (0, import_sha256.sha256)(clientDataJSON);
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
    instruction: new import_web3.TransactionInstruction({
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
var KeylessClient = class {
  /**
   * Create a new KeylessClient instance
   * 
   * @param config - Configuration options
   */
  constructor(config) {
    this.connection = new import_web32.Connection(config.rpcUrl, "confirmed");
    this.programId = new import_web32.PublicKey(
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
  getIdentityPDA(pubkey) {
    if (pubkey.length !== 33) {
      throw new Error("Public key must be 33 bytes (compressed secp256r1)");
    }
    return import_web32.PublicKey.findProgramAddressSync(
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
  getVaultPDA(identity) {
    return import_web32.PublicKey.findProgramAddressSync(
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
   * 
   * @example
   * ```typescript
   * const balance = await client.getVaultBalance(vaultPDA);
   * console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");
   * ```
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
   * This is a convenience method that wraps the message builder.
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
    const discriminator = this.getDiscriminator("create_identity");
    const nameBytes = new TextEncoder().encode(deviceName);
    const dataLength = 8 + 33 + 4 + nameBytes.length;
    const data = new Uint8Array(dataLength);
    data.set(discriminator, 0);
    data.set(pubkey, 8);
    const view = new DataView(data.buffer);
    view.setUint32(8 + 33, nameBytes.length, true);
    data.set(nameBytes, 8 + 33 + 4);
    const ix = new import_web32.TransactionInstruction({
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: identity, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: false },
        { pubkey: import_web32.SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId: this.programId,
      data: Buffer.from(data)
    });
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    const tx = new import_web32.Transaction({
      feePayer: payer.publicKey,
      recentBlockhash: blockhash
    }).add(ix);
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
    const executeIx = await this.buildExecuteInstruction(
      identity,
      vault,
      action,
      [{ keyIndex: 0, signature: signature.signature, recoveryId: 0 }],
      signedData,
      action.type === "send" ? action.to : null
    );
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    const tx = new import_web32.Transaction({
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
  getDiscriminator(instructionName) {
    const hash = (0, import_sha2562.sha256)(`global:${instructionName}`);
    return hash.slice(0, 8);
  }
  async buildExecuteInstruction(identity, vault, action, sigs, signedData, recipient) {
    const discriminator = this.getDiscriminator("execute");
    let actionData;
    if (action.type === "send") {
      actionData = new Uint8Array(1 + 32 + 8);
      actionData[0] = 0;
      actionData.set(action.to.toBytes(), 1);
      new DataView(actionData.buffer).setBigUint64(33, BigInt(action.lamports), true);
    } else {
      actionData = new Uint8Array(2);
      actionData[0] = 1;
      actionData[1] = action.threshold;
    }
    const sigsData = new Uint8Array(4 + sigs.length * 66);
    new DataView(sigsData.buffer).setUint32(0, sigs.length, true);
    let offset = 4;
    for (const sig of sigs) {
      sigsData[offset++] = sig.keyIndex;
      sigsData.set(sig.signature, offset);
      offset += 64;
      sigsData[offset++] = sig.recoveryId;
    }
    const signedDataWithLen = new Uint8Array(4 + signedData.length);
    new DataView(signedDataWithLen.buffer).setUint32(0, signedData.length, true);
    signedDataWithLen.set(signedData, 4);
    const data = Buffer.concat([
      Buffer.from(discriminator),
      Buffer.from(actionData),
      Buffer.from(sigsData),
      Buffer.from(signedDataWithLen)
    ]);
    const keys = [
      { pubkey: identity, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: recipient || identity, isSigner: false, isWritable: true },
      { pubkey: import_web32.SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: import_web32.SystemProgram.programId, isSigner: false, isWritable: false }
    ];
    return new import_web32.TransactionInstruction({
      keys,
      programId: this.programId,
      data
    });
  }
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
var import_web33 = require("@solana/web3.js");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  KeylessClient,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
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
});
