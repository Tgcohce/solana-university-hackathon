export interface CreateIdentityResponse {
  success: boolean;
  signature: string;
  identityPDA: string;
  vaultPDA: string;
  pubkey: string;
  deviceName: string;
}

export interface CreateIdentityRequest {
  pubkey: number[]; // 33-byte secp256r1 compressed public key
  deviceName: string;
}

// Execute types
export interface ExecuteRequest {
  identity: string; // base58 identity PDA
  action: ExecuteActionRequest;
  pubkey: number[]; // 33-byte secp256r1 compressed public key
  signatures: SignatureDataRequest[];
  // WebAuthn data needed for signature verification
  authenticatorData: number[];
  clientDataJSON: number[];
}

export interface ExecuteActionRequest {
  type: "send" | "setThreshold";
  to?: string; // base58 recipient (for send)
  lamports?: number; // amount in lamports (for send)
  threshold?: number; // new threshold (for setThreshold)
}

export interface SignatureDataRequest {
  keyIndex: number;
  signature: number[]; // 64-byte signature as number array
  recoveryId: number;
}

export interface ExecuteResponse {
  success: boolean;
  signature: string;
  action: ExecuteActionRequest;
}

// History types
export interface TransactionHistoryEntry {
  signature: string;
  blockTime: number | null;
  slot: number;
  status: 'success' | 'failed';
  type: 'send' | 'setThreshold' | 'createIdentity' | 'addKey' | 'registerCredential' | 'unknown';
  details: {
    recipient?: string;
    amount?: number; // in lamports
    threshold?: number;
    deviceName?: string;
  };
  fee: number;
}

export interface TransactionHistoryResponse {
  success: boolean;
  identity: string;
  vault: string;
  transactions: TransactionHistoryEntry[];
  hasMore: boolean;
  nextCursor: string | null;
}
