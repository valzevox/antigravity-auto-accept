# Release v2.3.3: Post-Update Zombie Recovery & Pre-Flight CDP Diagnostics

### 🚀 Highlights & Improvements

- **1-Click CDP Recovery Tool (`fix-cdp.bat`)**:
  - Resolves silent CDP port loss caused by Antigravity background updates (e.g., updating to v2.23.1).
  - Forcefully terminates lingering zombie `Antigravity.exe` background processes that prevent Chromium from binding port `9000` due to Electron's single-instance lock.
  - Re-launches Antigravity cleanly with `--remote-debugging-port=9000` and automatically restarts the background daemon.

- **Pre-Flight CDP Health Check in `run.bat`**:
  - Automatically queries the active CDP port before spawning the daemon console.
  - Warns the user immediately if Antigravity is running without CDP enabled and directs them to run `fix-cdp.bat`.

---

### 📦 Quick Install / Update:

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/valzevox/antigravity-auto-accept/main/scripts/install.ps1")))
```
