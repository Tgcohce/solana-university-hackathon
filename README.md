# Keystore - Passkey Multi-Sig Wallet for Solana

A hackathon project implementing a biometric-authenticated Solana wallet using passkeys (FaceID/TouchID) and the secp256r1 precompile (SIMD-0075).

## 🎯 What This Does

- **No Seed Phrases**: Uses device biometrics (FaceID/TouchID) via WebAuthn
- **Multi-Device Support**: Add multiple devices as backup keys
- **Multi-Sig Security**: Require multiple devices to approve high-value transactions
- **Gasless Transactions**: Relayer service pays transaction fees
- **On-Chain Verification**: secp256r1 signatures verified directly on Solana

## 🏗️ Architecture

### Components

1. **Solana Program** (`programs/keystore/`)
   - Anchor-based smart contract
   - Manages identity accounts with multiple registered keys
   - Verifies secp256r1 signatures on-chain via precompile
   - Enforces multi-sig threshold for transactions

2. **Frontend** (`app/`)
   - Next.js + React + Tailwind CSS
   - WebAuthn integration for passkey creation/signing
   - Connects to relayer for gasless transactions

3. **Relayer** (`relayer/`)
   - Node.js + Express service
   - Pays transaction fees for users
   - Rate-limited to prevent abuse

## 🔑 Key Technical Details

### Program Architecture

**PDAs (Program Derived Addresses):**
- Identity: `["identity", owner_pubkey]`
- Vault: `["vault", identity_pubkey]`

**Instructions:**
- `create_identity`: Initialize wallet with first passkey
- `add_key`: Register additional device/passkey
- `execute`: Execute multi-sig transaction (send SOL, set threshold)
- `register_credential`: Store WebAuthn credential ID on-chain

**Security Features:**
- Nonce-based replay protection
- Multi-signature verification (configurable threshold)
- Balance and rent-exemption checks
- Duplicate signature prevention
- Input validation (pubkey format, device names)

### secp256r1 Verification Flow

1. Frontend creates passkey signature using WebAuthn
2. Frontend builds secp256r1 verification instruction
3. Transaction includes:
   - secp256r1 precompile instruction (verifies signature)
   - execute instruction (reads verification result via sysvar)
4. Program introspects Instructions sysvar to confirm verification
5. If valid, program executes the action (send SOL, etc.)

### Message Signing

Messages are constructed as: `action_data || nonce`
- Action data: Borsh-serialized (e.g., Send variant + recipient + amount)
- Nonce: 8-byte little-endian u64 (prevents replay attacks)
- Hash: SHA-256 of the message is signed by the passkey

## 🚀 Setup & Deployment

### Prerequisites

- **Rust + Solana CLI + Anchor CLI (v0.32.1)**
- **Node.js + npm/yarn**
- **Solana wallet with devnet SOL**

**Windows Users**: Due to permission issues with `cargo-build-sbf`, use WSL (Windows Subsystem for Linux):

```bash
# Install WSL (if not already)
wsl --install

# In WSL, install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.5/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor --tag v0.32.1 anchor-cli --locked
```

### Build & Deploy

```bash
# 1. Build the Solana program (use WSL on Windows)
anchor build

# 2. Get your program ID
solana address -k target/deploy/keystore-keypair.json

# 3. Update Program ID in 3 places:
#    - Anchor.toml (line 9, under [programs.devnet])
#    - programs/keystore/src/lib.rs (declare_id! macro)
#    - app/src/lib/keystore.ts (PROGRAM_ID constant)

# 4. Rebuild after updating IDs
anchor build

# 5. Deploy to devnet
anchor deploy --provider.cluster devnet

# 6. Install frontend dependencies
cd app && npm install

# 7. Install relayer dependencies
cd ../relayer && npm install

# 8. Start relayer (in one terminal)
cd relayer && npm run dev

# 9. Start frontend (in another terminal)
cd app && npm run dev
```

