$ErrorActionPreference = "Stop"

$RepoOwner = "aronnaxlin"
$RepoName = "bgm-cli"
$RepoBranch = "main"
$ArchiveUrl = "https://github.com/$RepoOwner/$RepoName/archive/refs/heads/$RepoBranch.zip"
$InstallRoot = if ($env:LOCALAPPDATA -and $env:LOCALAPPDATA.Trim() -ne "") {
  Join-Path $env:LOCALAPPDATA "Programs"
} else {
  Join-Path $HOME "AppData\Local\Programs"
}
$InstallDir = Join-Path $InstallRoot $RepoName
$WorkDir = Join-Path ([System.IO.Path]::GetTempPath()) ("$RepoName-" + [System.Guid]::NewGuid().ToString("N"))
$ArchiveFile = Join-Path $WorkDir "$RepoName.zip"
$ExtractDir = Join-Path $WorkDir "extract"
$SourceDir = Join-Path $ExtractDir "$RepoName-$RepoBranch"
$GlobalInstallScript = Join-Path $InstallDir "scripts/install-global-bgm.ps1"
$BackupConfigFile = Join-Path $WorkDir "existing-config.json"

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

Write-Host "bgm-cli remote install"
Write-Host "Source: $ArchiveUrl"
Write-Host "Install dir: $InstallDir"
Write-Host ""

if (Test-Path $InstallDir) {
  Write-Host "Existing managed install detected. Updating in place."
  Write-Host ""

  $ExistingProjectConfig = Join-Path $InstallDir ".bgm-cli/config.json"
  if (Test-Path $ExistingProjectConfig) {
    Copy-Item $ExistingProjectConfig $BackupConfigFile
  }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Warning: Node.js was not found in PATH."
  Write-Host "bgm-cli requires Node.js >= 20 to run after installation."
  Write-Host ""
}

try {
  New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
  New-Item -ItemType Directory -Force -Path $ExtractDir | Out-Null
  New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

  Invoke-WebRequest -Uri $ArchiveUrl -OutFile $ArchiveFile
  Expand-Archive -Path $ArchiveFile -DestinationPath $ExtractDir -Force

  if (-not (Test-Path $SourceDir)) {
    throw "Extracted source directory was not found: $SourceDir"
  }

  if (Test-Path $InstallDir) {
    Remove-Item -Recurse -Force $InstallDir
  }

  Move-Item -Path $SourceDir -Destination $InstallDir

  $NewProjectConfig = Join-Path $InstallDir ".bgm-cli/config.json"
  if ((Test-Path $BackupConfigFile) -and (-not (Test-Path $NewProjectConfig))) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $NewProjectConfig) | Out-Null
    Copy-Item $BackupConfigFile $NewProjectConfig
  }

  Invoke-LocalPowerShellScript -ScriptPath $GlobalInstallScript
}
finally {
  if (Test-Path $WorkDir) {
    Remove-Item -Recurse -Force $WorkDir
  }
}
