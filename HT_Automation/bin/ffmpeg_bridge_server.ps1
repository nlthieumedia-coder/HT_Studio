# ============================================================================
# FFmpeg Bridge HTTP Server (TcpListener) — HT_Automation Premiere Pro UXP
# ============================================================================

$port = 19888
$bridgeVersion = "3.0.8"
$localAddr = [System.Net.IPAddress]::Parse("127.0.0.1")
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$defaultFfmpegExe = Join-Path $scriptDir "ffmpeg.exe"
$whisperDir = Join-Path (Split-Path -Parent $scriptDir) "Whisper"
$defaultWhisperExe = Join-Path $whisperDir "whisper-cli.exe"
$defaultWhisperModel = Join-Path $whisperDir "ggml-large-v3-turbo-q5_0.bin"
$whisperBackendFile = Join-Path $whisperDir "backend.txt"

# Collect once when the Bridge starts. This avoids repeatedly querying WMI while
# Premiere is working and gives the panel enough information to tune its workload.
$machineProfile = @{
    cpuName = ""
    logicalProcessors = [Environment]::ProcessorCount
    physicalMemoryGB = 0
    gpuName = ""
    gpuMemoryMB = 0
    runtimeDriveFreeGB = 0
}
try {
    $cpu = Get-CimInstance Win32_Processor -ErrorAction Stop | Select-Object -First 1
    $machineProfile.cpuName = ([string]$cpu.Name).Trim()
} catch {}
try {
    $computer = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop
    $machineProfile.physicalMemoryGB = [Math]::Round([double]$computer.TotalPhysicalMemory / 1GB, 1)
} catch {}
try {
    $runtimeDriveName = [System.IO.Path]::GetPathRoot($scriptDir).TrimEnd('\')
    $runtimeDrive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$runtimeDriveName'" -ErrorAction Stop
    $machineProfile.runtimeDriveFreeGB = [Math]::Round([double]$runtimeDrive.FreeSpace / 1GB, 1)
} catch {}
try {
    $nvidiaCommand = Get-Command "nvidia-smi.exe" -ErrorAction SilentlyContinue
    $nvidiaPath = $(if ($nvidiaCommand) { $nvidiaCommand.Source } elseif (Test-Path -LiteralPath "$env:WINDIR\System32\nvidia-smi.exe") { "$env:WINDIR\System32\nvidia-smi.exe" } else { "" })
    if ($nvidiaPath) {
        $gpuLine = & $nvidiaPath --query-gpu=name,memory.total --format=csv,noheader,nounits 2>$null | Select-Object -First 1
        if ($gpuLine -match '^\s*(.+),\s*(\d+)\s*$') {
            $machineProfile.gpuName = $matches[1].Trim()
            $machineProfile.gpuMemoryMB = [int]$matches[2]
        }
    }
} catch {}

# Kiem tra xem Server da dang chay va phan hoi tot chua
try {
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 2 -ErrorAction Stop
    if ($resp -and $resp.status -eq "ok") {
        Write-Host "====================================================================" -ForegroundColor Green
        Write-Host "   ✅ FFmpeg Bridge HTTP Server DA DANG CHAY SAN ROI!" -ForegroundColor Green
        Write-Host "   Server dang hoat dong ngam mượt mà tren may ban." -ForegroundColor Yellow
        Write-Host "====================================================================" -ForegroundColor Green
        Start-Sleep -Seconds 3
        exit 0
    }
} catch {
    # Server chua chay hoac dang bi treo -> Don dẹp tien trinh cu
    $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($c in $conns) {
            $pidToKill = $c.OwningProcess
            if ($pidToKill -and $pidToKill -ne $PID) {
                Write-Host "Dang tat tien trinh cu bi treo tren port $port (PID $pidToKill)..." -ForegroundColor Yellow
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Milliseconds 500
    }
}

$server = New-Object System.Net.Sockets.TcpListener($localAddr, $port)
try {
    $server.Start()
} catch {
    Write-Host "Loi khoi tao socket: $($_.Exception.Message)" -ForegroundColor Red
    Start-Sleep -Seconds 5
    exit 1
}

Write-Host "====================================================================" -ForegroundColor Green
Write-Host "   ✅ FFmpeg Bridge HTTP Server Dang Chay Tai: http://127.0.0.1:$port/" -ForegroundColor Green
Write-Host "   Giu cua so nay chay ngam khi su dung HT_Automation trong Premiere Pro." -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Green

while ($true) {
    try {
        $client = $server.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
        
        $requestLine = $reader.ReadLine()
        if (-not $requestLine) {
            $client.Close()
            continue
        }

        $contentLength = 0
        while ($true) {
            $line = $reader.ReadLine()
            if (-not $line -or $line.Trim() -eq "") { break }
            if ($line -like "*Content-Length:*") {
                $parts = $line.Split(":")
                if ($parts.Length -ge 2) {
                    [int]::TryParse($parts[1].Trim(), [ref]$contentLength) | Out-Null
                }
            }
        }

        $bodyText = ""
        if ($contentLength -gt 0) {
            # HTTP Content-Length counts UTF-8 bytes, not .NET UTF-16 chars.
            # Reading `contentLength` chars blocks forever when JSON contains
            # Vietnamese paths such as "Kênh 5" because those chars use more
            # than one UTF-8 byte.
            $bodyBuilder = New-Object System.Text.StringBuilder
            $bodyByteCount = 0
            while ($bodyByteCount -lt $contentLength) {
                $nextChar = $reader.Read()
                if ($nextChar -lt 0) { break }
                $charText = [char]$nextChar
                [void]$bodyBuilder.Append($charText)
                $bodyByteCount += [System.Text.Encoding]::UTF8.GetByteCount([string]$charText)
            }
            $bodyText = $bodyBuilder.ToString()
            if ($bodyByteCount -lt $contentLength) {
                throw "Incomplete HTTP body: received $bodyByteCount of $contentLength UTF-8 bytes."
            }
        }

        # Service routes
        $isOptions = $requestLine.StartsWith("OPTIONS")
        $isHealth = $requestLine.Contains("/health")
        $isRun = $requestLine.Contains("/run")
        $isCleanup = $requestLine.Contains("/cleanup")

        $responseBody = ""
        $statusCode = "200 OK"

        if ($isOptions) {
            $responseBody = ""
        } elseif ($isHealth) {
            $healthObj = @{
                status = "ok"
                message = "FFmpeg Bridge Server is running"
                bridgeVersion = $bridgeVersion
                logicalProcessors = $machineProfile.logicalProcessors
                cpuName = $machineProfile.cpuName
                physicalMemoryGB = $machineProfile.physicalMemoryGB
                gpuName = $machineProfile.gpuName
                gpuMemoryMB = $machineProfile.gpuMemoryMB
                runtimeDriveFreeGB = $machineProfile.runtimeDriveFreeGB
                whisperBackend = $(if (Test-Path -LiteralPath $whisperBackendFile -PathType Leaf) { (Get-Content -LiteralPath $whisperBackendFile -Raw).Trim() } else { "CPU" })
                whisperExe = $(if (Test-Path -LiteralPath $defaultWhisperExe -PathType Leaf) { $defaultWhisperExe } else { "" })
                whisperModel = $(if (Test-Path -LiteralPath $defaultWhisperModel -PathType Leaf) { $defaultWhisperModel } else { "" })
            }
            $responseBody = ConvertTo-Json $healthObj -Compress
        } elseif ($isCleanup) {
            $removed = 0
            if ($bodyText -and $bodyText.Trim().Length -gt 0) {
                try {
                    $cleanupData = ConvertFrom-Json $bodyText
                    foreach ($candidate in @($cleanupData.paths)) {
                        $candidatePath = [string]$candidate
                        $candidateName = [System.IO.Path]::GetFileName($candidatePath)
                        $candidateExtension = [System.IO.Path]::GetExtension($candidatePath).ToLowerInvariant()
                        if ($candidateName.StartsWith("ht_sub_", [StringComparison]::OrdinalIgnoreCase) -and @(".wav", ".json", ".txt") -contains $candidateExtension) {
                            if (Test-Path -LiteralPath $candidatePath -PathType Leaf) {
                                Remove-Item -LiteralPath $candidatePath -Force -ErrorAction Stop
                                $removed++
                            }
                        }
                    }
                } catch {}
            }
            $responseBody = ConvertTo-Json @{ removed = $removed } -Compress
        } elseif ($isRun) {
            $exePath = $defaultFfmpegExe
            $argsArr = @("-version")
            $timeoutMs = 0

            if ($bodyText -and $bodyText.Trim().Length -gt 0) {
                try {
                    $data = ConvertFrom-Json $bodyText
                    if ($data.exePath -and (Test-Path $data.exePath -PathType Leaf)) {
                        $exePath = $data.exePath
                    }
                    if ($data.args) {
                        $argsArr = $data.args
                    }
                    if ($data.timeoutMs) {
                        $timeoutMs = [Math]::Max(0, [Math]::Min(1800000, [int]$data.timeoutMs))
                    }
                } catch {}
            }

            if (-not (Test-Path $exePath)) {
                $exePath = $defaultFfmpegExe
            }

            $psi = New-Object System.Diagnostics.ProcessStartInfo
            $psi.FileName = $exePath
            $psi.UseShellExecute = $false
            $psi.RedirectStandardOutput = $true
            $psi.RedirectStandardError = $true
            $psi.CreateNoWindow = $true

            if ($argsArr) {
                $argList = @()
                foreach ($a in $argsArr) {
                    if ($a.Contains(" ")) {
                        $argList += "`"$a`""
                    } else {
                        $argList += $a
                    }
                }
                $psi.Arguments = [string]::Join(" ", $argList)
            }

            $proc = New-Object System.Diagnostics.Process
            $proc.StartInfo = $psi

            $stdOutText = ""
            $stdErrText = ""
            $exitCode = -1

            try {
                [void]$proc.Start()
                $stdOutTask = $proc.StandardOutput.ReadToEndAsync()
                $stdErrTask = $proc.StandardError.ReadToEndAsync()
                $exited = $(if ($timeoutMs -gt 0) { $proc.WaitForExit($timeoutMs) } else { $proc.WaitForExit(); $true })
                if (-not $exited) {
                    try { $proc.Kill() } catch {}
                    $proc.WaitForExit()
                    $stdErrText = "Process timeout after $timeoutMs ms."
                    $exitCode = 124
                }
                $stdOutText = $stdOutTask.Result
                $capturedStdErr = $stdErrTask.Result
                if ($exitCode -ne 124) {
                    $stdErrText = $capturedStdErr
                    $exitCode = $proc.ExitCode
                } elseif ($capturedStdErr) {
                    $stdErrText += " " + $capturedStdErr
                }
            } catch {
                $stdErrText = $_.Exception.Message
                $exitCode = -1
            }

            $resultObj = @{
                exitCode = $exitCode
                stdout = $stdOutText
                stderr = $stdErrText
            }
            $responseBody = ConvertTo-Json $resultObj -Depth 3
        } else {
            $statusCode = "404 Not Found"
            $responseBody = '{"error":"Not found"}'
        }

        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($responseBody)
        $headerText = "HTTP/1.1 $statusCode`r`n" +
                      "Content-Type: application/json; charset=utf-8`r`n" +
                      "Content-Length: $($bodyBytes.Length)`r`n" +
                      "Access-Control-Allow-Origin: *`r`n" +
                      "Access-Control-Allow-Methods: GET, POST, OPTIONS`r`n" +
                      "Access-Control-Allow-Headers: Content-Type`r`n" +
                      "Connection: close`r`n`r`n"
        
        $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($headerText)
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        if ($bodyBytes.Length -gt 0) {
            $stream.Write($bodyBytes, 0, $bodyBytes.Length)
        }
        $stream.Flush()
        $client.Close()
    } catch {
        # Keep server loop active
    }
}
