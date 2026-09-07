param([switch]$OfflineRuntime)
$ErrorActionPreference = "Stop"

$nodeCandidates = @(
    (Join-Path $env:ProgramFiles "nodejs\node.exe"),
    (Join-Path $env:ProgramFiles "Adobe\Adobe Creative Cloud Experience\libs\node.exe"),
    (Join-Path $env:ProgramFiles "Common Files\Adobe\Creative Cloud Libraries\libs\node.exe")
)
$nodeExe = $nodeCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if ($nodeExe) {
    & $nodeExe --check (Join-Path $PSScriptRoot "index.js")
    if ($LASTEXITCODE -ne 0) { throw "index.js co loi cu phap. Da dung dong goi de tranh tao bo cai bi hong." }
} else {
    Write-Warning "Khong tim thay Node.js; bo qua kiem tra cu phap index.js."
}

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$distDir = Join-Path $projectDir "dist"
$manifestPath = Join-Path $projectDir "manifest.json"
$ffmpegPath = Join-Path $projectDir "bin\ffmpeg.exe"
$nodeBuildScript = Join-Path $projectDir "build_ccx.js"
$buildToolsDir = Join-Path $projectDir ".build-tools"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  TAO BO CAI HT_AUTOMATION CHO WINDOWS X64" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

if (-not [Environment]::Is64BitOperatingSystem) {
    throw "Bo cai nay chi ho tro Windows x64."
}

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Khong tim thay manifest.json."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $manifest.id -or -not $manifest.version) {
    throw "manifest.json thieu id hoac version."
}

if (-not (Test-Path -LiteralPath $ffmpegPath -PathType Leaf)) {
    Write-Host "Chua co FFmpeg. Dang tai tu nguon duoc khai bao trong download_ffmpeg.ps1..." -ForegroundColor Yellow
    & (Join-Path $projectDir "download_ffmpeg.ps1")
}

if (-not (Test-Path -LiteralPath $ffmpegPath -PathType Leaf)) {
    throw "Khong the chuan bi bin\ffmpeg.exe."
}

if ((Get-Item -LiteralPath $ffmpegPath).Length -lt 1MB) {
    throw "bin\ffmpeg.exe co kich thuoc bat thuong; huy dong goi."
}

if (-not (Test-Path -LiteralPath $nodeBuildScript -PathType Leaf)) {
    throw "Thieu build_ccx.js."
}

$nodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $nodeExe -and (Test-Path -LiteralPath "C:\Program Files\nodejs\node.exe")) {
    $nodeExe = "C:\Program Files\nodejs\node.exe"
}
if (-not $npmCmd -and (Test-Path -LiteralPath "C:\Program Files\nodejs\npm.cmd")) {
    $npmCmd = "C:\Program Files\nodejs\npm.cmd"
}
if (-not $nodeExe -or -not $npmCmd) {
    throw "Can Node.js LTS tren may phat trien de tao CCX dung chuan Adobe."
}

$archiverModule = Join-Path $buildToolsDir "node_modules\archiver"
if (-not (Test-Path -LiteralPath $archiverModule)) {
    Write-Host "Dang cai cong cu dong goi archiver vao .build-tools..." -ForegroundColor Yellow
    & $npmCmd install --prefix $buildToolsDir --no-save --no-audit --no-fund archiver@7.0.1
    if ($LASTEXITCODE -ne 0) {
        throw "Khong cai duoc cong cu dong goi archiver."
    }
}

$requiredFiles = @(
    "manifest.json",
    "index.html",
    "index.js",
    "styles.css",
    "icons\logo_icon.png",
    "icons\plugin-icon.png",
    "icons\plugin-icon.svg",
    "icons\panel-dark.svg",
    "icons\panel-light.svg",
    "bin\ffmpeg.exe",
    "bin\ffmpeg_bridge_server.ps1",
    "cong_cu\phat_trien\CHAY_FFMPEG_BRIDGE.bat",
    "THIRD_PARTY_NOTICES.md",
    "HUONG_DAN_CAI_DAT.txt"
)

foreach ($relativePath in $requiredFiles) {
    $sourcePath = Join-Path $projectDir $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Thieu file bat buoc: $relativePath"
    }
}

