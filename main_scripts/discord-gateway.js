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
const { DiscordCommandHandler } = require('./discord-commands');

class DiscordGatewayBridge {
    constructor(router, config = {}, log = () => {}) {
        this.router = router;
        this.token = config.token || '';
        this.channelId = config.channelId || '';
        this.guildId = config.guildId || '';
        this.log = log;

        this.commandHandler = new DiscordCommandHandler(this, router, log);
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

                // Identify (Intents: Guilds = 1, GuildMessages = 512, MessageContent = 32768)
                this.send({
                    op: 2,
                    d: {
                        token: this.token,
                        intents: 1 | 512 | 32768,
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
                } else if (t === 'MESSAGE_CREATE') {
                    await this.commandHandler.handleMessage(d);
                }
                break;
        }
    }

    async handleInteraction(interaction) {
        // Component interaction (button click)
        if (interaction.type !== 3) return;

        const customId = interaction.data?.custom_id || '';

        // Handle language switch button: lang:en or lang:vi
        if (customId.startsWith('lang:')) {
            const targetLang = customId.replace('lang:', '');
            const { I18nManager } = require('./i18n');
            I18nManager.setLanguage(targetLang);
            const user = interaction.member?.user?.username || interaction.user?.username || 'User';
            const msg = targetLang === 'en'
                ? `✅ Display language set to **English** by @${user}!`
                : `✅ Đã chuyển ngôn ngữ hiển thị sang **Tiếng Việt** bởi @${user}!`;

            await this.respondInteraction(interaction.id, interaction.token, {
                type: 7,
                data: {
                    content: msg,
                    components: []
                }
            });
            return;
        }

        // Handle quick action buttons: act:pause, act:resume, act:stop, act:retry
        if (customId.startsWith('act:')) {
            const action = customId.replace('act:', '');
            const user = interaction.member?.user?.username || interaction.user?.username || 'User';
            const { I18nManager } = require('./i18n');
            const t = I18nManager.t();
            let ackMsg = '';

            if (action === 'pause') {
                for (const [targetId] of this.router.handler.connections) {
                    await this.router.handler._safeEvaluate(targetId, 'if(window.__autoAcceptStop) window.__autoAcceptStop()', 1);
                }
                ackMsg = t.commands.actionPaused(user);
            } else if (action === 'resume') {
                for (const [targetId] of this.router.handler.connections) {
                    await this.router.handler._safeEvaluate(targetId, 'if(window.__autoAcceptStart) window.__autoAcceptStart()', 1);
                }
                ackMsg = t.commands.actionResumed(user);
            } else if (action === 'stop') {
                await this.router.stopCurrentTask();
                ackMsg = t.commands.actionStopped(user);
            } else if (action === 'retry') {
                const expr = `(() => {
                    const buttons = Array.from(document.querySelectorAll('button, [role="button"], a.monaco-button'));
                    const btn = buttons.find(b => {
                        if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
                        const t = (b.textContent || b.innerText || '').trim();
                        const aria = (b.getAttribute('aria-label') || '').trim();
                        const title = (b.getAttribute('title') || '').trim();
                        return /^(retry|try again|thử lại)(\\b|$)/i.test(t) ||
                               /^(retry|try again)(\\b|$)/i.test(aria) ||
                               /^(retry|try again)(\\b|$)/i.test(title) ||
                               /continue generating/i.test(t);
                    });
                    if (btn) {
                        btn.click();
                        return { ok: true };
                    }
                    return { ok: false };
                })()`;
                for (const [targetId] of this.router.handler.connections) {
                    await this.router.handler._evaluate(targetId, expr);
                    break;
                }
                ackMsg = t.commands.actionRetried(user);
            }

            await this.respondInteraction(interaction.id, interaction.token, {
                type: 7,
                data: {
                    content: ackMsg,
                    components: []
                }
            });
            return;
        }

        const match = customId.match(/^ans:([a-zA-Z0-9_-]+):(\d+)$/);
        if (!match) return;

        const [, sessionId, rawIdx] = match;
        const index = parseInt(rawIdx, 10);
        const user = interaction.member?.user?.username || interaction.user?.username || 'User';

        this.log(`[DiscordGateway] ${user} clicked option ${index + 1} for session ${sessionId}`);

        const { I18nManager } = require('./i18n');
        const t = I18nManager.t();
        const ackContent = t.commands.buttonSelected(user, index + 1);

        // Acknowledge interaction immediately with UPDATE_MESSAGE (type 7) to show selected state
        await this.respondInteraction(interaction.id, interaction.token, {
            type: 7, // UPDATE_MESSAGE
            data: {
                content: ackContent,
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
    async sendMessageWithButtons(embed, options = [], sessionId = '', content = '') {
        if (!this.channelId || !this.token) return false;

        const payload = {
            content: content || undefined,
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

    /**
     * Create a message and return the created message object (with ID)
     */
    async createRawMessage(channelId, payload) {
        if (!channelId || !this.token) return null;
        const data = JSON.stringify(payload);
        return new Promise((resolve) => {
            const req = https.request(`https://discord.com/api/v10/channels/${channelId}/messages`, {
                method: 'POST',
                headers: {
                    Authorization: `Bot ${this.token}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, (res) => {
                let body = '';
                res.on('data', (c) => body += c);
                res.on('end', () => {
                    try {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(JSON.parse(body));
                        } else {
                            resolve(null);
                        }
                    } catch (e) {
                        resolve(null);
                    }
                });
            });
            req.on('error', () => resolve(null));
            req.write(data);
            req.end();
        });
    }

    /**
     * Edit an existing message in a Discord channel
     */
    async editMessage(channelId, messageId, payload) {
        if (!channelId || !messageId || !this.token) return false;
        const data = JSON.stringify(payload);
        return new Promise((resolve) => {
            const req = https.request(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
                method: 'PATCH',
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

    /**
     * Delete a message in a Discord channel
     */
    async deleteMessage(channelId, messageId) {
        if (!channelId || !messageId || !this.token) return false;
        return new Promise((resolve) => {
            const req = https.request(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bot ${this.token}` }
            }, (res) => {
                res.on('data', () => {});
                res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
            });
            req.on('error', () => resolve(false));
            req.end();
        });
    }

    /**
     * Send plain text or embed to any Discord channel
     */
    async sendChannelMessage(channelId, content = '', embed = null) {
        if (!channelId || !this.token) return false;
        const payload = {};
        if (content) payload.content = content;
        if (embed) payload.embeds = [embed];

        const res = await this.createRawMessage(channelId, payload);
        return !!res;
    }

    /**
     * Fetch list of channels from current Guild
     */
    async fetchGuildChannels() {
        if (!this.guildId || !this.token) return [];
        return new Promise((resolve) => {
            const req = https.request(`https://discord.com/api/v10/guilds/${this.guildId}/channels`, {
                method: 'GET',
                headers: {
                    Authorization: `Bot ${this.token}`,
                    'Content-Type': 'application/json'
                }
            }, (res) => {
                let body = '';
                res.on('data', (c) => body += c);
                res.on('end', () => {
                    try {
                        const channels = JSON.parse(body);
                        resolve(Array.isArray(channels) ? channels : []);
                    } catch {
                        resolve([]);
                    }
                });
            });
            req.on('error', () => resolve([]));
            req.end();
        });
    }
}

module.exports = { DiscordGatewayBridge };
