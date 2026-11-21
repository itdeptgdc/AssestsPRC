# Stops all AssetQR services started by start.ps1
$rt = Join-Path $PSScriptRoot 'runtime'
foreach ($port in 3000, 3001, 4000, 8080) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host "Stopped :$port" }
}
& "$rt\pgsql\bin\pg_ctl.exe" -D "$rt\pgdata" stop -m fast
