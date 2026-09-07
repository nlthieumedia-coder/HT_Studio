param(
    [Parameter(Mandatory = $true)][string]$PackageRoot,
    [Parameter(Mandatory = $true)][ValidateSet("Install", "UpdateLocal", "Repair", "Uninstall")][string]$Action,
    [string]$LogPath = ""
)
$ErrorActionPreference = "Stop"

$logDir = Join-Path $env:TEMP "HT_Automation_Logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
if (-not $LogPath) { $LogPath = Join-Path $logDir ("{0}_{1}.log" -f $Action, (Get-Date -Format "yyyyMMdd_HHmmss")) }

$isAdministrator = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdministrator) {
    $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"{0}"' -f $PSCommandPath), "-PackageRoot", ('"{0}"' -f $PackageRoot), "-Action", $Action, "-LogPath", ('"{0}"' -f $LogPath))
    try {
        Write-Host "Dang yeu cau quyen Administrator. Hay chon Yes trong hop thoai UAC..." -ForegroundColor Cyan
        $elevated = Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -PassThru -ArgumentList $arguments
        $startedAt = Get-Date
        $lastStatus = ""
        $lastHeartbeat = -5
        while (-not $elevated.HasExited) {
            Start-Sleep -Milliseconds 750
            $elevated.Refresh()
            if (Test-Path -LiteralPath $LogPath -PathType Leaf) {
                $status = Get-Content -LiteralPath $LogPath -Tail 1 -ErrorAction SilentlyContinue
                if ($status -and $status -ne $lastStatus -and $status -notmatch '^\*+$') {
                    Write-Host $status
                    $lastStatus = $status
                }
            }
            $elapsed = [math]::Floor(((Get-Date) - $startedAt).TotalSeconds)
            if ($elapsed - $lastHeartbeat -ge 5) {
                Write-Host ("Dang xu ly voi quyen Administrator... {0}s" -f $elapsed) -ForegroundColor DarkCyan
                $lastHeartbeat = $elapsed
            }
        }
        exit $elevated.ExitCode
    } catch {
        Write-Host "Khong nhan duoc quyen Administrator: $($_.Exception.Message)" -ForegroundColor Red
        exit 1223
    }
}

$success = $false
try {
    Start-Transcript -LiteralPath $LogPath -Force | Out-Null
    Write-Host "HT_Automation - $Action" -ForegroundColor Cyan
    Write-Host "Nhat ky: $LogPath" -ForegroundColor DarkGray
    switch ($Action) {
        "Install" { & (Join-Path $PackageRoot "installer\install.ps1") -PackageRoot $PackageRoot }
        "UpdateLocal" { & (Join-Path $PackageRoot "installer\install.ps1") -PackageRoot $PackageRoot }
        "Repair" { & (Join-Path $PackageRoot "installer\install.ps1") -PackageRoot $PackageRoot -Repair }
        "Uninstall" { & (Join-Path $PackageRoot "installer\uninstall.ps1") }
    }
    $success = $true
} catch {
    $message = "THAO TAC THAT BAI.`n`n$($_.Exception.Message)`n`nNhat ky: $LogPath"
    Write-Host $message -ForegroundColor Red
} finally {
    try { Stop-Transcript | Out-Null } catch {}
}

if ($success) {
    Write-Host "THAO TAC HOAN TAT THANH CONG." -ForegroundColor Green
    exit 0
}
exit 1
