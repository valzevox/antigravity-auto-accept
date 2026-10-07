/**
 * Antigravity Auto Accept - Webhook Notifier
 * Discord Webhooks + Telegram Bot API + Custom HTTP webhook.
 *
 * Interactive answer buttons are Telegram-only on purpose: Telegram long-polling
 * reaches this machine with no public URL and no port forwarding. Discord sends
 * component interactions to an Application Interaction Endpoint, which would
 * require a public HTTPS endpoint, so Discord gets rich embeds only.
 *
 * ponytail: raw https instead of undici/fetch. Upgrade if proxy or retry is needed.
 */

const https = require('https');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { I18nManager } = require('./i18n');

function getBrand() {
    const t = I18nManager.t();
    return {
        name: t.brandName,
        avatar: 'https://raw.githubusercontent.com/valzevox/antigravity-auto-accept/main/media/icon.png',
        footer: t.brandFooter
    };
}

function getEventMeta() {
    const t = I18nManager.t();
    return {
        1: {
            key: 'manual_intervention',
            title: t.events[1].title,
            color: 0xF59E0B,
            icon: '✋',
            label: t.events[1].label
        },
        2: {
            key: 'task_completed',
            title: t.events[2].title,
            color: 0x10B981,
            icon: '✅',
            label: t.events[2].label
        },
        3: {
            key: 'auto_approved',
            title: t.events[3].title,
            color: 0x3B82F6,
            icon: '⚡',
            label: t.events[3].label
        },
        4: {
            key: 'error',
            title: t.events[4].title,
            color: 0xEF4444,
            icon: '⚠️',
            label: t.events[4].label
        }
    };
}

class Notifier {
    constructor(config = {}) {
        this.config = this.loadConfig(config);
    }

    loadConfig(override = {}) {
        const configFile = path.join(__dirname, '..', 'config.json');
        let fileConfig = {};
        if (fs.existsSync(configFile)) {
            try {
                const raw = fs.readFileSync(configFile, 'utf8').replace(/^\uFEFF/, '');
                fileConfig = JSON.parse(raw);
            } catch (e) {}
        }

        const tgFile = fileConfig.webhooks?.telegram || {};
        const botFile = fileConfig.webhooks?.discordBot || {};
        const pick = (...vals) => {
            for (const v of vals) if (v !== undefined && v !== null) return v;
            return '';
        };

        return {
            webhooks: {
                discord: pick(process.env.DISCORD_WEBHOOK_URL, override.discord, fileConfig.webhooks?.discord),
                discordBot: {
                    token: pick(process.env.DISCORD_BOT_TOKEN, override.discordBotToken, botFile.token),
                    channelId: pick(process.env.DISCORD_BOT_CHANNEL_ID, override.discordBotChannelId, botFile.channelId),
                    guildId: pick(process.env.DISCORD_BOT_GUILD_ID, override.discordBotGuildId, botFile.guildId),
                    mentionUserId: pick(process.env.DISCORD_MENTION_USER_ID, override.mentionUserId, botFile.mentionUserId, fileConfig.mentionUserId)
                },
                telegram: {
                    botToken: pick(process.env.TELEGRAM_BOT_TOKEN, override.telegramBotToken, tgFile.botToken),
                    chatId: pick(process.env.TELEGRAM_CHAT_ID, override.telegramChatId, tgFile.chatId)
                },
                customUrl: pick(process.env.CUSTOM_WEBHOOK_URL, override.customUrl, fileConfig.webhooks?.customUrl)
            },
            events: {
                1: pick(override.events?.[1], fileConfig.events?.onManualIntervention, true),
                2: pick(override.events?.[2], fileConfig.events?.onTaskCompleted, true),
                3: pick(override.events?.[3], fileConfig.events?.onAutoApproved, true),
                4: pick(override.events?.[4], fileConfig.events?.onError, true)
            },
            maxErrorRetries: Number(pick(override.maxErrorRetries, fileConfig.maxErrorRetries, 5))
        };
    }

    isEnabled() {
        const { discord, discordBot, telegram, customUrl } = this.config.webhooks;
        return Boolean(
            discord ||
            (discordBot.token && discordBot.channelId) ||
            (telegram.botToken && telegram.chatId) ||
            customUrl
        );
    }

    /** Attach the Discord Gateway bridge after the router is built. */
    setGateway(bridge) {
        this.gateway = bridge;
    }

    post(targetUrl, payload, method = 'POST') {
        if (!targetUrl) return Promise.resolve(false);
        return new Promise((resolve) => {
            try {
                const parsed = url.parse(targetUrl);
                const lib = parsed.protocol === 'http:' ? http : https;
                const body = method === 'POST' ? JSON.stringify(payload) : null;
                const headers = {};
                if (body) {
                    headers['Content-Type'] = 'application/json';
                    headers['Content-Length'] = Buffer.byteLength(body);
                }

                const req = lib.request(parsed, { method, headers, timeout: 5000 }, (res) => {
                    let raw = '';
                    res.on('data', (c) => { raw += c; });
                    res.on('end', () => {
                        const ok = res.statusCode >= 200 && res.statusCode < 300;
                        if (!ok) return resolve(false);
                        try { resolve(JSON.parse(raw)); } catch (e) { resolve(true); }
                    });
                });

                req.on('error', () => resolve(false));
                req.on('timeout', () => { req.destroy(); resolve(false); });
                if (body) req.write(body);
                req.end();
            } catch (e) {
                resolve(false);
            }
        });
    }

    /** Trim a label to fit Telegram's 64-char button text budget. */
    static shortLabel(text, max = 58) {
        const flat = String(text || '').replace(/\s+/g, ' ').trim();
        return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
    }

