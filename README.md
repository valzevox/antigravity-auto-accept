# Antigravity Auto Accept ⚡

<p align="center">
  <img src="media/icon.png" width="128" height="128" alt="Antigravity Auto Accept Logo" />
</p>

<p align="center">
  <strong>True Hands-Free Automation for Antigravity 2.0 & AI Coding Agents</strong><br />
  Automatically handles permission dialogs, multi-choice question prompts, "Yes, and always allow..." choices, terminal approvals, and agent actions without interruption.
</p>

<p align="center">
  <a href="https://github.com/valzevox/antigravity-auto-accept/releases"><img src="https://img.shields.io/github/v/release/valzevox/antigravity-auto-accept?style=flat-square&color=blue" alt="Release"></a>
  <a href="https://github.com/valzevox/antigravity-auto-accept/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square" alt="Node Version"></a>
  <a href="https://github.com/valzevox/antigravity-auto-accept/stargazers"><img src="https://img.shields.io/github/stars/valzevox/antigravity-auto-accept?style=flat-square" alt="Stars"></a>
  <a href="https://github.com/valzevox/antigravity-auto-accept/issues"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome"></a>
</p>

---

## 🌟 Why Antigravity Auto Accept?

When building large software or letting AI agents complete autonomous multi-step plans, **Antigravity 2.0** often halts and waits for user confirmation:
- File searching & reading permissions
- Command execution approvals
- Multi-choice permission modals (`1. Yes, allow this time`, `2. Yes, and always allow...`)
- Step requirement inputs and `Submit` clicks

**Antigravity Auto Accept** hooks into the Chrome DevTools Protocol (CDP) engine of Antigravity, automatically resolving and accepting these prompts in real time. Never babysit your AI agent again!

---

## ✨ Key Features

- 🎯 **Native Antigravity 2.0 Multi-Choice Support**: Intelligently handles the 5-choice permission modals, automatically selects *"Yes, and always allow in this conversation/project"*, and triggers the `Submit` button.
- 🚀 **100% Standalone Background Daemon**: Runs silently in the background as a lightweight system service or background process without needing VS Code workbench windows.
- 🛡️ **Dangerous Command Guard**: Built-in safety filter automatically blocks hazardous patterns (`rm -rf /`, `format c:`, `dd if=`, etc.).
- 🔄 **Auto-Reconnection**: Resilient WebSocket layer detects when Antigravity opens or closes, instantly reconnecting within 3 seconds.
- ⚡ **Zero Configuration Required**: Includes automated 1-click Windows shortcut patcher and startup registration.
- 💻 **Cross-Platform & Backwards Compatible**: Supports Antigravity 2.0 standalone Electron app, Cursor, and VS Code extension environments.

---

## 📦 Architecture Overview

```
                      +-----------------------------+
                      |       Antigravity 2.0       |
                      |  (--remote-debugging-port)  |
                      +--------------+--------------+
                                     ^
                                     | WebSocket / CDP (:9000)
                                     v
+-------------------------------------------------------------------+
|               Antigravity Auto Accept Daemon                      |
|                                                                   |
|   +-----------------------+           +-----------------------+   |
|   |   CDP Target Hunter   |  ------>  |  Script DOM Injector  |   |
|   +-----------------------+           +-----------+-----------+   |
|                                                   |               |
|                                                   v               |
|                                     +-------------------------+   |
|                                     |    auto-accept.js DOM   |   |
|                                     |  - Select Permission    |   |
|                                     |  - Click Submit         |   |
|                                     |  - Auto-Resume Agent    |   |
|                                     +-------------------------+   |
+-------------------------------------------------------------------+
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org) >= 18.x
- Antigravity 2.0 (or Cursor / VS Code)

---

### Step 1: Clone & Install Dependencies

```bash
git clone https://github.com/valzevox/antigravity-auto-accept.git
cd antigravity-auto-accept
npm install
```

---

### Step 2: Configure Antigravity Debugging Port

Antigravity must be started with remote debugging enabled (`--remote-debugging-port=9000`).

#### 🪟 Windows (Automated Shortcut Setup):
Run the provided PowerShell setup script to automatically configure all your Desktop and Start Menu Antigravity shortcuts:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\update-shortcuts.ps1
```

*(Or simply launch Antigravity from terminal with: `Antigravity.exe --remote-debugging-port=9000`)*

---

### Step 3: Start the Daemon

#### Run in Foreground:
```bash
node daemon.js
```

#### Run Permanently in Background (Windows Scheduled Task):
To have the daemon run silently on Windows startup without opening any console windows:

```cmd
schtasks /create /tn "AntigravityAutoAccept" /tr "C:\Users\%USERNAME%\.gemini\antigravity-auto-accept\run-daemon.cmd" /sc onlogon /f
schtasks /run /tn "AntigravityAutoAccept"
```

---

## 🔍 Diagnostics & Health Check

Check the live status of the auto-accept engine at any time:

```powershell
powershell -ExecutionPolicy Bypass -File status.ps1
```

Example Output:
```text
RUNNING PID=22888
--- last 3 log lines ---
[AutoAccept] [CDP] Script injected into 9000:DDB37C2BA90087861A99D944E41AAC30
[AutoAccept Daemon] Successfully connected to Antigravity 2.0 via CDP!
--- CDP port 9000 ---
CDP OK (200)
```

---

## ⚙️ Configuration

Custom settings can be adjusted in `main_scripts/cdp-handler.js` or through environment configurations:

| Option | Default | Description |
| :--- | :--- | :--- |
| `cdpPort` | `9000` | Port for Chrome DevTools Protocol WebSocket. |
| `pollInterval` | `500ms` | Frequency of DOM scans for pending modal inputs. |
| `isBackgroundMode`| `true` | Allows continuous approvals when window is unfocused. |

---

## 🛡️ Safety & Command Blacklist

The auto-accept engine protects your machine by refusing to auto-click approvals containing destructive patterns:
- `rm -rf /` / `rm -rf ~` / `rm -rf *`
- `format c:` / `del /f /s /q`
- `mkfs.*` / `> /dev/sda`
- Fork bombs and destructive system calls

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the [Issues page](https://github.com/valzevox/antigravity-auto-accept/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 👤 Author

**valzevox**
- GitHub: [@valzevox](https://github.com/valzevox)
- Email: [valzevox@gmail.com](mailto:valzevox@gmail.com)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
