const assert = require('assert');
const { Notifier, COLORS } = require('./main_scripts/notifier');

// Check 1: Disabled by default when no webhooks configured
const emptyNotifier = new Notifier({ discord: '', telegramBotToken: '', telegramChatId: '', customUrl: '' });
assert.strictEqual(emptyNotifier.isEnabled(), false, 'empty config should disable notifier');

// Check 2: Enabled when Discord URL provided
const discordNotifier = new Notifier({ discord: 'https://discord.com/api/webhooks/mock/test' });
assert.strictEqual(discordNotifier.isEnabled(), true, 'discord url should enable notifier');

// Check 3: Enabled when Telegram token & chatId provided
const tgNotifier = new Notifier({ telegramBotToken: '123456:ABC', telegramChatId: '987654' });
assert.strictEqual(tgNotifier.isEnabled(), true, 'telegram config should enable notifier');

// Check 4: Payload formatting & Event toggle check
let sentPayload = null;
class MockNotifier extends Notifier {
    async post(url, payload) {
        sentPayload = { url, payload };
        return true;
    }
}

const mock = new MockNotifier({
    discord: 'https://discord.com/api/webhooks/mock/test',
    events: { onManualIntervention: true, onTaskCompleted: false }
});

(async () => {
    // Should NOT send task_completed when disabled in config
    await mock.notify('task_completed', { session: 'session-1', summary: 'Done' });
    assert.strictEqual(sentPayload, null, 'disabled event should not dispatch');

    // Should send manual_intervention
    await mock.notify('manual_intervention', {
        session: 'session-2',
        summary: 'Agent asked a question',
        details: 'Do you want to proceed?'
    });
    assert.ok(sentPayload, 'enabled event should dispatch');
    assert.strictEqual(sentPayload.payload.embeds[0].color, COLORS.MANUAL);
    assert.ok(sentPayload.payload.embeds[0].title.includes('Manual Intervention Required'));

    console.log('Notifier self-check: PASS');
})();
