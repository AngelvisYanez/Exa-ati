$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$configPath = Join-Path (Join-Path $env:APPDATA 'EXA-ATI') 'conector-sri.json'
if (-not (Test-Path -LiteralPath $configPath)) {
  throw 'Falta la configuración. Ejecute Instalar-Conector.cmd primero.'
}
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$secureKey = ConvertTo-SecureString $config.protectedKey
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $env:SRI_CONNECTOR_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
$env:SRI_CONNECTOR_URL = [string]$config.serverUrl
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

Push-Location $root
try {
  Write-Host 'Conector SRI activo. Mantenga esta ventana abierta mientras se descargan documentos.'
  & npm.cmd run connector:sri
  if ($LASTEXITCODE -ne 0) { throw 'El conector terminó con error.' }
} finally {
  Pop-Location
  Remove-Item Env:SRI_CONNECTOR_KEY -ErrorAction SilentlyContinue
}
