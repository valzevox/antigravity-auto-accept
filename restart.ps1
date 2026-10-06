Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object { $_.CommandLine -like '*daemon.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 1
schtasks /run /tn "AntigravityAutoAccept"
Start-Sleep -Seconds 2
& "C:\Users\Admin\.gemini\antigravity-auto-accept\status.ps1"
