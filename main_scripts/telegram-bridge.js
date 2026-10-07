/**
 * Telegram answer receiver via long polling.
 *
 * When the user taps an answer button in Telegram, this receiver picks it up,
 * navigates Antigravity to that conversation, selects the corresponding radio/
 * option, and clicks Submit.
 *
 * ponytail: polls every 2.5s with timeout=15s. Single bot instance only.
 */

const https = require('https');
const url = require('url');

class TelegramAnswerBridge {
    constructor(router, token, log = () => {}) {
        this.router = router;
        this.token = token;
        this.log = log;
        this.offset = 0;
        this.running = false;
        this.activeAbort = null;
    }

    start() {
        if (!this.token || this.running) return;
        this.running = true;
        this.loop();
    }

    stop() {
        this.running = false;
        if (this.activeAbort) {
            try { this.activeAbort.destroy(); } catch (e) {}
        }
    }

    async loop() {
        while (this.running) {
            try {
                await this.poll();
            } catch (e) {
                await new Promise((r) => setTimeout(r, 3000));
            }
        }
    }

    poll() {
        return new Promise((resolve) => {
            const endpoint = `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.offset}&timeout=15&allowed_updates=["callback_query"]`;
            const parsed = url.parse(endpoint);

            const req = https.request(parsed, { method: 'GET', timeout: 20000 }, (res) => {
                let raw = '';
                res.on('data', (c) => { raw += c; });
                res.on('end', async () => {
                    try {
                        const data = JSON.parse(raw);
                        if (data.ok && Array.isArray(data.result)) {
                            for (const upd of data.result) {
                                this.offset = upd.update_id + 1;
                                if (upd.callback_query) {
                                    await this.handleCallback(upd.callback_query);
                                }
                            }
                        }
                    } catch (e) {}
                    resolve();
                });
            });

            this.activeAbort = req;
            req.on('error', () => resolve());
            req.on('timeout', () => { req.destroy(); resolve(); });
            req.end();
        });
    }

    async answerCallback(queryId, text) {
        return new Promise((resolve) => {
            const body = JSON.stringify({ callback_query_id: queryId, text });
            const req = https.request(url.parse(`https://api.telegram.org/bot${this.token}/answerCallbackQuery`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
            }, () => resolve());
            req.on('error', () => resolve());
            req.write(body);
            req.end();
        });
    }

    /**
     * Parse callback data: ans:<session>:<index>
     * Run in-page click for option <index> then Submit.
     */
    async handleCallback(cb) {
        const data = cb.data || '';
        const match = data.match(/^ans:([a-zA-Z0-9_-]+):(\d+)$/);
        if (!match) return;

        const [, sessionId, rawIdx] = match;
        const index = parseInt(rawIdx, 10);

        this.log(`[Bridge] User picked answer ${index + 1} for ${sessionId}`);
        await this.answerCallback(cb.id, `Đã chọn lựa chọn ${index + 1}. Đang áp dụng...`);

        // Use router to evaluate click on the page
        const expr = `(async () => {
            try {
                if (window.__TSR_ROUTER__) {
                    await window.__TSR_ROUTER__.navigate({ to: '/c/${sessionId}' });
                }
                await new Promise((r) => setTimeout(r, 600));

                const radios = Array.from(document.querySelectorAll('[role="radio"], [role="option"], input[type="radio"], label'));
                if (radios[${index}]) {
                    radios[${index}].click();
                }

                await new Promise((r) => setTimeout(r, 200));

                const submit = Array.from(document.querySelectorAll('button, [role="button"]'))
                    .find((b) => (b.textContent || '').trim().toLowerCase() === 'submit');
                if (submit) submit.click();

                return true;
            } catch (e) {
                return false;
            }
        })()`;

        for (const [targetId] of this.router.handler.connections) {
            await this.router.handler._evaluate(targetId, expr);
            break;
        }
    }
}

module.exports = { TelegramAnswerBridge };
