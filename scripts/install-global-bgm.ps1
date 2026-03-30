$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoDir = Split-Path -Parent $ScriptDir
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")

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
