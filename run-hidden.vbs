Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell -WindowStyle Hidden -Command Start-Process 'C:\Program Files\nodejs\node.exe' -ArgumentList 'C:\Users\Admin\.gemini\antigravity-auto-accept\daemon.js' -WorkingDirectory 'C:\Users\Admin\.gemini\antigravity-auto-accept' -WindowStyle Hidden", 0, False
