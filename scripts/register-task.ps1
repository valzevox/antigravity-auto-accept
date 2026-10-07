$baseDir = Split-Path -Parent $PSScriptRoot
$bootstrapPath = Join-Path $baseDir "bootstrap.bat"
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$bootstrapPath`"" -WorkingDirectory $baseDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "AntigravityAutoAccept" -Action $action -Trigger $trigger -Force
Start-ScheduledTask -TaskName "AntigravityAutoAccept"
