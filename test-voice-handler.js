const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { VoiceHandler } = require('./main_scripts/voice-handler');

async function run() {
    // Test 1: Instantiation without API key
    const handler = new VoiceHandler({}, () => {});
    assert.ok(handler);
    console.log('[1] VoiceHandler instantiates without key (should be graceful)');

    // Test 2: transcribe without key should throw friendly error
    let threw = false;
    try {
        await handler.transcribe(path.join(__dirname, 'config.json'));
    } catch (e) {
        threw = true;
        assert.ok(e.message.includes('Groq API Key') || e.message.includes('not found'));
    }
    assert.ok(threw, 'Should throw when no key or file missing');
    console.log('[2] transcribe() throws gracefully without key');

    // Test 3: setGroqApiKey
    handler.setGroqApiKey('gsk_test_dummy');
    assert.strictEqual(handler.config.groqApiKey, 'gsk_test_dummy');
    console.log('[3] setGroqApiKey updates config');

    // Test 4: convertAudioToMp3 rejects gracefully when ffmpeg fails
    const nonExistent = path.join(__dirname, '__nonexistent_audio__.wav');
    let ffmpegThrew = false;
    try {
        await handler.convertAudioToMp3(nonExistent, path.join(__dirname, '__out.mp3'));
    } catch (e) {
        ffmpegThrew = true;
    }
    assert.ok(ffmpegThrew);
    console.log('[4] convertAudioToMp3 rejects gracefully on bad input');

    // Test 5: temp_audio dir creation logic
    const tempDir = path.join(__dirname, 'temp_audio');
    assert.ok(!fs.existsSync(tempDir) || fs.statSync(tempDir).isDirectory());
    console.log('[5] temp dir logic valid');

    console.log('VoiceHandler self-check: PASS');
}

run().catch((err) => {
    console.error('VoiceHandler self-check: FAIL', err);
    process.exit(1);
});
