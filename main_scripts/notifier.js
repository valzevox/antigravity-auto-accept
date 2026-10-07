/**
 * Antigravity Auto Accept - Webhook Notifier
 * Supports Discord Webhooks, Telegram Bot API, and Custom Webhooks.
 *
 * ponytail: uses Node stdlib https/http without axios/node-fetch.
 * Upgrade to undici or retry-queue if network drops frequently.
 */

const https = require('https');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const COLORS = {
    MANUAL: 0xF59E0B,   // Orange/Yellow - needs user input
    COMPLETED: 0x10B981,// Green - task finished
    APPROVED: 0x3B82F6, // Blue - auto-approved
    ERROR: 0xEF4444     // Red - error
};

class Notifier {
    constructor(config = {}) {
        this.config = this.loadConfig(config);
    }

    loadConfig(override = {}) {
        const configFile = path.join(__dirname, '..', 'config.json');
        let fileConfig = {};
        if (fs.existsSync(configFile)) {
            try {
                fileConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            } catch (e) {}
        }

        return {
            webhooks: {
                discord: process.env.DISCORD_WEBHOOK_URL || override.discord || fileConfig.webhooks?.discord || '',
                telegram: {
                    botToken: process.env.TELEGRAM_BOT_TOKEN || override.telegramBotToken || fileConfig.webhooks?.telegram?.botToken || '',
                    chatId: process.env.TELEGRAM_CHAT_ID || override.telegramChatId || fileConfig.webhooks?.telegram?.chatId || ''
                },
                customUrl: process.env.CUSTOM_WEBHOOK_URL || override.customUrl || fileConfig.webhooks?.customUrl || ''
            },
            events: {
                onManualIntervention: fileConfig.events?.onManualIntervention ?? true,
                onTaskCompleted: fileConfig.events?.onTaskCompleted ?? true,
                onAutoApproved: fileConfig.events?.onAutoApproved ?? true,
                onError: fileConfig.events?.onError ?? true,
                ...override.events
            }
        };
    }

    isEnabled() {
        const { discord, telegram, customUrl } = this.config.webhooks;
        return Boolean(discord || (telegram.botToken && telegram.chatId) || customUrl);
    }

    async post(targetUrl, payload) {
        if (!targetUrl) return false;
        return new Promise((resolve) => {
            try {
                const parsed = url.parse(targetUrl);
                const reqLib = parsed.protocol === 'http:' ? http : https;
                const body = JSON.stringify(payload);

                const req = reqLib.request(parsed, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body)
                    },
                    timeout: 5000
                }, (res) => {
                    resolve(res.statusCode >= 200 && res.statusCode < 300);
                });

                req.on('error', () => resolve(false));
                req.on('timeout', () => {
                    req.destroy();
                    resolve(false);
                });

                req.write(body);
                req.end();
            } catch (e) {
                resolve(false);
            }
        });
    }

    async sendDiscord(embed) {
        const webhookUrl = this.config.webhooks.discord;
        if (!webhookUrl) return;
        return this.post(webhookUrl, {
            username: 'Antigravity Agent Sentinel',
            avatar_url: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
            embeds: [embed]
        });
    }

    async sendTelegram(textHtml) {
        const { botToken, chatId } = this.config.webhooks.telegram;
        if (!botToken || !chatId) return;
        const tgUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        return this.post(tgUrl, {
            chat_id: chatId,
            text: textHtml,
            parse_mode: 'HTML'
        });
    }

    async sendCustom(eventData) {
        const customUrl = this.config.webhooks.customUrl;
        if (!customUrl) return;
        return this.post(customUrl, eventData);
    }

    async notify(event, payload = {}) {
        if (!this.isEnabled()) return;

        const {
            session = 'unknown',
            summary = '',
            details = '',
            extra = {}
        } = payload;

        let title = '';
        let color = COLORS.APPROVED;
        let icon = '⚡';

        if (event === 'manual_intervention') {
            if (!this.config.events.onManualIntervention) return;
            title = '⚠️ Manual Intervention Required';
            color = COLORS.MANUAL;
            icon = '✋';
        } else if (event === 'task_completed') {
            if (!this.config.events.onTaskCompleted) return;
            title = '✅ Agent Task Completed';
            color = COLORS.COMPLETED;
            icon = '🎯';
        } else if (event === 'auto_approved') {
            if (!this.config.events.onAutoApproved) return;
            title = '⚡ Auto-Approved Permission';
            color = COLORS.APPROVED;
            icon = '🚀';
        } else if (event === 'error') {
            if (!this.config.events.onError) return;
            title = '❌ Agent Execution Error';
            color = COLORS.ERROR;
            icon = '💥';
        }

        const timestamp = new Date().toISOString();
        const shortSession = session.length > 12 ? `${session.slice(0, 8)}...` : session;

        // 1. Discord Embed
        const discordEmbed = {
            title: `${icon} ${title}`,
            description: summary,
            color,
            fields: [
                { name: 'Session', value: `\`${session}\``, inline: true },
                { name: 'Timestamp', value: timestamp.replace('T', ' ').replace(/\..+/, ' UTC'), inline: true }
            ],
            footer: { text: 'Antigravity Auto Accept • Notification Hub' }
        };

        if (details) {
            discordEmbed.fields.push({
                name: 'Details / Question',
                value: details.length > 1000 ? `${details.slice(0, 997)}...` : details,
                inline: false
            });
        }

        // 2. Telegram HTML
        let tgMsg = `<b>${icon} ${title}</b>\n\n`;
        tgMsg += `<b>Session:</b> <code>${shortSession}</code>\n`;
        if (summary) tgMsg += `<b>Summary:</b> ${summary}\n`;
        if (details) tgMsg += `<b>Details:</b> <i>${details.slice(0, 500)}</i>\n`;

        // 3. Dispatch to all active destinations
        await Promise.allSettled([
            this.sendDiscord(discordEmbed),
            this.sendTelegram(tgMsg),
            this.sendCustom({ event, title, session, summary, details, extra, timestamp })
        ]);
    }
}

module.exports = { Notifier, COLORS };
