[CmdletBinding()]
param(
  [string]$Installer = 'release\1.0.0\HT_Dola_Studio_1.0.0_Setup.exe',
  [string]$ExpectedSha256 = '63CF0D297135E3637D007C5F27351A14BDAE89FA40113A2AC6AD033599A5B0B7'
)

$ErrorActionPreference = 'Stop'
$resolvedInstaller = (Resolve-Path -LiteralPath $Installer).Path
$actualHash = (Get-FileHash -LiteralPath $resolvedInstaller -Algorithm SHA256).Hash
if ($actualHash -ne $ExpectedSha256) {
  throw "Installer checksum mismatch: $actualHash"
}

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) 'HT Dola Release Lifecycle'
$unicodeRoot = Join-Path $testRoot 'Nguyễn Hiếu'
New-Item -ItemType Directory -Force -Path $unicodeRoot | Out-Null
$copiedInstaller = Join-Path $unicodeRoot 'HT Dola Studio Setup.exe'
Copy-Item -LiteralPath $resolvedInstaller -Destination $copiedInstaller -Force
$copiedHash = (Get-FileHash -LiteralPath $copiedInstaller -Algorithm SHA256).Hash
if ($copiedHash -ne $ExpectedSha256) {
  throw "Path edge-case copy checksum mismatch: $copiedHash"
}

$signature = Get-AuthenticodeSignature -LiteralPath $resolvedInstaller
$version = (Get-Item -LiteralPath $resolvedInstaller).VersionInfo.ProductVersion

[pscustomobject]@{
  Installer = $resolvedInstaller
  Sha256 = $actualHash
  ProductVersion = $version
  SignatureStatus = [string]$signature.Status
  SpaceAndUnicodePath = $copiedInstaller
  SpaceAndUnicodePathPass = $true
  CleanVmLifecycle = 'NOT_EXECUTABLE_IN_CURRENT_ENVIRONMENT'
  NextSteps = @(
    'Snapshot a clean Windows x64 VM.',
    'Install, launch, verify service/database/AppData/system health, create a mock project/job, close and restart.',
    'Upgrade from the prior RC and run SQLite quick_check and foreign_key_check.',
    'Uninstall and confirm binaries are removed while AppData remains; reinstall and verify retained data.'
  )
} | ConvertTo-Json -Depth 4
