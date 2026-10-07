@echo off
title Antigravity Auto Accept Launcher (Windows 11)
cd /d "%~dp0"

echo [AutoAccept] Checking existing daemon instances...

:: Terminate any existing daemon instance (both background and foreground)
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*daemon.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

echo [AutoAccept] Starting Antigravity Auto Accept with visible Console window...

:: Launch node daemon.js in a dedicated visible console window
start "Antigravity Auto Accept (Console)" cmd /k "title Antigravity Auto Accept Console && node daemon.js"

echo [AutoAccept] Started! Console window is now open on your desktop.
timeout /t 3 >nul
