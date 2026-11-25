# Deploy project to Blackwell server from Windows
# Usage:
#   .\scripts\blackwell\deploy-from-windows.ps1 -BlackwellHost user@192.168.1.100
#   .\scripts\blackwell\deploy-from-windows.ps1 -BlackwellHost user@blackwell -RunPlant

param(
    [Parameter(Mandatory = $true)]
    [string]$BlackwellHost,

    [string]$RemotePath = "~/toluene-cuda-smart-facility",

    [switch]$RunPlant,

    [int]$TankLevel = 0
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host "`n=== Deploy to Blackwell ===" -ForegroundColor Cyan
Write-Host "Local:  $Root"
Write-Host "Remote: ${BlackwellHost}:${RemotePath}"

$Excludes = @(
    "node_modules",
    ".git",
    "runs",
    ".env"
)

$TarExclude = ($Excludes | ForEach-Object { "--exclude=$_" }) -join " "

# rsync preferred; fallback to scp of key dirs
if (Get-Command rsync -ErrorAction SilentlyContinue) {
    Write-Host "`nSyncing via rsync..." -ForegroundColor Yellow
    $excludeArgs = $Excludes | ForEach-Object { "--exclude" ; $_ }
    & rsync -avz --delete @excludeArgs "$Root/" "${BlackwellHost}:${RemotePath}/"
} else {
    Write-Host "`nrsync not found — using scp (slower)..." -ForegroundColor Yellow
    ssh $BlackwellHost "mkdir -p $RemotePath"
    scp -r "$Root\package.json" "$Root\package-lock.json" "$Root\src" "$Root\scripts" `
        "$Root\plant" "$Root\omniverse" "$Root\database" "$Root\dashboards" `
        "$Root\tsconfig.json" "$Root\.env.example" `
        "${BlackwellHost}:${RemotePath}/"
}

Write-Host "`nSetting execute bits on Blackwell scripts..." -ForegroundColor Yellow
ssh $BlackwellHost "chmod +x $RemotePath/scripts/blackwell/*.sh 2>/dev/null; true"

if ($RunPlant) {
    Write-Host "`nRunning omniverse plant on Blackwell..." -ForegroundColor Green
    if ($TankLevel -gt 0) {
        ssh $BlackwellHost "cd $RemotePath && ./scripts/blackwell/omniverse-plant.sh --tank-level $TankLevel"
    } else {
        ssh $BlackwellHost "cd $RemotePath && ./scripts/blackwell/omniverse-plant.sh"
    }
}

Write-Host "`n--- Next steps on Blackwell ---" -ForegroundColor Cyan
Write-Host "1. ssh $BlackwellHost"
Write-Host "2. cd $RemotePath && ./scripts/blackwell/setup-blackwell.sh   # if first time"
Write-Host "3. Connect DCV/Parsec → ./scripts/blackwell/launch-kit.sh --refresh"
Write-Host ""
