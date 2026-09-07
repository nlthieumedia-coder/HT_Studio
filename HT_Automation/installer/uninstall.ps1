$ErrorActionPreference = "Stop"

$isAdministrator = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdministrator) {
    $elevated = Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"{0}"' -f $PSCommandPath))
    exit $elevated.ExitCode
}

if (Get-Process -Name "Adobe Premiere Pro" -ErrorAction SilentlyContinue) {
    throw "Hay dong hoan toan Adobe Premiere Pro truoc khi go HT_Automation."
}

Write-Host "Dang dung FFmpeg Bridge..." -ForegroundColor Cyan
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
Remove-ItemProperty -Path $runKey -Name "HT_Automation_FFmpeg_Bridge" -ErrorAction SilentlyContinue
$connections = Get-NetTCPConnection -LocalPort 19888 -ErrorAction SilentlyContinue
foreach ($connection in $connections) {
    if ($connection.OwningProcess -and $connection.OwningProcess -ne $PID) {
        Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

# Dừng cả Bridge chưa kịp mở cổng và FFmpeg con đang dùng file của plugin.
# Bộ lọc đường dẫn/command line tránh tác động các tiến trình không liên quan.
$automationProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    ($_.CommandLine -and $_.CommandLine -match 'ffmpeg_bridge_server\.ps1') -or
    ($_.ExecutablePath -and $_.ExecutablePath -match '[\\/]HT_Automation[\\/].*ffmpeg\.exe$')
}
foreach ($process in $automationProcesses) {
    if ($process.ProcessId -and $process.ProcessId -ne $PID) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
}
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if (-not (Get-NetTCPConnection -State Listen -LocalPort 19888 -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 250
}
if (Get-NetTCPConnection -State Listen -LocalPort 19888 -ErrorAction SilentlyContinue) {
    throw "Khong dung duoc FFmpeg Bridge tai cong 19888. Hay khoi dong lai Windows roi thu go cai dat lai."
}

function Remove-PathWithRetry([string]$LiteralPath, [switch]$Recurse) {
    if (-not (Test-Path -LiteralPath $LiteralPath)) { return }
    $lastError = $null
    for ($attempt = 1; $attempt -le 8; $attempt++) {
        try {
            if ($Recurse) { Remove-Item -LiteralPath $LiteralPath -Recurse -Force -ErrorAction Stop }
            else { Remove-Item -LiteralPath $LiteralPath -Force -ErrorAction Stop }
            return
        } catch {
            $lastError = $_
            if ($attempt -lt 8) { Start-Sleep -Milliseconds (250 * $attempt) }
        }
    }
    throw "Khong xoa duoc '$LiteralPath' sau nhieu lan thu. File dang bi khoa. Chi tiet: $($lastError.Exception.Message)"
}

Write-Host "Dang xoa runtime Bridge, FFmpeg va Whisper..." -ForegroundColor Cyan
$localRoot = [System.IO.Path]::GetFullPath($env:LOCALAPPDATA)
$automationRoot = [System.IO.Path]::GetFullPath((Join-Path $localRoot "HT_Automation"))
if (-not $automationRoot.StartsWith($localRoot, [StringComparison]::OrdinalIgnoreCase) -or [System.IO.Path]::GetFileName($automationRoot) -ne "HT_Automation") {
    throw "Duong dan runtime khong an toan; huy go cai dat."
}
if (Test-Path -LiteralPath $automationRoot) {
    Remove-PathWithRetry -LiteralPath $automationRoot -Recurse
}
$desktopUpdater = Join-Path ([Environment]::GetFolderPath("Desktop")) "CAP_NHAT_HT_AUTOMATION.bat"
if (Test-Path -LiteralPath $desktopUpdater -PathType Leaf) { Remove-PathWithRetry -LiteralPath $desktopUpdater }

Write-Host "Dang xoa plugin UXP HT_Automation..." -ForegroundColor Cyan
$externalRoot = [System.IO.Path]::GetFullPath((Join-Path ${env:CommonProgramFiles} "Adobe\UXP\Plugins\External"))
$commonFilesRoot = [System.IO.Path]::GetFullPath(${env:CommonProgramFiles})
if (-not $externalRoot.StartsWith($commonFilesRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Duong dan UXP khong an toan; huy go cai dat."
}
if (Test-Path -LiteralPath $externalRoot -PathType Container) {
    $pluginFolders = Get-ChildItem -LiteralPath $externalRoot -Directory -Force | Where-Object {
        $_.Name -match '^com\.hieuyt\.htautomation(?:[._]|$)'
    }
    foreach ($pluginFolder in $pluginFolders) {
        $resolvedPlugin = [System.IO.Path]::GetFullPath($pluginFolder.FullName)
        if ($resolvedPlugin.StartsWith($externalRoot, [StringComparison]::OrdinalIgnoreCase)) {
            Remove-PathWithRetry -LiteralPath $resolvedPlugin -Recurse
            Write-Host "  Da xoa $($pluginFolder.Name)" -ForegroundColor DarkGray
        }
    }
}

Write-Host "Da go HT_Automation, Whisper va FFmpeg Bridge." -ForegroundColor Green
