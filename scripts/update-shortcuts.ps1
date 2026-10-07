$sh = New-Object -ComObject WScript.Shell
$searchDirs = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('CommonDesktopDirectory'),
    [Environment]::GetFolderPath('Programs'),
    [Environment]::GetFolderPath('CommonPrograms'),
    (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"),
    (Join-Path $env:ALLUSERSPROFILE "Microsoft\Windows\Start Menu\Programs")
) | Select-Object -Unique

foreach ($dir in $searchDirs) {
    if (Test-Path $dir) {
        $shortcuts = Get-ChildItem -Path $dir -Filter "*Antigravity*.lnk" -Recurse -ErrorAction SilentlyContinue
        foreach ($item in $shortcuts) {
            try {
                $lnk = $sh.CreateShortcut($item.FullName)
                if ($lnk.TargetPath -like "*Antigravity.exe*") {
                    if ($lnk.Arguments -notlike "*--remote-debugging-port=9000*") {
                        if ([string]::IsNullOrWhiteSpace($lnk.Arguments)) {
                            $lnk.Arguments = "--remote-debugging-port=9000"
                        } else {
                            $lnk.Arguments = "$($lnk.Arguments.Trim()) --remote-debugging-port=9000"
                        }
                        $lnk.Save()
                        Write-Host "Updated: $($item.FullName)"
                    }
                }
            } catch {}
        }
    }
}