if (-not (Test-Path -LiteralPath $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}

# Keep dist unambiguous for transfer: only the current CCX and portable ZIP.
$resolvedProjectDir = [System.IO.Path]::GetFullPath($projectDir)
$resolvedDistDir = [System.IO.Path]::GetFullPath($distDir)
if (-not $resolvedDistDir.StartsWith($resolvedProjectDir, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Thu muc dist nam ngoai project; huy don dep."
}
$versionTag = "v$($manifest.version)"
$canonicalDistNames = @(
    "HT_Automation_PremierePro.ccx",
    "HT_Automation_Setup_Windows.zip",
    "HT_Automation_Setup_Windows_Full_Offline.zip"
)
Get-ChildItem -LiteralPath $resolvedDistDir -Force | ForEach-Object {
    if ($canonicalDistNames -notcontains $_.Name) {
        $stalePath = $_.FullName
        try {
            Remove-Item -LiteralPath $stalePath -Recurse -Force -ErrorAction Stop
        } catch {
            Write-Warning "Khong xoa duoc muc build cu dang bi khoa: $stalePath"
        }
    }
}

$tempRoot = [System.IO.Path]::GetTempPath()
$stageDir = Join-Path $tempRoot ("HT_Automation_CCX_" + [Guid]::NewGuid().ToString("N"))
# Match the filename convention used by Adobe UXP Developer Tool.
$packageName = "HT_Automation_PremierePro.ccx"
$packagePath = Join-Path $distDir $packageName

try {
    New-Item -ItemType Directory -Path $stageDir | Out-Null

    foreach ($relativePath in $requiredFiles) {
        $sourcePath = Join-Path $projectDir $relativePath
        $targetPath = Join-Path $stageDir $relativePath
        $targetParent = Split-Path -Parent $targetPath
        if (-not (Test-Path -LiteralPath $targetParent)) {
            New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
        }
        Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    }

    if (Test-Path -LiteralPath $packagePath) {
        Remove-Item -LiteralPath $packagePath -Force
    }

    $previousNodePath = $env:NODE_PATH
    try {
        $env:NODE_PATH = Join-Path $buildToolsDir "node_modules"
        & $nodeExe $nodeBuildScript $stageDir $packagePath
        if ($LASTEXITCODE -ne 0) {
            throw "Cong cu dong goi CCX tra ve ma loi $LASTEXITCODE."
        }
    } finally {
        $env:NODE_PATH = $previousNodePath
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($packagePath)
    try {
        $entryNames = @($archive.Entries | ForEach-Object { $_.FullName.Replace("/", "\") })
        foreach ($relativePath in $requiredFiles) {
            if ($entryNames -notcontains $relativePath) {
                throw "Kiem tra goi that bai, thieu: $relativePath"
            }
        }
    } finally {
        $archive.Dispose()
    }

    $hash = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash
    $sizeMB = [math]::Round((Get-Item -LiteralPath $packagePath).Length / 1MB, 2)

    Write-Host ""
    Write-Host "TAO BO CAI THANH CONG" -ForegroundColor Green
    Write-Host "File   : $packagePath" -ForegroundColor Green
    Write-Host "Dung luong: $sizeMB MB"
    Write-Host "SHA-256: $hash"
    Write-Host ""
    Write-Host "Dung bo cai mot click ben duoi de cai ma khong can Creative Cloud." -ForegroundColor Cyan

    $portableDir = Join-Path $tempRoot ("HT_Automation_Setup_" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $portableDir | Out-Null
    $packageInfo = @{
        product = "HT_Automation"
        version = [string]$manifest.version
        bridgeVersion = [string]$manifest.version
        premiereMinimum = [string]$manifest.host.minVersion
        packageMode = $(if ($OfflineRuntime) { "Full Offline" } else { "Online" })
        builtAt = (Get-Date).ToString("o")
    }
    $packageInfo | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $portableDir "package-info.json") -Encoding UTF8
    $portableZipName = "HT_Automation_Setup_Windows{0}.zip" -f $(if ($OfflineRuntime) { "_Full_Offline" } else { "" })
    $portableZip = Join-Path $distDir $portableZipName
    New-Item -ItemType Directory -Path (Join-Path $portableDir "installer") | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $portableDir "payload") | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $portableDir "cong_cu\cai_dat") -Force | Out-Null
    Copy-Item -LiteralPath $packagePath -Destination $portableDir
    Copy-Item -LiteralPath (Join-Path $projectDir "cong_cu\cai_dat\CAI_DAT_MOT_CLICK.bat") -Destination (Join-Path $portableDir "cong_cu\cai_dat")
    Copy-Item -LiteralPath (Join-Path $projectDir "cong_cu\cai_dat\GO_CAI_DAT.bat") -Destination (Join-Path $portableDir "cong_cu\cai_dat")
    Copy-Item -LiteralPath (Join-Path $projectDir "cong_cu\cai_dat\SUA_CHUA.bat") -Destination (Join-Path $portableDir "cong_cu\cai_dat")
    Copy-Item -LiteralPath (Join-Path $projectDir "cong_cu\cai_dat\CAP_NHAT_MOT_CLICK.bat") -Destination (Join-Path $portableDir "cong_cu\cai_dat")
    Copy-Item -LiteralPath (Join-Path $projectDir "installer\install.ps1") -Destination (Join-Path $portableDir "installer")
    Copy-Item -LiteralPath (Join-Path $projectDir "installer\run_action.ps1") -Destination (Join-Path $portableDir "installer")
    Copy-Item -LiteralPath (Join-Path $projectDir "installer\update.ps1") -Destination (Join-Path $portableDir "installer")
    Copy-Item -LiteralPath (Join-Path $projectDir "installer\uninstall.ps1") -Destination (Join-Path $portableDir "installer")
    Copy-Item -LiteralPath (Join-Path $projectDir "bin\ffmpeg_bridge_server.ps1") -Destination (Join-Path $portableDir "payload")
    Copy-Item -LiteralPath (Join-Path $projectDir "bin\ffmpeg.exe") -Destination (Join-Path $portableDir "payload")
    Copy-Item -LiteralPath (Join-Path $projectDir "HUONG_DAN_CAI_DAT.txt") -Destination $portableDir
    Copy-Item -LiteralPath (Join-Path $projectDir "THIRD_PARTY_NOTICES.md") -Destination $portableDir
    if ($OfflineRuntime) {
        $installedWhisper = Join-Path $env:LOCALAPPDATA "HT_Automation\Whisper"
        $offlineWhisper = Join-Path $portableDir "payload\Whisper"
        if (-not (Test-Path -LiteralPath (Join-Path $installedWhisper "whisper-cli.exe")) -or -not (Test-Path -LiteralPath (Join-Path $installedWhisper "ggml-large-v3-turbo-q5_0.bin"))) {
            throw "Khong co Whisper runtime/model day du de tao goi Full Offline."
        }
        New-Item -ItemType Directory -Path $offlineWhisper -Force | Out-Null
        Copy-Item -Path (Join-Path $installedWhisper "*") -Destination $offlineWhisper -Recurse -Force
    }
    $releaseNote = @"
HT_Automation $versionTag
Premiere Pro toi thieu: $($manifest.host.minVersion)
Che do bo cai: $($packageInfo.packageMode)
CCX: $packageName
Ngay dong goi: $($packageInfo.builtAt)
"@
    Set-Content -LiteralPath (Join-Path $portableDir "PHIEN_BAN_$versionTag.txt") -Value $releaseNote -Encoding UTF8
    if (Test-Path -LiteralPath $portableZip) { Remove-Item -LiteralPath $portableZip -Force }
    Compress-Archive -Path (Join-Path $portableDir "*") -DestinationPath $portableZip -CompressionLevel Optimal
    $portableHash = (Get-FileHash -LiteralPath $portableZip -Algorithm SHA256).Hash
    Write-Host ""
    Write-Host "BO CAI MOT CLICK: $portableZip" -ForegroundColor Green
    Write-Host "SHA-256: $portableHash"
    Write-Host "May moi: giai nen ZIP, bam dup cong_cu\cai_dat\CAI_DAT_MOT_CLICK.bat." -ForegroundColor Cyan
    Remove-Item -LiteralPath $portableDir -Recurse -Force
} finally {
    $resolvedTempRoot = [System.IO.Path]::GetFullPath($tempRoot)
    $resolvedStage = [System.IO.Path]::GetFullPath($stageDir)
    if ($resolvedStage.StartsWith($resolvedTempRoot, [StringComparison]::OrdinalIgnoreCase) -and
        (Test-Path -LiteralPath $resolvedStage)) {
        Remove-Item -LiteralPath $resolvedStage -Recurse -Force
    }
}
