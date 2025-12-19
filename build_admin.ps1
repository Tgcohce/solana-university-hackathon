# Run this script as Administrator
# Right-click -> Run with PowerShell (Admin)

$ErrorActionPreference = "Stop"

Write-Host "=== Building Solana Program with Admin Privileges ===" -ForegroundColor Cyan
Write-Host ""

# Change to project directory
Set-Location "C:\Users\tolga\cursor\sol-uni-hackathon"

Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
Write-Host ""

Write-Host "Running cargo-build-sbf..." -ForegroundColor Green
cargo-build-sbf --manifest-path programs\keystore\Cargo.toml --sbf-out-dir target\deploy

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Build successful!" -ForegroundColor Green
    Write-Host ""
    
    # List built files
    Write-Host "Built files:" -ForegroundColor Cyan
    Get-ChildItem target\deploy\*.so | Select-Object Name, Length, LastWriteTime
    
    Write-Host ""
    Write-Host "Press any key to deploy to devnet..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
    Write-Host ""
    Write-Host "Deploying to devnet..." -ForegroundColor Green
    solana program deploy target\deploy\keystore.so
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Deployment successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Program ID:" -ForegroundColor Cyan
        solana address -k target\deploy\keystore-keypair.json
    }
} else {
    Write-Host ""
    Write-Host "✗ Build failed" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

