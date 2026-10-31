const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

let psProcess = null;
let clickHandler = null;

function sendCommand(cmd) {
    if (psProcess && psProcess.stdin.writable) {
        psProcess.stdin.write(`${JSON.stringify(cmd)}\n`, 'utf8');
    }
}

function initTray(options = {}) {
    const { iconPath, tooltip, items, onClick } = options;
    clickHandler = onClick;

    const scriptPath = path.join(__dirname, 'tray.ps1');
    const safeIcon = iconPath || path.join(__dirname, '..', 'media', 'icon.ico');

    try {
        psProcess = spawn(
            'powershell.exe',
            [
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-WindowStyle', 'Hidden',
                '-InputFormat', 'Text',
                '-OutputFormat', 'Text',
                '-File', scriptPath,
                '-IconPath', safeIcon,
                '-Tooltip', tooltip || 'Antigravity Auto Accept'
            ],
            { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
        );
    } catch (err) {
        return null;
    }

    const rl = readline.createInterface({ input: psProcess.stdout });
    rl.on('line', (line) => {
        try {
            const evt = JSON.parse(line);
            if (evt.type === 'click' && clickHandler) {
                clickHandler(evt.index);
            }
        } catch (e) {}
    });

    psProcess.on('error', () => {});
    psProcess.stderr.on('data', () => {});

    if (Array.isArray(items)) {
        items.forEach((item, index) => {
            sendCommand({ action: 'add-item', index, title: item.title, enabled: item.enabled !== false });
        });
    }

    return {
        updateItem(index, title, enabled) {
            sendCommand({ action: 'update-item', index, title, enabled: enabled !== false });
        },
        setTooltip(text) {
            sendCommand({ action: 'set-tooltip', text });
        },
        kill() {
            try {
                sendCommand({ action: 'kill' });
            } catch (e) {}
            setTimeout(() => {
                if (psProcess && !psProcess.killed) {
                    try { psProcess.kill(); } catch (e) {}
                }
                psProcess = null;
            }, 300);
        }
    };
}

module.exports = { initTray };
