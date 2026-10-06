$node = "C:\Program Files\nodejs\node.exe"
$script = "C:\Users\Admin\.gemini\antigravity-auto-accept\daemon.js"
$cwd = "C:\Users\Admin\.gemini\antigravity-auto-accept"

# Stop any old daemon
Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object { $_.CommandLine -like '*daemon.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# Start detached background process
Start-Process -FilePath $node -ArgumentList "`"$script`"" -WorkingDirectory $cwd -WindowStyle Hidden
Start-Sleep -Seconds 2

# Verify
$p = Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object { $_.CommandLine -like '*daemon.js*' }
if ($p) {
    Write-Host "DAEMON STARTED OK - PID: $($p.ProcessId)"
} else {
    Write-Host "FAILED TO START"
}
