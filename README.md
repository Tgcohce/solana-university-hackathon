# Keystore - Passkey Multi-Sig Wallet for Solana

🏆 **Hackathon Project** - A Solana wallet that uses FaceID/TouchID (passkeys) instead of seed phrases, powered by the new secp256r1 precompile (SIMD-0075).

## 🎯 The Demo

1. User creates wallet with FaceID → no seed phrase needed
2. Adds phone as backup device → multi-device support
3. Sends SOL with biometrics → secure transactions
4. Enables 2-of-2 for high-value transactions → multi-sig security
5. Judge tries it on their own device → mind blown! 🤯

## ✨ Features

- **No Seed Phrases**: Keys stored in device's secure enclave
- **Biometric Auth**: FaceID/TouchID for all transactions
- **Multi-Device Support**: Add up to 5 devices as backup
- **Multi-Sig**: Configurable threshold signatures
- **secp256r1**: Uses the new Solana precompile for passkey verification
- **Modern UI**: Beautiful, responsive interface with Tailwind CSS

## 🏗️ Project Structure

```
keystore/
├── programs/keystore/          # Solana program (Anchor)
│   └── src/
│       ├── lib.rs             # Program entrypoint
│       ├── state.rs           # Account structures
│       ├── error.rs           # Custom errors
│       └── instructions/      # Instruction handlers
├── app/                       # Next.js frontend
│   └── src/
│       ├── app/              # Pages and layout
│       ├── lib/              # Client libraries
│       │   ├── passkey.ts   # WebAuthn integration
│       │   ├── keystore.ts  # On-chain client
│       │   └── solana.ts    # Solana utilities
│       └── components/       # React components
├── tests/                    # Anchor tests
├── Anchor.toml              # Anchor configuration
└── README.md                # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- Rust 1.70+
- Solana CLI 1.18+
- Anchor 0.30.1
- A device with FaceID/TouchID or security key

### 1. Install Dependencies

```bash
# Install Anchor dependencies
npm install

# Install frontend dependencies
cd app
npm install
cd ..
```

### 2. Build & Deploy Program

```bash
# Build the program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Copy the program ID
solana address -k target/deploy/keystore-keypair.json
```

### 3. Update Program ID

Update the program ID in:
- `programs/keystore/src/lib.rs` (line 10)
- `app/src/lib/keystore.ts` (line 8)
- `Anchor.toml` (line 7)

```rust
// In lib.rs
declare_id!("YOUR_PROGRAM_ID_HERE");
```

```typescript
// In keystore.ts
export const PROGRAM_ID = new PublicKey("YOUR_PROGRAM_ID_HERE");
```

### 4. Run Frontend

```bash
cd app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Test the Wallet

1. Click "Create with Face ID"
2. Authenticate with your device's biometrics
3. Click "Airdrop" to get devnet SOL
4. Click "Send" and enter a recipient address
5. Authenticate again to sign the transaction
6. 🎉 Transaction sent!

## 🧪 Running Tests

```bash
anchor test
```

## 📱 Browser Compatibility

Passkeys require WebAuthn support:
- ✅ Chrome/Edge 109+
- ✅ Safari 16+
- ✅ Firefox 119+
- ✅ iOS Safari 16+
- ✅ Android Chrome 109+

## 🔐 Security

- **Secure Enclave**: Private keys never leave your device
- **Biometric Auth**: FaceID/TouchID required for all transactions
- **Multi-Sig**: Require multiple devices to approve high-value transactions
- **No Seed Phrases**: Nothing to write down or lose
- **secp256r1**: Industry-standard elliptic curve used by passkeys

## 🏗️ How It Works

### 1. Wallet Creation
```
User triggers creation
  → Browser generates secp256r1 keypair in secure enclave
  → Public key sent to Solana program
  → PDA created with vault for holding funds
  → Credential ID stored in localStorage
```

### 2. Transaction Signing
```
User initiates transaction
  → Browser prompts for biometrics
  → Secure enclave signs transaction with secp256r1
  → Signature sent to Solana program
  → Program verifies via secp256r1 precompile
  → Transaction executed if threshold met
```

### 3. On-Chain Verification
```
execute instruction
  → Check signatures meet threshold
  → Build message (action + nonce)
  → Verify secp256r1 signatures via precompile
  → Execute action (send SOL, set threshold, etc.)
  → Increment nonce
```

## 📝 Program Instructions

### `create_identity`
Creates a new identity with the first passkey.

**Accounts:**
- `payer`: Signer who pays for account creation
- `identity`: PDA storing keys and settings
- `vault`: PDA for holding funds

**Args:**
- `pubkey`: 33-byte compressed secp256r1 public key
- `device_name`: Human-readable device name

### `add_key`
Adds a new passkey to an existing identity.

**Accounts:**
- `authority`: Identity owner
- `identity`: Identity account to update

**Args:**
- `new_pubkey`: New public key to add
- `device_name`: Device name

### `execute`
Executes an action with signature verification.

**Accounts:**
- `identity`: Identity account
- `vault`: Vault PDA
- `recipient`: Optional recipient account
- `instructions`: Sysvar for precompile verification
- `system_program`: System program

**Args:**
- `action`: Action to execute (Send or SetThreshold)
- `sigs`: Array of signatures with key indices

## 🎨 UI Features

- **Gradient Balance Card**: Shows current balance prominently
- **Copy/Explorer Buttons**: Easy access to address and blockchain explorer
- **Send Modal**: Beautiful modal for sending SOL with biometric confirmation
- **Security Dashboard**: Shows registered keys and threshold settings
- **Real-time Updates**: Balance updates every 5 seconds
- **Success/Error Toasts**: Clear feedback for all actions
- **Responsive Design**: Works on mobile and desktop

## 🛠️ Tech Stack

**On-Chain:**
- Anchor 0.30.1
- Solana 1.18
- secp256r1 precompile

**Frontend:**
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Lucide Icons
- @solana/web3.js

## 🔮 Future Enhancements

- [ ] Session keys for gasless transactions
- [ ] Social recovery with guardian keys
- [ ] Transaction batching
- [ ] Token support (SPL tokens, NFTs)
- [ ] Mobile app with React Native
- [ ] Hardware wallet integration
- [ ] Multi-chain support (Ethereum, etc.)
- [ ] Account abstraction

## 🐛 Known Limitations

- **Devnet Only**: Currently configured for Solana devnet
- **Demo Relayer**: Uses airdrop instead of proper relayer
- **Simplified Verification**: secp256r1 verification is stubbed for demo
- **No Transaction History**: History not yet implemented
- **Single Key Only**: Multi-key support partially implemented

## 📄 License

MIT License - feel free to use this code for your own projects!

## 🙏 Acknowledgments

- Solana Foundation for the hackathon
- SIMD-0075 for the secp256r1 precompile
- WebAuthn community for passkey standards
- Anchor framework for making Solana development easier

## 🎥 Demo Video

[Link to demo video - to be added]

## 🌐 Live Demo

[Link to live deployment - to be added]

## 📧 Contact

Built with ❤️ for the Solana University Hackathon

---

**Remember**: This is a hackathon demo. For production use, implement proper relayer infrastructure, complete secp256r1 verification, and add comprehensive testing.

**Judge Instructions**: Just open the app, click "Create with Face ID", and you'll have a working Solana wallet in 5 seconds. No seed phrase to write down. That's it! 🚀

