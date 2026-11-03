@echo off
title Disable Antigravity Auto Accept Startup
cd /d "%~dp0"

echo ============================================================
echo   Antigravity Auto Accept - Disable Auto Run on Startup
echo ============================================================
echo.

echo [1/3] Removing from Windows Startup Folder (VBS)...
set "STARTUP_VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AntigravityAutoAccept.vbs"
if exist "%STARTUP_VBS%" (
    del /f /q "%STARTUP_VBS%" >nul 2>&1
    echo    [OK] Deleted: %STARTUP_VBS%
) else (
    echo    [INFO] Startup VBS is not present.
)

echo.
echo [2/3] Disabling / Removing Windows Scheduled Task...
schtasks /delete /tn "AntigravityAutoAccept" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo    [OK] Scheduled Task "AntigravityAutoAccept" deleted.
) else (
    echo    [INFO] Scheduled Task was already removed or disabled.
)

echo.
echo [3/3] Stopping any currently running daemon instances...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*daemon.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
echo    [OK] Active daemon stopped.

echo.
echo ============================================================
echo  SUCCESS: Auto-run on restart has been completely DISABLED!
echo ============================================================
echo.
echo - When you want to run it manually: Run "run.bat"
echo - When you want to enable auto-start again: Run "enable-startup.bat"
echo.
pause
