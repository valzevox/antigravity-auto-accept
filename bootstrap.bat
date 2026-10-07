@echo off
:: Bootstrap: auto-update from GitHub, then run the daemon in foreground.
:: Used by the Scheduled Task (AtLogOn) and by setup.bat so the latest code is
:: always pulled before starting, with no manual git/powershell steps.
cd /d "%~dp0"

setlocal enabledelayedexpansion

where git >nul 2>&1
if %errorlevel% equ 0 (
    echo [Bootstrap] Checking GitHub for updates...
    git fetch origin main >nul 2>&1
    set "L_HASH="
    set "R_HASH="
    for /f "tokens=*" %%a in ('git rev-parse HEAD 2^>nul') do set "L_HASH=%%a"
    for /f "tokens=*" %%a in ('git rev-parse origin/main 2^>nul') do set "R_HASH=%%a"
    if not "!L_HASH!"=="" if not "!R_HASH!"=="" (
        if not "!L_HASH!"=="!R_HASH!" (
            echo [Bootstrap] Update found, pulling latest version...
            git pull origin main
            call npm install --omit=dev >nul 2>&1
        ) else (
            echo [Bootstrap] Already up to date.
        )
    ) else (
        echo [Bootstrap] Could not determine git state, skipping update.
    )
) else (
    echo [Bootstrap] Git not found, skipping update check.
)

echo [Bootstrap] Starting daemon...
node daemon.js
