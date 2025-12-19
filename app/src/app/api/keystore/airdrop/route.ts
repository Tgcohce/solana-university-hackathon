import { NextRequest, NextResponse } from 'next/server';
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const AIRDROP_AMOUNT = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
const MAX_RECIPIENT_BALANCE = 0.3 * LAMPORTS_PER_SOL; // 0.3 SOL

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipient } = body;

    if (!recipient) {
      return NextResponse.json(
        { error: 'recipient is required' },
        { status: 400 }
      );
    }

    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(recipient);
    } catch {
      return NextResponse.json(
        { error: 'Invalid recipient public key' },
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

    const adminWalletJson = process.env.ADMIN_WALLET;
    if (!adminWalletJson) {
      return NextResponse.json(
        { error: 'ADMIN_WALLET not configured' },
        { status: 500 }
      );
    }

    // Parse admin wallet keypair
    let adminKeypair: Keypair;
    try {
      adminKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(adminWalletJson))
      );
    } catch {
      return NextResponse.json(
        { error: 'Invalid ADMIN_WALLET configuration' },
        { status: 500 }
      );
    }

    const connection = new Connection(rpcUrl, 'confirmed');

    // Check recipient balance - don't airdrop if they already have more than 0.3 SOL
    const recipientBalance = await connection.getBalance(recipientPubkey);
    if (recipientBalance >= MAX_RECIPIENT_BALANCE) {
      return NextResponse.json(
        { error: 'Your balance is already above 0.3 SOL. Airdrop is only available for wallets with less than 0.3 SOL.' },
        { status: 400 }
      );
    }

    // Check admin wallet balance
    const adminBalance = await connection.getBalance(adminKeypair.publicKey);
    if (adminBalance < AIRDROP_AMOUNT + 5000) { // 5000 lamports for fee
      return NextResponse.json(
        { error: 'Airdrop faucet is empty. Please try again later.' },
        { status: 503 }
      );
    }

    // Create transfer transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    const transaction = new Transaction({
      feePayer: adminKeypair.publicKey,
      recentBlockhash: blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: adminKeypair.publicKey,
        toPubkey: recipientPubkey,
        lamports: AIRDROP_AMOUNT,
      })
    );

    transaction.sign(adminKeypair);

    // Send and confirm
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    // Poll for confirmation
    let confirmed = false;
    for (let i = 0; i < 30; i++) {
      const status = await connection.getSignatureStatus(signature);
      
      if (status.value !== null) {
        if (status.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }
        if (status.value.confirmationStatus === 'confirmed' || 
            status.value.confirmationStatus === 'finalized') {
          confirmed = true;
          break;
        }
      }
      
      const blockHeight = await connection.getBlockHeight();
      if (blockHeight > lastValidBlockHeight) {
        throw new Error('Transaction expired');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!confirmed) {
      throw new Error('Transaction confirmation timeout');
    }

    return NextResponse.json({
      success: true,
      signature,
      amount: AIRDROP_AMOUNT / LAMPORTS_PER_SOL,
      recipient: recipientPubkey.toBase58(),
    });
  } catch (error) {
    console.error('Airdrop error:', error);
    return NextResponse.json(
      {
        error: 'Airdrop failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
