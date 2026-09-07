param([Parameter(Mandatory = $true)][string]$PackageRoot, [switch]$Repair)
$ErrorActionPreference = "Stop"
$isAdministrator = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdministrator) {
    $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"{0}"' -f $PSCommandPath), "-PackageRoot", ('"{0}"' -f $PackageRoot))
    if ($Repair) { $arguments += "-Repair" }
    $elevated = Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList $arguments
    exit $elevated.ExitCode
}
$packageRootPath = [System.IO.Path]::GetFullPath($PackageRoot)
$ccx = Get-ChildItem -LiteralPath $packageRootPath -Filter "*.ccx" -File | Select-Object -First 1
$bridgeSource = Join-Path $packageRootPath "payload\ffmpeg_bridge_server.ps1"
$ffmpegSource = Join-Path $packageRootPath "payload\ffmpeg.exe"
$packageInfoPath = Join-Path $packageRootPath "package-info.json"
$packageInfo = $(if (Test-Path -LiteralPath $packageInfoPath) { Get-Content -LiteralPath $packageInfoPath -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null })
$expectedBridgeVersion = $(if ($packageInfo -and $packageInfo.bridgeVersion) { [string]$packageInfo.bridgeVersion } else { "" })
if (-not $ccx) { throw "Khong tim thay file CCX. Hay giai nen day du bo cai." }
if (-not (Test-Path -LiteralPath $bridgeSource -PathType Leaf)) { throw "Bo cai thieu FFmpeg Bridge." }
if (-not (Test-Path -LiteralPath $ffmpegSource -PathType Leaf)) { throw "Bo cai thieu ffmpeg.exe." }
if (Get-Process -Name "Adobe Premiere Pro" -ErrorAction SilentlyContinue) {
    throw "Hay dong hoan toan Adobe Premiere Pro truoc khi cai hoac cap nhat HT_Automation."
}

$runtimeDir = Join-Path $env:LOCALAPPDATA "HT_Automation\Bridge"
$bridgeTarget = Join-Path $runtimeDir "ffmpeg_bridge_server.ps1"
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
Copy-Item -LiteralPath $bridgeSource -Destination $bridgeTarget -Force
Copy-Item -LiteralPath $ffmpegSource -Destination (Join-Path $runtimeDir "ffmpeg.exe") -Force

# Download whisper.cpp and a multilingual model once. Keep all DLL files beside
# whisper-cli.exe because current official Windows builds are dynamically linked.
$whisperDir = Join-Path $env:LOCALAPPDATA "HT_Automation\Whisper"
$whisperExe = Join-Path $whisperDir "whisper-cli.exe"
$whisperModel = Join-Path $whisperDir "ggml-large-v3-turbo-q5_0.bin"
$backendMarker = Join-Path $whisperDir "backend.txt"
New-Item -ItemType Directory -Path $whisperDir -Force | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$offlineWhisper = Join-Path $packageRootPath "payload\Whisper"
if ((Test-Path -LiteralPath (Join-Path $offlineWhisper "whisper-cli.exe") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $offlineWhisper "ggml-large-v3-turbo-q5_0.bin") -PathType Leaf)) {
    Write-Host "Dang cai Whisper runtime Full Offline..." -ForegroundColor Cyan
    Copy-Item -Path (Join-Path $offlineWhisper "*") -Destination $whisperDir -Recurse -Force
}

function Invoke-ReliableDownload([string]$Uri, [string]$OutFile, [hashtable]$Headers = @{}, [long]$MinimumBytes = 1) {
    $partFile = "$OutFile.part"
    Remove-Item -LiteralPath $partFile -Force -ErrorAction SilentlyContinue
    $lastError = $null
    for ($attempt = 1; $attempt -le 4; $attempt++) {
        try {
            Write-Host "Dang tai (lan $attempt/4)..." -ForegroundColor DarkCyan
            $curl = Get-Command "curl.exe" -ErrorAction SilentlyContinue
            if ($curl) {
                $arguments = @("--location", "--fail", "--silent", "--show-error", "--connect-timeout", "20", "--max-time", "1800", "--retry", "3", "--retry-all-errors", "--output", $partFile)
                foreach ($key in $Headers.Keys) { $arguments += @("--header", ("{0}: {1}" -f $key, $Headers[$key])) }
                $arguments += $Uri
                & $curl.Source @arguments
                if ($LASTEXITCODE -ne 0) { throw "curl.exe tra ve ma loi $LASTEXITCODE" }
            } else {
                Invoke-WebRequest -Uri $Uri -Headers $Headers -OutFile $partFile -UseBasicParsing -TimeoutSec 1800
            }
            if (-not (Test-Path -LiteralPath $partFile -PathType Leaf)) { throw "Khong nhan duoc file tai ve." }
            $downloadedBytes = (Get-Item -LiteralPath $partFile).Length
            if ($downloadedBytes -lt $MinimumBytes) { throw "File tai ve khong day du ($downloadedBytes bytes)." }
            Move-Item -LiteralPath $partFile -Destination $OutFile -Force
            return
        } catch {
            $lastError = $_
            Remove-Item -LiteralPath $partFile -Force -ErrorAction SilentlyContinue
            if ($attempt -lt 4) { Start-Sleep -Seconds (2 * $attempt) }
        }
    }
    throw "Khong the tai file sau 4 lan. Hay kiem tra Internet, VPN/Proxy hoac thu lai sau. Chi tiet: $($lastError.Exception.Message)"
}

