$ErrorActionPreference = "Stop"
Push-Location (Join-Path $PSScriptRoot "../..")
try {
  node scripts/connector/build-package.mjs
  if ($LASTEXITCODE) { throw "Error al preparar el paquete" }
  & "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe" /nologo /target:winexe /r:System.Windows.Forms.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /resource:assets\connector\conector-sri-windows.zip,connector.zip /out:assets\connector\Conector-SRI.exe scripts\connector\Installer.cs
  if ($LASTEXITCODE) { throw "Error al compilar el instalador" }
} finally { Pop-Location }
