<#
.SYNOPSIS
  Reinicia Chrome con --remote-debugging-port=9222 y --user-data-dir personalizado
  para que el worker SRI se conecte vía CDP a la misma ventana (no un proceso aparte).

.DESCRIPTION
  Requerido por Chrome 136+ (tu versión: 149) que BLOQUEA remote-debugging-port
  cuando se usa el perfil por defecto del usuario.

  1. Cierra Chrome (pide confirmación).
  2. Lo reabre con --remote-debugging-port=9222 y --user-data-dir=./browser_session.
  3. El worker se conecta al puerto 9222 y abre PESTAÑAS en esta misma ventana
     (compartiendo cookies y sesión del SRI).

  DESPUÉS DEL REINICIO:
  - Te logueas en SRI una vez en esta ventana.
  - Usas el modal de descarga masiva desde localhost:3000.
  - El worker reutiliza la misma sesión para todos los jobs → sin CAPTCHA.
#>

$projectDir = Split-Path -Parent $PSScriptRoot
$sessionDir = Join-Path -Path $projectDir -ChildPath "browser_session"

$chromePath = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
  $chromePath = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $chromePath)) {
  $chromePath = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $chromePath)) {
  Write-Host "[ERROR] No se encontró Chrome en el sistema." -ForegroundColor Red
  pause
  exit 1
}

# 1. Confirmar con usuario
$choice = $host.UI.PromptForChoice(
  "Reiniciar Chrome con debug port",
  ("AVISO: Chrome 136+ ya no permite depuración remota con el perfil por defecto.`n" +
   "Se cerrará Chrome y se reabrirá con un perfil independiente en:`n" +
   "  $sessionDir`n" +
   "`nEl worker SRI podrá conectarse y abrir pestañas en esta ventana.`n" +
   "`n¿Guardaste tu trabajo?"),
  @("&Si", "&No"), 1
)
if ($choice -ne 0) {
  Write-Host "[Cancelado] No se reinició Chrome." -ForegroundColor Yellow
  pause
  exit 0
}

# 2. Matar Chrome
Write-Host "[1/2] Cerrando Chrome..." -ForegroundColor Cyan
try {
  Get-Process chrome -ErrorAction Stop | Stop-Process -Force
  Write-Host "      Chrome cerrado." -ForegroundColor Green
} catch {
  Write-Host "      Chrome no estaba corriendo." -ForegroundColor Yellow
}

Start-Sleep -Seconds 2

# 3. Crear directorio de sesión si no existe
if (-not (Test-Path $sessionDir)) {
  New-Item -ItemType Directory -Path $sessionDir -Force | Out-Null
}

# 4. Relanzar con debug port + user-data-dir personalizado
Write-Host "[2/2] Abriendo Chrome con debug port y perfil independiente..." -ForegroundColor Cyan
Start-Process -FilePath $chromePath -ArgumentList @(
  "--remote-debugging-port=9222",
  "--user-data-dir=`"$sessionDir`"",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-blink-features=AutomationControlled"
)
Write-Host ""
Write-Host "✅ Chrome reabierto con puerto de depuración 9222." -ForegroundColor Green
Write-Host "   Perfil independiente: $sessionDir" -ForegroundColor Green
Write-Host ""
Write-Host "ℹ️  Chrome 136+ exige --user-data-dir no estándar para CDP." -ForegroundColor Yellow
Write-Host "   Este perfil es exclusivo para scraping, separado de tu Chrome personal." -ForegroundColor Yellow
Write-Host ""
Write-Host "🔑 Pasos siguientes:" -ForegroundColor Cyan
Write-Host "   1. Abre https://srienlinea.sri.gob.ec en esta ventana" -ForegroundColor White
Write-Host "   2. Inicia sesión con tu RUC y clave" -ForegroundColor White
Write-Host "   3. Abre http://localhost:3000 en una pestaña" -ForegroundColor White
Write-Host "   4. Usa el modal de descarga masiva" -ForegroundColor White
Write-Host ""
Write-Host "💡 El worker se conectará a esta ventana vía CDP, abrirá pestañas" -ForegroundColor Green
Write-Host "   dentro de ella (no ventanas separadas) y reutilizará tu sesión." -ForegroundColor Green
pause
