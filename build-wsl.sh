#!/bin/bash
# Build script for WSL (Ubuntu)

set -e

echo "Building Keystore Solana Program in WSL..."

# Check if Rust is installed
if ! command -v rustc &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# Check if Solana is installed
if ! command -v solana &> /dev/null; then
    echo "Installing Solana CLI..."
    sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi

# Check if Anchor is installed
if ! command -v anchor &> /dev/null; then
    echo "Installing Anchor CLI..."
    cargo install --git https://github.com/coral-xyz/anchor --tag v0.32.1 anchor-cli
fi

# Build the program
echo "Building program..."
anchor build

echo "Build complete! The program binary is in target/deploy/"

