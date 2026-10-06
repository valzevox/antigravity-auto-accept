$vbsPath = "C:\Users\Admin\.gemini\antigravity-auto-accept\run-hidden.vbs"
@"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell -WindowStyle Hidden -Command Start-Process 'C:\Program Files\nodejs\node.exe' -ArgumentList 'C:\Users\Admin\.gemini\antigravity-auto-accept\daemon.js' -WorkingDirectory 'C:\Users\Admin\.gemini\antigravity-auto-accept' -WindowStyle Hidden", 0, False
"@ | Set-Content -Path $vbsPath -Encoding ASCII

$sh = New-Object -ComObject WScript.Shell
$startupLnk = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\AntigravityAutoAccept.lnk"
$shortcut = $sh.CreateShortcut($startupLnk)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$vbsPath`""
$shortcut.WorkingDirectory = "C:\Users\Admin\.gemini\antigravity-auto-accept"
$shortcut.Save()

Write-Host "Startup shortcut created at: $startupLnk"
