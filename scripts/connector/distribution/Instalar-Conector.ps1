$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$node = Get-Command node.exe -ErrorAction SilentlyContinue
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $node -or -not $npm) {
  throw 'Instale Node.js 20.9 o superior antes de continuar.'
}
$nodeMajor = [int](& node.exe -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 20) {
  throw 'El conector requiere Node.js 20.9 o superior.'
}

$defaultUrl = 'https://ati.exacontable.com'
Add-Type -AssemblyName System.Windows.Forms
[Windows.Forms.Application]::EnableVisualStyles()
$form = New-Object Windows.Forms.Form
$form.Text = 'EXA-ATI | Configurar conector SRI'
$form.StartPosition = 'CenterScreen'
$form.ClientSize = [Drawing.Size]::new(460,220)
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
function Add-Label($caption,$y) {
  $label = New-Object Windows.Forms.Label
  $label.Text = $caption
  $label.SetBounds(16,$y,420,20)
  $form.Controls.Add($label)
}
Add-Label 'Dirección de EXA-ATI' 15
$url = New-Object Windows.Forms.ComboBox
$url.SetBounds(16,38,425,24)
$url.DropDownStyle = 'DropDownList'
$url.Items.AddRange(@($defaultUrl,'http://127.0.0.1:3000'))
$url.SelectedIndex = 0
$form.Controls.Add($url)
Add-Label 'Clave del conector de tu empresa' 79
$key = New-Object Windows.Forms.TextBox
$key.UseSystemPasswordChar = $true
$key.SetBounds(16,103,425,25)
$form.Controls.Add($key)
Add-Label 'Introduce la clave entregada por el administrador de EXA-ATI.' 135
$save = New-Object Windows.Forms.Button
$save.Text = 'Guardar e iniciar'
$save.SetBounds(297,170,144,32)
$form.Controls.Add($save)
$form.AcceptButton = $save
$save.Add_Click({
  if ($key.Text.Trim().Length -lt 32) {
    [Windows.Forms.MessageBox]::Show($form,'Introduce la clave completa (mínimo 32 caracteres).') | Out-Null
    return
  }
  $form.DialogResult = 'OK'
})
try {
  if ($form.ShowDialog() -ne 'OK') { exit 2 }
  $serverUrl = $url.Text
  $secureKey = ConvertTo-SecureString $key.Text.Trim() -AsPlainText -Force
  $key.Clear()
} finally { $form.Dispose() }
$configDir = Join-Path $env:APPDATA 'EXA-ATI'
New-Item -ItemType Directory -Path $configDir -Force | Out-Null
$configPath = Join-Path $configDir 'conector-sri.json'
@{
  serverUrl = $serverUrl
  protectedKey = ConvertFrom-SecureString $secureKey
} | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8

Push-Location $root
try {
  Write-Host 'Instalando dependencias del conector. Esto puede tardar varios minutos...'
  & npm.cmd ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm ci no pudo completar la instalación.' }
} finally {
  Pop-Location
}

Write-Host 'Instalación terminada. Ejecute Iniciar-Conector.cmd desde esta carpeta.'
