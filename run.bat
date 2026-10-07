@echo off
title Antigravity Auto Accept
cd /d "%~dp0"

:: Terminate any existing daemon instances
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*daemon.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

:: If called with --background (e.g. from headless tasks), run detached
if /i "%~1"=="--background" (
    start "" /b node daemon.js
    exit /b 0
)

:: Visible console window for both Windows 10 & 11
start "Antigravity Auto Accept (Console)" cmd /k "title Antigravity Auto Accept Console && node daemon.js"
