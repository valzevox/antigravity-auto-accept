@echo off
title Fix Antigravity CDP
cd /d "%~dp0"
echo ============================================================
echo  [Antigravity Auto Accept] Resetting Antigravity CDP Port...
echo ============================================================
echo.
echo [1/3] Terminating zombie Antigravity and daemon processes...
taskkill /F /IM Antigravity.exe >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*daemon.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Clean launching Antigravity with --remote-debugging-port=9000...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-antigravity-cdp.ps1"

echo [3/3] Starting Auto Accept Daemon...
start "Antigravity Auto Accept (Console)" cmd /k "title Antigravity Auto Accept Console && cd /d "%~dp0" && node daemon.js"
echo.
echo ============================================================
echo  SUCCESS: Antigravity has been cleanly restarted with CDP!
echo ============================================================
timeout /t 3 /nobreak >nul
