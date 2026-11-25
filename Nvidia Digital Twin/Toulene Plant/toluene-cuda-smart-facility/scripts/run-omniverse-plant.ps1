# Run the full Omniverse plant pipeline (simulate + sync twin state)
# Usage: .\scripts\run-omniverse-plant.ps1 [-TankLevel 65]
#
# NOTE: Primary Omniverse target is Blackwell GPU server (Option B).
#       Use deploy-from-windows.ps1 to push + run on Blackwell.
#       See omniverse/BLACKWELL_SETUP.md

param(
    [int]$TankLevel = 0
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "`n=== TKOW Omniverse Plant (Local) ===" -ForegroundColor Cyan
Write-Host "For Blackwell deployment use:" -ForegroundColor DarkYellow
Write-Host "  .\scripts\blackwell\deploy-from-windows.ps1 -Host user@blackwell-ip -RunPlant`n"

if ($TankLevel -gt 0) {
    npm run omniverse:plant -- --tank-level $TankLevel
} else {
    npm run omniverse:plant
}

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$SiteUsd = Join-Path $Root "plant\usd\Site.usd"
$TwinState = Join-Path $Root "omniverse\runtime\twin_state.json"

Write-Host "`n--- Omniverse Kit ---" -ForegroundColor Yellow
Write-Host "USD scene:  $SiteUsd"
Write-Host "Twin state: $TwinState"

# Try common Omniverse Kit install paths
$KitPaths = @(
    "$env:LOCALAPPDATA\ov\pkg\kit-*\kit.exe",
    "$env:ProgramFiles\NVIDIA Omniverse\kit\kit.exe",
    "C:\Program Files\NVIDIA Corporation\Omniverse\kit\kit.exe"
)

$KitExe = $null
foreach ($pattern in $KitPaths) {
    $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $KitExe = $found.FullName; break }
}

if ($KitExe) {
    Write-Host "`nLaunching Omniverse Kit: $KitExe" -ForegroundColor Green
    Start-Process -FilePath $KitExe -ArgumentList $SiteUsd
    Write-Host @"

In Script Editor, paste:
  exec(open(r"$Root\omniverse\action_graph\run_twin_refresh.py").read())

"@ -ForegroundColor Gray
} else {
    Write-Host "`nOmniverse Kit not found — open Site.usd manually in USD Composer." -ForegroundColor DarkYellow
    Write-Host @"

1. Open: $SiteUsd
2. Script Editor:
   exec(open(r"$Root\omniverse\action_graph\run_twin_refresh.py").read())

"@ -ForegroundColor Gray
}
