@echo off
cd /d "%~dp0"

:: Terminate any existing daemon instance
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*daemon.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

:: Start Scheduled Task or launch detached
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\register-task.ps1" >nul 2>&1

echo [AutoAccept] Background daemon is active.
