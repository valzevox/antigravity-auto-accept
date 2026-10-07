/**
 * Antigravity Auto Accept - Discord Gateway & Remote Button Bridge
 * Connects directly to wss://gateway.discord.gg via WebSocket (no open ports needed).
 * Listens for INTERACTION_CREATE events when buttons are clicked in Discord.
 *
 * ponytail: uses 'ws' package to connect to Gateway v10.
 */

const https = require('https');
const WebSocket = require('ws');
const { BRAND, EVENT_META } = require('./notifier');

class DiscordGatewayBridge {
    constructor(router, config = {}, log = () => {}) {
        this.router = router;
        this.token = config.token || '';
        this.channelId = config.channelId || '';
        this.guildId = config.guildId || '';
        this.log = log;

        this.ws = null;
        this.heartbeatTimer = null;
        this.sequence = null;
        this.sessionId = null;
        this.reconnectTimer = null;
        this.running = false;
    }

    start() {
        if (!this.token || this.running) return;
        this.running = true;
        this.connect();
    }

    stop() {
        this.running = false;
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.ws) {
            try { this.ws.close(); } catch (e) {}
            this.ws = null;
        }
    }

    connect() {
        if (!this.running) return;
        this.log('[DiscordGateway] Connecting to wss://gateway.discord.gg/?v=10&encoding=json ...');
        this.ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');

        this.ws.on('open', () => {
            this.log('[DiscordGateway] WebSocket connection established.');
        });

        this.ws.on('message', async (data) => {
            try {
                const payload = JSON.parse(data.toString());
                await this.handlePayload(payload);
            } catch (e) {
                this.log(`[DiscordGateway] Message error: ${e.message}`);
            }
        });

        this.ws.on('close', (code) => {
            this.log(`[DiscordGateway] Connection closed (code ${code}). Reconnecting in 5s...`);
            if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
            if (this.running) {
                this.reconnectTimer = setTimeout(() => this.connect(), 5000);
            }
        });

        this.ws.on('error', (err) => {
            this.log(`[DiscordGateway] Error: ${err.message}`);
        });
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    async handlePayload(payload) {
        const { op, d, s, t } = payload;
        if (s) this.sequence = s;

        switch (op) {
            case 10: // HELLO
                const interval = d.heartbeat_interval;
                if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
                this.heartbeatTimer = setInterval(() => {
                    this.send({ op: 1, d: this.sequence });
                }, interval);

                // Identify (Intents: Guilds = 1)
                this.send({
                    op: 2,
                    d: {
                        token: this.token,
                        intents: 1 | 512, // GUILDS | GUILD_MESSAGES
                        properties: {
                            os: process.platform,
                            browser: 'Antigravity-Agent',
                            device: 'Antigravity-Agent'
                        }
                    }
                });
                break;

            case 11: // Heartbeat ACK
                break;

            case 0: // DISPATCH
                if (t === 'READY') {
                    this.sessionId = d.session_id;
                    this.log(`[DiscordGateway] Ready! Logged in as ${d.user.username}#${d.user.discriminator}`);
                } else if (t === 'INTERACTION_CREATE') {
                    await this.handleInteraction(d);
                }
                break;
        }
    }

    async handleInteraction(interaction) {
        // Component interaction (button click)
        if (interaction.type !== 3) return;

        const customId = interaction.data?.custom_id || '';
        const match = customId.match(/^ans:([a-zA-Z0-9_-]+):(\d+)$/);
        if (!match) return;

        const [, sessionId, rawIdx] = match;
        const index = parseInt(rawIdx, 10);
        const user = interaction.member?.user?.username || interaction.user?.username || 'User';

        this.log(`[DiscordGateway] ${user} clicked option ${index + 1} for session ${sessionId}`);

        // Acknowledge interaction immediately with UPDATE_MESSAGE (type 7) to show selected state
        await this.respondInteraction(interaction.id, interaction.token, {
            type: 7, // UPDATE_MESSAGE
            data: {
                content: `✅ **Option ${index + 1} selected by @${user}!** Applying in Antigravity...`,
                components: [] // remove buttons after click
            }
        });

        // Hop and execute in Antigravity page
        const expr = `(async () => {
            try {
                if (window.__TSR_ROUTER__) {
                    await window.__TSR_ROUTER__.navigate({ to: '/c/${sessionId}' });
                }
                await new Promise((r) => setTimeout(r, 600));

                const radios = Array.from(document.querySelectorAll('[role="radio"], [role="option"], input[type="radio"], label'));
                if (radios[${index}]) {
                    radios[${index}].click();
                }

                await new Promise((r) => setTimeout(r, 200));

                const submit = Array.from(document.querySelectorAll('button, [role="button"]'))
                    .find((b) => (b.textContent || '').trim().toLowerCase() === 'submit');
                if (submit) submit.click();

                return true;
            } catch (e) {
                return false;
            }
        })()`;

        for (const [targetId] of this.router.handler.connections) {
            await this.router.handler._evaluate(targetId, expr);
            break;
        }
    }

    respondInteraction(interactionId, interactionToken, body) {
        return new Promise((resolve) => {
            const data = JSON.stringify(body);
            const req = https.request(`https://discord.com/api/v10/interactions/${interactionId}/${interactionToken}/callback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, (res) => {
                res.on('data', () => {});
                res.on('end', () => resolve(true));
            });
            req.on('error', () => resolve(false));
            req.write(data);
            req.end();
        });
    }

    /**
     * Send rich embed message with interactive buttons to the configured Discord channel
     */
    async sendMessageWithButtons(embed, options = [], sessionId = '') {
        if (!this.channelId || !this.token) return false;

        const payload = {
            embeds: [embed],
            components: []
        };

        if (options && options.length > 0 && sessionId) {
            // Discord allows max 5 buttons per action row
            const buttons = options.slice(0, 5).map((opt, i) => {
                const label = opt.length > 70 ? `${opt.slice(0, 67)}...` : opt;
                return {
                    type: 2, // Button
                    style: 1, // Primary (Blurple)
                    label: `${i + 1}. ${label}`,
                    custom_id: `ans:${sessionId}:${i}`
                };
            });

            payload.components.push({
                type: 1, // Action Row
                components: buttons
            });
        }

        const data = JSON.stringify(payload);
        return new Promise((resolve) => {
            const req = https.request(`https://discord.com/api/v10/channels/${this.channelId}/messages`, {
                method: 'POST',
                headers: {
                    Authorization: `Bot ${this.token}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, (res) => {
                let body = '';
                res.on('data', (c) => body += c);
                res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
            });
            req.on('error', () => resolve(false));
            req.write(data);
            req.end();
        });
    }
}

module.exports = { DiscordGatewayBridge };
