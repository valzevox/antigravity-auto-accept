@echo off
title Antigravity Auto Accept Launcher (Windows 11)
cd /d "%~dp0"

echo [AutoAccept] Checking for updates from GitHub...

:: Auto-update check: pull latest updates from GitHub if git is present
where git >nul 2>&1
if %errorlevel% equ 0 (
    git fetch origin main >nul 2>&1
    for /f "tokens=*" %%a in ('git rev-parse HEAD 2^>nul') do set "L_HASH=%%a"
    for /f "tokens=*" %%a in ('git rev-parse origin/main 2^>nul') do set "R_HASH=%%a"
    if not "%L_HASH%"=="" if not "%R_HASH%"=="" if not "%L_HASH%"=="%R_HASH%" (
        echo [AutoAccept] New update detected! Pulling latest version...
        git pull origin main
        call npm install --omit=dev >nul 2>&1
    ) else (
        echo [AutoAccept] Already on the latest version.
    )
)

echo [AutoAccept] Checking existing daemon instances...

:: Terminate any existing daemon instance (both background and foreground)
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*daemon.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

echo [AutoAccept] Starting Antigravity Auto Accept with visible Console window...

:: Launch node daemon.js in a dedicated visible console window
start "Antigravity Auto Accept (Console)" cmd /k "title Antigravity Auto Accept Console && node daemon.js"

echo [AutoAccept] Started! Console window is now open on your desktop.
timeout /t 3 >nul