function Invoke-GitHubApi([string]$Uri, [hashtable]$Headers) {
    $lastError = $null
    for ($attempt = 1; $attempt -le 4; $attempt++) {
        try { return Invoke-RestMethod -Uri $Uri -Headers $Headers -TimeoutSec 30 }
        catch {
            $lastError = $_
            if ($attempt -lt 4) { Start-Sleep -Seconds (2 * $attempt) }
        }
    }
    throw "Khong ket noi duoc GitHub de kiem tra Whisper. Hay kiem tra Internet, VPN/Proxy hoac thu lai sau. Chi tiet: $($lastError.Exception.Message)"
}

function Install-WhisperRuntime([object]$release, [hashtable]$headers, [string]$assetPattern, [string]$backendName) {
    $asset = @($release.assets) | Where-Object { $_.name -match $assetPattern } | Select-Object -First 1
    if (-not $asset) { throw "Khong tim thay goi whisper.cpp $backendName trong ban phat hanh moi nhat." }
    $downloadZip = Join-Path ([System.IO.Path]::GetTempPath()) ("ht_whisper_" + [Guid]::NewGuid().ToString("N") + ".zip")
    $extractDir = Join-Path ([System.IO.Path]::GetTempPath()) ("ht_whisper_" + [Guid]::NewGuid().ToString("N"))
    try {
        Invoke-ReliableDownload -Uri $asset.browser_download_url -OutFile $downloadZip -Headers $headers -MinimumBytes 1MB
        Expand-Archive -LiteralPath $downloadZip -DestinationPath $extractDir -Force
        $downloadedExe = Get-ChildItem -LiteralPath $extractDir -Filter "whisper-cli.exe" -File -Recurse | Select-Object -First 1
        if (-not $downloadedExe) { throw "Goi whisper.cpp khong co whisper-cli.exe." }
        Get-ChildItem -LiteralPath $whisperDir -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch '^ggml-.*\.bin$' } | Remove-Item -Force -ErrorAction SilentlyContinue
        Copy-Item -Path (Join-Path $downloadedExe.Directory.FullName "*") -Destination $whisperDir -Recurse -Force
        Set-Content -LiteralPath (Join-Path $whisperDir "version.txt") -Value $release.tag_name -Encoding ASCII
        Set-Content -LiteralPath $backendMarker -Value $backendName -Encoding ASCII
    } finally {
        if (Test-Path -LiteralPath $downloadZip) { Remove-Item -LiteralPath $downloadZip -Force }
        if (Test-Path -LiteralPath $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force }
    }
}

function Test-WhisperRuntime([string]$backendName) {
    if (-not (Test-Path -LiteralPath $whisperExe -PathType Leaf)) { return $false }
    $stdoutFile = Join-Path ([System.IO.Path]::GetTempPath()) ("ht_whisper_test_" + [Guid]::NewGuid().ToString("N") + ".out")
    $stderrFile = "$stdoutFile.err"
    try {
        $process = Start-Process -FilePath $whisperExe -ArgumentList @("--version") -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
        $diagnostic = ""
        if (Test-Path -LiteralPath $stdoutFile) { $diagnostic += Get-Content -LiteralPath $stdoutFile -Raw -ErrorAction SilentlyContinue }
        if (Test-Path -LiteralPath $stderrFile) { $diagnostic += Get-Content -LiteralPath $stderrFile -Raw -ErrorAction SilentlyContinue }
        if ($process.ExitCode -ne 0) { return $false }
        if ($backendName -like "CUDA*") { return $diagnostic -match "CUDA|ggml-cuda" }
        return $true
    } catch { return $false }
    finally {
        Remove-Item -LiteralPath $stdoutFile, $stderrFile -Force -ErrorAction SilentlyContinue
    }
}

