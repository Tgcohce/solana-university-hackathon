/**
 * API Client for Keystore Mobile App
 * Communicates with the hosted API at https://solana-university-hackathon.vercel.app
 */

import { PublicKey } from "@solana/web3.js";
import {
  CreateIdentityResponse,
  CreateIdentityRequest,
  ExecuteRequest,
  ExecuteResponse,
  ExecuteActionRequest,
  SignatureDataRequest,
  IdentityInfo,
  ApiError,
  TransactionHistoryResponse,
  AirdropResponse,
} from "./types/api";

// Base URL for the hosted API
const API_BASE_URL = "https://solana-university-hackathon.vercel.app";

/**
 * Fetch identity account info from the API
 */
export async function getIdentityInfo(
  identity: PublicKey | string
): Promise<IdentityInfo> {
  const identityStr = typeof identity === "string" ? identity : identity.toBase58();

  const response = await fetch(
    `${API_BASE_URL}/api/keystore/identity?identity=${encodeURIComponent(identityStr)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const error = data as ApiError;
    throw new Error(error.details || error.error || "Failed to fetch identity");
  }

  return data as IdentityInfo;
}

/**
 * Create a new identity on-chain via the API
 */
export async function createIdentity(
  pubkey: Uint8Array,
  deviceName: string
): Promise<CreateIdentityResponse> {
  // Validate pubkey length
  if (pubkey.length !== 33) {
    throw new Error("Public key must be 33 bytes (secp256r1 compressed format)");
  }

  const response = await fetch(`${API_BASE_URL}/api/keystore/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pubkey: Array.from(pubkey),
      deviceName,
    } as CreateIdentityRequest),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as ApiError;
    throw new Error(error.details || error.error || "Failed to create identity");
  }

  return data as CreateIdentityResponse;
}

/**
 * Helper to get PublicKey objects from the response
 */
export function parseCreateIdentityResponse(response: CreateIdentityResponse) {
  return {
    ...response,
    identity: new PublicKey(response.identityPDA),
    vault: new PublicKey(response.vaultPDA),
    publicKeyBytes: Buffer.from(response.pubkey, "base64"),
  };
}

/**
 * Execute a transaction (send SOL or set threshold) via the API
 */
export async function executeTransaction(
  identity: PublicKey | string,
  action:
    | { type: "send"; to: PublicKey | string; lamports: number }
    | { type: "setThreshold"; threshold: number },
  pubkey: Uint8Array,
  signatures: Array<{
    keyIndex: number;
    signature: Uint8Array;
    recoveryId: number;
  }>,
  authenticatorData: Uint8Array,
  clientDataJSON: Uint8Array
): Promise<ExecuteResponse> {
  // Validate pubkey length
  if (pubkey.length !== 33) {
    throw new Error("Public key must be 33 bytes (secp256r1 compressed format)");
  }

  // Validate signatures
  for (const sig of signatures) {
    if (sig.signature.length !== 64) {
      throw new Error("Each signature must be 64 bytes");
    }
  }

  // Convert action to API format
  const actionRequest: ExecuteActionRequest =
    action.type === "send"
      ? {
          type: "send",
          to: typeof action.to === "string" ? action.to : action.to.toBase58(),
          lamports: action.lamports,
        }
      : {
          type: "setThreshold",
          threshold: action.threshold,
        };

  // Convert signatures to API format
  const sigsRequest: SignatureDataRequest[] = signatures.map((sig) => ({
    keyIndex: sig.keyIndex,
    signature: Array.from(sig.signature),
    recoveryId: sig.recoveryId,
  }));

  const requestBody: ExecuteRequest = {
    identity: typeof identity === "string" ? identity : identity.toBase58(),
    action: actionRequest,
    pubkey: Array.from(pubkey),
    signatures: sigsRequest,
    authenticatorData: Array.from(authenticatorData),
    clientDataJSON: Array.from(clientDataJSON),
  };

  const response = await fetch(`${API_BASE_URL}/api/keystore/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as ApiError;
    throw new Error(error.details || error.error || "Failed to execute transaction");
  }

  return data as ExecuteResponse;
}

/**
 * Fetch transaction history for an identity
 * 
 * @param identity - The identity PDA as base58 string or PublicKey
 * @returns The transaction history
 */
export async function getTransactionHistory(
  identity: PublicKey | string
): Promise<TransactionHistoryResponse> {
  const identityStr = typeof identity === "string" ? identity : identity.toBase58();
  
  const response = await fetch(
    `${API_BASE_URL}/api/keystore/history?identity=${encodeURIComponent(identityStr)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const error = data as ApiError;
    throw new Error(error.details || error.error || "Failed to fetch transaction history");
  }

  return data as TransactionHistoryResponse;
}

/**
 * Request an airdrop of 0.1 SOL from the admin wallet
 * 
 * @param recipient - The recipient wallet address
 * @returns The airdrop result
 */
export async function requestAirdrop(
  recipient: PublicKey | string
): Promise<AirdropResponse> {
  const recipientStr = typeof recipient === "string" ? recipient : recipient.toBase58();
  
  const response = await fetch(`${API_BASE_URL}/api/keystore/airdrop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient: recipientStr }),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as ApiError;
    throw new Error(error.details || error.error || "Airdrop failed");
  }

  return data as AirdropResponse;
}
