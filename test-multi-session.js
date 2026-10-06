const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { MultiSessionRouter } = require('./main_scripts/multi-session');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-router-test-'));
const convoId = 'test-convo-123';
const logDir = path.join(tmp, convoId, '.system_generated', 'logs');
fs.mkdirSync(logDir, { recursive: true });

const transcript = path.join(logDir, 'transcript.jsonl');
const step1 = {
    step_index: 1,
    source: 'MODEL',
    type: 'PLANNER_RESPONSE',
    status: 'DONE',
    tool_calls: [{ name: 'run_command', args: { CommandLine: 'dir' } }]
};
fs.writeFileSync(transcript, JSON.stringify(step1) + '\n', 'utf8');

const router = new MultiSessionRouter(null, { brainDir: tmp });

// Check 1: detects pending tool_call in fresh transcript
const pending = router.findPending();
assert.ok(pending, 'should find pending step');
assert.strictEqual(pending.id, convoId);
assert.strictEqual(pending.key, `${convoId}:1`);

// Check 2: cooldown suppresses re-detection
router.cooldowns.set(pending.key, Date.now() + 60000);
const suppressed = router.findPending();
assert.strictEqual(suppressed, null, 'cooldown must suppress duplicate hops');

// Check 3: follow-up user step clears pending status
router.cooldowns.clear();
const step2 = {
    step_index: 2,
    source: 'SYSTEM',
    type: 'GENERIC',
    status: 'DONE',
    content: 'Command output'
};
fs.appendFileSync(transcript, JSON.stringify(step2) + '\n', 'utf8');
const resolved = router.findPending();
assert.strictEqual(resolved, null, 'completed tool call must not be flagged pending');

// Clean up
fs.rmSync(tmp, { recursive: true, force: true });

console.log('MultiSessionRouter self-check: PASS');
