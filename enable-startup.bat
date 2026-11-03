@echo off
title Enable Antigravity Auto Accept Startup
cd /d "%~dp0"

echo ============================================================
echo   Antigravity Auto Accept - Enable Auto Run on Startup
echo ============================================================
echo.

echo [1/2] Registering into Windows Startup Folder (Silent VBS)...
powershell -NoProfile -Command ^
    "$vbs = Join-Path ([Environment]::GetFolderPath('Startup')) 'AntigravityAutoAccept.vbs'; " ^
    "$node = (Get-Command node).Source; " ^
    "$daemon = Join-Path (Get-Location).Path 'daemon.js'; " ^
    "$content = 'Set WshShell = CreateObject(\"WScript.Shell\")' + [Environment]::NewLine + 'WshShell.Run \"\"\"' + $node + '\"\" \"\"' + $daemon + '\"\" --tray\", 0, False'; " ^
    "[IO.File]::WriteAllText($vbs, $content, (New-Object Text.ASCIIEncoding)); " ^
    "Write-Host '   [OK] Registered Startup VBS at: ' $vbs"

echo.
echo [2/2] Registering Windows Scheduled Task as fallback...
powershell -NoProfile -Command ^
    "$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c cd /d \"' + (Get-Location).Path + '\" && update.bat --boot && run.bat --background') -WorkingDirectory (Get-Location).Path; " ^
    "$trigger = New-ScheduledTaskTrigger -AtLogOn; " ^
    "$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 0); " ^
    "Register-ScheduledTask -TaskName 'AntigravityAutoAccept' -Action $action -Trigger $trigger -Settings $settings -Force >$null; " ^
    "Write-Host '   [OK] Scheduled Task \"AntigravityAutoAccept\" registered.'"

echo.
echo ============================================================
echo  SUCCESS: Auto-run on restart has been ENABLED!
echo ============================================================
echo.
pause
