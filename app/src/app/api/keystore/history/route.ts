import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, ParsedTransactionWithMeta, ConfirmedSignatureInfo } from '@solana/web3.js';
import { KeystoreClient } from '@/lib/keystore-client';

// Transaction history entry
interface TransactionHistoryEntry {
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

// Instruction discriminators from IDL
const INSTRUCTION_DISCRIMINATORS = {
  createIdentity: [12, 253, 209, 41, 176, 51, 195, 179],
  execute: [130, 221, 242, 154, 13, 193, 189, 29],
  addKey: [251, 19, 183, 109, 168, 179, 18, 195],
  registerCredential: [1, 125, 182, 19, 180, 151, 48, 231],
};

function matchesDiscriminator(data: Buffer | Uint8Array, discriminator: number[]): boolean {
  if (data.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (data[i] !== discriminator[i]) return false;
  }
  return true;
}

function parseActionType(data: Buffer | Uint8Array): 'send' | 'setThreshold' | 'unknown' {
  // After discriminator (8 bytes), action enum variant is next
  // Send = 0, SetThreshold = 1
  if (data.length > 8) {
    const actionByte = data[8];
    if (actionByte === 0) return 'send';
    if (actionByte === 1) return 'setThreshold';
  }
  return 'unknown';
}

function parseExecuteDetails(
  data: Buffer | Uint8Array, 
  tx: ParsedTransactionWithMeta
): { type: 'send' | 'setThreshold' | 'unknown'; details: TransactionHistoryEntry['details'] } {
  const actionType = parseActionType(data);
  const details: TransactionHistoryEntry['details'] = {};

  if (actionType === 'send') {
    // Send action: discriminator (8) + variant (1) + pubkey (32) + lamports (8)
    if (data.length >= 49) {
      const recipientBytes = data.slice(9, 41);
      details.recipient = new PublicKey(recipientBytes).toBase58();
      
      // Read lamports as u64 little-endian
      const lamportsBuffer = data.slice(41, 49);
      details.amount = Number(new DataView(lamportsBuffer.buffer, lamportsBuffer.byteOffset, 8).getBigUint64(0, true));
    }
  } else if (actionType === 'setThreshold') {
    // SetThreshold action: discriminator (8) + variant (1) + threshold (1)
    if (data.length >= 10) {
      details.threshold = data[9];
    }
  }

  return { type: actionType, details };
}

function parseTransactionType(
  tx: ParsedTransactionWithMeta,
  programId: string
): { type: TransactionHistoryEntry['type']; details: TransactionHistoryEntry['details'] } {
  const innerInstructions = tx.meta?.innerInstructions || [];
  const message = tx.transaction.message;

  // Look through all instructions for our program
  for (const ix of message.instructions) {
    if ('programId' in ix && ix.programId.toBase58() === programId) {
      // This is a compiled instruction, try to get data
      if ('data' in ix && typeof ix.data === 'string') {
        try {
          const data = Buffer.from(ix.data, 'base64');
          
          if (matchesDiscriminator(data, INSTRUCTION_DISCRIMINATORS.createIdentity)) {
            return { type: 'createIdentity', details: {} };
          }
          if (matchesDiscriminator(data, INSTRUCTION_DISCRIMINATORS.addKey)) {
            return { type: 'addKey', details: {} };
          }
          if (matchesDiscriminator(data, INSTRUCTION_DISCRIMINATORS.registerCredential)) {
            return { type: 'registerCredential', details: {} };
          }
          if (matchesDiscriminator(data, INSTRUCTION_DISCRIMINATORS.execute)) {
            return parseExecuteDetails(data, tx);
          }
        } catch (e) {
          console.error('Error parsing instruction data:', e);
        }
      }
    }
  }

  // Fallback: try to detect based on account changes
  const preBalances = tx.meta?.preBalances || [];
  const postBalances = tx.meta?.postBalances || [];
  
  if (preBalances.length > 0 && postBalances.length > 0) {
    // Check for SOL transfers
    for (let i = 0; i < preBalances.length; i++) {
      const diff = postBalances[i] - preBalances[i];
      if (diff > 0 && diff > (tx.meta?.fee || 0)) {
        // This account received SOL
        const accountKeys = message.accountKeys;
        if (accountKeys[i]) {
          return {
            type: 'send',
            details: {
              recipient: 'pubkey' in accountKeys[i] 
                ? accountKeys[i].pubkey.toBase58() 
                : accountKeys[i].toBase58(),
              amount: diff,
            },
          };
        }
      }
    }
  }

  return { type: 'unknown', details: {} };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const identityParam = searchParams.get('identity');
    const limitParam = searchParams.get('limit');
    const beforeParam = searchParams.get('before'); // For pagination

    if (!identityParam) {
      return NextResponse.json(
        { error: 'identity query parameter is required' },
        { status: 400 }
      );
    }

    let identityPubkey: PublicKey;
    try {
      identityPubkey = new PublicKey(identityParam);
    } catch {
      return NextResponse.json(
        { error: 'Invalid identity public key' },
        { status: 400 }
      );
    }

    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 20;

    const rpcUrl = process.env.SOLANA_RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json(
        { error: 'SOLANA_RPC_URL not configured' },
        { status: 500 }
      );
    }

