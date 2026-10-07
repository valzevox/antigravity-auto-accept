@echo off
cd /d "%~dp0"

:: Auto-update check: pull latest updates from GitHub if git is present
where git >nul 2>&1
if %errorlevel% equ 0 (
    git fetch origin main >nul 2>&1
    for /f "tokens=*" %%a in ('git rev-parse HEAD 2^>nul') do set "L_HASH=%%a"
    for /f "tokens=*" %%a in ('git rev-parse origin/main 2^>nul') do set "R_HASH=%%a"
    if not "%L_HASH%"=="" if not "%R_HASH%"=="" if not "%L_HASH%"=="%R_HASH%" (
        echo [AutoAccept] New update detected! Pulling latest version...
        git pull origin main >nul 2>&1
    )
)

:: Terminate any existing daemon instance
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*daemon.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

:: Start Scheduled Task or launch detached
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\register-task.ps1" >nul 2>&1

echo [AutoAccept] Background daemon is active.
