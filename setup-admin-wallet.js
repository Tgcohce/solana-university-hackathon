#!/usr/bin/env node
/**
 * Setup script to create and fund an admin wallet for demo
 * This wallet pays for transaction fees so users don't need SOL
 */

const { Keypair, Connection, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🔧 Setting up admin wallet for Keystore demo...\n');
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Check if there's already a wallet
  const envPath = path.join(__dirname, 'app', '.env.local');
  let keypair;
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/NEXT_PUBLIC_ADMIN_KEYPAIR=\[(.*?)\]/);
    
    if (match && match[1]) {
      try {
        const secretKey = new Uint8Array(JSON.parse(`[${match[1]}]`));
        keypair = Keypair.fromSecretKey(secretKey);
        console.log('✅ Found existing admin wallet');
        console.log('📍 Address:', keypair.publicKey.toBase58());
      } catch (e) {
        console.log('⚠️  Invalid keypair in .env.local, generating new one...');
      }
    }
  }
  
  // Generate new keypair if needed
  if (!keypair) {
    keypair = Keypair.generate();
    console.log('🔑 Generated new admin wallet');
    console.log('📍 Address:', keypair.publicKey.toBase58());
    
    // Save to .env.local
    const secretKeyArray = Array.from(keypair.secretKey);
    const envContent = `# Admin Wallet for Demo (pays transaction fees)\nNEXT_PUBLIC_ADMIN_KEYPAIR=[${secretKeyArray.join(',')}]\n`;
    fs.writeFileSync(envPath, envContent);
    console.log('💾 Saved to app/.env.local\n');
  }
  
  // Check balance
  let balance = await connection.getBalance(keypair.publicKey);
  console.log(`💰 Current balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  
  // Request airdrop if needed
  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.log('\n📡 Requesting airdrop...');
    try {
      const signature = await connection.requestAirdrop(
        keypair.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(signature, 'confirmed');
      balance = await connection.getBalance(keypair.publicKey);
      console.log(`✅ Airdrop successful! New balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    } catch (error) {
      console.error('❌ Airdrop failed:', error.message);
      console.log('\n📋 Manual funding instructions:');
      console.log('   1. Visit: https://faucet.solana.com/');
      console.log(`   2. Enter address: ${keypair.publicKey.toBase58()}`);
      console.log('   3. Request devnet SOL');
      process.exit(1);
    }
  }
  
  console.log('\n✅ Admin wallet ready!');
  console.log('🚀 Run: cd app && npm run dev');
  console.log('🌐 Visit: http://localhost:3000\n');
}

main().catch(console.error);

