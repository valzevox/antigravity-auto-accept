@echo off
title Antigravity Auto Accept - Updater
cd /d "%~dp0"

echo [AutoUpdate] Checking for updates from GitHub...

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [AutoUpdate] Git not found. Skipping update check.
    goto :START_RUN
)

:: Fetch remote changes quietly
git fetch origin main >nul 2>&1

set "LOCAL_HASH="
set "REMOTE_HASH="
for /f "tokens=*" %%a in ('git rev-parse HEAD 2^>nul') do set "LOCAL_HASH=%%a"
for /f "tokens=*" %%a in ('git rev-parse origin/main 2^>nul') do set "REMOTE_HASH=%%a"

if "%LOCAL_HASH%"=="" (
    echo [AutoUpdate] Git status unavailable, pulling...
    git pull origin main >nul 2>&1
    call npm install --omit=dev --silent >nul 2>&1
    goto :START_RUN
)

if not "%LOCAL_HASH%"=="%REMOTE_HASH%" (
    echo [AutoUpdate] New version detected (%LOCAL_HASH:~0,7% -^> %REMOTE_HASH:~0,7%). Pulling changes...
    git pull origin main
    echo [AutoUpdate] Updating dependencies...
    call npm install --omit=dev --silent
    echo [AutoUpdate] Update complete!
) else (
    echo [AutoUpdate] Already up to date (%LOCAL_HASH:~0,7%).
)

:START_RUN
:: If update.bat was called directly (not chained with && run.bat), start run.bat
if "%~1"=="" (
    call run.bat
)
