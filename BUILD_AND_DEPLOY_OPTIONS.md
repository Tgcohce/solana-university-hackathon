# 🚀 Build & Deploy Options (Windows Permission Workarounds)

Since Windows has permission issues with `cargo-build-sbf`, here are **4 working alternatives**:

---

## ⭐ Option 1: GitHub Actions (RECOMMENDED - Easiest!)

This builds the program automatically in the cloud:

### Steps:

1. **Commit and push your code to GitHub:**
   ```powershell
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Go to GitHub Actions:**
   - Visit: `https://github.com/YOUR_USERNAME/YOUR_REPO/actions`
   - Click "Build and Deploy to Devnet"
   - Click "Run workflow" → "Run workflow"

3. **Wait 5-10 minutes** for the build to complete

4. **Download the built program:**
   - Click on the completed workflow run
   - Scroll to "Artifacts"
   - Download "solana-program.zip"
   - Extract it - you'll get `keystore.so`

5. **Deploy from your machine:**
   ```powershell
   solana program deploy keystore.so
   ```

✅ **Pros:** No setup needed, works every time, can re-run easily
❌ **Cons:** Need to push to GitHub

---

## Option 2: Docker with Custom Container

Build using a custom Dockerfile:

### Create Dockerfile:

```dockerfile
FROM rust:1.75

RUN apt-get update && apt-get install -y curl build-essential

# Install Solana
RUN sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Install Anchor
RUN cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked

WORKDIR /workspace
```

### Build:

```powershell
# Build the Docker image (one-time, takes 10-15 min)
docker build -t solana-builder .

# Use it to build your program
docker run --rm -v "${PWD}:/workspace" solana-builder anchor build

# Deploy
solana program deploy target/deploy/keystore.so
```

✅ **Pros:** Works on any machine with Docker
❌ **Cons:** Initial Docker image build takes time

---

## Option 3: WSL (Windows Subsystem for Linux)

Build in a Linux environment:

### Setup (one-time):

```powershell
# In Windows PowerShell
wsl --install ubuntu
```

After restart:

```bash
# In WSL terminal
cd /mnt/c/Users/tolga/cursor/sol-uni-hackathon

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install Solana
sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked

# Build
anchor build

# The .so file is now in target/deploy/
```

### Deploy (back in Windows PowerShell):

```powershell
solana program deploy target\deploy\keystore.so
```

✅ **Pros:** Full Linux environment, no Docker needed
❌ **Cons:** WSL setup takes time

---

## Option 4: Cloud Development (Gitpod/Codespaces)

Use a cloud development environment:

### Gitpod:

1. Push your code to GitHub
2. Go to `https://gitpod.io/#https://github.com/YOUR_USERNAME/YOUR_REPO`
3. In the Gitpod terminal:
   ```bash
   # Install Solana & Anchor
   sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"
   export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
   cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked
   
   # Build
   anchor build
   ```

4. Download `target/deploy/keystore.so` via the file browser
5. Deploy from your local machine

✅ **Pros:** No local setup, works in browser
❌ **Cons:** Need GitHub account, download/upload files

---

## 📊 Comparison

| Option | Setup Time | Build Time | Ease of Use | Repeatability |
|--------|------------|------------|-------------|---------------|
| **GitHub Actions** | 2 min | 8 min | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Docker | 15 min | 5 min | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| WSL | 20 min | 5 min | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Gitpod | 5 min | 8 min | ⭐⭐⭐ | ⭐⭐⭐ |

---

## 🎯 Quick Recommendation

**If you have GitHub:** Use **Option 1 (GitHub Actions)**
- Just push and click "Run workflow"
- Download the built file
- Deploy in 30 seconds

**If you don't want to use GitHub:** Use **Option 2 (Docker)**
- One-time Docker setup
- Fast rebuilds afterward

---

## 📝 What Happens After Build

Once you have `keystore.so`:

```powershell
# Deploy to devnet
solana program deploy keystore.so

# Verify
solana program show 4DS5K64SuWK6PmN1puZVtPouLWCqQDA3aE58MPPuDXu2

# Test the apps!
cd app && npm run dev
# or
cd mobile-app && npx expo start
```

---

## ✅ Current Status

- ✅ Code compiles perfectly
- ✅ All IDs synced
- ✅ Devnet configured
- ✅ Wallet funded (5 SOL)
- ⏳ Just need the `.so` file

**Choose any option above and you'll be deployed in minutes!** 🚀

