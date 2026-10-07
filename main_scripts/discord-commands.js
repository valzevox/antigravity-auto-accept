/**
 * Antigravity Auto Accept - Discord Commands Handler
 * Allows managing bot settings directly from Discord chat (e.g. !setchannel, !setping, !status).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_PATH = path.resolve(__dirname, '../config.json');
const { VoiceHandler } = require('./voice-handler');

class DiscordCommandHandler {
    constructor(gateway, router, log = console.log) {
        this.gateway = gateway;
        this.router = router;
        this.log = log;
        const cfg = this.loadConfig();
        this.voiceHandler = new VoiceHandler(cfg, log);
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

        // Check for Voice message / Audio attachments first
        const attachments = message.attachments || [];
        const audioAttachment = attachments.find(a => {
            const ct = (a.content_type || '').toLowerCase();
            const fn = (a.filename || a.name || '').toLowerCase();
            return ct.startsWith('audio/') || 
                   fn.endsWith('.ogg') || fn.endsWith('.mp3') || fn.endsWith('.wav') || 
                   fn.endsWith('.m4a') || fn.endsWith('.oga');
        });

        if (audioAttachment) {
            await this.handleVoiceMessage(message, audioAttachment);
            return;
        }

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
            case 'prompt':
            case 'message':
            case 'ask':
                await this.cmdPrompt(message, args.join(' '), false);
                break;
            case 'new':
            case 'newchat':
                await this.cmdPrompt(message, args.join(' '), true);
                break;
            case 'stop':
            case 'cancel':
                await this.cmdStop(message);
                break;
            case 'sessions':
            case 'ls':
                await this.cmdSessions(message);
                break;
            case 'switch':
            case 'go':
                await this.cmdSwitch(message, args.join(' '));
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
            case 'setgroq':
            case 'groq':
                await this.cmdSetGroq(message, args[0]);
                break;
            case 'channels':
            case 'listchannels':
                await this.cmdListChannels(message);
                break;
        }
    }

    parseVoiceIntent(text) {
        if (!text) return { intent: 'prompt', prompt: '' };
        const clean = text.trim().toLowerCase().replace(/[.,!?;:]+$/, '');

        // 1. List / Xem sessions
        if (/^(?:danh sách|list|xem|hiện|hiển thị|các)\s*(?:tất cả\s*)?(?:các\s*)?(?:session|phiên|cuộc trò chuyện|chat)/i.test(clean) ||
            /^(?:sessions|list sessions|list session)$/i.test(clean)) {
            return { intent: 'sessions' };
        }

        // 2. Chuyển session / Switch session
        const switchMatch = clean.match(/^(?:chuyển|switch|đổi|mở|go to|nhảy sang|nhảy qua)\s*(?:sang|đến|vào)?\s*(?:session|phiên)?\s*(.+)$/i);
        if (switchMatch && switchMatch[1] && switchMatch[1].trim()) {
            return { intent: 'switch', target: switchMatch[1].trim() };
        }

        // 3. Dừng task / Stop
        if (/^(dừng|dừng lại|hủy|stop|cancel|ngừng)(?:\s*(?:lại|task|nhiệm vụ|tiến trình))?$/i.test(clean)) {
            return { intent: 'stop' };
        }

        // 4. Trạng thái / Status
        if (/^(trạng thái|kiểm tra|status|check)$/i.test(clean)) {
            return { intent: 'status' };
        }

        // 5. Phiên mới + Prompt
        const newMatch = clean.match(/^(?:tạo|mở|bắt đầu)?\s*(?:session|phiên|chat)?\s*mới\s*[:,-]?\s*(.+)$/i);
        if (newMatch && newMatch[1] && newMatch[1].trim()) {
            return { intent: 'new', prompt: newMatch[1].trim() };
        }

        // 6. Trợ giúp / Help
        if (/^(hướng dẫn|trợ giúp|lệnh|help)$/i.test(clean)) {
            return { intent: 'help' };
        }

        // 7. Mặc định: Gửi prompt vào Antigravity
        return { intent: 'prompt', prompt: text };
    }

    async handleVoiceMessage(message, attachment) {
        const user = message.author?.username || 'Unknown';
        this.log(`[Voice] Received voice attachment from @${user}: ${attachment.url}`);

        try {
            await this.reply(message.channel_id, '🎙️ **Đang nhận diện giọng nói qua Groq Whisper...**');
            const transcribed = await this.voiceHandler.processDiscordVoice(attachment);

            if (!transcribed || transcribed.trim().length === 0) {
                return this.reply(message.channel_id, '⚠️ Không nhận diện được âm thanh hoặc giọng nói quá nhỏ.');
            }

            const parsed = this.parseVoiceIntent(transcribed);
            this.log(`[Voice Intent] Detected intent: ${parsed.intent} (text="${transcribed}")`);

            if (parsed.intent === 'sessions') {
                await this.reply(message.channel_id, `🎙️ *Voice: "${transcribed}"* ➡️ **Thực thi: Danh sách Session**`);
                await this.cmdSessions(message);
            } else if (parsed.intent === 'switch') {
                await this.reply(message.channel_id, `🎙️ *Voice: "${transcribed}"* ➡️ **Thực thi: Chuyển sang session \`${parsed.target}\`**`);
                await this.cmdSwitch(message, parsed.target);
            } else if (parsed.intent === 'stop') {
                await this.reply(message.channel_id, `🎙️ *Voice: "${transcribed}"* ➡️ **Thực thi: Dừng task đang chạy**`);
                await this.cmdStop(message);
            } else if (parsed.intent === 'status') {
                await this.reply(message.channel_id, `🎙️ *Voice: "${transcribed}"* ➡️ **Thực thi: Kiểm tra trạng thái**`);
                await this.cmdStatus(message);
            } else if (parsed.intent === 'help') {
                await this.reply(message.channel_id, `🎙️ *Voice: "${transcribed}"* ➡️ **Thực thi: Hướng dẫn sử dụng**`);
                await this.cmdHelp(message);
            } else if (parsed.intent === 'new') {
                const embed = {
                    title: '🎙️ Voice: Mở Session mới & Gửi Prompt',
                    description: `**Nội dung:**\n> "${parsed.prompt}"`,
                    color: 0x5865F2,
                    fields: [
                        { name: 'Người nói', value: `<@${message.author.id}>`, inline: true },
                        { name: 'Chế độ', value: '✨ Phiên mới', inline: true }
                    ],
                    footer: { text: 'Antigravity Voice Controller' }
                };
                await this.reply(message.channel_id, '', embed);
                await this.cmdPrompt(message, parsed.prompt, true);
            } else {
                // Default: Regular prompt into Antigravity
                const embed = {
                    title: '🎙️ Voice Transcribed & Sent to Antigravity!',
                    description: `**Nội dung nhận diện:**\n> "${transcribed}"`,
                    color: 0x5865F2,
                    fields: [
                        { name: 'Người gửi', value: `<@${message.author.id}>`, inline: true },
                        { name: 'Model', value: '`whisper-large-v3-turbo`', inline: true }
                    ],
                    footer: { text: 'Antigravity Voice Bridge' }
                };

                await this.reply(message.channel_id, '', embed);

                const res = await this.router.sendPrompt(transcribed, false);
                if (!res || !res.ok) {
                    await this.reply(message.channel_id, `⚠️ Không thể nạp prompt vào Antigravity: ${res?.error || 'Lỗi kết nối'}`);
                }
            }
        } catch (err) {
            this.log(`[Voice Error] ${err.message}`);
            await this.reply(message.channel_id, `❌ **Lỗi xử lý voice:** ${err.message}`);
        }
    }

    async cmdSetGroq(message, apiKey) {
        if (!apiKey || !apiKey.trim()) {
            return this.reply(message.channel_id, '❌ Cách dùng: `!setgroq <groq_api_key>`\nLấy key miễn phí tại: https://console.groq.com/keys');
        }

        const key = apiKey.trim();
        const cfg = this.loadConfig();
        cfg.groqApiKey = key;
        const ok = this.saveConfig(cfg);

        if (ok) {
            this.voiceHandler.setGroqApiKey(key);
            const masked = key.slice(0, 8) + '...' + key.slice(-4);
            await this.reply(message.channel_id, `✅ **Đã lưu Groq API Key thành công:** \`${masked}\`\n🎙️ Bây giờ bạn có thể gửi voice note vào kênh này, bot sẽ tự động nhận diện và gửi prompt vào Antigravity!`);
        } else {
            await this.reply(message.channel_id, '❌ Không thể ghi vào config.json');
        }
    }

    async reply(channelId, text, embed = null) {
        return this.gateway.sendChannelMessage(channelId, text, embed);
    }

    async cmdHelp(message) {
        const embed = {
            title: '🛠️ Antigravity Discord Control Commands',
            description: 'Các lệnh quản lý và tương tác 2 chiều với Antigravity:',
            color: 0x5865F2,
            fields: [
                { name: '`!prompt <nội dung>` hoặc `!message <nội dung>`', value: '🚀 **Gửi prompt trực tiếp vào Antigravity** để Agent thực thi!', inline: false },
                { name: '`!new <nội dung>`', value: '✨ Mở phiên chat mới và gửi prompt thực thi.', inline: false },
                { name: '`!stop`', value: '🛑 Dừng khẩn cấp task đang chạy trong Antigravity.', inline: false },
                { name: '`!sessions`', value: '📂 Xem danh sách các phiên trò chuyện & session đang mở.', inline: false },
                { name: '`!switch <id hoặc tên>`', value: '🔀 Chuyển Antigravity sang session được chỉ định.', inline: false },
                { name: '`!status`', value: 'Kiểm tra trạng thái CDP, session đang mở & daemon.', inline: false },
                { name: '`!config`', value: 'Xem cấu hình hiện tại (kênh gửi, chế độ ping).', inline: false },
                { name: '`!setchannel <#kênh hoặc ID>`', value: 'Đổi kênh bot sẽ gửi thông báo và câu hỏi.', inline: false },
                { name: '`!setping <@user | here | everyone | off>`', value: 'Cấu hình ai sẽ được ping khi có câu hỏi / hoàn tất task.', inline: false },
                { name: '`!channels`', value: 'Liệt kê danh sách các kênh trong server kèm ID.', inline: false }
            ],
            footer: { text: 'Antigravity 2.0 • Remote 2-Way Controller' }
        };
        await this.reply(message.channel_id, '', embed);
    }

    async cmdPrompt(message, promptText, isNew = false) {
        if (!promptText || !promptText.trim()) {
            return this.reply(message.channel_id, '❌ Cách dùng: `!prompt <nội dung cần làm>`\nVí dụ: `!prompt hãy kiểm tra lỗi trong file index.js giúp anh`');
        }

        const author = message.author?.username || 'User';
        this.log(`[DiscordCommands] Sending prompt from @${author} (new=${isNew}): ${promptText.slice(0, 80)}...`);

        const res = await this.router.sendPrompt(promptText, isNew);
        if (res && res.ok) {
            const embed = {
                title: isNew ? '✨ Đã mở phiên mới và gửi prompt!' : '🚀 Đã nạp prompt vào Antigravity!',
                description: `**Nội dung:**\n> ${promptText.length > 500 ? promptText.slice(0, 500) + '...' : promptText}`,
                color: 0x10B981,
                fields: [
                    { name: 'Người gửi', value: `<@${message.author.id}>`, inline: true },
                    { name: 'Phương thức', value: `\`${res.method || 'DOM'}\``, inline: true }
                ],
                footer: { text: 'Agent đang xử lý... Kết quả sẽ gửi về đây khi hoàn thành!' }
            };
            await this.reply(message.channel_id, '', embed);
        } else {
            const err = res?.error || 'Không thể tương tác với Antigravity';
            await this.reply(message.channel_id, `❌ **Lỗi khi gửi prompt:** ${err}\n*(Kiểm tra xem Antigravity có đang mở trên máy không)*`);
        }
    }

    async cmdStop(message) {
        const res = await this.router.stopCurrentTask();
        if (res && res.ok) {
            await this.reply(message.channel_id, '🛑 **Đã gửi lệnh dừng task đang chạy trong Antigravity!**');
        } else {
            await this.reply(message.channel_id, `⚠️ ${res?.error || 'Không thể dừng hoặc không có task nào đang chạy.'}`);
        }
    }

    async cmdSessions(message) {
        const info = await this.router.getSessions();
        const { currentId, currentTitle, sessions } = info || {};

        if (!sessions || sessions.length === 0) {
            return this.reply(message.channel_id, '⚠️ Không tìm thấy danh sách session nào (hoặc Antigravity đang đóng).');
        }

        const lines = sessions.slice(0, 15).map((s, idx) => {
            const prefix = s.active ? '👉 **[ACTIVE]**' : `\`${idx + 1}.\``;
            const shortId = s.id ? s.id.slice(0, 8) : 'unknown';
            return `${prefix} **${s.title}**\n   └ ID: \`${shortId}\` (\`${s.id}\`)`;
        });

        const embed = {
            title: '📂 Danh sách Sessions trong Antigravity',
            description: lines.join('\n\n'),
            color: 0x5865F2,
            fields: [
                {
                    name: '💡 Chuyển đổi session',
                    value: 'Dùng lệnh `!switch <id>` hoặc `!switch <tên>` để chuyển Antigravity sang session đó!'
                }
            ],
            footer: { text: `Đang mở: ${currentTitle || currentId || 'N/A'}` }
        };

        await this.reply(message.channel_id, '', embed);
    }

    async cmdSwitch(message, query) {
        if (!query || !query.trim()) {
            return this.reply(message.channel_id, '❌ Cách dùng: `!switch <ID hoặc tên session>`\nVí dụ: `!switch 89e10449` hoặc `!switch Higgsfield`\n*(Dùng `!sessions` để xem danh sách)*');
        }

        const res = await this.router.switchSession(query);
        if (res && res.ok) {
            const s = res.session;
            const embed = {
                title: '🔀 Đã chuyển phiên làm việc thành công!',
                description: `**Session:** ${s.title}\n**ID:** \`${s.id}\``,
                color: 0x10B981,
                footer: { text: 'Antigravity đã chuyển sang tab này trên máy tính!' }
            };
            await this.reply(message.channel_id, '', embed);
        } else {
            await this.reply(message.channel_id, `❌ ${res?.error || 'Không thể chuyển session'}`);
        }
    }

    async cmdStatus(message) {
        const isConnected = this.router?.cdp?.connected || (this.router?.handler?.connections?.size > 0);
        const info = await this.router.getSessions();
        const activeName = info?.currentTitle || 'N/A';
        const activeId = info?.currentId ? `\`${info.currentId.slice(0, 8)}...\`` : 'N/A';
        const guildId = this.gateway.guildId;
        const channelId = this.gateway.channelId;

        const embed = {
            title: '⚡ Antigravity System Status',
            color: isConnected ? 0x10B981 : 0xEF4444,
            fields: [
                { name: 'Antigravity CDP', value: isConnected ? '🟢 Connected' : '🔴 Disconnected', inline: true },
                { name: 'Active Session', value: `**${activeName}**\n(${activeId})`, inline: true },
                { name: 'Target Channel', value: `<#${channelId}> (\`${channelId}\`)`, inline: false },
                { name: 'Guild ID', value: `\`${guildId}\``, inline: true }
            ],
            footer: { text: 'Antigravity 2.0 • 2-Way Controller' },
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
