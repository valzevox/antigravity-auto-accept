# Antigravity Auto Accept ⚡

<p align="center">
  <img src="media/icon.png" width="128" height="128" alt="Antigravity Auto Accept Logo" />
</p>

<p align="center">
  <strong>Complete Hands-Free Automation for Antigravity 2.0 & AI Coding Agents</strong><br />
  Automatically handles permission dialogs, multiple-choice questions, "Always allow in this project", and terminal execution confirmations without interrupting your flow.
</p>

<p align="center">
  <a href="https://github.com/valzevox/antigravity-auto-accept/releases"><img src="https://img.shields.io/github/v/release/valzevox/antigravity-auto-accept?style=flat-square&color=blue" alt="Latest Release"></a>
  <a href="https://github.com/valzevox/antigravity-auto-accept/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square" alt="Node Version"></a>
  <a href="https://github.com/valzevox/antigravity-auto-accept/stargazers"><img src="https://img.shields.io/github/stars/valzevox/antigravity-auto-accept?style=flat-square" alt="Stars"></a>
  <a href="https://github.com/valzevox/antigravity-auto-accept/issues"><img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat-square" alt="Contributions Welcome"></a>
</p>

<p align="center">
  <a href="README.md">🇻🇳 Xem bản Tiếng Việt</a> | <a href="README_EN.md">🇬🇧 English Documentation</a>
</p>

---

## 🌟 Why Antigravity Auto Accept?

When developing large projects or delegating multi-step plans to autonomous coding agents in **Antigravity 2.0**, the agent frequently pauses waiting for manual approvals:
- Searching and reading workspace files
- Confirming shell command executions in the terminal
- Answering permission prompts (`1. Allow once`, `2. Always allow in this project...`)
- Resolving multiple-choice clarification questions and clicking `Submit`

**Antigravity Auto Accept** bridges directly into Antigravity via Chrome DevTools Protocol (CDP port 9000), continuously detecting and resolving these approval roadblocks in real time. You can safely step away from your workstation while your agent keeps working uninterrupted!

---

## ✨ Key Features

- 🎯 **Full Support for Antigravity 2.0 Multi-Option Dialogs**: Automatically identifies 5-option permission prompts, prefers *"Allow and remember in this conversation/project"*, and triggers the `Submit` action.
- 🔄 **Live Discord Progress Tracker**: A dynamic status embed refreshing every 2.5 seconds. Displays the agent's live thinking process, active tool calls, working sub-agents, and total elapsed duration. Automatically transitions to a green completion card when done.
- ⚠️ **Instant Quota & Token Limit Alerts**: Detects when your account hits token rate limits (HTTP 429 / resource exhausted), immediately notifying your mobile phone or desktop with a high-visibility red card and user mention (`@user`).
- 🔁 **Auto-Retry on Transient Model Errors**: Automatically clicks the `Retry` button whenever Antigravity encounters model or network interruptions ("Agent terminated due to error"). Configurable retry cap (default: 5 attempts). If retries are exhausted without a response, the task pauses and sends a warning to avoid infinite loops.
- 🎙️ **Ultra-Fast Voice Control (Groq Whisper)**: Send voice clips or audio files in Discord to query system status, switch sessions, halt tasks, or inject prompts into Antigravity in ~300ms.
- 🔀 **Autonomous Multi-Session Hopping**: Observes all background conversation threads. When another session gets blocked waiting for confirmation, the daemon switches into that tab, approves the action, and returns to your active view.
- 🎮 **Two-Way Interactive Buttons (Discord & Telegram)**: When the agent asks questions (`ask_question`), the bot pushes actionable buttons. Tap the desired option directly on your phone to submit your response back to Antigravity!
- ⚡ **Native Discord Gateway Integration**: Connects via Discord's persistent WebSocket protocol 24/7 without requiring port-forwarding, static IPs, or ngrok tunnels.
- 🔔 **Multi-Tier Event Notifications**: 4 distinct event classes (Decision Needed, Task Completed, Auto-Approved, Error/Quota Exhausted).
- 🛡️ **Dangerous Command Guardrails**: Safeguards your host environment by refusing to auto-approve destructive operations (`rm -rf /`, `format c:`, partition wipers, fork bombs).
- 🔄 **Self-Healing Reconnection**: Watches Antigravity lifecycle and automatically reconnects CDP within 3 seconds whenever Antigravity is launched or closed.

---

## 📦 Architecture Overview

```
                      +-----------------------------+
                      |       Antigravity 2.0       |
                      |  (--remote-debugging-port)  |
                      +--------------+--------------+
                                     ^
                                     | WebSocket (:9000)
                                     v
+-------------------------------------------------------------------+
|                   Auto-Accept Background Daemon                   |
|                                                                   |
|   +-----------------------+           +-----------------------+   |
|   |   CDP Port Scanner    |  ------>  |   DOM Action Injector |   |
|   +-----------------------+           +-----------+-----------+   |
|               |                                   |               |
|               v                                   v               |
|   +-----------------------+         +-------------------------+   |
|   | Multi-Session Router  |         |   In-Page Evaluator     |   |
|   | - Transcript Watcher  |         |   - Select Radio Option |   |
|   | - Auto Hop & Return   | <=====> |   - Trigger Submit      |   |
|   +-----------------------+         |   - Resume Execution    |   |
|                                     +-------------------------+   |
+-------------------------------------------------------------------+
```

---

## 🚀 Quick Start Guide

> ⚡ **One-line setup via PowerShell:**  
> The installer checks system requirements, configures port 9000 on Antigravity shortcuts, collects bot credentials, registers Windows startup tasks, and boots the daemon automatically!

### Option 1: Direct PowerShell Command (Recommended)

