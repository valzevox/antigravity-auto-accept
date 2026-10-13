# Release v2.3.2: Resilient CDP Port Discovery & Robust Question Submit Handling

### 🚀 Highlights & Improvements

- **Robust Interactive Question & Option Submission (`answerQuestion`)**:
  - Full support for Antigravity's interactive decision modals (`ask_question`, grill-me interviews, plan confirmations, and tool execution permissions).
  - Flexible **Submit** button matching across edge cases (handles `Submit ↵`, `Submit`, return arrow icons, and localized labels).
  - Dispatches full synthetic pointer/mouse events (`pointerdown`, `mousedown`, `click`) combined with native CDP `Enter` keystroke dispatch to guarantee instantaneous submission upon clicking choices in Discord or Telegram.
  - Centralized answering pipeline in `MultiSessionRouter`, cleanly shared between `DiscordGatewayBridge` and `TelegramAnswerBridge`.

- **Resilient Dynamic CDP Port Discovery (`daemon.js`)**:
  - Automatically resolves active remote debugging port directly from Electron/Antigravity's `DevToolsActivePort` state file if the port drifts across restarts.
  - Falls back to progressive range scanning (ports 9000 through 9005) rather than stalling on a single hardcoded port, eliminating connection freezes after silent background IDE updates.

---

### 📦 Quick Install / Update:

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/valzevox/antigravity-auto-accept/main/scripts/install.ps1")))
```
