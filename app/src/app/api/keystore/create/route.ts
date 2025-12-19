import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { KeystoreClient } from '@/lib/keystore-client';
import { CreateIdentityRequest, CreateIdentityResponse } from '@/types/api';

export async function POST(request: NextRequest) {
  try {
    const body: CreateIdentityRequest = await request.json();
    const { pubkey, deviceName } = body;

    if (!pubkey) {
      return NextResponse.json(
        { error: 'pubkey is required' },
        { status: 400 }
      );
    }

    if (!deviceName) {
      return NextResponse.json(
        { error: 'deviceName is required' },
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

    // Convert number array to Uint8Array
    const pubkeyBytes = new Uint8Array(pubkey);

    const connection = new Connection(rpcUrl, 'confirmed');
    const keystoreClient = new KeystoreClient(connection);

    const signature = await keystoreClient.createIdentityTx(pubkeyBytes, deviceName);

    const identityPDA = keystoreClient.getIdentityPDA(pubkeyBytes);
    const vaultPDA = keystoreClient.getVaultPDA(identityPDA);

    const res: CreateIdentityResponse = {
      success: true,
      signature,
      identityPDA: identityPDA.toBase58(),
      vaultPDA: vaultPDA.toBase58(),
      pubkey: Buffer.from(pubkeyBytes).toString('base64'),
      deviceName,
    };
    return NextResponse.json(res);
  } catch (error) {
    console.error('Error creating identity:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create identity', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
