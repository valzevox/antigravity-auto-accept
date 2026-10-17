# Release v2.4.0: Multi-Platform Auto-Accept (Desktop, CLI, IDE) & Enhanced Bilingual Setup

### 🚀 Highlights & Improvements

- **Multi-Platform Support (Antigravity CLI & IDE)**:
  - **Antigravity CLI (`agy`)**: Installer automatically detects `agy` and sets up `agy-auto` CLI wrapper in the user's PATH configured with `--dangerously-skip-permissions` for complete hands-free terminal workflows.
  - Updates `~/.gemini/antigravity-cli/settings.json` permissions for default execution approvals.
  - **Antigravity IDE**: Added native compatibility detection for standalone IDE workspaces and VS Code environments.

- **Bilingual & Resilient 1-Click Installer (`install.ps1`)**:
  - Full interactive language selection: **Tiếng Việt** and **English**.
  - **In-place Antigravity Detection**: Checks if Antigravity is running without CDP and prompts to cleanly restart with port 9000 right inside the installer.
  - **Automatic Desktop Shortcut Creation**: Generates an optimized desktop shortcut with `--remote-debugging-port=9000` if no shortcuts exist.
  - **Live Discord Verification**: Sends an instant test message to your configured Discord channel during setup to immediately verify your Bot Token and Channel ID.

---

### 📦 Quick Install / Update:

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/valzevox/antigravity-auto-accept/main/scripts/install.ps1")))
```
