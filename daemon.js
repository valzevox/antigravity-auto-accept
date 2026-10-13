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

async function resolveActiveCdpPort() {
    // 1. Check DevToolsActivePort file written by Electron/Antigravity
    try {
        const dtPath = path.join(process.env.APPDATA || '', 'Antigravity', 'DevToolsActivePort');
        if (fs.existsSync(dtPath)) {
            const firstLine = fs.readFileSync(dtPath, 'utf8').split('\n')[0].trim();
            const p = parseInt(firstLine, 10);
            if (p > 0 && p < 65536) {
                if (await checkCdpPort(p)) return p;
            }
        }
    } catch (e) {}

    // 2. Check default port 9000
    if (await checkCdpPort(PORT)) return PORT;

    // 3. Check port range 9001-9005
    for (let p = 9001; p <= 9005; p++) {
        if (await checkCdpPort(p)) return p;
    }

    return null;
}

const { MultiSessionRouter } = require('./main_scripts/multi-session');
const { TelegramAnswerBridge } = require('./main_scripts/telegram-bridge');
const { DiscordGatewayBridge } = require('./main_scripts/discord-gateway');
const { LoadingWatcher } = require('./main_scripts/loading-watcher');
const router = new MultiSessionRouter(handler, { log });
const loadingWatcher = new LoadingWatcher(router, { log });
router.loadingWatcher = loadingWatcher;

let bridge = null;
const tgToken = router.notifier.config.webhooks.telegram.botToken;
if (tgToken) {
    bridge = new TelegramAnswerBridge(router, tgToken, log);
}

let discordBridge = null;
const dbot = router.notifier.config.webhooks.discordBot;
if (dbot.token && dbot.channelId) {
    discordBridge = new DiscordGatewayBridge(router, dbot, log);
    router.notifier.setGateway(discordBridge);
    discordBridge.start();
    log('[AutoAccept Daemon] Discord Bot Gateway started.');
}

if (bridge) {
    bridge.start();
    log('[AutoAccept Daemon] Telegram Bridge started.');
}

async function loop() {
    try {
        const activePort = await resolveActiveCdpPort();
        if (activePort) {
            await handler.start({
                cdpPort: activePort,
                cdpPortRange: 0,
                isBackgroundMode: true,
                ide: 'antigravity',
                quiet: isConnected,
                maxErrorRetries: router.notifier?.config?.maxErrorRetries !== undefined ? router.notifier.config.maxErrorRetries : 5
            });
            if (!isConnected) {
                log(`[AutoAccept Daemon] Successfully connected to Antigravity 2.0 via CDP on port ${activePort}!`);
                isConnected = true;
                router.start();
                loadingWatcher.start();
            }
        } else {
            if (isConnected) {
                log('[AutoAccept Daemon] Antigravity disconnected or closed. Waiting for Antigravity...');
                isConnected = false;
                router.stop();
                loadingWatcher.stop();
                await handler.stop();
            }
        }
    } catch (err) {
        log(`[AutoAccept Daemon] Error: ${err.message}`);
        router.notifier.notify(4, {
            summary: `Daemon runtime error: ${err.message}`,
            details: err.stack || err.message
        });
    }
    setTimeout(loop, CHECK_INTERVAL);
}

loop();
