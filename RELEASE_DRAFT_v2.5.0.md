# Release v2.5.0: Windows System Tray Icon, 9Router-Style Silent Startup & In-Process Auto-Update

### 🚀 Highlights & Improvements

- **Windows Taskbar System Tray Icon**:
  - Adds a native, hidden system tray icon in the Windows taskbar with rich contextual actions.
  - Context menu features: live connection status, "Fix / Restart Antigravity CDP", "Check Updates Now", "Open Logs", and "Quit / Exit".
  - Built with pure PowerShell & Windows Forms (`NotifyIcon`) — zero binary packages, lightweight, and completely AV-safe.

- **Silent Background Startup (`.vbs`)**:
  - Implemented the battle-tested startup pattern from **9Router** & **9Remote**.
  - Registers `AntigravityAutoAccept.vbs` in the user's Windows Startup folder (`shell:startup`), launching the daemon 100% silently upon boot without annoying console window popups or task scheduler stalls.

- **Automatic In-Process Updates**:
  - Checks GitHub origin on startup and every 30 minutes in the background.
  - Automatically fetches new commits, runs silent dependency installs (`npm install`), and seamlessly hot-restarts the daemon process.

---

### 📦 Quick Install / Update:

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/valzevox/antigravity-auto-accept/main/scripts/install.ps1")))
```
