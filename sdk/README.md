# @keyless/sdk

**Biometric wallet infrastructure for Solana using passkeys (WebAuthn) and secp256r1 signature verification.**

[![npm version](https://img.shields.io/npm/v/@keyless/sdk?style=flat-square)](https://www.npmjs.com/package/@keyless/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Devnet-green?style=flat-square)](https://solana.com)

---

## Table of Contents

- [Demo](#demo)
- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Types](#types)
- [Architecture](#architecture)
- [Security](#security)
- [Browser Compatibility](#browser-compatibility)
- [Development](#development)
- [License](#license)

---

## Demo

**Video Demonstration:** [Watch on YouTube](YOUR_DEMO_VIDEO_LINK_HERE)

**Live Demo:** [Try it now](YOUR_LIVE_DEMO_LINK_HERE)

---

## Overview

Keyless SDK enables Solana applications to authenticate users via device biometrics (FaceID, TouchID, Windows Hello) instead of traditional seed phrases. Private keys are generated and stored exclusively within the device's secure enclave, never exposed to the application layer.

### Key Features

- **Passkey-based authentication** — Leverages WebAuthn for secure credential management
- **No seed phrases** — Private keys remain in the device's secure enclave
- **On-chain verification** — secp256r1 signatures verified via Solana's native precompile
- **Cross-platform support** — Compatible with web browsers, iOS, and Android
- **Multi-signature support** — Configure up to 5 keys with customizable thresholds
- **Replay protection** — Nonce-based transaction security

---

## Installation

```bash
npm install @keyless/sdk @solana/web3.js @coral-xyz/anchor
```

### Peer Dependencies

| Package | Version | Description |
|---------|---------|-------------|
| `@solana/web3.js` | >= 1.87.0 | Solana JavaScript SDK |
| `@coral-xyz/anchor` | >= 0.30.0 | Anchor framework for instruction serialization |

---

## Quick Start

### Initialize the Client

```typescript
import { KeylessClient } from "@keyless/sdk";

const client = new KeylessClient({
  rpcUrl: "https://api.devnet.solana.com",
});
```

### Create a Wallet

```typescript
import { createPasskey, storeCredential } from "@keyless/sdk";
import { Keypair } from "@solana/web3.js";

// Triggers biometric authentication
const credential = await createPasskey("user@example.com", "Application Name");

// Create on-chain identity (relayer pays transaction fees)
const relayerKeypair = Keypair.fromSecretKey(/* relayer secret key */);
const result = await client.createIdentity(
  credential.publicKey,
  "Device Name",
  relayerKeypair
);

// Persist credentials for future sessions
storeCredential({
  credentialId: Array.from(credential.credentialId),
  publicKey: Array.from(credential.publicKey),
  identity: result.identity.toBase58(),
  vault: result.vault.toBase58(),
});
```

### Send SOL

```typescript
import { signWithPasskey, getStoredCredential, solToLamports } from "@keyless/sdk";
import { PublicKey } from "@solana/web3.js";

const stored = getStoredCredential();
if (!stored) throw new Error("No wallet found");

const identity = new PublicKey(stored.identity);
const account = await client.getIdentity(identity);

const action = {
  type: "send" as const,
  to: new PublicKey("RecipientAddress"),
  lamports: solToLamports(0.1),
};

// Sign with passkey (triggers biometric prompt)
const message = client.buildMessage(action, account?.nonce || 0);
const signature = await signWithPasskey(
  new Uint8Array(stored.credentialId),
  message
);

// Execute transaction
const result = await client.execute(
  identity,
  action,
  new Uint8Array(stored.publicKey),
  signature,
  relayerKeypair
);
```

### Check Balance

```typescript
import { lamportsToSol } from "@keyless/sdk";

const balance = await client.getVaultBalance(new PublicKey(stored.vault));
console.log("Balance:", lamportsToSol(balance), "SOL");
```

---

## API Reference

### KeylessClient

Primary client for interacting with the Keyless program.

```typescript
const client = new KeylessClient({
  rpcUrl: string;       // Solana RPC endpoint
  programId?: string;   // Custom program ID (optional)
  idl?: any;            // Custom Anchor IDL (optional)
});
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getIdentityPDA` | `pubkey: Uint8Array` | `PublicKey` | Derives identity PDA from passkey public key |
| `getVaultPDA` | `identity: PublicKey` | `PublicKey` | Derives vault PDA from identity |
| `getIdentity` | `identity: PublicKey` | `IdentityAccount \| null` | Fetches identity account data |
| `getVaultBalance` | `vault: PublicKey` | `number` | Returns vault balance in lamports |
| `identityExists` | `identity: PublicKey` | `boolean` | Checks if identity exists on-chain |
| `buildMessage` | `action: Action, nonce: number` | `Uint8Array` | Builds message for signing |
| `createIdentity` | `pubkey, deviceName, payer` | `CreateIdentityResult` | Creates new identity on-chain |
| `execute` | `identity, action, pubkey, signature, payer` | `ExecuteResult` | Executes a transaction |

### Passkey Functions

```typescript
// Create a new passkey credential
createPasskey(
  username: string,
  rpName?: string,
  rpId?: string
): Promise<PasskeyCredential>

// Sign a message with an existing passkey
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
// Build message for signing
buildMessage(action: Action, nonce: number): Uint8Array

// Unit conversion
solToLamports(sol: number): number
lamportsToSol(lamports: number): number
```

---

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
  publicKey: Uint8Array;    // 33-byte compressed secp256r1 public key
  credentialId: Uint8Array; // WebAuthn credential identifier
}

interface StoredCredential {
  credentialId: number[];
  publicKey: number[];
  identity: string;         // Base58-encoded PDA address
  vault: string;            // Base58-encoded PDA address
}

interface PasskeySignature {
  signature: Uint8Array;         // 64-byte raw signature (r || s)
  authenticatorData: Uint8Array; // WebAuthn authenticator data
  clientDataJSON: Uint8Array;    // WebAuthn client data JSON
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

---

## Architecture

```
Application Layer
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                        @keyless/sdk                          │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────┐ │
│  │  Passkey   │  │   Client   │  │ secp256r1  │  │Message │ │
│  │  Module    │  │   Module   │  │   Module   │  │Builder │ │
│  └────────────┘  └────────────┘  └────────────┘  └────────┘ │
└──────────────────────────────────────────────────────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌────────────┐      ┌────────────┐      ┌─────────────────────┐
│   Device   │      │   Solana   │      │   Solana Network    │
│   Secure   │      │    RPC     │      │                     │
│   Enclave  │      │            │      │  ┌───────────────┐  │
│            │      │            │      │  │Keyless Program│  │
│  (FaceID,  │      │            │      │  └───────────────┘  │
│  TouchID,  │      │            │      │  ┌───────────────┐  │
│  Windows   │      │            │      │  │   secp256r1   │  │
│   Hello)   │      │            │      │  │   Precompile  │  │
└────────────┘      └────────────┘      │  └───────────────┘  │
                                        └─────────────────────┘
```

### Transaction Flow

1. **Wallet Creation**
   - User authenticates via device biometrics
   - Passkey generated in secure enclave
   - Public key extracted and compressed to 33 bytes
   - Identity PDA created on-chain

2. **Transaction Signing**
   - Application builds transaction message
   - User authenticates via biometrics
   - Passkey signs message in secure enclave
   - Signature returned with WebAuthn metadata

3. **On-Chain Execution**
   - secp256r1 precompile verifies signature
   - Keyless program validates nonce
   - Action executed (transfer, threshold update, etc.)

---

## Security

| Component | Implementation |
|-----------|----------------|
| Key Storage | Device secure enclave (TPM, Secure Enclave, Android Keystore) |
| Authentication | Biometric verification required for each signature |
| Signature Verification | On-chain via Solana secp256r1 precompile (SIMD-0075) |
| Replay Protection | Sequential nonce enforcement |
| Multi-Signature | Configurable threshold with up to 5 registered keys |

---

## Browser Compatibility

| Browser | Windows | macOS | Linux | iOS | Android |
|---------|:-------:|:-----:|:-----:|:---:|:-------:|
| Chrome  | Yes | Yes | Yes | — | Yes |
| Safari  | — | Yes | — | Yes | — |
| Firefox | Yes | Yes | Yes | — | — |
| Edge    | Yes | Yes | — | — | — |

### Requirements

- Node.js 18 or higher (development)
- Browser with WebAuthn API support
- Device with biometric capability or external security key

---

## Development

```bash
git clone https://github.com/Tgcohce/solana-university-hackathon.git
cd solana-university-hackathon/sdk

npm install
npm run build
npm run lint
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build the SDK |
| `npm run dev` | Watch mode for development |
| `npm run lint` | Type checking |

---

## License

MIT License. See [LICENSE](../LICENSE) for details.

---

## References

- [GitHub Repository](https://github.com/Tgcohce/solana-university-hackathon)
- [SIMD-0075: secp256r1 Precompile](https://github.com/solana-foundation/solana-improvement-documents/pull/75)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [Solana Documentation](https://docs.solana.com/)
