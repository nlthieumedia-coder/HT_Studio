param(
  [ValidateRange(0, 10)]
  [int]$KeepNewest = 1
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Remove-ProjectItem {
  param([Parameter(Mandatory = $true)][string]$LiteralPath)

  if (-not (Test-Path -LiteralPath $LiteralPath)) { return }
  $resolved = (Resolve-Path -LiteralPath $LiteralPath).Path
  if (-not $resolved.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove path outside project: $resolved"
  }

  Remove-Item -LiteralPath $resolved -Recurse -Force
  Write-Host "Removed: $resolved"
}

# Keep only the newest release directory/directories.
$releaseDirs = Get-ChildItem -LiteralPath $projectRoot -Directory -Force |
  Where-Object { $_.Name -eq 'release' -or $_.Name -match '^release[-0-9]' } |
  Sort-Object LastWriteTime -Descending

$releaseDirs | Select-Object -Skip $KeepNewest | ForEach-Object {
  Remove-ProjectItem -LiteralPath $_.FullName
}

# Inside retained releases, keep distributable EXEs only; remove unpacked staging and updater metadata.
$releaseDirs | Select-Object -First $KeepNewest | ForEach-Object {
  Get-ChildItem -LiteralPath $_.FullName -Force | Where-Object {
    $_.Name -eq 'win-unpacked' -or $_.Extension -in @('.blockmap', '.yml', '.yaml') -or $_.Name -match '\.nsis\.7z$'
  } | ForEach-Object {
    Remove-ProjectItem -LiteralPath $_.FullName
  }
}

# Remove smoke-test browser profiles and copied diagnostics, but retain test source files.
$testRoot = Join-Path $projectRoot 'tests\technical'
if (Test-Path -LiteralPath $testRoot) {
  Get-ChildItem -LiteralPath $testRoot -Force | Where-Object {
    $_.Name -match '^(atp-|cft-|release-.*-smoke|verify-|asar-check)' -or
    $_.Name -match '^chromium-.*\.zip$' -or
    $_.Name -match '^(history-|diag-|cookies-).*\.db$' -or
    $_.Name -eq 'main.cjs'
  } | ForEach-Object {
    Remove-ProjectItem -LiteralPath $_.FullName
  }
}

# Remove development/build residue that is never part of the runtime package.
# Browser profiles used by the app live under Electron's userData directory,
# not in this legacy project-local folder.
Remove-ProjectItem -LiteralPath (Join-Path $projectRoot 'browser_profiles')
Remove-ProjectItem -LiteralPath (Join-Path $projectRoot 'tests\.artifacts')
Remove-ProjectItem -LiteralPath (Join-Path $projectRoot 'node_modules\.vite')
Remove-ProjectItem -LiteralPath (Join-Path $projectRoot 'extensions\atp-cookie\.git')
Remove-ProjectItem -LiteralPath (Join-Path $projectRoot 'main.js')

# Playwright downloads helper browsers that this desktop app does not use.
$localBrowsers = Join-Path $projectRoot 'node_modules\playwright-core\.local-browsers'
if (Test-Path -LiteralPath $localBrowsers) {
  Get-ChildItem -LiteralPath $localBrowsers -Force | Where-Object {
    $_.Name -ne 'chromium-1243'
  } | ForEach-Object {
    Remove-ProjectItem -LiteralPath $_.FullName
  }
}

Write-Host "Cleanup complete. Kept $KeepNewest newest release director$(if ($KeepNewest -eq 1) { 'y' } else { 'ies' })."