Open PowerShell and run:

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/valzevox/antigravity-auto-accept/main/scripts/install.ps1")))
```

---

### Option 2: Clone & Local Setup

```bash
git clone https://github.com/valzevox/antigravity-auto-accept.git
cd antigravity-auto-accept
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```

---

### 🛠️ What Does `install.ps1` Do?

1. ✅ **Prerequisite Validation:** Confirms Node.js (>= 18) and Git are installed.
2. ✅ **Dependency Installation:** Automatically runs `npm install`.
3. ✅ **Port 9000 Configuration:** Adds `--remote-debugging-port=9000` to Antigravity shortcuts on Desktop and Start Menu.
4. ✅ **Interactive Setup:** Prompts for Discord Bot Token, Channel ID, Admin User ID, and Groq API Key.
5. ✅ **Startup Registration:** Configures Windows Task Scheduler for seamless auto-start upon user login.
6. ✅ **Instant Launch:** Starts the background monitor immediately.

---

### 🔄 Auto-Update & Startup Sequence

On Windows reboot or login:
- System triggers: **Update Check (`update.bat`) ➔ Daemon Launch (`run.bat`)**.
- **`update.bat`**: Syncs latest releases from GitHub and updates dependencies in seconds.
- **`run.bat`**: Launches the watcher process with a clean console view.
- No need to run the setup script repeatedly.

---

## 📋 Script Reference

| Script | Purpose |
| :--- | :--- |
| `run.bat` | Start the daemon with a visible console window (compatible with Windows 10 & 11) |
| `update.bat` | Pull latest updates and apply dependencies from GitHub |
| `status.bat` | Inspect process state and Antigravity CDP connection |
| `powershell -File scripts\install.ps1` | Re-run installer or reconfigure credentials at any time |

---

## ⚙️ Configuration (`config.json`)

Configure your credentials in **`config.json`**:

```json
{
  "language": "en",
  "webhooks": {
    "discord": "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL",
    "discordBot": {
      "token": "DISCORD_BOT_TOKEN",
      "channelId": "DISCORD_CHANNEL_ID",
      "guildId": "DISCORD_GUILD_ID",
      "ownerUserId": "ADMIN_USER_ID",
      "mentionUserId": "USER_ID_TO_PING"
    },
    "telegram": {
      "botToken": "TELEGRAM_BOT_TOKEN",
      "chatId": "TELEGRAM_CHAT_ID"
    },
    "customUrl": ""
  },
  "maxErrorRetries": 5,
  "groqApiKey": "GROQ_API_KEY",
  "events": {
    "onManualIntervention": true,
    "onTaskCompleted": true,
    "onAutoApproved": true,
    "onError": true
  }
}
```

---

### Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → Click **New Application**.
2. Navigate to **Bot** → Click **Reset Token** → Copy token to `discordBot.token`.
3. Enable **Message Content Intent** under **Privileged Gateway Intents** (Required for reading commands).
4. Go to **OAuth2** → **URL Generator** → Select `bot` scope and permissions: `Send Messages`, `Read Message History`, `Embed Links`, `Attach Files`. Copy link and invite the bot to your server.
5. In Discord User Settings, enable **Developer Mode** to copy **Channel ID** (`channelId`) and your **User ID** (`ownerUserId`).

---

### Telegram Bot Setup

1. Open Telegram, message **@BotFather**, and send `/newbot`.
2. Follow prompts and copy the **HTTP API Token** into `telegram.botToken`.
3. Message [@userinfobot](https://t.me/userinfobot) to obtain your numeric ID (`chatId`).

---

## 🎮 Discord Command Reference

| Command | Description | Example |
| :--- | :--- | :--- |
| `!prompt <text>` | Submit a prompt directly to the active Antigravity session | `!prompt fix unit tests in auth.js` |
| `!message <text>` | Alias for `!prompt` | `!message summarize repo architecture` |
| `!new <text>` | Create a fresh conversation thread and dispatch prompt | `!new implement dark mode toggle` |
| `!stop` | Instantly halt the currently running task | `!stop` |
| `!sessions` | List open conversation sessions with IDs | `!sessions` |
| `!switch <id or title>` | Switch Antigravity interface to target session | `!switch 89e10449` |
| `!status` | Inspect CDP connection, active session, and daemon health | `!status` |
| `!config` | Display current bot settings (channel, mention, language) | `!config` |
| `!language` | Interactive button modal to switch between English and Vietnamese | `!language` |
| `!setchannel <#channel>` | Change target notification and command channel | `!setchannel #agent-logs` |
| `!setping <target>` | Change mention target (`@user`, `here`, `everyone`, `off`) | `!setping @valzevox` |
| `!setretry <number>` | Configure maximum automatic Retry attempts on errors (default: 5) | `!setretry 5` |
| `!setvoice <on/off>` | Enable or disable voice transcription processing | `!setvoice off` |
| `!setgroq <key>` | Configure Groq API key for voice processing | `!setgroq gsk_...` |
| `!help` | Show command reference | `!help` |

---

## 🛡️ Dangerous Command Guardrails

The engine rejects automatic approval for high-risk operations to protect your machine:
- Root deletion: `rm -rf /`, `rm -rf ~`, `rm -rf *`
- Drive format: `format c:`, recursive system tree wipe
- Fork bombs or low-level disk overwrites

---

## 💖 Support & Contributions

If **Antigravity Auto Accept** saves your time and boosts your workflow, consider supporting the author:

<p align="left">
  <a href="https://ko-fi.com/m1n698"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support on Ko-fi" /></a>
  &nbsp;&nbsp;
  <a href="https://zypage.com/m1n6"><img src="https://img.shields.io/badge/Support-ZyPage-blueviolet?style=for-the-badge&logo=heart" alt="Support on ZyPage" /></a>
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

Licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
