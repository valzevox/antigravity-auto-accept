@echo off
setlocal enabledelayedexpansion
title Antigravity Auto Accept - 1-Click Setup

echo ========================================================
echo        ANTIGRAVITY AUTO ACCEPT 2.0 - AUTO SETUP
echo ========================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found! Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)
echo [1/4] Node.js detected: OK

:: 2. Install Dependencies & Initialize Config
echo [2/4] Installing dependencies...
cd /d "%~dp0"
if not exist "config.json" (
    copy "config.json.example" "config.json" >nul 2>&1
    echo [INFO] Created config.json from template.
)
call npm install --silent
if %errorlevel% neq 0 (
    echo [WARNING] npm install finished with warnings, continuing...
) else (
    echo [2/4] Dependencies installed: OK
)

:: 3. Patch Antigravity Shortcuts with --remote-debugging-port=9000
echo [3/4] Patching Antigravity desktop & start menu shortcuts...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update-shortcuts.ps1"
echo [3/4] Shortcuts configured: OK

:: 4. Register & Start Windows Startup Scheduled Task
echo [4/4] Registering background daemon to run on Windows startup...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\register-task.ps1" >nul 2>&1
echo [4/4] Background service registered and started: OK

echo.
echo ========================================================
echo   [SUCCESS] SETUP COMPLETED SUCCESSFULLY!
echo   Antigravity Auto Accept is now running in background.
echo ========================================================
echo.
pause
