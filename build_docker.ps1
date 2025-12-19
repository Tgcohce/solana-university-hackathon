# Build using Docker to avoid Windows permission issues
$ErrorActionPreference = "Stop"

Write-Host "=== Building with Docker ===" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Building Solana program using Docker container..." -ForegroundColor Yellow
Write-Host "(This avoids Windows permission issues)"
Write-Host ""

# Use Docker to build - mount the project as /workdir
docker run --rm `
    -v "${PWD}:/workdir" `
    -w /workdir `
    --user root `
    projectserum/build:v0.30.1 `
    bash -c "cd programs/keystore && cargo build-bpf"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Build successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Checking for built file..." -ForegroundColor Cyan
    Get-ChildItem -Recurse -Filter "*.so" | Select-Object FullName, Length
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

