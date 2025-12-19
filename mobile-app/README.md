# Keystore Wallet - Mobile App

A beautiful, cross-platform Solana wallet with biometric authentication powered by WebAuthn and the secp256r1 precompile.

## 🎨 Features

### ✨ Beautiful Modern UI
- **Gradient designs** with smooth animations
- **Dark/Light mode** support
- **Responsive layout** for all screen sizes
- **Native feel** on iOS, Android, and Web

### 🔐 Biometric Security
- **Face ID** on iOS
- **Fingerprint** on Android
- **Windows Hello** on Web
- Keys stored in **secure enclave** (never exposed)

### 💰 Full Wallet Functionality
- Create wallet with biometric authentication
- View SOL balance in real-time
- Send transactions with biometric confirmation
- Receive funds with easy address copy
- Request devnet airdrops for testing

### 🚀 Infrastructure Service
- Micro-fee model for key creation
- Transaction relay service
- Multi-device support
- Enterprise-ready

## 📱 Screenshots

### Onboarding Screen
Beautiful gradient background with clear value proposition and feature highlights.

### Wallet Dashboard
- Large balance display with USD conversion
- Quick action buttons (Send, Receive, Airdrop)
- Security status indicators
- Network information

### Send Modal
- Clean, intuitive send interface
- Biometric authentication prompt
- Real-time balance validation

## 🛠️ Tech Stack

**Frontend:**
- React Native (Expo)
- TypeScript
- expo-linear-gradient
- react-native-passkeys

**Blockchain:**
- @solana/web3.js
- Solana Devnet
- secp256r1 precompile

**Authentication:**
- WebAuthn API
- Platform authenticators (Face ID, Touch ID, Windows Hello)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI
- iOS Simulator / Android Emulator / Web Browser

### Installation

```bash
cd mobile-app
npm install
```

### Run on Web (localhost:8081)

```bash
npm run web
```

**Requirements for Web:**
- Modern browser (Chrome, Safari, Edge)
- HTTPS or localhost
- Windows Hello / Touch ID enabled

### Run on iOS

```bash
npm run ios
```

**Requirements:**
- macOS with Xcode
- iOS device or simulator with Face ID / Touch ID

### Run on Android

```bash
npm run android
```

**Requirements:**
- Android Studio
- Android device or emulator with fingerprint sensor

## 📁 Project Structure

```
mobile-app/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Wallet screen
│   │   ├── explore.tsx        # About/Info screen
│   │   └── _layout.tsx        # Tab navigation
│   └── _layout.tsx            # Root layout
├── lib/
│   ├── passkey.ts             # WebAuthn integration
│   ├── solana.ts              # Solana utilities
│   └── keystore.ts            # Keystore client
├── components/                # Reusable components
└── constants/                 # Theme & config
```

## 🔑 How It Works

### 1. Wallet Creation
```
User taps "Create Wallet"
  ↓
WebAuthn creates passkey
  ↓
Private key stored in secure enclave
  ↓
Public key (33 bytes) stored locally
  ↓
Identity PDA derived
  ↓
Vault PDA derived for holding funds
```

### 2. Transaction Signing
```
User initiates transaction
  ↓
Biometric prompt appears
  ↓
User authenticates (Face ID/Fingerprint)
  ↓
Secure enclave signs with secp256r1
  ↓
Signature sent to Solana
  ↓
secp256r1 precompile verifies
  ↓
Transaction executed
```

### 3. Cross-Platform Support
- **Web**: Uses browser's WebAuthn API
- **iOS**: Uses platform authenticator (Face ID/Touch ID)
- **Android**: Uses platform authenticator (Fingerprint)
- **All platforms**: Same codebase, same UX

## 🎯 Use Cases

### Consumer Wallet
- No seed phrases to remember
- Quick onboarding
- Familiar biometric authentication
- Perfect for mainstream adoption

