$sh = New-Object -ComObject WScript.Shell
$targets = @(
    "C:\Users\Admin\Desktop\Antigravity.lnk",
    "C:\Users\Admin\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Antigravity.lnk"
)
foreach ($t in $targets) {
    if (Test-Path $t) {
        $shortcut = $sh.CreateShortcut($t)
        $shortcut.Arguments = "--remote-debugging-port=9000"
        $shortcut.Save()
        Write-Host "Updated: $t"
    }
}
