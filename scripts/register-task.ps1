$baseDir = Split-Path -Parent $PSScriptRoot
$action = New-ScheduledTaskAction -Execute "C:\Program Files\nodejs\node.exe" -Argument "daemon.js" -WorkingDirectory $baseDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "AntigravityAutoAccept" -Action $action -Trigger $trigger -Force
Start-ScheduledTask -TaskName "AntigravityAutoAccept"
