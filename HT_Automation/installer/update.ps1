param([string]$Repository = "nlthieumedia-coder/HT_Automation")
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$isAdministrator = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdministrator) {
    $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"{0}"' -f $PSCommandPath), "-Repository", ('"{0}"' -f $Repository))
    $elevated = Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList $arguments
    exit $elevated.ExitCode
}

$pluginManifest = Join-Path ${env:CommonProgramFiles} "Adobe\UXP\Plugins\External\com.hieuyt.htautomation\manifest.json"
$currentVersion = [version]"0.0.0"
if (Test-Path -LiteralPath $pluginManifest -PathType Leaf) {
    try { $currentVersion = [version]((Get-Content -LiteralPath $pluginManifest -Raw -Encoding UTF8 | ConvertFrom-Json).version) } catch {}
}

Write-Host "HT_Automation hien tai: $currentVersion" -ForegroundColor Cyan
Write-Host "Dang kiem tra GitHub Releases..." -ForegroundColor Cyan
$headers = @{ "User-Agent" = "HT_Automation-Updater"; "Accept" = "application/vnd.github+json" }
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/releases/latest" -Headers $headers -TimeoutSec 30
} catch {
    throw "Chua tim thay GitHub Release cong khai cho $Repository. Hay phat hanh ZIP moi tren trang Releases truoc. Chi tiet: $($_.Exception.Message)"
}

$latestText = ([string]$release.tag_name).TrimStart("v", "V")
try { $latestVersion = [version]$latestText } catch { throw "Tag release khong dung SemVer: $($release.tag_name)" }
# v3.0.5 starts the new public numbering scheme and supersedes the legacy
# v5.7.x line even though its numeric SemVer value is lower.
$migratingFromLegacyVersion = $currentVersion.Major -eq 5 -and $currentVersion.Minor -eq 7 -and $latestVersion.Major -eq 3
if (-not $migratingFromLegacyVersion -and $currentVersion -ge $latestVersion) {
    Write-Host "Ban dang dung phien ban moi nhat $currentVersion." -ForegroundColor Green
    exit 0
}

$asset = @($release.assets) | Where-Object {
    $_.name -eq "HT_Automation_Setup_Windows.zip" -or $_.name -match '^HT_Automation_v[0-9.]+_Setup_Windows\.zip$'
} | Sort-Object @{ Expression = { $_.name -eq "HT_Automation_Setup_Windows.zip" }; Descending = $true } | Select-Object -First 1
if (-not $asset) { throw "Release $($release.tag_name) khong co bo cai Windows ZIP." }

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("HT_Automation_Update_" + [Guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempRoot "update.zip"
$extractPath = Join-Path $tempRoot "package"
try {
    New-Item -ItemType Directory -Path $tempRoot, $extractPath -Force | Out-Null
    Write-Host "Dang tai HT_Automation $latestVersion..." -ForegroundColor Cyan
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curl) {
        & $curl.Source --location --fail --silent --show-error --connect-timeout 20 --max-time 1800 --retry 3 --output $zipPath $asset.browser_download_url
        if ($LASTEXITCODE -ne 0) { throw "Tai bo cai that bai, curl ma loi $LASTEXITCODE." }
    } else {
        Invoke-WebRequest -Uri $asset.browser_download_url -Headers $headers -OutFile $zipPath -UseBasicParsing -TimeoutSec 1800
    }
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force
    $packageInfoPath = Join-Path $extractPath "package-info.json"
    $installerPath = Join-Path $extractPath "installer\install.ps1"
    if (-not (Test-Path -LiteralPath $packageInfoPath) -or -not (Test-Path -LiteralPath $installerPath)) { throw "ZIP cap nhat khong dung cau truc HT_Automation." }
    $packageVersion = [version]((Get-Content -LiteralPath $packageInfoPath -Raw -Encoding UTF8 | ConvertFrom-Json).version)
    if ($packageVersion -ne $latestVersion) { throw "Version trong ZIP $packageVersion khong khop release $latestVersion." }
    Write-Host "Da tai va xac minh $packageVersion. Dang cap nhat..." -ForegroundColor Green
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installerPath -PackageRoot $extractPath
    if ($LASTEXITCODE -ne 0) { throw "Bo cai cap nhat tra ve ma loi $LASTEXITCODE." }
} finally {
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
