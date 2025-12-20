<p align="center">
  <img src="https://raw.githubusercontent.com/Tgcohce/solana-university-hackathon/main/assets/keyless-logo.svg" width="120" alt="Keyless Logo" />
</p>

<h1 align="center">@keyless/sdk</h1>

<p align="center">
  <strong>Biometric wallet infrastructure for Solana</strong><br/>
  Passkeys (WebAuthn) + secp256r1 signature verification
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@keyless/sdk"><img src="https://img.shields.io/npm/v/@keyless/sdk?style=flat-square&color=14F195" alt="npm version" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-9945FF.svg?style=flat-square" alt="License: MIT" /></a>
  <a href="https://solana.com"><img src="https://img.shields.io/badge/Solana-Devnet-00D4FF?style=flat-square" alt="Solana Devnet" /></a>
</p>

<p align="center">
  <a href="#demo">Demo</a> •
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#api-reference">API</a> •
  <a href="#architecture">Architecture</a>
</p>

---

## Demo

<p align="center">
  <a href="YOUR_DEMO_VIDEO_LINK_HERE">
    <img src="https://img.shields.io/badge/▶_Watch_Demo-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="Watch Demo" />
  </a>
  &nbsp;&nbsp;
  <a href="YOUR_LIVE_DEMO_LINK_HERE">
    <img src="https://img.shields.io/badge/Try_Live_Demo-14F195?style=for-the-badge&logo=vercel&logoColor=black" alt="Live Demo" />
  </a>
</p>

<!-- Replace with actual demo GIF -->
<!-- <p align="center">
  <img src="./assets/demo.gif" width="600" alt="Keyless Demo" />
</p> -->

---

## Features

| Feature | Description |
|---------|-------------|
| 🔐 **Passkey Authentication** | Use FaceID, TouchID, Windows Hello, or security keys |
| 🚀 **No Seed Phrases** | Private keys never leave the device's secure enclave |
| ⚡ **Instant Signing** | Biometric authentication in milliseconds |
| 🔒 **On-Chain Verification** | secp256r1 signature verification via Solana precompile |
| 📱 **Cross-Platform** | Works on Web, iOS, and Android |
| 🔑 **Multi-Sig Support** | Up to 5 keys with configurable threshold |
| 🛡️ **Replay Protection** | Nonce-based transaction security |

---

## Installation

```bash
npm install @keyless/sdk @solana/web3.js @coral-xyz/anchor
```

<details>
<summary>Using yarn or pnpm</summary>

```bash
# yarn
yarn add @keyless/sdk @solana/web3.js @coral-xyz/anchor

# pnpm
pnpm add @keyless/sdk @solana/web3.js @coral-xyz/anchor
```

</details>

### Peer Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@solana/web3.js` | >= 1.87.0 | Solana JavaScript SDK |
| `@coral-xyz/anchor` | >= 0.30.0 | Anchor instruction serialization |

---

## Quick Start

### 1. Initialize the Client

```typescript
import { KeylessClient } from "@keyless/sdk";

const client = new KeylessClient({
  rpcUrl: "https://api.devnet.solana.com",
});
```

### 2. Create a Wallet

```typescript
import { createPasskey, storeCredential } from "@keyless/sdk";
import { Keypair } from "@solana/web3.js";

// Trigger biometric authentication (FaceID/TouchID/Windows Hello)
const credential = await createPasskey("user@example.com", "My App");

// Create on-chain identity (relayer pays for rent)
const adminKeypair = Keypair.fromSecretKey(/* your relayer key */);
const result = await client.createIdentity(
  credential.publicKey,
  "iPhone 15 Pro",
  adminKeypair
);

// Persist for future sessions
storeCredential({
  credentialId: Array.from(credential.credentialId),
  publicKey: Array.from(credential.publicKey),
  identity: result.identity.toBase58(),
  vault: result.vault.toBase58(),
});

console.log("Wallet created!");
console.log("Vault address:", result.vault.toBase58());
```

### 3. Send SOL

```typescript
import { signWithPasskey, getStoredCredential, solToLamports } from "@keyless/sdk";
import { PublicKey } from "@solana/web3.js";

const stored = getStoredCredential();
if (!stored) throw new Error("No wallet found");

const identity = new PublicKey(stored.identity);
const account = await client.getIdentity(identity);

// Define the transfer
const action = {
  type: "send" as const,
  to: new PublicKey("RecipientAddress..."),
  lamports: solToLamports(0.1),
};

// Sign with passkey (triggers biometric prompt)
const message = client.buildMessage(action, account?.nonce || 0);
const signature = await signWithPasskey(
  new Uint8Array(stored.credentialId),
  message
);

// Execute on-chain
const tx = await client.execute(
  identity,
  action,
  new Uint8Array(stored.publicKey),
  signature,
  adminKeypair
);

console.log("Transaction:", tx.signature);
```

### 4. Check Balance

```typescript
import { lamportsToSol } from "@keyless/sdk";

const balance = await client.getVaultBalance(new PublicKey(stored.vault));
console.log("Balance:", lamportsToSol(balance), "SOL");
```

---

## API Reference

### KeylessClient

The main client for interacting with the Keyless program.

