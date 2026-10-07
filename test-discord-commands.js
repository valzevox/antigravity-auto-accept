/**
 * Test Discord Command Handler
 */

const assert = require('assert');
const { DiscordCommandHandler } = require('./main_scripts/discord-commands');

async function run() {
    let sentMessages = [];
    const mockGateway = {
        channelId: '1557278717313556531',
        guildId: '710045911371350117',
        async sendChannelMessage(channelId, content, embed) {
            sentMessages.push({ channelId, content, embed });
            return true;
        },
        async fetchGuildChannels() {
            return [
                { id: '1557278717313556531', name: 'general', type: 0 },
                { id: '2222222222222222222', name: 'logs', type: 0 }
            ];
        }
    };

    const mockRouter = {
        cdp: { connected: true },
        currentSessionPath: '/c/test-session-123',
        getSessions: async () => ({ currentId: 'test-session-123', currentTitle: 'Test Session', sessions: [] }),
        switchSession: async (q) => ({ ok: true, session: { id: q, title: 'Switched Session' } }),
        notifier: {
            config: {
                webhooks: {
                    discordBot: {
                        channelId: '123456789012345678',
                        mentionUserId: ''
                    }
                }
            }
        }
    };

    const handler = new DiscordCommandHandler(mockGateway, mockRouter);
    handler.loadConfig = () => mockRouter.notifier.config;
    handler.saveConfig = (cfg) => { mockRouter.notifier.config = cfg; return true; };

    // Test 1: !help
    sentMessages = [];
    await handler.handleMessage({ author: { bot: false }, channel_id: 'chan_1', content: '!help' });
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(sentMessages[0].embed.title, '🛠️ Antigravity Discord Control Commands');

    // Test 2: !status
    sentMessages = [];
    await handler.handleMessage({ author: { bot: false }, channel_id: 'chan_1', content: '!status' });
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(sentMessages[0].embed.title, '⚡ Antigravity System Status');

    // Test 3: !channels
    sentMessages = [];
    await handler.handleMessage({ author: { bot: false }, channel_id: 'chan_1', content: '!channels' });
    assert.strictEqual(sentMessages.length, 1);
    assert.ok(sentMessages[0].embed.description.includes('general'));

    // Test 4: !setping @here
    sentMessages = [];
    await handler.handleMessage({ author: { bot: false }, channel_id: 'chan_1', content: '!setping here' });
    assert.strictEqual(sentMessages.length, 1);
    assert.ok(sentMessages[0].content.includes('Cập nhật chế độ ping'));
    assert.strictEqual(mockRouter.notifier.config.webhooks.discordBot.mentionUserId, 'here');

    // Test 5: !setping @everyone
    await handler.handleMessage({ author: { bot: false }, channel_id: 'chan_1', content: '!setping everyone' });
    assert.strictEqual(mockRouter.notifier.config.webhooks.discordBot.mentionUserId, 'everyone');

    // Test 6: !setping off
    await handler.handleMessage({ author: { bot: false }, channel_id: 'chan_1', content: '!setping off' });
    assert.strictEqual(mockRouter.notifier.config.webhooks.discordBot.mentionUserId, '');

    // Test 7: !setchannel
    sentMessages = [];
    await handler.handleMessage({ author: { bot: false }, channel_id: 'chan_1', content: '!setchannel <#2222222222222222222>' });
    assert.strictEqual(mockGateway.channelId, '2222222222222222222');
    assert.strictEqual(mockRouter.notifier.config.webhooks.discordBot.channelId, '2222222222222222222');

    // Revert channel back to 1557278717313556531
    await handler.handleMessage({ author: { bot: false }, channel_id: 'chan_1', content: '!setchannel 1557278717313556531' });

    // Test 8: !prompt / !message
    mockRouter.sendPrompt = async (text, isNew) => ({ ok: true, method: 'button', text, isNew });
    sentMessages = [];
    await handler.handleMessage({ author: { bot: false, id: '111', username: 'valzevox' }, channel_id: 'chan_1', content: '!prompt write unit test' });
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(sentMessages[0].embed.title, '🚀 Đã nạp prompt vào Antigravity!');

    // Test 9: !new
    sentMessages = [];
    await handler.handleMessage({ author: { bot: false, id: '111', username: 'valzevox' }, channel_id: 'chan_1', content: '!new new task' });
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(sentMessages[0].embed.title, '✨ Đã mở phiên mới và gửi prompt!');

    // Test 10: !stop
    mockRouter.stopCurrentTask = async () => ({ ok: true });
    sentMessages = [];
    await handler.handleMessage({ author: { bot: false }, channel_id: 'chan_1', content: '!stop' });
    assert.strictEqual(sentMessages.length, 1);
    assert.ok(sentMessages[0].content.includes('Đã gửi lệnh dừng task'));

    // Test 11: !sessions
    mockRouter.getSessions = async () => ({
        currentId: 'a3bb597f',
        currentTitle: 'Higgsfield CLI',
        sessions: [
            { id: 'a3bb597f', title: 'Higgsfield CLI', active: true },
            { id: '89e10449', title: 'General Greeting', active: false }
        ]
    });
    sentMessages = [];
    await handler.handleMessage({ author: { bot: false }, channel_id: 'chan_1', content: '!sessions' });
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(sentMessages[0].embed.title, '📂 Danh sách Sessions trong Antigravity');
    assert.ok(sentMessages[0].embed.description.includes('Higgsfield CLI'));

    // Test 12: !switch
    mockRouter.switchSession = async (q) => ({ ok: true, session: { id: '89e10449', title: 'General Greeting' } });
    sentMessages = [];
    await handler.handleMessage({ author: { bot: false }, channel_id: 'chan_1', content: '!switch 89e10449' });
    assert.strictEqual(sentMessages.length, 1);
    // Test 13: !setgroq
    sentMessages = [];
    await handler.handleMessage({ author: { bot: false }, channel_id: 'chan_1', content: '!setgroq gsk_dummy_key_123456789' });
    assert.strictEqual(sentMessages.length, 1);
    assert.ok(sentMessages[0].content.includes('Đã lưu Groq API Key thành công'));

    // Test 14: Voice attachment dispatch
    handler.voiceHandler.processDiscordVoice = async () => 'build a landing page';
    sentMessages = [];
    await handler.handleMessage({
        author: { bot: false, id: '111', username: 'valzevox' },
        channel_id: 'chan_1',
        content: '',
        attachments: [{
            name: 'voice-message.ogg',
            content_type: 'audio/ogg',
            url: 'https://cdn.discord.com/fake.ogg'
        }]
    });
    // First message is "Đang nhận diện giọng nói...", second is the embed
    assert.strictEqual(sentMessages.length, 2);
    assert.strictEqual(sentMessages[1].embed.title, '🎙️ Voice Transcribed & Sent to Antigravity!');
    assert.ok(sentMessages[1].embed.description.includes('build a landing page'));

    // Test 15: Voice Intent Parsing
    assert.strictEqual(handler.parseVoiceIntent('danh sách session').intent, 'sessions');
    assert.strictEqual(handler.parseVoiceIntent('xem các phiên').intent, 'sessions');
    assert.strictEqual(handler.parseVoiceIntent('chuyển sang session Higgsfield').intent, 'switch');
    assert.strictEqual(handler.parseVoiceIntent('chuyển sang session Higgsfield').target, 'higgsfield');
    assert.strictEqual(handler.parseVoiceIntent('dừng lại').intent, 'stop');
    assert.strictEqual(handler.parseVoiceIntent('trạng thái').intent, 'status');
    assert.strictEqual(handler.parseVoiceIntent('viết unit test cho auth').intent, 'prompt');

    // Test 16: Voice message with 'danh sách session' triggers cmdSessions
    handler.voiceHandler.processDiscordVoice = async () => 'danh sách các session';
    sentMessages = [];
    await handler.handleMessage({
        author: { bot: false, id: '111', username: 'valzevox' },
        channel_id: 'chan_1',
        content: '',
        attachments: [{
            name: 'voice.ogg',
            content_type: 'audio/ogg',
            url: 'https://cdn.discord.com/fake.ogg'
        }]
    });
    // Expected: 1. Đang nhận diện..., 2. Thực thi: Danh sách Session, 3. Embed sessions
    assert.ok(sentMessages.length >= 3);
    assert.ok(sentMessages[1].content.includes('Thực thi: Danh sách Session'));
    assert.strictEqual(sentMessages[2].embed.title, '📂 Danh sách Sessions trong Antigravity');

    // Test 17: Unauthorized user trying to run !stop
    sentMessages.length = 0;
    handler.loadConfig = () => ({
        webhooks: { discordBot: { mentionUserId: '999999999999999999' } }
    });
    await handler.handleMessage({
        author: { id: '111111111111111111', username: 'attacker' },
        channel_id: 'chan-1',
        content: '!stop'
    });
    assert.strictEqual(sentMessages.length, 1);
    assert.ok(sentMessages[0].content.includes('yêu cầu quyền chủ sở hữu'));

    // Test 18: Unauthorized user sending voice attachment
    sentMessages.length = 0;
    await handler.handleMessage({
        author: { id: '111111111111111111', username: 'attacker' },
        channel_id: 'chan-1',
        attachments: [{
            url: 'https://cdn.discord.com/fake.ogg',
            content_type: 'audio/ogg'
        }]
    });
    assert.strictEqual(sentMessages.length, 1);
    assert.ok(sentMessages[0].content.includes('Bạn không có quyền điều khiển'));

    console.log('DiscordCommandHandler self-check: PASS');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