### Alternative: Using Solana Playground (Easiest)

If you encounter build issues:

1. Go to https://beta.solpg.io
2. Create new Anchor project
3. Copy all files from `programs/keystore/src/`
4. Build and deploy in the playground
5. Copy the Program ID and update the 3 files mentioned above

## 📱 User Flow

1. **Create Wallet**: User clicks "Create Wallet" → device prompts for FaceID/TouchID → wallet created
2. **View Balance**: Dashboard shows SOL balance in the vault PDA
3. **Send SOL**: User enters amount and recipient → signs with biometrics → relayer submits transaction
4. **Add Device**: User can add phone/laptop as backup key (requires existing device signature)
5. **Set Threshold**: Enable 2-of-2 multi-sig for high-value transactions

## 🔐 Security Considerations

### What's Secure
- Private keys never leave the device's secure enclave
- Signatures verified on-chain (trustless)
- Nonce prevents replay attacks
- Multi-sig for high-value transactions
- Rate limiting on relayer

### Known Limitations
- Relayer is centralized (could be replaced with fee delegation or priority fees)
- No account recovery if all devices are lost (future: social recovery)
- Credential registry is on-chain but not yet used for recovery flow
- Frontend stores credential ID in localStorage (should use IndexedDB)

## 🧪 Testing

```bash
# Run Anchor tests
anchor test

# Test on devnet
# 1. Deploy program
# 2. Start relayer
# 3. Open frontend in browser (must be HTTPS or localhost)
# 4. Create wallet with biometrics
# 5. Request airdrop from frontend
# 6. Send SOL to another address
```

## 📂 Project Structure

```
.
├── programs/
│   └── keystore/
│       ├── src/
│       │   ├── lib.rs              # Program entrypoint
│       │   ├── state.rs            # Account structures
│       │   ├── error.rs            # Custom errors
│       │   ├── secp256r1.rs        # Signature verification
│       │   └── instructions/
│       │       ├── create.rs       # Create identity
│       │       ├── add_key.rs      # Add device
│       │       ├── execute.rs      # Execute multi-sig tx
│       │       └── register_credential.rs
│       └── Cargo.toml
├── app/
│   ├── src/
│   │   ├── app/
│   │   │   └── page.tsx           # Main UI
│   │   └── lib/
│   │       ├── keystore.ts        # Solana client
│   │       ├── passkey.ts         # WebAuthn wrapper
│   │       └── relayer.ts         # Relayer client
│   └── package.json
├── relayer/
│   ├── src/
│   │   ├── index.ts               # Express server
│   │   ├── relayer.ts             # Transaction logic
│   │   └── rateLimit.ts           # Rate limiting
│   └── package.json
├── Anchor.toml                     # Anchor config
└── README.md
```

## 🎓 Key Learnings

1. **secp256r1 Precompile**: SIMD-0075 enables WebAuthn signatures on Solana
2. **Instruction Introspection**: Programs can read other instructions via Instructions sysvar
3. **PDA Vaults**: Secure fund storage without exposing private keys
4. **Anchor Discriminators**: First 8 bytes of SHA256("global:instruction_name")
5. **Windows Build Issues**: Solana toolchain has known issues on Windows (use Playground or WSL)

## 🚧 Future Improvements

- [ ] Social recovery (guardian approval)
- [ ] Session keys for frequent small transactions
- [ ] Hardware wallet integration
- [ ] Mobile app (React Native)
- [ ] Decentralized relayer network
- [ ] Support for SPL tokens
- [ ] Transaction history and analytics
- [ ] Spending limits and budgets

## 📄 License

MIT

## 🤝 Contributing

This is a hackathon project. Feel free to fork and improve!

## 🔗 Resources

- [SIMD-0075: secp256r1 Precompile](https://github.com/solana-foundation/solana-improvement-documents/pull/75)
- [WebAuthn Guide](https://webauthn.guide/)
- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
