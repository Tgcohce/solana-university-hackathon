<div align="center">

# Keyless

**Biometric Wallet Infrastructure for Solana**

*Eliminate seed phrases forever. Sign transactions with your face.*

[![npm version](https://img.shields.io/npm/v/@keyless/sdk?style=flat-square&color=14F195)](https://www.npmjs.com/package/@keyless/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-9945FF.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Devnet-00D4FF?style=flat-square)](https://solana.com)
[![Built with Anchor](https://img.shields.io/badge/Built%20with-Anchor-blueviolet?style=flat-square)](https://www.anchor-lang.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Rust](https://img.shields.io/badge/Rust-1.70+-DEA584?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

[Live Demo](https://solana-university-hackathon.vercel.app/) · [Watch Demo Video](https://youtu.be/Ong4XZ2eGE4) · [Documentation](#how-it-works)

<br />

`solana` `blockchain` `webauthn` `passkeys` `biometrics` `wallet` `secp256r1` `anchor` `rust` `typescript` `nextjs` `defi` `web3` `crypto` `hackathon`

---

</div>

## Table of Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Demo](#demo)
- [Features](#features)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
  - [Wallet Creation](#wallet-creation)
  - [Transaction Signing](#transaction-signing)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Deploy to Devnet](#deploy-to-devnet)
  - [Run the Application](#run-the-application)
- [Project Structure](#project-structure)
- [Program Instructions](#program-instructions)
- [Browser Compatibility](#browser-compatibility)
- [Security Model](#security-model)
- [Tech Stack](#tech-stack)
- [Roadmap](#roadmap)
- [Known Limitations](#known-limitations)
- [Acknowledgments](#acknowledgments)

---

## The Problem

Seed phrases are the single biggest barrier to mainstream crypto adoption. Users must:

- Write down 12-24 random words and store them securely forever
- Risk permanent loss of funds if the phrase is lost, stolen, or damaged
- Trust themselves to never make a mistake with irreversible consequences

**78% of potential users abandon wallet setup when confronted with seed phrase management.**

## The Solution

Keyless replaces seed phrases with the biometric authentication users already trust—Face ID and Touch ID. Private keys are generated and stored in your device's secure enclave, never exposed to the network or even the application itself.

**Create a Solana wallet in 5 seconds. No seed phrase. No compromise on security.**

---

## Demo

<div align="center">

### For Hackathon Judges

1. Open the [live demo](https://solana-university-hackathon.vercel.app/)
2. Click **"Create with Face ID"**
3. Authenticate with biometrics
4. You now have a fully functional Solana wallet—no seed phrase required

*That's it. Five seconds to a working wallet.*

</div>

---

## Features

| Feature | Description |
|---------|-------------|
| **Zero Seed Phrases** | Private keys live in your device's secure enclave—nothing to write down or lose |
| **Biometric Authentication** | Face ID / Touch ID for every transaction |
| **Multi-Device Support** | Register up to 5 devices as backup authenticators |
| **Configurable Multi-Sig** | Set threshold signatures for high-value transactions |
| **Native secp256r1** | Leverages Solana's new precompile (SIMD-0075) for on-chain passkey verification |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER DEVICE                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │   Application   │───▶│    WebAuthn     │───▶│    Secure Enclave       │  │
│  │   (Next.js)     │    │   (Passkeys)    │    │  (secp256r1 keypair)    │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SOLANA BLOCKCHAIN                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │ Keyless Program │───▶│ secp256r1       │───▶│   Identity PDA          │  │
│  │    (Anchor)     │    │ Precompile      │    │   + Vault               │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## How It Works

### Wallet Creation

```
User clicks "Create with Face ID"
    ↓
Browser generates secp256r1 keypair in secure enclave
    ↓
Public key transmitted to Solana program
    ↓
Identity PDA created with associated vault
    ↓
Credential ID stored locally
    ↓
✓ Wallet ready—no seed phrase generated or stored anywhere
```

### Transaction Signing

```
User initiates transaction
    ↓
Biometric prompt (Face ID / Touch ID)
    ↓
Secure enclave signs with secp256r1 private key
    ↓
Signature submitted to Solana program
    ↓
On-chain verification via secp256r1 precompile
    ↓
Transaction executed if threshold met
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- Rust 1.70+
- Solana CLI 1.18+
- Anchor 0.30.1
- Device with Face ID, Touch ID, or security key

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/keyless.git
cd keyless

# Install program dependencies
npm install

# Install frontend dependencies
cd app && npm install && cd ..
```

### Deploy to Devnet

```bash
# Build the Solana program
anchor build

# Deploy
anchor deploy --provider.cluster devnet

# Get your program ID
solana address -k target/deploy/keystore-keypair.json
```

Update the program ID in three locations:

```rust
// programs/keystore/src/lib.rs
declare_id!("YOUR_PROGRAM_ID");
```

```typescript
// app/src/lib/keystore.ts
export const PROGRAM_ID = new PublicKey("YOUR_PROGRAM_ID");
```

```toml
# Anchor.toml
[programs.devnet]
keystore = "YOUR_PROGRAM_ID"
```

### Run the Application

```bash
cd app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
keyless/
├── programs/keystore/           # Solana program (Anchor)
│   └── src/
│       ├── lib.rs              # Program entrypoint
│       ├── state.rs            # Account structures
│       ├── error.rs            # Custom errors
│       └── instructions/       # Instruction handlers
│
├── app/                         # Next.js frontend
│   └── src/
│       ├── app/                # Pages and routing
│       ├── lib/
│       │   ├── passkey.ts     # WebAuthn integration
│       │   ├── keystore.ts    # On-chain client
│       │   └── solana.ts      # Solana utilities
│       └── components/         # React components
│
├── tests/                       # Anchor test suite
├── Anchor.toml                 # Anchor configuration
└── README.md
```

---

## Program Instructions

### `create_identity`

Creates a new identity with the initial passkey.

**Accounts:** `payer` (signer), `identity` (PDA), `vault` (PDA)

**Arguments:**
- `pubkey`: 33-byte compressed secp256r1 public key
- `device_name`: Human-readable identifier

### `add_key`

Registers an additional passkey to an existing identity.

**Accounts:** `authority` (signer), `identity` (PDA)

**Arguments:**
- `new_pubkey`: Public key to add
- `device_name`: Device identifier

### `execute`

Executes an action after verifying signatures against the configured threshold.

**Accounts:** `identity`, `vault`, `recipient` (optional), `instructions` (sysvar), `system_program`

**Arguments:**
- `action`: `Send { amount, recipient }` or `SetThreshold { threshold }`
- `sigs`: Array of signatures with corresponding key indices

---

## Browser Compatibility

| Browser | Minimum Version |
|---------|-----------------|
| Chrome / Edge | 109+ |
| Safari | 16+ |
| Firefox | 119+ |
| iOS Safari | 16+ |
| Android Chrome | 109+ |

---

## Security Model

| Layer | Protection |
|-------|------------|
| **Key Storage** | Private keys generated and stored in device secure enclave—never exported |
| **Authentication** | Biometric verification required for all signing operations |
| **Recovery** | Multi-device registration prevents single point of failure |
| **High-Value Protection** | Configurable multi-sig thresholds |
| **Cryptography** | secp256r1 (NIST P-256)—industry standard used by Apple, Google, Microsoft |

---

## Tech Stack

**On-Chain:** Anchor 0.30.1 · Solana 1.18 · secp256r1 Precompile (SIMD-0075)

**Frontend:** Next.js 14 · React 18 · TypeScript · Tailwind CSS · @solana/web3.js

---

## Roadmap

- [ ] Session keys for gasless transactions
- [ ] Social recovery with guardian keys
- [ ] SPL token and NFT support
- [ ] Transaction batching
- [ ] React Native mobile app
- [ ] Hardware wallet integration
- [ ] Multi-chain expansion

---

## Known Limitations

This is a hackathon demonstration. Current constraints:

- Devnet deployment only
- Transaction history not yet implemented
- Multi-key UI partially complete

---

## Acknowledgments

- **Solana Foundation** — Hackathon sponsorship
- **SIMD-0075** — secp256r1 precompile specification
- **WebAuthn Community** — Passkey standards
- **Anchor Framework** — Solana development infrastructure

---

<div align="center">

Built for the **Solana University Hackathon**

[Live Demo](https://solana-university-hackathon.vercel.app/) · [Video Walkthrough](https://youtu.be/Ong4XZ2eGE4)

---

*⚠️ This is hackathon software. Not audited for production use.*

</div>