    const connection = new Connection(rpcUrl, 'confirmed');
    const keystoreClient = new KeystoreClient(connection);
    const programId = keystoreClient.getProgramId().toBase58();

    // Also get the vault PDA to track all transactions
    const vaultPda = keystoreClient.getVaultPDA(identityPubkey);

    // Fetch signatures for both identity and vault
    const sigOptions: { limit: number; before?: string } = { limit };
    if (beforeParam) {
      sigOptions.before = beforeParam;
    }

    const [identitySignatures, vaultSignatures] = await Promise.all([
      connection.getSignaturesForAddress(identityPubkey, sigOptions),
      connection.getSignaturesForAddress(vaultPda, sigOptions),
    ]);

    // Merge and deduplicate signatures
    const signatureMap = new Map<string, ConfirmedSignatureInfo>();
    for (const sig of [...identitySignatures, ...vaultSignatures]) {
      if (!signatureMap.has(sig.signature)) {
        signatureMap.set(sig.signature, sig);
      }
    }

    // Sort by slot (newest first)
    const allSignatures = Array.from(signatureMap.values())
      .sort((a, b) => b.slot - a.slot)
      .slice(0, limit);

    if (allSignatures.length === 0) {
      return NextResponse.json({
        success: true,
        identity: identityParam,
        vault: vaultPda.toBase58(),
        transactions: [],
        hasMore: false,
      });
    }

    // Fetch parsed transactions individually (to avoid batch request limitations on free RPC plans)
    const history: TransactionHistoryEntry[] = [];
    for (const sigInfo of allSignatures) {
      try {
        const tx = await connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx) {
          // Still include basic info even if we can't fetch full tx
          history.push({
            signature: sigInfo.signature,
            blockTime: sigInfo.blockTime,
            slot: sigInfo.slot,
            status: sigInfo.err ? 'failed' : 'success',
            type: 'unknown',
            details: {},
            fee: 0,
          });
          continue;
        }

        const { type, details } = parseTransactionType(tx, programId);

        history.push({
          signature: sigInfo.signature,
          blockTime: sigInfo.blockTime,
          slot: sigInfo.slot,
          status: sigInfo.err ? 'failed' : 'success',
          type,
          details,
          fee: tx.meta?.fee || 0,
        });
      } catch (e) {
        // If individual tx fetch fails, still include basic info
        console.error(`Failed to fetch tx ${sigInfo.signature}:`, e);
        history.push({
          signature: sigInfo.signature,
          blockTime: sigInfo.blockTime,
          slot: sigInfo.slot,
          status: sigInfo.err ? 'failed' : 'success',
          type: 'unknown',
          details: {},
          fee: 0,
        });
      }
    }

    // Determine if there are more transactions
    const hasMore = allSignatures.length === limit;
    const lastSignature = allSignatures.length > 0 
      ? allSignatures[allSignatures.length - 1].signature 
      : null;

    return NextResponse.json({
      success: true,
      identity: identityParam,
      vault: vaultPda.toBase58(),
      transactions: history,
      hasMore,
      nextCursor: hasMore ? lastSignature : null,
    });
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch transaction history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