$nvidiaSmi = (Get-Command "nvidia-smi.exe" -ErrorAction SilentlyContinue).Source
if (-not $nvidiaSmi -and (Test-Path -LiteralPath "$env:WINDIR\System32\nvidia-smi.exe" -PathType Leaf)) { $nvidiaSmi = "$env:WINDIR\System32\nvidia-smi.exe" }
$desiredBackend = $(if ($nvidiaSmi) { "CUDA 12.4" } else { "CPU" })
$installedBackend = $(if (Test-Path -LiteralPath $backendMarker -PathType Leaf) { (Get-Content -LiteralPath $backendMarker -Raw).Trim() } else { "" })
$runtimeHealthy = $(if ($installedBackend) { Test-WhisperRuntime $installedBackend } else { $false })
$needsRuntime = -not $runtimeHealthy -or ($Repair -and $installedBackend -ne $desiredBackend)
if ($runtimeHealthy -and -not $Repair -and $installedBackend -ne $desiredBackend) {
    Write-Host "Giu backend Whisper $installedBackend dang hoat dong. Chay SUA_CHUA neu muon thu lai $desiredBackend." -ForegroundColor DarkGray
    $desiredBackend = $installedBackend
}
if ($needsRuntime) {
    Write-Host "Dang tai whisper.cpp $desiredBackend tu GitHub chinh thuc..." -ForegroundColor Cyan
    $headers = @{ "User-Agent" = "HT_Automation-Installer"; "Accept" = "application/vnd.github+json" }
    $release = Invoke-GitHubApi -Uri "https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest" -Headers $headers
    $assetPattern = $(if ($desiredBackend -eq "CUDA 12.4") { '^whisper-cublas-12\.4\.0-bin-x64\.zip$' } else { '^whisper-bin-x64\.zip$' })
    Install-WhisperRuntime $release $headers $assetPattern $desiredBackend
    if (-not (Test-WhisperRuntime $desiredBackend)) {
        if ($desiredBackend -eq "CUDA 12.4") {
            Write-Warning "CUDA khong khoi dong duoc tren may nay. Dang tu dong chuyen sang Whisper CPU."
            $desiredBackend = "CPU"
            Install-WhisperRuntime $release $headers '^whisper-bin-x64\.zip$' $desiredBackend
        }
        if (-not (Test-WhisperRuntime $desiredBackend)) { throw "whisper-cli.exe khong khoi dong duoc tren may nay." }
    }
}
if (-not (Test-Path -LiteralPath $whisperModel -PathType Leaf)) {
    Write-Host "Dang tai model Whisper Large V3 Turbo Q5 multilingual (khoang 547 MB)..." -ForegroundColor Cyan
    $modelUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin?download=true"
    Invoke-ReliableDownload -Uri $modelUrl -OutFile $whisperModel -MinimumBytes 500MB
    if ((Get-Item -LiteralPath $whisperModel).Length -lt 500MB) {
        Remove-Item -LiteralPath $whisperModel -Force
        throw "Model Whisper tai ve khong hop le. Hay chay lai bo cai."
    }
}

