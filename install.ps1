$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "bgm-cli one-click install"
Write-Host "Repository: $ScriptDir"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Warning: Node.js was not found in PATH."
  Write-Host "bgm-cli requires Node.js >= 20 to run."
  Write-Host ""
}

& (Join-Path $ScriptDir "scripts/install-global-bgm.ps1")
