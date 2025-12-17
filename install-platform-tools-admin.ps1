# Run this script as Administrator to install Solana platform tools
# Right-click and select "Run with PowerShell" (as Administrator)

Write-Host "Installing Solana platform tools..." -ForegroundColor Green

# Navigate to the project directory
Set-Location "C:\Users\tolga\cursor\sol-uni-hackathon\programs\keystore"

# Run cargo build-sbf which will install the platform tools
cargo build-sbf

Write-Host "`nPlatform tools installation complete!" -ForegroundColor Green
Write-Host "You can now run 'anchor build' in the main project directory." -ForegroundColor Yellow

Read-Host -Prompt "Press Enter to exit"

