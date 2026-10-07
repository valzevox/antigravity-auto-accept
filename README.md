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
- 🔀 **Multi-Session Auto-Router & Seamless Background Hop**: Monitors all background conversations across your entire workspace/brain. When an agent in another session halts on a tool or permission request, the router automatically hops to that conversation, approves it, and immediately returns you back to your current active session!
- 🔔 **Discord & Telegram Webhook Notifications**: Real-time alerts for agent task completion, manual user intervention required (e.g. subagent asking questions), auto-approval history, and errors.
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
|               |                                   |               |
|               v                                   v               |
|   +-----------------------+         +-------------------------+   |
|   |  MultiSessionRouter   |         |    auto-accept.js DOM   |   |
|   |  - Disk Brain Watcher |         |  - Select Permission    |   |
|   |  - Auto-Hop & Return  | <=====> |  - Click Submit         |   |
|   +-----------------------+         |  - Auto-Resume Agent    |   |
|                                     +-------------------------+   |
+-------------------------------------------------------------------+
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org) >= 18.x
- Antigravity 2.0 (or Cursor / VS Code)

---

### Step 1: Clone the repository

```bash
git clone https://github.com/valzevox/antigravity-auto-accept.git
cd antigravity-auto-accept
```

---

### Step 2: Run the 1-Click Setup

Double-click **`setup.bat`** (or right-click &gt; *Run as Administrator*).

The setup script automatically handles everything:

1. ✅ Verifies Node.js is installed
2. ✅ Installs npm dependencies
3. ✅ Patches all Antigravity Desktop &amp; Start Menu shortcuts with `--remote-debugging-port=9000`
4. ✅ Registers a Windows Scheduled Task so the daemon auto-starts on login
5. ✅ Launches the background daemon immediately

---

### Step 3: Restart Antigravity

Close Antigravity and reopen it using your (now-patched) shortcut. The auto-accept engine is now fully active.

---

### Manual Alternative (Advanced Users)

```bash
# Install dependencies
npm install

# Patch Antigravity shortcuts
powershell -ExecutionPolicy Bypass -File scripts\update-shortcuts.ps1

# Start the background daemon
run.bat
```

---

## 📋 Command Reference

| Command | Description |
| :--- | :--- |
| `setup.bat` | Full 1-click setup: install, patch shortcuts, register startup, run daemon |
| `run.bat` | Start or restart the background daemon |
| `status.bat` | Check if the daemon is running and CDP is connected |
| `node daemon.js` | Run daemon in foreground (for debugging) |
| `node test-multi-session.js` | Run self-test for Multi-Session Auto-Router detection |
| `node test-notifier.js` | Run self-test for Discord & Telegram Webhook notifications |

---

## 🔔 Webhook Notifications & Remote Action Buttons (Discord & Telegram)

Get alerted on Discord or Telegram whenever your AI subagents require attention, styled with native Antigravity branding:
- 1️⃣ **Case 1 (Manual Intervention)**: Subagent asks a question (`ask_question`). On Telegram, interactive inline buttons are attached for each option so you can tap to select and submit directly from your phone!
- 2️⃣ **Case 2 (Task Completed)**: Subagent concluded its work turn without further tool calls.
- 3️⃣ **Case 3 (Auto-Approved)**: Auto-accept successfully hopped and approved a permission request.
- 4️⃣ **Case 4 (Execution Error)**: Subagent hit an error.

### Quick Setup:

Copy `config.json.example` to `config.json`:

```json
{
  "webhooks": {
    "discord": "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL",
    "telegram": {
      "botToken": "YOUR_TELEGRAM_BOT_TOKEN",
      "chatId": "YOUR_CHAT_ID"
    },
    "customUrl": ""
  },
  "events": {
    "onManualIntervention": true,
    "onTaskCompleted": true,
    "onAutoApproved": true,
    "onError": true
  }
}
```

> **Remote Button Answering (Telegram):** When you tap an option button in Telegram, the built-in bridge automatically navigates Antigravity to that conversation, selects the corresponding option, and clicks `Submit` without needing port forwarding!

---

## 🔍 Diagnostics &amp; Health Check

Check the live status of the auto-accept engine at any time by double-clicking **`status.bat`**:

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

## 💖 Support & Donate

If **Antigravity Auto Accept** saved your time and made your workflow seamless, consider buying me a coffee or supporting my work:

<p align="left">
  <a href="https://ko-fi.com/m1n698"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support on Ko-fi" /></a>
  &nbsp;&nbsp;
  <a href="https://zypage.com/m1n6"><img src="https://img.shields.io/badge/Donate-ZyPage-blueviolet?style=for-the-badge&logo=heart" alt="Donate on ZyPage" /></a>
</p>

- **Ko-fi:** [ko-fi.com/m1n698](https://ko-fi.com/m1n698)
- **ZyPage:** [zypage.com/m1n6](https://zypage.com/m1n6)

---

## 👤 Author

**valzevox**
- GitHub: [@valzevox](https://github.com/valzevox)
- Email: [valzevox@gmail.com](mailto:valzevox@gmail.com)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