    static escapeHtml(str = '') {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * @param {number} code 1..4 from EVENT_META
     * @param {object} payload { session, summary, details, options: string[] }
     */
    buildMessage(code, payload = {}) {
        const t = I18nManager.t();
        const brand = getBrand();
        const events = getEventMeta();

        let meta = events[code] || events[1];
        if (code === 4 && payload.isQuota) {
            meta = {
                key: 'quota_error',
                title: t.events.quota.title,
                color: 0xED4245,
                icon: '⚠️',
                label: t.events.quota.label
            };
        } else if (code === 4 && payload.isRetryWarning) {
            meta = {
                key: 'retry_warning',
                title: t.events.retryWarning?.title || 'Đã đạt giới hạn thử lại',
                color: 0xF59E0B,
                icon: '⚠️',
                label: t.events.retryWarning?.label || summary
            };
        }
        const { session = 'unknown', summary = '', details = '', options = [] } = payload;
        const stamp = new Date().toLocaleString(I18nManager.getLanguage() === 'vi' ? 'vi-VN' : 'en-US');
        const short = session.length > 14 ? `${session.slice(0, 10)}…` : session;

        const fields = [
            { name: t.fields.session, value: `\`${session}\``, inline: true },
            { name: t.fields.time, value: stamp, inline: true }
        ];
        if (details) {
            fields.push({
                name: t.fields.prompt,
                value: details.length > 1000 ? `${details.slice(0, 997)}…` : details
            });
        }
        if (options.length) {
            fields.push({
                name: t.fields.options,
                value: options.slice(0, 10).map((o, i) => `**${i + 1}.** ${Notifier.shortLabel(o, 90)}`).join('\n')
            });
        }

        const tgSummary = Notifier.escapeHtml(summary || meta.label);
        const tgSafeSummary = tgSummary.length > 2500 ? `${tgSummary.slice(0, 2497)}…` : tgSummary;

        return {
            meta,
            embed: {
                author: { name: brand.name, icon_url: brand.avatar },
                title: `${meta.icon} ${meta.title}`,
                description: (summary || meta.label).slice(0, 4000),
                color: meta.color,
                fields,
                footer: { text: brand.footer },
                timestamp: new Date().toISOString()
            },
            telegramText:
                `<b>${meta.icon} ${meta.title}</b>\n\n` +
                `${tgSafeSummary}\n\n` +
                `<b>${t.fields.session}:</b> <code>${short}</code>\n` +
                `<b>${t.fields.time}:</b> ${stamp}` +
                (details ? `\n\n<b>${t.fields.prompt}:</b>\n${Notifier.escapeHtml(details).slice(0, 800)}` : '') +
                (options.length ? `\n\n${options.slice(0, 10).map((o, i) => `<b>${i + 1}.</b> ${Notifier.escapeHtml(Notifier.shortLabel(o, 200))}`).join('\n')}` : ''),
            // Interactive buttons only exist for manual intervention.
            replyMarkup: code === 1 && options.length
                ? {
                    inline_keyboard: options.slice(0, 3).map((o, i) => ([
                        { text: `${i + 1}. ${Notifier.shortLabel(o)}`, callback_data: `ans:${session}:${i}` }
                    ]))
                }
                : undefined
        };
    }

    /** @returns {object|null} telegram message id when interactive buttons were attached */
    async notify(code, payload = {}) {
        if (!this.isEnabled()) return null;
        if (!this.config.events[code]) return null;

        const msg = this.buildMessage(code, payload);
        const { discord, discordBot, telegram, customUrl } = this.config.webhooks;
        const options = payload.options || [];

        const jobs = [];

        // Format ping text (e.g. @here, @everyone, or <@123456>) on Case 1 (options), Case 2 (task completed), and Case 4 (error / quota exhausted)
        let mention = '';
        if ((code === 1 || code === 2 || code === 4) && discordBot.mentionUserId) {
            const m = String(discordBot.mentionUserId).trim();
            if (m.toLowerCase() === 'here' || m === '@here') mention = '@here';
            else if (m.toLowerCase() === 'everyone' || m === '@everyone') mention = '@everyone';
            else if (m) mention = `<@${m}>`;
        }

        // Discord Bot channel: full interactive support with buttons + user ping on Case 1 & Case 2.
        if (this.gateway && discordBot.token && discordBot.channelId) {
            jobs.push(this.gateway.sendMessageWithButtons(msg.embed, options, payload.session || '', mention));
        }

        if (discord) {
            const hookMention = mention ? `${mention}\n` : '';
            const brand = getBrand();
            jobs.push(this.post(discord, {
                username: brand.name,
                avatar_url: brand.avatar,
                content: hookMention || undefined,
                embeds: [msg.embed]
            }));
        }

        if (telegram.botToken && telegram.chatId) {
            jobs.push(this.post(`https://api.telegram.org/bot${telegram.botToken}/sendMessage`, {
                chat_id: telegram.chatId,
                text: msg.telegramText,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: msg.replyMarkup
            }).then((r) => (r && r.result ? r.result.message_id : null)));
        }

        if (customUrl) {
            jobs.push(this.post(customUrl, {
                event: msg.meta.key,
                code,
                title: msg.meta.title,
                session: payload.session,
                summary: payload.summary || '',
                details: payload.details || '',
                options: payload.options || [],
                timestamp: new Date().toISOString()
            }));
        }

        const results = await Promise.all(jobs);
        return results.find((r) => typeof r === 'number') || null;
    }
}

module.exports = {
    Notifier,
    getBrand,
    getEventMeta,
    get BRAND() { return getBrand(); },
    get EVENT_META() { return getEventMeta(); }
};
