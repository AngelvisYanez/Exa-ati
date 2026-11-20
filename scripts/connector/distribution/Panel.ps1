$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
[Windows.Forms.Application]::EnableVisualStyles()
$root = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$form = New-Object Windows.Forms.Form
$form.Text = 'EXA-ATI | Conector SRI'
$form.StartPosition = 'CenterScreen'
$form.ClientSize = [Drawing.Size]::new(460,360)
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
function Control($type,$caption,$y,$height) {
  $c = New-Object "Windows.Forms.$type"
  $c.Text = $caption
  $c.SetBounds(20,$y,420,$height)
  $form.Controls.Add($c)
  return $c
}
Control Label 'El conector descarga los XML del SRI desde esta computadora y los sincroniza con los documentos de tu empresa en EXA-ATI.' 15 42 | Out-Null
Control Label 'Dirección de EXA-ATI para la prueba local' 61 20 | Out-Null
$url = Control TextBox 'http://127.0.0.1:3000' 83 25
Control Label 'Correo electrónico o RUC' 116 20 | Out-Null
$login = Control TextBox '' 138 25
Control Label 'Contraseña de EXA-ATI' 172 20 | Out-Null
$password = Control TextBox '' 194 25
$password.UseSystemPasswordChar = $true
$status = Control Label 'Apagado' 238 40
$button = Control Button 'Encender conector' 286 36
$form.AcceptButton = $button
$loginControls = @($form.Controls)
foreach ($control in $loginControls) { $control.Hide() }
$form.AcceptButton = $null
$form.BackColor = [Drawing.Color]::White
$form.Font = [Drawing.Font]::new('Segoe UI',9)
$heading = Control Label 'Instalando el conector SRI' 38 40
$heading.Font = [Drawing.Font]::new('Segoe UI',16,[Drawing.FontStyle]::Bold)
$hint = Control Label 'Espera mientras npm instala los componentes. Al terminar podrás ingresar con tu cuenta de EXA-ATI.' 100 54
$bar = Control ProgressBar '' 172 14
$bar.Style = 'Marquee'
$bar.MarqueeAnimationSpeed = 30
$retry = Control Button 'Reintentar instalación' 220 36
$retry.Hide()
$script:setup = $null
$marker = Join-Path $root '.installed'
$cli = Join-Path $root 'node_modules/tsx/dist/cli.mjs'
function Show-Login {
  foreach ($c in @($heading,$hint,$bar,$retry)) { $c.Hide() }
  foreach ($c in $loginControls) { $c.Show() }
  $form.AcceptButton = $button
  $button.Text = 'Encender conector'
  [void]$login.Focus()
}
function Install-Failed($message) {
  $heading.Text = 'Instalación pendiente'
  $hint.Text = $message
  $bar.Hide()
  $retry.Show()
}
function Start-Setup {
  try {
    if (!(Get-Command node.exe -ErrorAction SilentlyContinue) -or !(Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
      throw 'Instala Node.js con npm, vuelve a abrir el conector y reintenta.'
    }
    $heading.Text = 'Instalando el conector SRI'
    $hint.Text = 'Espera mientras npm instala los componentes. Al terminar podrás ingresar con tu cuenta de EXA-ATI.'
    $bar.Show()
    $retry.Hide()
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = Join-Path $PSHOME 'powershell.exe'
    $start.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $PSScriptRoot 'Setup.ps1') + '"'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $script:setup = [Diagnostics.Process]::Start($start)
  } catch { Install-Failed $_.Exception.Message }
}
$retry.Add_Click({ Start-Setup })
$form.Add_Shown({
  if ((Test-Path -LiteralPath $marker) -and (Test-Path -LiteralPath $cli)) { Show-Login }
  else { Start-Setup }
})
$script:worker = $null
$script:auth = $null
$stopFile = Join-Path $env:TEMP ('exa-stop-'+[guid]::NewGuid())
function Request-Panel($action) {
  Invoke-RestMethod -Method Post -Uri "$script:server/api/sri/local-connector" -Headers $script:auth -ContentType 'application/json' -Body (@{action=$action}|ConvertTo-Json) -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 10 | Out-Null
}
function Stop-Panel {
  [IO.File]::WriteAllText($stopFile,'stop')
  $button.Enabled = $false
  $status.Text = 'Apagando al finalizar el trabajo actual...'
}
$button.Add_Click({
  if ($script:worker) { Stop-Panel; return }
  try {
    $script:server = 'https://ati.exacontable.com'
    $body = @{email=$login.Text.Trim();password=$password.Text} | ConvertTo-Json
    $response = Invoke-RestMethod -Method Post -Uri "$script:server/api/auth/login" -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 15
    $script:auth = @{Authorization="Bearer $($response.accessToken)"}
    Request-Panel 'connect'
    $psi = New-Object Diagnostics.ProcessStartInfo
    $psi.FileName = (Get-Command node.exe).Source
    $psi.Arguments = 'node_modules/tsx/dist/cli.mjs scripts/connector/sri-local.ts'
    $psi.WorkingDirectory = $root
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.EnvironmentVariables.Remove('DATABASE_URL')
    $psi.EnvironmentVariables['SRI_CONNECTOR_SESSION']=$response.accessToken
    $psi.EnvironmentVariables['SRI_CONNECTOR_URL']=$script:server
    $psi.EnvironmentVariables['SRI_CONNECTOR_STOP_FILE']=$stopFile
    $script:worker = [Diagnostics.Process]::Start($psi)
    $password.Clear()
    $login.Enabled=$password.Enabled=$false
    $status.Text='Encendido | '+$response.user.email
    $button.Text='Apagar conector'
  } catch {
    if ($script:auth) { try { Request-Panel 'disconnect' } catch {}; $script:auth=$null }
    $status.Text='No se pudo conectar. Revisa la dirección, las credenciales y el permiso de administrador.'
  }
})
$timer=New-Object Windows.Forms.Timer
$timer.Interval=500
$timer.Add_Tick({
  if ($script:setup -and $script:setup.HasExited) {
    $ok = $script:setup.ExitCode -eq 0 -and (Test-Path -LiteralPath $cli)
    $script:setup.Dispose()
    $script:setup = $null
    if ($ok) {
      [IO.File]::WriteAllText($marker,'ok')
      Show-Login
    } else {
      Install-Failed 'npm no pudo terminar la instalación. Comprueba tu conexión a Internet y pulsa Reintentar instalación.'
    }
  }
  if ($script:worker -and $script:worker.HasExited) {
    $exitCode=$script:worker.ExitCode
    $script:worker.Dispose()
    $script:worker=$null
    try { Request-Panel 'disconnect' } catch {}
    $script:auth=$null
    [IO.File]::Delete($stopFile)
    $status.Text=if ($exitCode -eq 0) {'Apagado'} else {'Conexión interrumpida. Inicia sesión de nuevo.'}
    $button.Text='Encender conector'
    $login.Enabled=$password.Enabled=$button.Enabled=$true
  }
})
$form.Add_FormClosing({param($sender,$eventArgs)
  if ($script:setup) { $eventArgs.Cancel=$true; $hint.Text="Espera a que termine la instalación antes de cerrar."; return }; if ($script:worker) { $eventArgs.Cancel=$true; Stop-Panel }
})
$timer.Start()
try { [void]$form.ShowDialog() } finally { $timer.Dispose(); $form.Dispose() }
