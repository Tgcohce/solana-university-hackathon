#!/bin/bash
set -e
set -x

echo "=== Building Solana Program in WSL ==="
echo ""

# Set up PATH
export PATH="$HOME/.local/share/solana/bin:$HOME/.cargo/bin:$PATH"

# Show versions
echo "Rust version:"
rustc --version

echo ""
echo "Cargo version:"
cargo --version

echo ""
echo "Solana version:"
solana --version

echo ""
echo "cargo-build-sbf version:"
cargo-build-sbf --version

# Navigate to project
cd /mnt/c/Users/tolga/cursor/sol-uni-hackathon

echo ""
echo "Building program..."
cargo-build-sbf --manifest-path programs/keystore/Cargo.toml --sbf-out-dir target/deploy

echo ""
echo "Build complete!"
echo ""
echo "Checking for .so file:"
ls -lah target/deploy/*.so 2>&1 || echo "No .so file found yet"

echo ""
echo "All files in target/deploy:"
ls -lah target/deploy/