```typescript
const client = new KeylessClient({
  rpcUrl: string;           // Solana RPC endpoint
  programId?: string;       // Optional: custom program ID
  idl?: any;                // Optional: custom Anchor IDL
});
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getIdentityPDA` | `pubkey: Uint8Array` | `PublicKey` | Derive identity PDA from passkey |
| `getVaultPDA` | `identity: PublicKey` | `PublicKey` | Derive vault PDA from identity |
| `getIdentity` | `identity: PublicKey` | `IdentityAccount \| null` | Fetch identity account data |
| `getVaultBalance` | `vault: PublicKey` | `number` | Get vault SOL balance (lamports) |
| `identityExists` | `identity: PublicKey` | `boolean` | Check if identity exists |
| `buildMessage` | `action: Action, nonce: number` | `Uint8Array` | Build signable message |
| `createIdentity` | `pubkey, deviceName, payer` | `CreateIdentityResult` | Create new identity on-chain |
| `execute` | `identity, action, pubkey, sig, payer` | `ExecuteResult` | Execute a transaction |

### Passkey Functions

```typescript
// Create a new passkey (triggers biometric)
createPasskey(
  username: string,
  rpName?: string,
  rpId?: string
): Promise<PasskeyCredential>

// Sign with existing passkey (triggers biometric)
signWithPasskey(
  credentialId: Uint8Array,
  message: Uint8Array,
  rpId?: string
): Promise<PasskeySignature>

// Credential storage utilities
storeCredential(credential: StoredCredential): void
getStoredCredential(): StoredCredential | null
clearStoredCredential(): void
hasStoredCredential(): boolean
```

### Utility Functions

```typescript
// Message building
buildMessage(action: Action, nonce: number): Uint8Array

// Conversion helpers
solToLamports(sol: number): number      // 1.5 → 1500000000
lamportsToSol(lamports: number): number // 1500000000 → 1.5
```

---

## Types

<details>
<summary><strong>Action Types</strong></summary>

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

</details>

<details>
<summary><strong>Credential Types</strong></summary>

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
  signature: Uint8Array;         // 64-byte raw signature (r || s)
  authenticatorData: Uint8Array; // WebAuthn authenticator data
  clientDataJSON: Uint8Array;    // WebAuthn client data
}
```

</details>

<details>
<summary><strong>Account Types</strong></summary>

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

</details>

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Your Application                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          @keyless/sdk                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Passkey   │  │   Client    │  │  secp256r1  │  │  Message   │ │
│  │   Module    │  │   Module    │  │   Module    │  │  Builder   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐
│   Device    │    │   Solana    │    │      Solana Network         │
│   Secure    │    │   RPC       │    │  ┌─────────┐  ┌──────────┐  │
│   Enclave   │    │             │    │  │Keyless  │  │secp256r1 │  │
│  (FaceID/   │    │             │    │  │Program  │  │Precompile│  │
│   TouchID)  │    │             │    │  └─────────┘  └──────────┘  │
└─────────────┘    └─────────────┘    └─────────────────────────────┘
```

### How It Works

1. **Wallet Creation**: User authenticates with biometrics → Passkey created in secure enclave → Public key extracted → Identity PDA created on-chain

2. **Transaction Signing**: Build message → User authenticates with biometrics → Passkey signs in secure enclave → Signature returned with WebAuthn data

3. **On-Chain Execution**: secp256r1 precompile verifies signature → Keyless program validates nonce → Action executed (transfer, threshold change, etc.)

---

## Security

| Layer | Protection |
|-------|------------|
| **Key Storage** | Private keys stored in device secure enclave (TPM, Secure Enclave) |
| **Authentication** | Biometric required for every signature |
| **Verification** | On-chain secp256r1 signature verification via Solana precompile |
| **Replay Protection** | Nonce-based transaction ordering |
| **Multi-Sig** | Up to 5 keys with configurable threshold |

---

## Browser Compatibility

| Browser | Windows | macOS | Linux | iOS | Android |
|---------|:-------:|:-----:|:-----:|:---:|:-------:|
| Chrome  | ✅ | ✅ | ✅ | - | ✅ |
| Safari  | - | ✅ | - | ✅ | - |
| Firefox | ✅ | ✅ | ✅ | - | - |
| Edge    | ✅ | ✅ | - | - | - |

---

## Requirements

- **Node.js** 18+ (for development)
- **Modern browser** with WebAuthn support
- **Biometric device** (TouchID, FaceID, Windows Hello) or security key

---

## Development

```bash
# Clone the repository
git clone https://github.com/Tgcohce/solana-university-hackathon.git
cd solana-university-hackathon/sdk

# Install dependencies
npm install

# Build the SDK
npm run build

# Watch mode for development
npm run dev

# Type checking
npm run lint
```

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../CONTRIBUTING.md) for details.

---

## License

MIT © [Keyless Team](https://github.com/Tgcohce/solana-university-hackathon)

---

<p align="center">
  <strong>Built for the Solana University Hackathon</strong><br/>
  <a href="https://github.com/Tgcohce/solana-university-hackathon">GitHub</a> •
  <a href="https://github.com/solana-foundation/solana-improvement-documents/pull/75">SIMD-0075</a> •
  <a href="https://www.w3.org/TR/webauthn-2/">WebAuthn Spec</a>
</p>
