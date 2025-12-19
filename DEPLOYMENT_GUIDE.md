# Deployment Guide

## Current Status

The Solana program needs to be deployed to devnet before the apps can work properly.

## Issue: Transaction Simulation Failed

The error "Attempt to debit an account but found no record of a prior credit" occurs because:
1. The program is not deployed on devnet
2. The payer account (generated on-the-fly) doesn't have SOL to pay for transactions
3. Devnet airdrops are rate-limited

## Solution Steps

### 1. Deploy the Solana Program

```bash
# Make sure you're on devnet
solana config set --url devnet

# Request airdrop for your wallet (may be rate limited)
solana airdrop 2

# Build the program
anchor build

# Deploy to devnet
anchor deploy

# Verify deployment
solana program show 4DS5K64SuWK6PmN1puZVtPouLWCqQDA3aE58MPPuDXu2
```

### 2. Alternative: Use a Pre-funded Keypair

If airdrops are rate-limited, you can:

1. Get SOL from a devnet faucet:
   - https://faucet.solana.com/
   - https://solfaucet.com/

2. Or use a pre-funded keypair in the code:

```typescript
// In app/src/lib/keystore.ts, replace getFundedKeypair() with:
private async getFundedKeypair(): Promise<Keypair> {
  // Use a pre-funded keypair (for demo only!)
  const secretKey = Uint8Array.from([/* your secret key array */]);
  return Keypair.fromSecretKey(secretKey);
}
```

### 3. For Mobile App

The mobile app (mobile-app/) is configured to work with passkeys on Android. Key changes made:

1. **RP ID Configuration**: Set to `undefined` for Android to use the app's package name
2. **Passkey Library**: Uses `react-native-passkeys` v0.4.0
3. **Expo Configuration**: Properly configured in `app.json`

To run:
```bash
cd mobile-app
npm install
npx expo run:android
```

### 4. For Web App

The web app (app/) needs:

1. **Program Deployed**: The Solana program must be on devnet
2. **Funded Payer**: Either through airdrop or pre-funded keypair
3. **HTTPS**: WebAuthn requires HTTPS (localhost is OK for dev)

To run:
```bash
cd app
npm install
npm run dev
```

## Quick Fix for Testing

If you just want to test the passkey functionality without the Solana program:

1. **Mobile App**: The passkey creation should work now with the updated RP ID configuration
2. **Web App**: Comment out the on-chain transaction parts and just test passkey creation/signing

## Program ID

Current program ID: `4DS5K64SuWK6PmN1puZVtPouLWCqQDA3aE58MPPuDXu2`

This is already updated in:
- `programs/keystore/src/lib.rs`
- `app/src/lib/keystore.ts`
- `Anchor.toml`

## Next Steps

1. ✅ Mobile app passkey configuration fixed
2. ✅ Dependencies installed
3. ⏳ Deploy Solana program (requires funded wallet)
4. ⏳ Test end-to-end flow

## Troubleshooting

### Android Passkey Issues

If passkeys don't work on Android:
1. Make sure you have a screen lock set up
2. Enable biometrics in device settings
3. Check that Google Play Services is up to date
4. Try using a physical device instead of emulator

### Devnet Airdrop Rate Limit

If you hit the rate limit:
1. Wait 24 hours
2. Use a different wallet address
3. Use an online faucet
4. Ask in Solana Discord for devnet SOL

### Build Errors

If Anchor build fails:
1. Check Rust toolchain: `rustc --version`
2. Check Solana version: `solana --version`
3. Check Anchor version: `anchor --version`
4. Try: `cargo clean` then `anchor build`

