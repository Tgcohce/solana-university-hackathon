/**
 * Solana Utilities for Keystore Mobile App
 * Provides connection helpers and formatting utilities
 */

import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Buffer } from "buffer";

// Polyfill Buffer for React Native
if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer;
}

/**
 * Get a Solana connection for the specified cluster
 */
export function getConnection(
  cluster: "devnet" | "mainnet-beta" | "testnet" = "devnet"
): Connection {
  return new Connection(clusterApiUrl(cluster), "confirmed");
}

/**
 * Format a Solana address for display (shortened)
 */
export function formatAddress(address: string, length: number = 4): string {
  if (!address || address.length < length * 2) return address;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

/**
 * Format lamports as SOL string
 */
export function formatSOL(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

/**
 * Convert lamports to SOL number
 */
export function lamportsToSOL(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

/**
 * Request an airdrop of devnet SOL
 */
export async function requestAirdrop(
  connection: Connection,
  address: PublicKey,
  amount: number = 1
): Promise<string> {
  const signature = await connection.requestAirdrop(address, amount * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(signature);
  return signature;
}

/**
 * Get balance in lamports
 */
export async function getBalance(
  connection: Connection,
  address: PublicKey
): Promise<number> {
  return await connection.getBalance(address);
}