function Test-WhisperInference([string]$backendName) {
    $testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("ht_selftest_" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
    $testWav = Join-Path $testRoot "test.wav"
    $testPrefix = Join-Path $testRoot "result"
    $stdoutFile = Join-Path $testRoot "stdout.txt"
    $stderrFile = Join-Path $testRoot "stderr.txt"
    try {
        $ffmpegRuntime = Join-Path $runtimeDir "ffmpeg.exe"
        & $ffmpegRuntime -nostdin -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=440:duration=1" -ac 1 -ar 16000 $testWav
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $testWav)) { return $false }
        # One greedy decoder is enough to prove that the model can be loaded and
        # inference works. It is much faster on older CPUs than the default beam search.
        $arguments = @("-m", $whisperModel, "-f", $testWav, "-l", "en", "-t", "2", "-bs", "1", "-bo", "1")
        if ($backendName -like "CUDA*") { $arguments += "-fa" }
        else { $arguments += "-ng" }
        $arguments += @("-oj", "-of", $testPrefix)
        $process = Start-Process -FilePath $whisperExe -ArgumentList $arguments -NoNewWindow -PassThru -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
        if (-not $process.WaitForExit(300000)) {
            try { $process.Kill() } catch {}
            return $false
        }
        return $process.ExitCode -eq 0 -and (Test-Path -LiteralPath "$testPrefix.json" -PathType Leaf)
    } catch { return $false }
    finally { Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

if ($needsRuntime -or $Repair) {
Write-Host "Dang kiem tra suy luan Whisper thuc te..." -ForegroundColor Cyan
if (-not (Test-WhisperInference $desiredBackend)) {
    if ($desiredBackend -like "CUDA*") {
        Write-Warning "Whisper CUDA khong vuot qua self-test. Dang thu che do CPU an toan."
        $desiredBackend = "CPU"
        Set-Content -LiteralPath $backendMarker -Value $desiredBackend -Encoding ASCII
        if (-not (Test-WhisperInference $desiredBackend)) {
            if (-not $release) {
                $headers = @{ "User-Agent" = "HT_Automation-Installer"; "Accept" = "application/vnd.github+json" }
                $release = Invoke-GitHubApi -Uri "https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest" -Headers $headers
            }
            Install-WhisperRuntime $release $headers '^whisper-bin-x64\.zip$' $desiredBackend
        }
    }
    if (-not (Test-WhisperInference $desiredBackend)) {
        # Runtime --version and the model integrity checks above already passed.
        # Do not block the CCX/Bridge update because a synthetic one-second tone
        # timed out or produced no transcript on a slow machine.
        Write-Warning "Whisper khong hoan tat self-test am thanh gia, nhung runtime va model da hop le. Tiep tuc cai dat de co the dung Auto Sub."
    }
}
} else {
    Write-Host "Whisper $desiredBackend da hoat dong; bo qua self-test khi cap nhat nhanh." -ForegroundColor DarkGray
}
Set-Content -LiteralPath $backendMarker -Value $desiredBackend -Encoding ASCII

$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$runCommand = 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $bridgeTarget
New-Item -Path $runKey -Force | Out-Null
New-ItemProperty -Path $runKey -Name "HT_Automation_FFmpeg_Bridge" -Value $runCommand -PropertyType String -Force | Out-Null

# Restart an older installed bridge so the new health/config endpoint is active.
$oldConnections = Get-NetTCPConnection -LocalPort 19888 -ErrorAction SilentlyContinue
foreach ($connection in $oldConnections) {
    if ($connection.OwningProcess -and $connection.OwningProcess -ne $PID) {
        Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}
# Dừng FFmpeg con còn sót từ Bridge cũ; nếu không, Windows có thể khóa file
# bin\ffmpeg.exe và làm cập nhật/gỡ cài đặt thất bại.
$staleFfmpeg = Get-CimInstance Win32_Process -Filter "Name = 'ffmpeg.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.ExecutablePath -and $_.ExecutablePath -match '[\\/]HT_Automation[\\/]'
}
foreach ($process in $staleFfmpeg) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 500
$remainingBridge = Get-NetTCPConnection -State Listen -LocalPort 19888 -ErrorAction SilentlyContinue
if ($remainingBridge) {
    throw "Bridge cu van chiem cong 19888 (PID $($remainingBridge[0].OwningProcess)). Hay dong Premiere, chay cong_cu\cai_dat\SUA_CHUA.bat bang Run as administrator."
}
$ready = $false
try {
    $health = Invoke-RestMethod "http://127.0.0.1:19888/health" -TimeoutSec 2
    $ready = $health.status -eq "ok" -and (-not $expectedBridgeVersion -or $health.bridgeVersion -eq $expectedBridgeVersion)
} catch {}
if (-not $ready) {
    Start-Process "powershell.exe" -ArgumentList @("-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", ('"{0}"' -f $bridgeTarget)) -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 15; $attempt++) {
        Start-Sleep -Milliseconds 300
        try {
            $health = Invoke-RestMethod "http://127.0.0.1:19888/health" -TimeoutSec 1
            if ($health.status -eq "ok" -and (-not $expectedBridgeVersion -or $health.bridgeVersion -eq $expectedBridgeVersion)) { $ready = $true; break }
        } catch {}
    }
}
if (-not $ready) { throw "Khong khoi dong duoc FFmpeg Bridge dung phien ban $expectedBridgeVersion tai cong 19888." }

Write-Host "FFmpeg Bridge $expectedBridgeVersion va Whisper multilingual da san sang." -ForegroundColor Green

