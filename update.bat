@echo off
title Antigravity Auto Accept - 1-Click Updater
cd /d "%~dp0"

echo ===================================================
echo     Antigravity Auto Accept - 1-Click Updater
echo ===================================================
echo.

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [Error] Git is not installed or not in PATH!
    echo Please install Git from https://git-scm.com/
    pause
    exit /b 1
)

echo [1/4] Stopping running daemon instances...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*daemon.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

echo [2/4] Checking for updates from GitHub...
git fetch origin main

set "LOCAL_HASH="
set "REMOTE_HASH="
for /f "tokens=*" %%a in ('git rev-parse HEAD 2^>nul') do set "LOCAL_HASH=%%a"
for /f "tokens=*" %%a in ('git rev-parse origin/main 2^>nul') do set "REMOTE_HASH=%%a"

if "%LOCAL_HASH%"=="" (
    echo [Warning] Could not read local git commit. Trying direct git pull...
    git pull origin main
    goto :INSTALL_DEPS
)

if "%LOCAL_HASH%"=="%REMOTE_HASH%" (
    echo.
    echo [INFO] You are already on the latest version! (Commit: %LOCAL_HASH:~0,7%)
    goto :RESTART_DAEMON
)

echo.
echo [3/4] New updates found! Pulling latest changes (%LOCAL_HASH:~0,7% -> %REMOTE_HASH:~0,7%)...
git pull origin main

:INSTALL_DEPS
echo.
echo [4/4] Verifying and updating dependencies...
call npm install --omit=dev

:RESTART_DAEMON
echo.
echo ===================================================
echo     Update complete! Restarting daemon...
echo ===================================================
echo.

if exist "run-win11.bat" (
    call run-win11.bat
) else (
    call run.bat
)
