$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoDir = Split-Path -Parent $ScriptDir
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$ConfigRoot = Join-Path $RepoDir ".bgm-cli"
$MarkerFile = Join-Path $ConfigRoot ".global-install-enabled"
$UserConfigRoot = if ($env:APPDATA -and $env:APPDATA.Trim() -ne "") {
  Join-Path $env:APPDATA "bgm-cli"
} else {
  Join-Path $HOME ".config/bgm-cli"
}
$UserConfigFile = Join-Path $UserConfigRoot "config.json"
$ProjectConfigFile = Join-Path $RepoDir ".bgm-cli/config.json"

function Install-NodeDependencies {
  $PackageJson = Join-Path $RepoDir "package.json"
  if (-not (Test-Path $PackageJson)) {
    return
  }

  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm is required to install bgm-cli dependencies."
  }

  Write-Host "Installing bgm-cli dependencies..."
  Push-Location $RepoDir
  try {
    npm ci --omit=dev
  }
  finally {
    Pop-Location
  }
}

Install-NodeDependencies

[System.IO.Directory]::CreateDirectory($ConfigRoot) | Out-Null
if (-not (Test-Path $MarkerFile)) {
  New-Item -ItemType File -Path $MarkerFile | Out-Null
}
[System.IO.Directory]::CreateDirectory($UserConfigRoot) | Out-Null
if ((-not (Test-Path $UserConfigFile)) -and (Test-Path $ProjectConfigFile)) {
  Copy-Item $ProjectConfigFile $UserConfigFile
}

$NormalizedEntries = @()
if ($UserPath) {
  $NormalizedEntries = $UserPath.Split(";") | Where-Object { $_ -and $_.Trim() -ne "" }
}

if ($NormalizedEntries -contains $RepoDir) {
  Write-Host "PATH already contains $RepoDir"
} else {
  $NextPath = if ($UserPath -and $UserPath.Trim() -ne "") {
    "$UserPath;$RepoDir"
  } else {
    $RepoDir
  }

  [Environment]::SetEnvironmentVariable("Path", $NextPath, "User")
  Write-Host "Added bgm-cli to user PATH: $RepoDir"
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Restart PowerShell or CMD"
Write-Host "2. Verify with: bgm --help"
