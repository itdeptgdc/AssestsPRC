# Starts AssetQR without Docker:
#   PostgreSQL :5432 · API :4000 · Web (internal) 127.0.0.1:3001 · HTTPS gateway :3000 · Adminer :8080
# Usage (PowerShell):  powershell -ExecutionPolicy Bypass -File .\start.ps1
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$rt   = Join-Path $root 'runtime'
$logs = Join-Path $rt 'logs'
New-Item -ItemType Directory -Force $logs | Out-Null
$node = Join-Path $rt 'node\node.exe'
$env:Path = (Join-Path $rt 'node') + ';' + $env:Path

function Test-Port($p) { [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue) }

# 1. PostgreSQL
if (Test-Port 5432) { Write-Host 'PostgreSQL already running on :5432' }
else {
  & "$rt\pgsql\bin\pg_ctl.exe" -D "$rt\pgdata" -o '-p 5432 -c listen_addresses=localhost' -l "$logs\postgres.log" -w start | Out-Null
  Write-Host 'PostgreSQL started on :5432'
}

# 2. API
if (Test-Port 4000) { Write-Host 'API already running on :4000' }
else {
  Start-Process -FilePath $node -ArgumentList 'src/index.js' -WorkingDirectory (Join-Path $root 'backend') `
    -WindowStyle Hidden -RedirectStandardOutput "$logs\api.log" -RedirectStandardError "$logs\api.err.log"
  Write-Host 'API starting on :4000'
}

# 3. Web (production build)
$fe = Join-Path $root 'frontend'
if (-not (Test-Path (Join-Path $fe '.next\BUILD_ID'))) {
  Write-Host 'Building frontend (first run) ...'
  Push-Location $fe; & $node 'node_modules/next/dist/bin/next' build; Pop-Location
}
if (Test-Port 3001) { Write-Host 'Web already running on 127.0.0.1:3001' }
else {
  Start-Process -FilePath $node -ArgumentList 'node_modules/next/dist/bin/next', 'start', '-p', '3001', '-H', '127.0.0.1' -WorkingDirectory $fe `
    -WindowStyle Hidden -RedirectStandardOutput "$logs\web.log" -RedirectStandardError "$logs\web.err.log"
  Write-Host 'Web starting on 127.0.0.1:3001 (internal)'
}

# 3b. HTTPS gateway on :3000 (https + http->https redirect + /cert setup page)
if (-not (Test-Path (Join-Path $rt 'certs\server.crt'))) {
  Write-Host 'Creating HTTPS certificates (first run) ...'
  Push-Location $root; & $node 'scripts/make-certs.js'; Pop-Location
}
if (Test-Port 3000) { Write-Host 'Gateway already running on :3000' }
else {
  Start-Process -FilePath $node -ArgumentList 'scripts/gateway.js' -WorkingDirectory $root `
    -WindowStyle Hidden -RedirectStandardOutput "$logs\gateway.log" -RedirectStandardError "$logs\gateway.err.log"
  Write-Host 'HTTPS gateway starting on :3000'
}

# 4. Adminer
if (Test-Port 8080) { Write-Host 'Adminer already running on :8080' }
else {
  Start-Process -FilePath "$rt\php\php.exe" -ArgumentList '-c', "$rt\php\php.ini", '-S', '0.0.0.0:8080', '-t', "$rt\adminer" `
    -WindowStyle Hidden -RedirectStandardOutput "$logs\adminer.log" -RedirectStandardError "$logs\adminer.err.log"
  Write-Host 'Adminer starting on :8080'
}

Write-Host ''
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*' } | Select-Object -First 1).IPAddress
Write-Host "Web app : https://${ip}:3000   (http:// redirects to https)"
Write-Host "Phones  : http://${ip}:3000/cert  (one-time certificate setup for camera + app install)"
Write-Host 'Adminer : http://localhost:8080  (System: PostgreSQL, Server: localhost, User: postgres, DB: assetqr_db)'
