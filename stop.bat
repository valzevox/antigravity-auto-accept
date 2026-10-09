@echo off
title Stop Antigravity Auto Accept
cd /d "%~dp0"

echo [Antigravity Auto Accept] Dang dung tat ca tien trinh lien quan...
echo.

:: 1. Dung tien trinh node chay daemon.js hoac trong thu muc antigravity-auto-accept
powershell -NoProfile -Command ^
    "$procs = Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -and ($_.CommandLine -like '*daemon.js*' -or $_.CommandLine -like '*antigravity-auto-accept*')) }; " ^
    "if ($procs) { " ^
    "    $procs | ForEach-Object { Write-Host ('   - Dung node PID: ' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; " ^
    "} else { " ^
    "    Write-Host '   - Khong co tien trinh node daemon nao dang chay.'; " ^
    "}"

:: 2. Dong cac cua so cmd.exe co tieu de chua Antigravity Auto Accept
powershell -NoProfile -Command ^
    "$cmds = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cmd.exe' -and ($_.CommandLine -like '*Antigravity Auto Accept*' -or $_.CommandLine -like '*daemon.js*') -and $_.ProcessId -ne $PID }; " ^
    "if ($cmds) { " ^
    "    $cmds | ForEach-Object { Write-Host ('   - Dong cua so cmd PID: ' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; " ^
    "}"

echo.
echo [Antigravity Auto Accept] Da dung tat ca tien trinh thanh cong!
echo.
powershell -NoProfile -Command "Start-Sleep -Seconds 2" >nul 2>&1

