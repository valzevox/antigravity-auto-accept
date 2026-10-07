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
        notifier: {
            config: {
                webhooks: {
                    discordBot: {
                        channelId: '1557278717313556531',
                        mentionUserId: ''
                    }
                }
            }
        }
    };

    const handler = new DiscordCommandHandler(mockGateway, mockRouter);

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

    console.log('DiscordCommandHandler self-check: PASS');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
