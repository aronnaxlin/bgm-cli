$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$GlobalInstallScript = Join-Path $ScriptDir "scripts/install-global-bgm.ps1"

function Invoke-LocalPowerShellScript {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ScriptPath
  )

  if (-not (Test-Path $ScriptPath)) {
    throw "PowerShell script was not found: $ScriptPath"
  }

  $powershellCommand = Get-Command powershell -ErrorAction SilentlyContinue
  if ($powershellCommand) {
    & $powershellCommand.Source -NoProfile -ExecutionPolicy Bypass -File $ScriptPath
    return
  }

  $pwshCommand = Get-Command pwsh -ErrorAction SilentlyContinue
  if ($pwshCommand) {
    & $pwshCommand.Source -NoProfile -ExecutionPolicy Bypass -File $ScriptPath
    return
  }

  throw "Neither powershell nor pwsh was found in PATH."
}

Write-Host "bgm-cli one-click install"
Write-Host "Repository: $ScriptDir"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Warning: Node.js was not found in PATH."
  Write-Host "bgm-cli requires Node.js >= 20 to run."
  Write-Host ""
}

Invoke-LocalPowerShellScript -ScriptPath $GlobalInstallScript
