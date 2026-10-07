const { CDPHandler } = require('./main_scripts/cdp-handler');
const http = require('http');

const fs = require('fs');
const path = require('path');

const PORT = 9000;
const CHECK_INTERVAL = 3000;
const logFile = path.join(__dirname, 'daemon.log');

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try { fs.appendFileSync(logFile, line); } catch (e) {}
    console.log(msg);
}

process.on('uncaughtException', (err) => {
    log(`[UncaughtException] ${err.stack || err.message}`);
});
process.on('unhandledRejection', (reason) => {
    log(`[UnhandledRejection] ${reason?.stack || reason}`);
});

log('[AutoAccept Daemon] Starting background daemon for Antigravity 2.0...');

let handler = new CDPHandler((msg) => {
    if (!msg.includes('Scanning ports')) {
        log(`[AutoAccept] ${msg}`);
    }
});

let isConnected = false;

function checkCdpPort(port) {
    return new Promise((resolve) => {
        const req = http.get({
            hostname: '127.0.0.1',
            port,
            path: '/json/version',
            timeout: 1000
        }, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
    });
}

const { MultiSessionRouter } = require('./main_scripts/multi-session');
const { TelegramAnswerBridge } = require('./main_scripts/telegram-bridge');
const router = new MultiSessionRouter(handler, { log });

let bridge = null;
const tgToken = router.notifier.config.webhooks.telegram.botToken;
if (tgToken) {
    bridge = new TelegramAnswerBridge(router, tgToken, log);
}

async function loop() {
    try {
        const available = await checkCdpPort(PORT);
        if (available) {
            await handler.start({
                cdpPort: PORT,
                cdpPortRange: 0,
                isBackgroundMode: true,
                ide: 'antigravity',
                quiet: isConnected
            });
            if (!isConnected) {
                log('[AutoAccept Daemon] Successfully connected to Antigravity 2.0 via CDP!');
                isConnected = true;
                router.start();
                if (bridge) bridge.start();
            }
        } else {
            if (isConnected) {
                log('[AutoAccept Daemon] Antigravity disconnected or closed. Waiting for Antigravity...');
                isConnected = false;
                router.stop();
                if (bridge) bridge.stop();
                await handler.stop();
            }
        }
    } catch (err) {
        log(`[AutoAccept Daemon] Error: ${err.message}`);
    }
    setTimeout(loop, CHECK_INTERVAL);
}

loop();
