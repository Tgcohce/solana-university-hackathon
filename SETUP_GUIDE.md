# Keystore Setup Guide

## Prerequisites

### Windows Users
Due to Windows permission issues with Solana's cargo-build-sbf, we recommend building in WSL (Windows Subsystem for Linux).

1. **Install WSL** (if not already installed):
   ```powershell
   wsl --install
   ```

2. **Install Rust in WSL**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source ~/.cargo/env
   ```

3. **Install Solana CLI in WSL**:
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"
   export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
   ```

4. **Install Anchor CLI in WSL**:
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor --tag v0.32.1 anchor-cli --locked
   ```

### macOS/Linux Users
1. **Install Rust**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Install Solana CLI**:
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"
   ```

3. **Install Anchor CLI**:
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor --tag v0.32.1 anchor-cli --locked
   ```

## Building the Program

### Windows (WSL)
```bash
wsl bash -c "cd /mnt/c/Users/YOUR_USERNAME/path/to/sol-uni-hackathon && source ~/.cargo/env && anchor build"
```

### macOS/Linux
```bash
anchor build
```

## Deploying to Devnet

1. **Create a Solana wallet** (if you don't have one):
   ```bash
   solana-keygen new
   ```

2. **Airdrop SOL for deployment**:
   ```bash
   solana airdrop 2 --url devnet
   ```

3. **Deploy the program**:
   ```bash
   anchor deploy --provider.cluster devnet
   ```

4. **Update Program IDs**:
   After deployment, update the program ID in:
   - `programs/keystore/src/lib.rs` (declare_id! macro)
   - `app/src/lib/keystore.ts` (PROGRAM_ID constant)
   - `Anchor.toml` (programs.devnet.keystore)

## Running the Frontend

1. **Install dependencies**:
   ```bash
   cd app
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```

3. **Open in browser**:
   Navigate to `http://localhost:3000`

   **Important**: Passkeys require HTTPS or localhost. For production, deploy to a service with HTTPS.

## Running the Relayer (Optional)

The relayer sponsors transaction fees for a gasless user experience.

1. **Install dependencies**:
   ```bash
   cd relayer
   npm install
   ```

2. **Set up environment**:
   Create a `.env` file:
   ```
   SOLANA_RPC_URL=https://api.devnet.solana.com
   PAYER_SECRET_KEY=[your_base58_secret_key]
   PORT=3001
   ```

3. **Run the relayer**:
   ```bash
   npm start
   ```

## Testing Passkeys

### Requirements
- **Device**: Must have biometric authentication (FaceID, TouchID, Windows Hello, or a security key)
- **Browser**: Chrome, Edge, Safari, or Firefox (latest versions)
- **Connection**: HTTPS or localhost

### Demo Flow
1. **Create Wallet**: Click "Create Wallet with FaceID/TouchID"
   - Browser will prompt for biometric authentication
   - A new identity account and vault will be created on-chain

2. **Add Backup Device**: Click "Add Backup Key"
   - Use a second device (e.g., phone) to register another passkey
   - This enables multi-device recovery

3. **Send SOL**: 
   - Enter recipient address and amount
   - Click "Send"
   - Authenticate with biometrics
   - Transaction is signed and submitted

4. **Enable Multi-Sig**: (Future feature)
   - Set threshold to 2
   - Requires signatures from 2 devices for high-value transactions

## Troubleshooting

### Build Errors on Windows
- **Error**: "Access is denied" or "Failed to install platform-tools"
- **Solution**: Use WSL as described above

### Passkey Not Working
- **Error**: "Passkey creation failed"
- **Solution**: 
  - Ensure you're on HTTPS or localhost
  - Check that your device has biometric authentication enabled
  - Try a different browser

### Transaction Fails
- **Error**: "Signature verification failed"
- **Solution**:
  - Ensure the secp256r1 precompile instruction is included
  - Verify the message hash matches
  - Check that the nonce is current

### Insufficient Funds
- **Error**: "InsufficientFunds"
- **Solution**:
  - Airdrop SOL to your vault: `solana airdrop 1 <VAULT_ADDRESS> --url devnet`
  - Check vault balance: `solana balance <VAULT_ADDRESS> --url devnet`

## Architecture Notes

### Passkey Flow
1. User creates passkey → Browser generates secp256r1 keypair in secure enclave
2. Public key extracted and registered on-chain in Identity account
3. For signing: Message → SHA-256 hash → Sign with private key (in enclave) → Return signature
4. Signature sent to Solana → secp256r1 precompile verifies → Execute instruction runs

### On-Chain Verification
- secp256r1 precompile instruction MUST precede the execute instruction
- Precompile verifies signature cryptographically
- Execute instruction checks that precompile succeeded by inspecting Instructions sysvar
- If precompile fails, entire transaction fails

### Security
- Private keys never leave the secure enclave
- Nonce prevents replay attacks
- Multi-sig threshold prevents single point of failure
- Rent-exempt checks prevent vault drainage

## Next Steps

1. **Test on devnet** with real passkeys
2. **Add multi-device support** by registering multiple credentials
3. **Implement threshold signatures** for high-value transactions
4. **Deploy relayer** for gasless UX
5. **Audit smart contract** before mainnet deployment

