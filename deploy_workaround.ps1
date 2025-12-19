# Workaround script to deploy to devnet
# Since cargo-build-sbf has permission issues, we'll use a different approach

Write-Host "Checking Solana configuration..."
solana config get

Write-Host "`nChecking balance..."
solana balance

Write-Host "`nProgram ID from keypair:"
solana address -k target\deploy\keystore-keypair.json

Write-Host "`nNote: Build is blocked by platform-tools permission error"
Write-Host "Workaround options:"
Write-Host "1. Run PowerShell as Administrator and try: cargo-build-sbf --manifest-path programs/keystore/Cargo.toml"
Write-Host "2. Use WSL with proper Solana installation"
Write-Host "3. Use GitHub Actions for building"
Write-Host "4. Use a pre-deployed test program"

Write-Host "`nFor now, updating frontend to use mock/test mode..."

