import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { KeystoreClient } from '@/lib/keystore-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const identityParam = searchParams.get('identity');

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

    const rpcUrl = process.env.SOLANA_RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json(
        { error: 'SOLANA_RPC_URL not configured' },
        { status: 500 }
      );
    }

    const connection = new Connection(rpcUrl, 'confirmed');
    const keystoreClient = new KeystoreClient(connection);

    const identityAccount = await keystoreClient.getIdentity(identityPubkey);
    console.log("Fetched identity account:", identityAccount);

    if (!identityAccount) {
      return NextResponse.json(
        { error: 'Identity not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      identity: identityParam,
      bump: identityAccount.bump,
      vaultBump: identityAccount.vaultBump,
      threshold: identityAccount.threshold,
      nonce: identityAccount.nonce,
      keys: identityAccount.keys,
    });
  } catch (error) {
    console.error('Error fetching identity:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch identity', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
