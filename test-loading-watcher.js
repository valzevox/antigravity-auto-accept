/**
 * Test Suite: LoadingWatcher (Live Progress & Subagent Tracker)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { LoadingWatcher } = require('./main_scripts/loading-watcher');

console.log('--- TEST 1: LoadingWatcher initialization & approval recording ---');
const mockGateway = {
    messages: new Map(),
    nextId: 100,
    async createRawMessage(channelId, payload) {
        const id = String(this.nextId++);
        this.messages.set(id, { channelId, ...payload });
        return { id, channel_id: channelId };
    },
    async editMessage(channelId, messageId, payload) {
        if (!this.messages.has(messageId)) return false;
        const msg = this.messages.get(messageId);
        Object.assign(msg, payload);
        return true;
    }
};

const mockRouter = {
    brainDir: path.join(process.env.USERPROFILE || process.env.HOME || '', '.gemini', 'antigravity', 'brain'),
    notifier: {
        gateway: mockGateway,
        config: { webhooks: { discordBot: { channelId: '123456789012345678' } } }
    },
    handler: { connections: new Map() }
};

const watcher = new LoadingWatcher(mockRouter, { log: () => {} });
assert.strictEqual(watcher.activeSessions.size, 0);

watcher.recordApproval('89e10449-test', 'run_command', 'git status');
assert.strictEqual(watcher.recentAccepts.length, 1);
assert.strictEqual(watcher.recentAccepts[0].action, 'run_command');
assert.strictEqual(watcher.recentAccepts[0].sessionId, '89e10449');
console.log('✅ TEST 1 PASSED: Approval recorded correctly');

console.log('\n--- TEST 2: Start tracking session & create live card ---');
(async () => {
    const testSessionId = 'a3bb597f-ef13-4c42-93f5-5080ff7834ff';
    const state = await watcher.trackSession(testSessionId, 'Live Test Session', '123456789012345678');
    
    assert.ok(state);
    assert.strictEqual(state.sessionId, testSessionId);
    assert.strictEqual(watcher.activeSessions.size, 1);
    assert.ok(state.messageId, 'Message ID should be populated');

    const createdMsg = mockGateway.messages.get(state.messageId);
    assert.ok(createdMsg);
    assert.ok(createdMsg.embeds && createdMsg.embeds.length > 0);
    assert.ok(createdMsg.embeds[0].title.includes('Antigravity Đang Xử Lý'));
    console.log('✅ TEST 2 PASSED: Initial Discord live card created');

    console.log('\n--- TEST 3: Parse live transcript & embed building ---');
    const live = watcher.readLiveTranscript(testSessionId);
    assert.ok(live);
    assert.ok(live.lastThought.length > 0);
    assert.ok(live.currentAction.length > 0);
    console.log('Parsed Live Thought:', live.lastThought);
    console.log('Parsed Current Action:', live.currentAction);
    console.log('Parsed Subagents:', live.subagents);

    // Test embed construction
    state.lastThought = live.lastThought;
    state.currentAction = live.currentAction;
    const embed = watcher.buildLoadingEmbed(state);
    assert.ok(embed.fields.length >= 4);
    assert.ok(embed.fields[0].name.includes('Thinking'));
    assert.ok(embed.fields[1].name.includes('Hành động'));
    assert.ok(embed.fields[2].name.includes('Sub-agents'));
    assert.ok(embed.fields[3].name.includes('Tự động phê duyệt'));
    console.log('✅ TEST 3 PASSED: Embed built with all live metrics');

    console.log('\n--- TEST 4: Finish session card update ---');
    await watcher.finishSession(testSessionId, 'Đã xử lý xong toàn bộ yêu cầu của người dùng.');
    assert.strictEqual(watcher.activeSessions.size, 0);

    const updatedMsg = mockGateway.messages.get(state.messageId);
    assert.ok(updatedMsg.embeds[0].title.includes('Tác vụ hoàn tất thành công'));
    assert.ok(updatedMsg.embeds[0].description.includes('Đã xử lý xong toàn bộ yêu cầu'));
    console.log('✅ TEST 4 PASSED: Final summary card rendered cleanly');

    console.log('\n========================================');
    console.log('🎉 ALL 4 LOADING WATCHER TESTS PASSED!');
    console.log('========================================');
})();
