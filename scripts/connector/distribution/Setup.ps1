$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '../../..')
& npm.cmd ci --no-audit --no-fund
exit $LASTEXITCODE
