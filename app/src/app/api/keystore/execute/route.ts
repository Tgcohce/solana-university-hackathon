import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { KeystoreClient, Action, SignatureData } from '@/lib/keystore-client';
import { ExecuteRequest, ExecuteResponse } from '@/types/api';

export async function POST(request: NextRequest) {
  try {
    const body: ExecuteRequest = await request.json();
    const { identity, action, pubkey, signatures, authenticatorData, clientDataJSON } = body;

    // Validate required fields
    if (!identity) {
      return NextResponse.json(
        { error: 'identity is required' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      );
    }

    if (!pubkey) {
      return NextResponse.json(
        { error: 'pubkey is required' },
        { status: 400 }
      );
    }

    if (!signatures || signatures.length === 0) {
      return NextResponse.json(
        { error: 'at least one signature is required' },
        { status: 400 }
      );
    }

    if (!authenticatorData || !Array.isArray(authenticatorData)) {
      return NextResponse.json(
        { error: 'authenticatorData is required' },
        { status: 400 }
      );
    }

    if (!clientDataJSON || !Array.isArray(clientDataJSON)) {
      return NextResponse.json(
        { error: 'clientDataJSON is required' },
        { status: 400 }
      );
    }

    // Validate pubkey is 33 bytes
    if (!Array.isArray(pubkey) || pubkey.length !== 33) {
      return NextResponse.json(
        { error: 'pubkey must be a 33-byte array (secp256r1 compressed format)' },
        { status: 400 }
      );
    }

    // Validate signatures
    for (let i = 0; i < signatures.length; i++) {
      const sig = signatures[i];
      if (!Array.isArray(sig.signature) || sig.signature.length !== 64) {
        return NextResponse.json(
          { error: `signature at index ${i} must be a 64-byte array` },
          { status: 400 }
        );
      }
    }

    // Validate action
    if (action.type === 'send') {
      if (!action.to) {
        return NextResponse.json(
          { error: 'action.to is required for send action' },
          { status: 400 }
        );
      }
      if (action.lamports === undefined || action.lamports <= 0) {
        return NextResponse.json(
          { error: 'action.lamports must be a positive number for send action' },
          { status: 400 }
        );
      }
    } else if (action.type === 'setThreshold') {
      if (action.threshold === undefined || action.threshold <= 0) {
        return NextResponse.json(
          { error: 'action.threshold must be a positive number for setThreshold action' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'action.type must be "send" or "setThreshold"' },
        { status: 400 }
      );
    }

    const rpcUrl = process.env.SOLANA_RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json(
        { error: 'SOLANA_RPC_URL not configured' },
        { status: 500 }
      );
    }

    const adminWallet = process.env.ADMIN_WALLET;
    if (!adminWallet) {
      return NextResponse.json(
        { error: 'ADMIN_WALLET not configured' },
        { status: 500 }
      );
    }

    // Convert to proper types
    const identityPubkey = new PublicKey(identity);
    const pubkeyBytes = new Uint8Array(pubkey);

    // Convert action to internal format
    let internalAction: Action;
    if (action.type === 'send') {
      internalAction = {
        type: 'send',
        to: new PublicKey(action.to!),
        lamports: action.lamports!,
      };
    } else {
      internalAction = {
        type: 'setThreshold',
        threshold: action.threshold!,
      };
    }

    // Convert signatures to internal format
    const internalSigs: SignatureData[] = signatures.map(sig => ({
      keyIndex: sig.keyIndex,
      signature: new Uint8Array(sig.signature),
      recoveryId: sig.recoveryId,
    }));

    // Convert WebAuthn data to Uint8Arrays
    const authDataBytes = new Uint8Array(authenticatorData);
    const clientDataBytes = new Uint8Array(clientDataJSON);

    const connection = new Connection(rpcUrl, 'confirmed');
    const keystoreClient = new KeystoreClient(connection);

    console.log("Executing Transaction");
    const signature = await keystoreClient.executeTx(
      identityPubkey,
      internalAction,
      pubkeyBytes,
      internalSigs,
      authDataBytes,
      clientDataBytes
    );

    const res: ExecuteResponse = {
      success: true,
      signature,
      action,
    };
    return NextResponse.json(res);
  } catch (error) {
    console.error('Error executing transaction:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute transaction', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
