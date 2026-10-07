$baseDir = Split-Path -Parent $PSScriptRoot
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"cd /d `"$baseDir`" && update.bat && run.bat --background`"" -WorkingDirectory $baseDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 0)
Register-ScheduledTask -TaskName "AntigravityAutoAccept" -Action $action -Trigger $trigger -Settings $settings -Force >$null 2>&1
Start-ScheduledTask -TaskName "AntigravityAutoAccept" >$null 2>&1
