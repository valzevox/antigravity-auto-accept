const assert = require('assert');
const { Notifier, EVENT_META } = require('./main_scripts/notifier');

// Check 1: Disabled by default when no webhooks configured
const emptyNotifier = new Notifier({ discord: '', discordBotToken: '', telegramBotToken: '', telegramChatId: '', customUrl: '' });
assert.strictEqual(emptyNotifier.isEnabled(), false, 'empty config should disable notifier');

// Check 2: Enabled when Discord URL provided
assert.strictEqual(new Notifier({ discord: 'https://discord.com/api/webhooks/x/y', discordBotToken: '' }).isEnabled(), true);
assert.strictEqual(new Notifier({ discord: '', discordBotToken: '', telegramBotToken: '123:ABC', telegramChatId: '99' }).isEnabled(), true);

// Check 3: Case 1 with options builds Telegram answer buttons
const n = new Notifier({ telegramBotToken: '123:ABC', telegramChatId: '99' });
const msg = n.buildMessage(1, {
    session: 'abc-123',
    summary: 'Pick a runtime',
    options: ['Node.js', 'Python', 'Go']
});

assert.strictEqual(msg.meta.key, 'manual_intervention');
assert.strictEqual(msg.embed.color, EVENT_META[1].color);
assert.strictEqual(msg.replyMarkup.inline_keyboard.length, 3, 'one button per option');
assert.strictEqual(msg.replyMarkup.inline_keyboard[0][0].callback_data, 'ans:abc-123:0');
assert.ok(msg.embed.fields.some((f) => f.name === 'Options'), 'embed must list options');

// Check 4: Case 2/3 must NOT carry buttons, and Case 2 preserves long text
const longSummary = 'A'.repeat(2500);
const done = n.buildMessage(2, { session: 'abc', summary: longSummary });
assert.strictEqual(done.replyMarkup, undefined, 'completed task must not expose buttons');
assert.strictEqual(done.embed.description.length, 2500, 'must preserve long task description');
const auto = n.buildMessage(3, { session: 'abc', summary: 'auto' });
assert.strictEqual(auto.replyMarkup, undefined, 'auto-approved must not expose buttons');

// Check 5: Case 1 without options stays read-only
const noOpts = n.buildMessage(1, { session: 'abc', summary: 'free-form question' });
assert.strictEqual(noOpts.replyMarkup, undefined, 'no options means no buttons');

// Check 6: event toggle is honoured
const off = new Notifier({
    discord: 'https://discord.com/api/webhooks/x/y',
    events: { 1: false }
});
assert.strictEqual(off.config.events[1], false);
assert.strictEqual(off.config.events[2], true, 'other events stay on');

console.log('Notifier self-check: PASS');
