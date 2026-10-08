/**
 * Antigravity Auto Accept - Discord Commands Handler
 * Allows managing bot settings directly from Discord chat (e.g. !setchannel, !setping, !status).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_PATH = path.resolve(__dirname, '../config.json');
const { VoiceHandler } = require('./voice-handler');
const { I18nManager } = require('./i18n');

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
                const raw = fs.readFileSync(CONFIG_PATH, 'utf-8').replace(/^\uFEFF/, '');
                return JSON.parse(raw);
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

    /**
     * Owner-only authorization gate.
     * Owner ID lives in webhooks.discordBot.ownerUserId — a dedicated key that no
     * command overwrites (unlike mentionUserId, which !setping rewrites).
     * Falls back to mentionUserId for backward compatibility.
     * If neither is configured, runs in open mode so fresh installs still work.
     * `!help` stays public.
     */
    isAuthorized(message) {
        const cfg = this.loadConfig();
        const bot = cfg.webhooks?.discordBot || {};
        const ownerId = bot.ownerUserId || bot.mentionUserId;
        if (!ownerId || ownerId === 'here' || ownerId === 'everyone') return true;
        return String(message.author?.id || '') === String(ownerId);
    }

    async handleMessage(message) {
        if (!message || message.author?.bot) return;

        const cfg = this.loadConfig();
        const targetChannelId = this.gateway?.channelId || cfg.webhooks?.discordBot?.channelId;

        // CRITICAL FIX: Only process messages & voice sent inside the configured bot channel!
        // Prevents triggering prompts or voice recognition from other channels in the server.
        if (targetChannelId && String(message.channel_id) !== String(targetChannelId)) {
            return;
        }

        // Check for Voice message / Audio attachments
        const voiceEnabled = cfg.voiceEnabled !== false; // Default true
        const attachments = message.attachments || [];
        const audioAttachment = attachments.find(a => {
            const ct = (a.content_type || '').toLowerCase();
            const fn = (a.filename || a.name || '').toLowerCase();
            return ct.startsWith('audio/') || 
                   fn.endsWith('.ogg') || fn.endsWith('.mp3') || fn.endsWith('.wav') || 
                   fn.endsWith('.m4a') || fn.endsWith('.oga');
        });

        if (audioAttachment) {
            if (!voiceEnabled) {
                // Voice feature is disabled by owner, ignore audio attachments
                return;
            }
            if (!this.isAuthorized(message)) {
                await this.reply(message.channel_id, `🔒 <@${message.author.id}> Bạn không có quyền điều khiển Antigravity bằng voice. Chỉ chủ sở hữu mới được sử dụng.`);
                return;
            }
            await this.handleVoiceMessage(message, audioAttachment);
            return;
        }

        const content = (message.content || '').trim();
        if (!content.startsWith('!') && !content.startsWith('/')) return;

        const parts = content.slice(1).trim().split(/\s+/);
        const cmd = parts[0]?.toLowerCase();
        const args = parts.slice(1);

        // Owner-only gate: allow !help for everyone, everything else requires owner
        if (cmd !== 'help' && cmd !== 'commands' && !this.isAuthorized(message)) {
            this.log(`[DiscordCommands] Denied @${message.author?.username} (${message.author?.id}) tried: !${cmd}`);
            await this.reply(message.channel_id, `🔒 <@${message.author.id}> Lệnh \`!${cmd}\` yêu cầu quyền chủ sở hữu. Chỉ tài khoản được cấp quyền mới được sử dụng các lệnh điều khiển.`);
            return;
        }

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
            case 'setretry':
            case 'retrylimit':
                await this.cmdSetRetry(message, args);
                break;
            case 'setgroq':
            case 'groq':
                await this.cmdSetGroq(message, args[0]);
                break;
            case 'setvoice':
            case 'voice':
                await this.cmdSetVoice(message, args[0]);
                break;
            case 'setowner':
            case 'owner':
                await this.cmdSetOwner(message, args);
                break;
            case 'lang':
            case 'language':
            case 'ngonngu':
                await this.cmdLanguage(message, args[0]);
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
                    title: '🎙️ Đã nhận diện giọng nói và nạp vào Antigravity!',
                    description: `**Nội dung nhận diện:**\n> "${transcribed}"`,
                    color: 0x5865F2,
                    fields: [
                        { name: 'Người gửi', value: `<@${message.author.id}>`, inline: true },
                        { name: 'Mô hình chuyển âm', value: '`whisper-large-v3-turbo`', inline: true }
                    ],
                    footer: { text: 'Antigravity • Điều khiển bằng giọng nói' }
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

    async cmdSetVoice(message, state) {
        const raw = (state || '').toLowerCase().trim();
        if (raw !== 'on' && raw !== 'off' && raw !== 'enable' && raw !== 'disable') {
            const cfg = this.loadConfig();
            const current = cfg.voiceEnabled !== false ? 'BẬT (ON)' : 'TẮT (OFF)';
            return this.reply(message.channel_id, `ℹ️ Trạng thái nhận diện giọng nói hiện tại: **${current}**\nCách dùng: \`!setvoice on\` (bật) hoặc \`!setvoice off\` (tắt).`);
        }

        const enabled = raw === 'on' || raw === 'enable';
        const cfg = this.loadConfig();
        cfg.voiceEnabled = enabled;

        if (this.saveConfig(cfg)) {
            const msg = enabled 
                ? '✅ **Đã BẬT chức năng nhận diện giọng nói (Voice Control)**.\n🎙️ Giờ bạn có thể gửi voice note/audio trong kênh này để điều khiển Antigravity.'
                : '🔇 **Đã TẮT chức năng nhận diện giọng nói (Voice Control)**.\n🔒 Bot sẽ bỏ qua tất cả tin nhắn thoại/audio, không tự động trigger prompt voice.';
            await this.reply(message.channel_id, msg);
        } else {
            await this.reply(message.channel_id, '❌ Lỗi lưu cấu hình vào config.json');
        }
    }

    async reply(channelId, text, embed = null) {
        return this.gateway.sendChannelMessage(channelId, text, embed);
    }

    async cmdHelp(message) {
        const t = I18nManager.t();
        const embed = {
            title: t.commands.helpTitle,
            description: t.commands.helpDesc,
            color: 0x5865F2,
            fields: [
                { name: '`!prompt <text>` / `!message <text>`', value: t.commands.promptDesc, inline: false },
                { name: '`!new <text>`', value: t.commands.newDesc, inline: false },
                { name: '`!stop`', value: t.commands.stopDesc, inline: false },
                { name: '`!sessions`', value: t.commands.sessionsDesc, inline: false },
                { name: '`!switch <id>`', value: t.commands.switchDesc, inline: false },
                { name: '`!status`', value: t.commands.statusDesc, inline: false },
                { name: '`!config`', value: t.commands.configDesc, inline: false },
                { name: '`!language`', value: t.commands.setlanguageDesc, inline: false },
                { name: '`!setchannel <#channel>`', value: t.commands.setchannelDesc, inline: false },
                { name: '`!setping <target>`', value: t.commands.setpingDesc, inline: false },
                { name: '`!setretry <number>`', value: t.commands.setretryDesc, inline: false },
                { name: '`!channels`', value: t.commands.channelsDesc, inline: false }
            ],
            footer: { text: t.twoWayFooter }
        };
        const payload = {
            embeds: [embed],
            components: [
                {
                    type: 1, // ActionRow 1: Language selection
                    components: [
                        { type: 2, style: 1, label: t.commands.btnVi || '🇻🇳 Tiếng Việt', custom_id: 'lang:vi' },
                        { type: 2, style: 2, label: t.commands.btnEn || '🇬🇧 English', custom_id: 'lang:en' }
                    ]
                },
                {
                    type: 1, // ActionRow 2: Quick controls
                    components: [
                        { type: 2, style: 2, label: t.commands.btnPause || '⏸️ Tạm dừng', custom_id: 'act:pause' },
                        { type: 2, style: 3, label: t.commands.btnResume || '▶️ Tiếp tục', custom_id: 'act:resume' },
                        { type: 2, style: 4, label: t.commands.btnStop || '🛑 Dừng Task', custom_id: 'act:stop' },
                        { type: 2, style: 1, label: t.commands.btnRetry || '🔄 Retry ngay', custom_id: 'act:retry' }
                    ]
                }
            ]
        };
        await this.gateway.createRawMessage(message.channel_id, payload);
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
        const t = I18nManager.t();
        const isConnected = this.router?.cdp?.connected || (this.router?.handler?.connections?.size > 0);
        const info = await this.router.getSessions();
        const activeName = info?.currentTitle || 'N/A';
        const activeId = info?.currentId ? `\`${info.currentId.slice(0, 8)}...\`` : 'N/A';
        const guildId = this.gateway.guildId;
        const channelId = this.gateway.channelId;
        const currentLang = I18nManager.getLangName(I18nManager.getLanguage());

        const embed = {
            title: t.commands.statusTitle,
            color: isConnected ? 0x10B981 : 0xEF4444,
            fields: [
                { name: t.commands.connField, value: isConnected ? t.commands.connected : t.commands.disconnected, inline: true },
                { name: t.commands.activeField, value: `**${activeName}**\n(${activeId})`, inline: true },
                { name: t.commands.langField, value: currentLang, inline: true },
                { name: t.commands.targetField, value: `<#${channelId}> (\`${channelId}\`)`, inline: false },
                { name: t.commands.guildField, value: `\`${guildId}\``, inline: true }
            ],
            footer: { text: t.twoWayFooter },
            timestamp: new Date().toISOString()
        };
        await this.reply(message.channel_id, '', embed);
    }

    async cmdConfig(message) {
        const t = I18nManager.t();
        const cfg = this.loadConfig();
        const bot = cfg.webhooks?.discordBot || {};
        const mention = bot.mentionUserId || '(None)';
        let pingMode = 'Off';
        if (mention === 'here') pingMode = '@here';
        else if (mention === 'everyone') pingMode = '@everyone';
        else if (mention) pingMode = `<@${mention}> (\`${mention}\`)`;

        const currentLang = I18nManager.getLangName(I18nManager.getLanguage());

        const embed = {
            title: t.commands.configTitle,
            color: 0x3B82F6,
            fields: [
                { name: t.commands.configChannel, value: `<#${bot.channelId || this.gateway.channelId}>`, inline: true },
                { name: t.commands.configPing, value: pingMode, inline: true },
                { name: t.commands.configLang, value: currentLang, inline: true },
                { name: t.commands.configRetries || 'Số lần thử lại khi lỗi', value: `\`${cfg.maxErrorRetries ?? 5}\``, inline: true },
                { name: t.commands.guildField, value: `\`${bot.guildId || this.gateway.guildId}\``, inline: false }
            ],
            footer: { text: t.commands.configFooter }
        };
        const payload = {
            embeds: [embed],
            components: [
                {
                    type: 1, // ActionRow 1: Language selection
                    components: [
                        { type: 2, style: 1, label: t.commands.btnVi || '🇻🇳 Tiếng Việt', custom_id: 'lang:vi' },
                        { type: 2, style: 2, label: t.commands.btnEn || '🇬🇧 English', custom_id: 'lang:en' }
                    ]
                },
                {
                    type: 1, // ActionRow 2: Quick controls
                    components: [
                        { type: 2, style: 2, label: t.commands.btnPause || '⏸️ Tạm dừng', custom_id: 'act:pause' },
                        { type: 2, style: 3, label: t.commands.btnResume || '▶️ Tiếp tục', custom_id: 'act:resume' },
                        { type: 2, style: 4, label: t.commands.btnStop || '🛑 Dừng Task', custom_id: 'act:stop' }
                    ]
                }
            ]
        };
        await this.gateway.createRawMessage(message.channel_id, payload);
    }

    async cmdLanguage(message, langChoice) {
        if (langChoice) {
            const chosen = I18nManager.setLanguage(langChoice.toLowerCase());
            const msg = chosen === 'en'
                ? '✅ Display language switched to **English**!'
                : '✅ Đã chuyển ngôn ngữ hiển thị sang **Tiếng Việt**!';
            return this.reply(message.channel_id, msg);
        }

        const t = I18nManager.t();
        const embed = {
            title: t.commands.langPromptTitle,
            description: t.commands.langPromptDesc,
            color: 0x5865F2,
            fields: [
                { name: '🇻🇳 Tiếng Việt', value: 'Bấm nút bên dưới để chọn Tiếng Việt.', inline: true },
                { name: '🇬🇧 English', value: 'Click button below to select English.', inline: true }
            ],
            footer: { text: 'Antigravity • Language Selector' }
        };

        const payload = {
            embeds: [embed],
            components: [
                {
                    type: 1, // ActionRow
                    components: [
                        {
                            type: 2, // Button
                            style: 1, // Primary (Blurple)
                            label: '🇻🇳 Tiếng Việt',
                            custom_id: 'lang:vi'
                        },
                        {
                            type: 2, // Button
                            style: 2, // Secondary (Gray)
                            label: '🇬🇧 English',
                            custom_id: 'lang:en'
                        }
                    ]
                }
            ]
        };

        await this.gateway.createRawMessage(message.channel_id, payload);
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

    async cmdSetOwner(message, args) {
        const raw = args[0];
        if (!raw) {
            return this.reply(message.channel_id, '❌ Cách dùng: `!setowner <@user hoặc User_ID>`\nVí dụ: `!setowner @valzevox` hoặc `!setowner 710045911371350117`');
        }

        const match = raw.match(/\d+/);
        if (!match) {
            return this.reply(message.channel_id, `❌ Không tìm thấy User ID hợp lệ trong: \`${raw}\``);
        }
        const targetUserId = match[0];

        const cfg = this.loadConfig();
        if (!cfg.webhooks) cfg.webhooks = {};
        if (!cfg.webhooks.discordBot) cfg.webhooks.discordBot = {};
        cfg.webhooks.discordBot.ownerUserId = targetUserId;

        if (this.saveConfig(cfg)) {
            await this.reply(message.channel_id, `👑 **Đã cấp quyền chủ sở hữu duy nhất cho:** <@${targetUserId}> (\`${targetUserId}\`)\n🔒 Từ bây giờ chỉ tài khoản này mới có thể dùng các lệnh điều khiển Antigravity.`);
        } else {
            await this.reply(message.channel_id, '❌ Lỗi lưu cấu hình vào `config.json`!');
        }
    }

    async cmdSetRetry(message, args) {
        const num = parseInt(args[0], 10);
        const isEn = I18nManager.getLanguage() === 'en';
        if (isNaN(num) || num < 0 || num > 50) {
            return this.reply(message.channel_id, isEn
                ? '❌ Usage: `!setretry <number (0-50)>`\nExample: `!setretry 5`'
                : '❌ Cách dùng: `!setretry <số lần (0-50)>`\nVí dụ: `!setretry 5`');
        }

        const cfg = this.loadConfig();
        cfg.maxErrorRetries = num;
        if (this.saveConfig(cfg)) {
            if (this.router?.notifier?.config) {
                this.router.notifier.config.maxErrorRetries = num;
            }
            for (const [targetId] of this.router?.handler?.connections || []) {
                try {
                    await this.router.evalPage(targetId, `if (window.__autoAcceptFreeState) { window.__autoAcceptFreeState.maxErrorRetries = ${num}; }`);
                } catch (e) {}
            }
            await this.reply(message.channel_id, isEn
                ? `✅ **Updated maximum error retries to: ${num}**`
                : `✅ **Đã cập nhật số lần thử lại tối đa khi lỗi: ${num}**`);
        } else {
            await this.reply(message.channel_id, isEn
                ? '❌ Failed to save config to `config.json`!'
                : '❌ Lỗi lưu cấu hình vào `config.json`!');
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
