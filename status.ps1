$procs = Get-CimInstance Win32_Process -Filter "name='node.exe'"
$found = $false
foreach ($p in $procs) {
    if ($p.CommandLine -like '*daemon.js*') {
        Write-Host "RUNNING PID=$($p.ProcessId)"
        $found = $true
    }
}
if (-not $found) { Write-Host "NOT RUNNING" }

$logPath = "C:\Users\Admin\.gemini\antigravity-auto-accept\daemon.log"
if (Test-Path $logPath) {
    Write-Host "--- last 3 log lines ---"
    Get-Content $logPath -Tail 3
} else {
    Write-Host "no log file"
}

Write-Host "--- CDP port 9000 ---"
try {
    $r = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9000/json/version -TimeoutSec 3
    Write-Host "CDP OK ($($r.StatusCode))"
} catch {
    Write-Host "CDP DOWN"
}