### Developer Infrastructure
- Integrate biometric auth in your dApp
- Pay micro-fees for key creation
- Use relay service for gasless transactions
- Multi-device support out of the box

### Enterprise
- Employee access to corporate treasury
- Multi-sig with biometric approval
- Audit trail of all transactions
- Hardware-backed security

## 🔒 Security

### Key Storage
- Private keys **never leave** the secure enclave
- Only public keys stored in app storage
- Credential IDs used to reference keys

### Authentication
- Biometric verification required for all transactions
- User presence verification enforced
- Replay protection via nonce

### On-Chain
- Signatures verified via secp256r1 precompile
- Multi-sig threshold support
- Nonce prevents replay attacks

## 💡 Configuration

### Update Program ID
After deploying your Solana program, update the program ID in:

```typescript
// mobile-app/lib/solana.ts
export const PROGRAM_ID = new PublicKey("YOUR_PROGRAM_ID_HERE");
```

### Change Network
To switch between Solana clusters:

```typescript
// In mobile-app/app/(tabs)/index.tsx
const connection = getConnection('devnet'); // or 'mainnet-beta' or 'testnet'
```

## 🧪 Testing

### Web Testing
1. Run `npm run web`
2. Open http://localhost:8081
3. Use Windows Hello or Touch ID to create wallet
4. Test send/receive flows

### Mobile Testing
1. Build and run on device (not simulator for biometrics)
2. Ensure biometric authentication is set up
3. Test wallet creation and transactions

## 🚧 Known Limitations

### Current Demo Limitations
- **No relayer integration**: Transactions require manual fee payment
- **Simplified identity creation**: Uses derived PDAs without on-chain creation
- **Devnet only**: Not production-ready
- **No transaction history**: Only shows current balance

### Production TODO
- [ ] Integrate with relayer service for gasless transactions
- [ ] Add proper on-chain identity creation
- [ ] Implement transaction history
- [ ] Add multi-sig support
- [ ] Support multiple accounts
- [ ] Add QR code scanning for addresses
- [ ] Implement push notifications
- [ ] Add analytics and monitoring

## 📝 API Reference

### Passkey Functions

```typescript
// Create a new passkey
createPasskey(username: string): Promise<PasskeyCredential>

// Sign a message with passkey
signWithPasskey(credentialId: Uint8Array, message: Uint8Array): Promise<Uint8Array>

// Store credential locally
storeCredential(cred: StoredCredential): void

// Retrieve stored credential
getStoredCredential(): StoredCredential | null
```

### Solana Functions

```typescript
// Get connection to Solana
getConnection(cluster?: "devnet" | "mainnet-beta"): Connection

// Format address for display
formatAddress(address: string, length?: number): string

// Format lamports to SOL
formatSOL(lamports: number): string

// Get balance
getBalance(connection: Connection, address: PublicKey): Promise<number>

// Request airdrop
requestAirdrop(connection: Connection, address: PublicKey, amount?: number): Promise<string>
```

### Keystore Client

```typescript
// Create new identity
createIdentity(
  ownerPublicKey: PublicKey,
  passkeyPublicKey: Uint8Array,
  deviceName: string
): Promise<{ identity: PublicKey; vault: PublicKey; transaction: Transaction }>

// Send transaction
sendTransaction(
  identity: PublicKey,
  vault: PublicKey,
  to: PublicKey,
  lamports: number,
  nonce: number,
  credentialId: Uint8Array,
  publicKey: Uint8Array
): Promise<string>
```

## 🤝 Contributing

This is a hackathon project! Contributions welcome:

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Test on all platforms
5. Submit a PR

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Solana Foundation for the secp256r1 precompile
- Safe team for WebAuthn inspiration
- Expo team for amazing cross-platform tools
- React Native Passkeys library

## 📞 Support

- GitHub Issues: [Report bugs or request features]
- Discord: [Join our community]
- Twitter: [@keystore_wallet]

---

Built with ❤️ for Solana University Hackathon
