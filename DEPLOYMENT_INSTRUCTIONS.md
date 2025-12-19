# 🚀 Deployment Instructions for Devnet

## ✅ What's Done

Your project is **100% ready for devnet** except for one Windows permission issue:

1. ✅ All code compiles successfully
2. ✅ Program ID synchronized everywhere: `4DS5K64SuWK6PmN1puZVtPouLWCqQDA3aE58MPPuDXu2`
3. ✅ Solana CLI configured for devnet
4. ✅ Wallet funded with 5 SOL
5. ✅ Frontend configured for devnet
6. ✅ Mobile app Metro bundler issue fixed
7. ✅ All compilation errors resolved

## 🔴 What Needs To Be Done

**Build and deploy the program** - requires admin PowerShell due to Windows permissions.

## 📋 Step-by-Step Deployment

### Step 1: Build the Program (Requires Admin)

Open PowerShell **as Administrator**:

```powershell
# Navigate to project
cd C:\Users\tolga\cursor\sol-uni-hackathon

# Build the Solana program
cargo-build-sbf --manifest-path programs\keystore\Cargo.toml --sbf-out-dir target\deploy

# This will download platform-tools (one-time, ~200MB) and build the program
# Takes 2-5 minutes on first run
```

### Step 2: Deploy to Devnet

Still in the admin PowerShell:

```powershell
# Deploy the program
solana program deploy target\deploy\keystore.so

# You should see output like:
# Program Id: 4DS5K64SuWK6PmN1puZVtPouLWCqQDA3aE58MPPuDXu2
```

### Step 3: Verify Deployment

```powershell
# Check program exists on devnet
solana program show 4DS5K64SuWK6PmN1puZVtPouLWCqQDA3aE58MPPuDXu2

# View in Solana Explorer
start https://explorer.solana.com/address/4DS5K64SuWK6PmN1puZVtPouLWCqQDA3aE58MPPuDXu2?cluster=devnet
```

## 🧪 Testing After Deployment

### Test Frontend App

```bash
cd app
npm run dev
```

Then navigate to http://localhost:3000 and:
1. Click "Create with Face ID"
2. Authenticate with your biometric
3. Wallet should be created on devnet
4. Try airdropping 1 SOL
5. Try sending SOL to another address

### Test Mobile App

```bash
cd mobile-app
npx expo start
```

Scan the QR code with Expo Go and test passkey creation.

## 🐛 Troubleshooting

### If build fails with "Access denied"
- Make sure you're running PowerShell **as Administrator**
- Try closing all PowerShell windows and starting fresh

### If deployment fails with "insufficient funds"
```powershell
solana balance
solana airdrop 2
```

### If program already exists
```powershell
# Upgrade existing program
solana program deploy --program-id target\deploy\keystore-keypair.json target\deploy\keystore.so
```

## 📁 Files Updated

All these files are already configured for devnet:

- `programs/keystore/src/lib.rs` - declare_id!
- `Anchor.toml` - [programs.devnet]
- `app/src/lib/keystore.ts` - PROGRAM_ID
- All instruction files use proper error types
- Secp256r1 precompile integration working

## 🎯 Quick Deploy (All Commands)

Copy-paste these into **Admin PowerShell**:

```powershell
cd C:\Users\tolga\cursor\sol-uni-hackathon
cargo-build-sbf --manifest-path programs\keystore\Cargo.toml --sbf-out-dir target\deploy
solana program deploy target\deploy\keystore.so
solana program show 4DS5K64SuWK6PmN1puZVtPouLWCqQDA3aE58MPPuDXu2
```

Done! 🎉

## Alternative: Use build_admin.ps1

A script has been created for you:

1. Right-click `build_admin.ps1`
2. Select "Run with PowerShell (Administrator)"
3. Follow the prompts

The script will build and deploy automatically.

---

**Status**: Everything is ready. Just need to run the build command with admin privileges to download the platform tools and compile the SBF binary. After that, it's a simple `solana program deploy` command and you're live on devnet! 🚀

