#Requires -RunAsAdministrator
<#
.SYNOPSIS
    NemenchPos — Windows update script
.DESCRIPTION
    Pulls the latest code, rebuilds the frontend, and restarts the NemenchPos service.
    Run this whenever a new version is available.
.PARAMETER InstallDir
    NemenchPos install directory. Default: C:\opt\nemenchpos
.PARAMETER ServiceName
    NSSM service name. Default: nemenchpos
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File C:\opt\nemenchpos\update.ps1
#>
[CmdletBinding()]
param(
    [string] $InstallDir  = "C:\opt\nemenchpos",
    [string] $ServiceName = "nemenchpos"
)

$ErrorActionPreference = "Stop"

function Step  ([string]$msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function OK                   { Write-Host "   OK"     -ForegroundColor Green }
function Abort ([string]$msg) { Write-Host "`nERROR: $msg`n" -ForegroundColor Red; exit 1 }

$NssmExe = "C:\nssm\nssm.exe"

if (-not (Test-Path (Join-Path $InstallDir ".git"))) {
    Abort "NemenchPos not found at $InstallDir. Run install.ps1 first."
}
if (-not (Test-Path $NssmExe)) {
    Abort "NSSM not found at $NssmExe. Run install.ps1 first."
}

# ── Pull latest code ──────────────────────────────────────────────────────────
Step "Pulling latest code..."
& git -C $InstallDir pull --ff-only
if ($LASTEXITCODE -ne 0) { Abort "git pull failed. Resolve any conflicts in $InstallDir." }
OK

# ── Rebuild ───────────────────────────────────────────────────────────────────
Push-Location $InstallDir
try {
    Step "Updating npm dependencies..."
    & npm ci --prefer-offline --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { Abort "npm ci failed." }

    Step "Rebuilding frontend..."
    & npm run build
    if ($LASTEXITCODE -ne 0) { Abort "npm run build failed." }
    OK
} finally {
    Pop-Location
}

# ── Restart service ───────────────────────────────────────────────────────────
Step "Restarting '$ServiceName' service..."
& $NssmExe restart $ServiceName
Start-Sleep -Seconds 3

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq "Running") {
    OK
    Write-Host "`n   NemenchPos updated and running." -ForegroundColor Green
} else {
    Write-Host "   Service status: $($svc?.Status ?? 'unknown')" -ForegroundColor Yellow
    Write-Host "   Check logs in $InstallDir\logs for details."
}