# Install into Premiere's system fallback folder. UPIC scans this location at
# startup without Creative Cloud Desktop, UPIA, or a user PluginsInfo record.
Write-Host "Dang cai plugin UXP truc tiep (khong can Creative Cloud)..." -ForegroundColor Cyan
$commonFilesRoot = [System.IO.Path]::GetFullPath(${env:CommonProgramFiles})
$externalRoot = [System.IO.Path]::GetFullPath((Join-Path $commonFilesRoot "Adobe\UXP\Plugins\External"))
$pluginId = "com.hieuyt.htautomation"
$pluginTarget = [System.IO.Path]::GetFullPath((Join-Path $externalRoot $pluginId))
if (-not $externalRoot.StartsWith($commonFilesRoot, [StringComparison]::OrdinalIgnoreCase) -or
    -not $pluginTarget.StartsWith($externalRoot, [StringComparison]::OrdinalIgnoreCase) -or
    [System.IO.Path]::GetFileName($pluginTarget) -ne $pluginId) {
    throw "Duong dan cai plugin UXP khong an toan; huy cai dat."
}
New-Item -ItemType Directory -Path $externalRoot -Force | Out-Null
$pluginStage = Join-Path $externalRoot (".htautomation_install_" + [Guid]::NewGuid().ToString("N"))
$pluginBackup = Join-Path $externalRoot (".htautomation_backup_" + [Guid]::NewGuid().ToString("N"))
try {
    New-Item -ItemType Directory -Path $pluginStage -Force | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ccx.FullName, $pluginStage)
    $installedManifestPath = Join-Path $pluginStage "manifest.json"
    if (-not (Test-Path -LiteralPath $installedManifestPath -PathType Leaf)) { throw "CCX khong co manifest.json." }
    $installedManifest = Get-Content -LiteralPath $installedManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string]$installedManifest.id -ne $pluginId) { throw "CCX co plugin ID khong hop le: $($installedManifest.id)" }
    if ($expectedBridgeVersion -and [string]$installedManifest.version -ne $expectedBridgeVersion) {
        throw "Version CCX $($installedManifest.version) khong khop bo cai $expectedBridgeVersion."
    }
    if (Test-Path -LiteralPath $pluginTarget -PathType Container) { Move-Item -LiteralPath $pluginTarget -Destination $pluginBackup }
    Move-Item -LiteralPath $pluginStage -Destination $pluginTarget
    if (Test-Path -LiteralPath $pluginBackup) { Remove-Item -LiteralPath $pluginBackup -Recurse -Force }
} catch {
    if (-not (Test-Path -LiteralPath $pluginTarget) -and (Test-Path -LiteralPath $pluginBackup)) {
        Move-Item -LiteralPath $pluginBackup -Destination $pluginTarget -ErrorAction SilentlyContinue
    }
    throw
} finally {
    if (Test-Path -LiteralPath $pluginStage) { Remove-Item -LiteralPath $pluginStage -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $pluginBackup) { Remove-Item -LiteralPath $pluginBackup -Recurse -Force -ErrorAction SilentlyContinue }
}
Write-Host "Da cai plugin vao: $pluginTarget" -ForegroundColor Green

# Remove obsolete per-user sideload copies so Premiere sees only one plugin ID.
$legacyExternalRoot = Join-Path $env:APPDATA "Adobe\UXP\Plugins\External"
foreach ($legacyId in @("com.hieuyt.htautomation", "com.hieuyt.htstudio")) {
    $legacyTarget = Join-Path $legacyExternalRoot $legacyId
    if (Test-Path -LiteralPath $legacyTarget -PathType Container) {
        Remove-Item -LiteralPath $legacyTarget -Recurse -Force
    }
}

$updaterSource = Join-Path $packageRootPath "installer\update.ps1"
if (Test-Path -LiteralPath $updaterSource -PathType Leaf) {
    $updaterDir = Join-Path $env:LOCALAPPDATA "HT_Automation\Updater"
    New-Item -ItemType Directory -Path $updaterDir -Force | Out-Null
    Copy-Item -LiteralPath $updaterSource -Destination (Join-Path $updaterDir "update.ps1") -Force
    $desktopUpdater = Join-Path ([Environment]::GetFolderPath("Desktop")) "CAP_NHAT_HT_AUTOMATION.bat"
    $updaterCommand = @"
@echo off
title Cap nhat HT_Automation
powershell.exe -NoProfile -Command "exit (Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""$updaterDir\update.ps1""').ExitCode"
if errorlevel 1 pause
"@
    Set-Content -LiteralPath $desktopUpdater -Value $updaterCommand -Encoding ASCII
    Write-Host "Da tao nut cap nhat mot click tren Desktop." -ForegroundColor Green
}
Write-Host "Da cai HT_Automation, Bridge va Whisper multilingual. Mo lai Premiere Pro de su dung." -ForegroundColor Green
