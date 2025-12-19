# @keyless/sdk

> Biometric wallet infrastructure for Solana using passkeys (WebAuthn) and secp256r1

[![npm version](https://badge.fury.io/js/@keyless%2Fsdk.svg)](https://www.npmjs.com/package/@keyless/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔐 **Passkey-based authentication** - Use FaceID, TouchID, or Windows Hello
- 🚀 **No seed phrases** - Private keys never leave the device's secure enclave
- ⚡ **Fast transactions** - Biometric signing in milliseconds
- 🔒 **On-chain verification** - secp256r1 signature verification via Solana precompile
- 📱 **Cross-platform** - Works on web, iOS, and Android

## Installation

```bash
npm install @keyless/sdk @solana/web3.js
# or
yarn add @keyless/sdk @solana/web3.js
# or
pnpm add @keyless/sdk @solana/web3.js
```

## Quick Start

### 1. Initialize the Client

```typescript
import { KeylessClient } from "@keyless/sdk";

const client = new KeylessClient({
  rpcUrl: "https://api.devnet.solana.com",
  // Optional: custom program ID
  // programId: "Your_Program_ID",
});
```

### 2. Create a New Wallet

```typescript
import { createPasskey, storeCredential } from "@keyless/sdk";
import { Keypair } from "@solana/web3.js";

// This triggers biometric authentication (FaceID/TouchID)
const credential = await createPasskey("user@example.com", "My App");

// Create the on-chain identity (admin wallet pays for rent)
const adminKeypair = Keypair.fromSecretKey(/* your admin key */);
const result = await client.createIdentity(
  credential.publicKey,
  "iPhone 15 Pro",
  adminKeypair
);

console.log("Identity PDA:", result.identity.toBase58());
console.log("Vault PDA:", result.vault.toBase58());

// Store for future sessions
storeCredential({
  credentialId: Array.from(credential.credentialId),
  publicKey: Array.from(credential.publicKey),
  identity: result.identity.toBase58(),
  vault: result.vault.toBase58(),
});
```

### 3. Send SOL

```typescript
import { signWithPasskey, getStoredCredential, solToLamports } from "@keyless/sdk";
import { PublicKey } from "@solana/web3.js";

// Get stored credential
const stored = getStoredCredential();
if (!stored) throw new Error("No wallet found");

// Get current nonce
const identity = new PublicKey(stored.identity);
const account = await client.getIdentity(identity);
const nonce = account?.nonce || 0;

// Build the action
const action = {
  type: "send" as const,
  to: new PublicKey("RecipientAddress..."),
  lamports: solToLamports(0.1), // 0.1 SOL
};

// Sign with passkey (triggers biometric)
const message = client.buildMessage(action, nonce);
const signature = await signWithPasskey(
  new Uint8Array(stored.credentialId),
  message
);

// Execute on-chain
const result = await client.execute(
  identity,
  action,
  new Uint8Array(stored.publicKey),
  signature,
  adminKeypair
);

console.log("Transaction:", result.signature);
```

### 4. Check Balance

```typescript
import { lamportsToSol } from "@keyless/sdk";
import { PublicKey } from "@solana/web3.js";

const vault = new PublicKey(stored.vault);
const balance = await client.getVaultBalance(vault);
console.log("Balance:", lamportsToSol(balance), "SOL");
```

## API Reference

### KeylessClient

Main client for interacting with the Keyless program.

```typescript
const client = new KeylessClient(config: KeylessConfig);
```

#### Methods

| Method | Description |
|--------|-------------|
| `getIdentityPDA(pubkey)` | Derive identity PDA from passkey public key |
| `getVaultPDA(identity)` | Derive vault PDA from identity |
| `getIdentity(identity)` | Fetch identity account data |
| `getVaultBalance(vault)` | Get SOL balance of vault |
| `identityExists(identity)` | Check if identity exists on-chain |
| `buildMessage(action, nonce)` | Build message for signing |
| `createIdentity(pubkey, deviceName, payer)` | Create new identity on-chain |
| `execute(identity, action, pubkey, signature, payer)` | Execute a transaction |

### Passkey Functions

```typescript
// Create a new passkey
const credential = await createPasskey(
  username: string,
  rpName?: string,
  rpId?: string
): Promise<PasskeyCredential>;

// Sign with passkey
const signature = await signWithPasskey(
  credentialId: Uint8Array,
  message: Uint8Array,
  rpId?: string
): Promise<PasskeySignature>;

// Storage helpers
storeCredential(credential: StoredCredential): void;
getStoredCredential(): StoredCredential | null;
clearStoredCredential(): void;
hasStoredCredential(): boolean;
```

### Message Building

```typescript
// Build message for signing
const message = buildMessage(action: Action, nonce: number): Uint8Array;

// Conversion helpers
const lamports = solToLamports(sol: number): number;
const sol = lamportsToSol(lamports: number): number;
```

## Types

### Action Types

```typescript
type Action = SendAction | SetThresholdAction;

interface SendAction {
  type: "send";
  to: PublicKey;
  lamports: number;
}

interface SetThresholdAction {
  type: "setThreshold";
  threshold: number;
}
```

### Credential Types

```typescript
interface PasskeyCredential {
  publicKey: Uint8Array;    // 33-byte compressed secp256r1
  credentialId: Uint8Array; // WebAuthn credential ID
}

interface StoredCredential {
  credentialId: number[];
  publicKey: number[];
  identity: string;  // Base58 PDA address
  vault: string;     // Base58 PDA address
}

interface PasskeySignature {
  signature: Uint8Array;        // 64-byte raw signature
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
}
```

### Account Types

```typescript
interface IdentityAccount {
  bump: number;
  vaultBump: number;
  threshold: number;
  nonce: number;
  keys: RegisteredKey[];
}

interface RegisteredKey {
  pubkey: Uint8Array;
  name: string;
  addedAt: number;
}
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Your App      │────▶│   Keyless SDK    │────▶│  Solana Network │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                        │
        │                       │                        │
        ▼                       ▼                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Device Secure  │     │   secp256r1      │     │   Keyless       │
│    Enclave      │     │   Precompile     │     │   Program       │
│  (FaceID/Touch) │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Security

- **Private keys never leave the device** - Stored in secure enclave (TPM, Secure Enclave, etc.)
- **Biometric authentication required** - Every transaction requires FaceID/TouchID
- **On-chain signature verification** - secp256r1 precompile verifies signatures
- **Replay protection** - Nonce prevents transaction replay attacks
- **Multi-sig support** - Up to 5 keys with configurable threshold

## Browser Compatibility

| Browser | Platform | Status |
|---------|----------|--------|
| Chrome | Windows, macOS, Linux, Android | ✅ |
| Safari | macOS, iOS | ✅ |
| Firefox | Windows, macOS, Linux | ✅ |
| Edge | Windows | ✅ |

## Requirements

- Node.js 18+ (for development)
- Modern browser with WebAuthn support
- Device with biometric capability (or security key)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Type check
npm run lint
```

## License

MIT © Keyless Team

## Links

- [GitHub Repository](https://github.com/Tgcohce/solana-university-hackathon)
- [Solana secp256r1 SIMD](https://github.com/solana-foundation/solana-improvement-documents/pull/75)
- [WebAuthn Spec](https://www.w3.org/TR/webauthn-2/)

