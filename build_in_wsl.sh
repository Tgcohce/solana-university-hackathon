#!/bin/bash
# Run this script in WSL: bash build_in_wsl.sh

set -e

echo "===================================="
echo "Building Solana Program in WSL"
echo "===================================="
echo ""

# Fix PATH
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$HOME/.local/share/solana/bin:$HOME/.cargo/bin:$PATH"

echo "Checking tools..."
echo "Rust: $(rustc --version)"
echo "Cargo: $(cargo --version)"
echo "Solana: $(solana --version)"
echo "cargo-build-sbf: $(cargo-build-sbf --version | head -1)"
echo ""

# Navigate to project
cd /mnt/c/Users/tolga/cursor/sol-uni-hackathon
echo "Working directory: $(pwd)"
echo ""

echo "Starting build..."
echo "This will take 3-5 minutes..."
echo ""

# Build
cargo-build-sbf \
    --manifest-path programs/keystore/Cargo.toml \
    --sbf-out-dir target/deploy \
    --verbose

echo ""
echo "===================================="
echo "BUILD COMPLETE!"
echo "===================================="
echo ""

echo "Built files:"
ls -lh target/deploy/

echo ""
echo "Program ID:"
solana-keygen pubkey target/deploy/keystore-keypair.json

echo ""
echo "To deploy:"
echo "solana program deploy target/deploy/keystore.so"

