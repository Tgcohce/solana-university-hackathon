import { Connection, PublicKey, clusterApiUrl, Transaction, SystemProgram, TransactionInstruction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Buffer } from 'buffer';

// Polyfill Buffer for React Native
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Your deployed program ID - update after deployment
export const PROGRAM_ID = new PublicKey("BioDLEXFMcnU9vGCLwD2fYwAGHs7MKP3Usu6Z1ThnnQB");

export function getConnection(cluster: "devnet" | "mainnet-beta" | "testnet" = "devnet"): Connection {
  return new Connection(clusterApiUrl(cluster), "confirmed");
}

export function formatAddress(address: string, length: number = 4): string {
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

export function formatSOL(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

export async function getBalance(connection: Connection, address: PublicKey): Promise<number> {
  return await connection.getBalance(address);
}

export async function requestAirdrop(connection: Connection, address: PublicKey, amount: number = 1): Promise<string> {
  const signature = await connection.requestAirdrop(address, amount * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(signature);
  return signature;
}

// Derive PDA for identity account
export function getIdentityPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("identity"), owner.toBuffer()],
    PROGRAM_ID
  );
}

// Derive PDA for vault account
export function getVaultPDA(identity: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), identity.toBuffer()],
    PROGRAM_ID
  );
}

export interface IdentityAccount {
  owner: PublicKey;
  keys: { pubkey: number[]; deviceName: string }[];
  threshold: number;
  nonce: number;
}

export async function getIdentityAccount(
  connection: Connection,
  identity: PublicKey
): Promise<IdentityAccount | null> {
  try {
    const accountInfo = await connection.getAccountInfo(identity);
    if (!accountInfo) return null;

    const data = accountInfo.data;
    // Parse account data (simplified - adjust based on your actual account structure)
    return {
      owner: new PublicKey(data.slice(8, 40)),
      keys: [], // Parse keys from data
      threshold: data[40] || 1,
      nonce: Number(data.readBigUInt64LE(41)),
    };
  } catch (error) {
    console.error("Failed to get identity account:", error);
    return null;
  }
}

