# Antigravity Auto Accept v1.2.0

## Fixed

- Restored approval detection for newer Antigravity builds where prompts can render inside child document targets.
- CDP now follows eligible child `iframe`, `webview`, and `page` sessions and injects the same silent background approval handler there.
- Control-panel connection and activity stats now include attached child CDP sessions.

## Verification

- `npm test`
- `npm run compile`
