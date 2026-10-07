/**
 * Antigravity Auto Accept - Discord Commands Handler
 * Allows managing bot settings directly from Discord chat (e.g. !setchannel, !setping, !status).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_PATH = path.resolve(__dirname, '../config.json');

class DiscordCommandHandler {
    constructor(gateway, router, log = console.log) {
        this.gateway = gateway;
        this.router = router;
        this.log = log;
    }

    loadConfig() {
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            }
        } catch (e) {
            this.log(`[DiscordCommands] Failed to read config: ${e.message}`);
        }
        return {};
    }

    saveConfig(cfg) {
        try {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
            return true;
        } catch (e) {
            this.log(`[DiscordCommands] Failed to write config: ${e.message}`);
            return false;
        }
    }

    async handleMessage(message) {
        if (!message || message.author?.bot) return;

        const content = (message.content || '').trim();
        if (!content.startsWith('!') && !content.startsWith('/')) return;

        const parts = content.slice(1).trim().split(/\s+/);
        const cmd = parts[0]?.toLowerCase();
        const args = parts.slice(1);

        switch (cmd) {
            case 'help':
            case 'commands':
                await this.cmdHelp(message);
                break;
            case 'status':
                await this.cmdStatus(message);
                break;
            case 'config':
            case 'settings':
                await this.cmdConfig(message);
                break;
            case 'setchannel':
                await this.cmdSetChannel(message, args);
                break;
            case 'setping':
                await this.cmdSetPing(message, args);
                break;
            case 'channels':
            case 'listchannels':
                await this.cmdListChannels(message);
                break;
        }
    }

    async reply(channelId, text, embed = null) {
        return this.gateway.sendChannelMessage(channelId, text, embed);
    }

    async cmdHelp(message) {
        const embed = {
            title: '🛠️ Antigravity Discord Control Commands',
            description: 'Các lệnh quản lý trực tiếp Antigravity Bot từ Discord:',
            color: 0x5865F2,
            fields: [
                { name: '`!status`', value: 'Kiểm tra trạng thái Antigravity CDP & background daemon.', inline: false },
                { name: '`!config`', value: 'Xem cấu hình hiện tại (kênh gửi, chế độ ping).', inline: false },
                { name: '`!setchannel <#kênh hoặc ID>`', value: 'Đổi kênh bot sẽ gửi thông báo và câu hỏi.', inline: false },
                { name: '`!setping <@user | here | everyone | off>`', value: 'Cấu hình ai sẽ được ping khi có câu hỏi lựa chọn.', inline: false },
                { name: '`!channels`', value: 'Liệt kê danh sách các kênh trong server kèm ID.', inline: false }
            ],
            footer: { text: 'Antigravity 2.0 • Remote Management' }
        };
        await this.reply(message.channel_id, '', embed);
    }

    async cmdStatus(message) {
        const isConnected = this.router?.cdp?.connected || false;
        const currentPath = this.router?.currentSessionPath || 'N/A';
        const guildId = this.gateway.guildId;
        const channelId = this.gateway.channelId;

        const embed = {
            title: '⚡ Antigravity System Status',
            color: isConnected ? 0x10B981 : 0xEF4444,
            fields: [
                { name: 'Antigravity CDP', value: isConnected ? '🟢 Connected' : '🔴 Disconnected', inline: true },
                { name: 'Active Session Path', value: `\`${currentPath}\``, inline: true },
                { name: 'Target Channel', value: `<#${channelId}> (\`${channelId}\`)`, inline: false },
                { name: 'Guild ID', value: `\`${guildId}\``, inline: true }
            ],
            footer: { text: 'Antigravity 2.0' },
            timestamp: new Date().toISOString()
        };
        await this.reply(message.channel_id, '', embed);
    }

    async cmdConfig(message) {
        const cfg = this.loadConfig();
        const bot = cfg.webhooks?.discordBot || {};
        const mention = bot.mentionUserId || '(None)';
        let pingMode = 'Off';
        if (mention === 'here') pingMode = '@here';
        else if (mention === 'everyone') pingMode = '@everyone';
        else if (mention) pingMode = `<@${mention}> (\`${mention}\`)`;

        const embed = {
            title: '⚙️ Antigravity Bot Configuration',
            color: 0x3B82F6,
            fields: [
                { name: 'Notification Channel', value: `<#${bot.channelId || this.gateway.channelId}>`, inline: true },
                { name: 'Option Ping Target', value: pingMode, inline: true },
                { name: 'Guild ID', value: `\`${bot.guildId || this.gateway.guildId}\``, inline: false }
            ],
            footer: { text: 'Dùng !setchannel hoặc !setping để thay đổi' }
        };
        await this.reply(message.channel_id, '', embed);
    }

    async cmdSetChannel(message, args) {
        let raw = args[0];
        if (!raw) {
            return this.reply(message.channel_id, '❌ Cách dùng: `!setchannel <#kênh hoặc channel_id>`\nVí dụ: `!setchannel #general` hoặc `!setchannel 1557278717313556531`');
        }

        // Extract channel ID from mention <#123456> or raw number
        const match = raw.match(/\d+/);
        if (!match) {
            return this.reply(message.channel_id, `❌ Không tìm thấy Channel ID hợp lệ trong: \`${raw}\``);
        }
        const targetChannelId = match[0];

        const cfg = this.loadConfig();
        if (!cfg.webhooks) cfg.webhooks = {};
        if (!cfg.webhooks.discordBot) cfg.webhooks.discordBot = {};
        cfg.webhooks.discordBot.channelId = targetChannelId;

        if (this.saveConfig(cfg)) {
            this.gateway.channelId = targetChannelId;
            if (this.router?.notifier?.config?.webhooks?.discordBot) {
                this.router.notifier.config.webhooks.discordBot.channelId = targetChannelId;
            }
            await this.reply(message.channel_id, `✅ **Đã chuyển kênh thông báo sang:** <#${targetChannelId}> (\`${targetChannelId}\`)`);
        } else {
            await this.reply(message.channel_id, '❌ Lỗi lưu cấu hình vào `config.json`!');
        }
    }

    async cmdSetPing(message, args) {
        const raw = args[0]?.toLowerCase();
        if (!raw) {
            return this.reply(message.channel_id, '❌ Cách dùng: `!setping <@user | here | everyone | off>`\nVí dụ: `!setping @here`, `!setping @everyone`, `!setping @valzevox`, hoặc `!setping off`');
        }

        let target = '';
        let display = '';

        if (raw === 'off' || raw === 'none' || raw === 'disable') {
            target = '';
            display = 'Đã tắt ping (chỉ gửi tin nhắn và embed)';
        } else if (raw === 'here' || raw === '@here') {
            target = 'here';
            display = 'Sẽ ping `@here` khi có câu hỏi cần trả lời';
        } else if (raw === 'everyone' || raw === '@everyone') {
            target = 'everyone';
            display = 'Sẽ ping `@everyone` khi có câu hỏi cần trả lời';
        } else {
            // Check for user mention <@123456> or raw user ID
            const match = args[0].match(/\d+/);
            if (match) {
                target = match[0];
                display = `Sẽ ping riêng <@${target}> khi có câu hỏi cần trả lời`;
            } else {
                return this.reply(message.channel_id, '❌ Không nhận diện được target ping. Hãy gõ `!setping @here`, `!setping @everyone`, tag user, hoặc `!setping off`.');
            }
        }

        const cfg = this.loadConfig();
        if (!cfg.webhooks) cfg.webhooks = {};
        if (!cfg.webhooks.discordBot) cfg.webhooks.discordBot = {};
        cfg.webhooks.discordBot.mentionUserId = target;

        if (this.saveConfig(cfg)) {
            if (this.router?.notifier?.config?.webhooks?.discordBot) {
                this.router.notifier.config.webhooks.discordBot.mentionUserId = target;
            }
            await this.reply(message.channel_id, `✅ **Cập nhật chế độ ping thành công!**\n👉 ${display}`);
        } else {
            await this.reply(message.channel_id, '❌ Lỗi lưu cấu hình vào `config.json`!');
        }
    }

    async cmdListChannels(message) {
        const channels = await this.gateway.fetchGuildChannels();
        if (!channels || !channels.length) {
            return this.reply(message.channel_id, '❌ Không thể tải danh sách kênh.');
        }

        const textChannels = channels
            .filter(c => c.type === 0 || c.type === 5) // Text & Announcement channels
            .slice(0, 20);

        const list = textChannels.map(c => `• **#${c.name}** — <#${c.id}> (\`${c.id}\`)`).join('\n');

        const embed = {
            title: `📋 Danh sách kênh text (${textChannels.length} kênh đầu)`,
            description: list || 'Không tìm thấy kênh text nào.',
            color: 0x5865F2,
            footer: { text: 'Dùng !setchannel <ID> để chọn kênh gửi' }
        };
        await this.reply(message.channel_id, '', embed);
    }
}

module.exports = { DiscordCommandHandler };
