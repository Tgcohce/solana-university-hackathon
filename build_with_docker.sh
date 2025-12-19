#!/bin/bash
# Build script for Docker/WSL/Linux environments
set -e

echo "=== Building Solana Program ==="
echo ""

# Install Solana if not present
if ! command -v solana &> /dev/null; then
    echo "Installing Solana..."
    sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi

# Install Anchor if not present
if ! command -v anchor &> /dev/null; then
    echo "Installing Anchor..."
    cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked
fi

echo "Solana version: $(solana --version)"
echo "Anchor version: $(anchor --version)"
echo ""

# Build the program
echo "Building program..."
cd /workspace || cd "$(dirname "$0")"
anchor build

echo ""
echo "✓ Build complete!"
echo ""

# Show built files
echo "Built files:"
ls -lh target/deploy/*.so

echo ""
echo "Program ID:"
solana-keygen pubkey target/deploy/keystore-keypair.json

