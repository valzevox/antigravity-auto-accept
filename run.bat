@echo off
title Antigravity Auto Accept
cd /d "%~dp0"

:: Terminate any existing daemon instances
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*daemon.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

:: Check if Antigravity is running but CDP is inactive
powershell -NoProfile -Command "$proc = Get-Process Antigravity -ErrorAction SilentlyContinue; if ($proc) { try { $r = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9000/json/version -TimeoutSec 1 } catch { Write-Host '[!] Antigravity is running but CDP port 9000 is NOT responding.' -ForegroundColor Yellow; Write-Host '[i] Run fix-cdp.bat to cleanly restart Antigravity with CDP.' -ForegroundColor Cyan; Start-Sleep -Seconds 2 } }"

:: If called with --background (e.g. from headless tasks), run detached
if /i "%~1"=="--background" (
    start "" /b node daemon.js
    exit /b 0
)

:: Visible console window for both Windows 10 & 11
start "Antigravity Auto Accept (Console)" cmd /k "title Antigravity Auto Accept Console && node daemon.js"
