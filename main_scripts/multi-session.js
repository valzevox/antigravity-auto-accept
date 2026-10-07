/**
 * Antigravity Auto Accept - Multi-Session Router
 *
 * Detects conversations that are blocked on a tool/permission request while
 * the user is looking at a different conversation, hops over to approve it,
 * then returns the user to the conversation they were reading.
 *
 * Detection is disk-first: each conversation keeps a transcript at
 *   <brainDir>\<id>\.system_generated\logs\transcript.jsonl
 * A conversation is "pending" when its newest record is a completed
 * PLANNER_RESPONSE that carries tool_calls and has not yet been followed by a
 * result record.
 *
 * ponytail: tail window is 256 KB of a possibly large jsonl. Upgrade to an
 * index/sidecar file if transcripts ever grow past a few MB.
 */

const fs = require('fs');
const path = require('path');
const { Notifier } = require('./notifier');

const TAIL_BYTES = 256 * 1024;
const DEFAULT_INTERVAL = 2000;
const FRESH_MS = 120000;
const COOLDOWN_MS = 60000;
const HOP_SETTLE_MS = 800;
const SETTLE_BACK_MS = 1800;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Runs in the page. Returns true when an approval card is on screen.
const PAGE_HAS_APPROVAL = `(() => {
    try {
        const nodes = Array.from(document.querySelectorAll('button, [role="button"], [role="dialog"], [role="radio"], label'));
        const hit = nodes.some((el) => {
            const t = (el.textContent || '').trim().toLowerCase();
            return t.includes('always allow')
                || t.includes('allow once')
                || t.includes('allow this time')
                || t.includes('allow for this conversation')
                || t === 'submit';
        });
        return !!hit;
    } catch (e) {
        return false;
    }
})()`;

class MultiSessionRouter {
    constructor(handler, options = {}) {
        this.handler = handler;
        this.brainDir = options.brainDir || path.join(
            process.env.USERPROFILE || process.env.HOME || '',
            '.gemini', 'antigravity', 'brain'
        );
        this.interval = options.interval || DEFAULT_INTERVAL;
        this.log = options.log || (() => {});
        this.notifier = options.notifier || new Notifier();
        this.timer = null;
        this.busy = false;
        this.cooldowns = new Map();
        this.seenSteps = new Map();
    }

    start() {
        if (this.timer) return;
        this.timer = setInterval(() => this.tick(), this.interval);
        this.tick();
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    /** Read the last record of a transcript without loading the whole file. */
    tailRecord(file) {
        let fd;
        try {
            const size = fs.statSync(file).size;
            if (size === 0) return null;
            const length = Math.min(size, TAIL_BYTES);
            const buf = Buffer.alloc(length);
            fd = fs.openSync(file, 'r');
            fs.readSync(fd, buf, 0, length, size - length);
            const lines = buf.toString('utf8').split('\n').filter((l) => l.trim());
            if (!lines.length) return null;
            return JSON.parse(lines[lines.length - 1]);
        } catch (e) {
            return null;
        } finally {
            if (fd !== undefined) {
                try { fs.closeSync(fd); } catch (e) {}
            }
        }
    }

    /** @returns {string|null} conversation id awaiting approval, or null */
    findPending() {
        let ids;
        try {
            ids = fs.readdirSync(this.brainDir);
        } catch (e) {
            return null;
        }

        const now = Date.now();
        let best = null;

        for (const id of ids) {
            const file = path.join(this.brainDir, id, '.system_generated', 'logs', 'transcript.jsonl');
            let stat;
            try {
                stat = fs.statSync(file);
            } catch (e) {
                continue;
            }
            if (now - stat.mtimeMs > FRESH_MS) continue;

            const last = this.tailRecord(file);
            if (!last) continue;
            if (last.type !== 'PLANNER_RESPONSE' || last.status !== 'DONE') continue;

            const key = `${id}:${last.step_index}`;

            // Case 1: Agent asks user a question (manual intervention required)
            if (Array.isArray(last.tool_calls) && last.tool_calls.some(tc => tc.name === 'ask_question')) {
                if (!this.seenSteps.has(key)) {
                    this.seenSteps.set(key, now);
                    const qCall = last.tool_calls.find(tc => tc.name === 'ask_question');
                    let promptText = '';
                    let options = [];
                    try {
                        const raw = typeof qCall?.args === 'string' ? JSON.parse(qCall.args) : (qCall?.args || {});
                        const qArr = Array.isArray(raw?.questions) ? raw.questions : (typeof raw?.questions === 'string' ? JSON.parse(raw.questions) : []);
                        if (qArr.length) {
                            promptText = qArr[0].question || '';
                            options = Array.isArray(qArr[0].options) ? qArr[0].options : [];
                        }
                    } catch (e) {
                        promptText = typeof qCall?.args === 'string' ? qCall.args : JSON.stringify(qCall?.args || {});
                    }

                    this.notifier.notify(1, {
                        session: id,
                        summary: promptText || 'Agent requires user decision or input.',
                        details: promptText,
                        options
                    });
                }
                continue;
            }

            // Case 2: Agent completed response with no further tool calls
            if (!Array.isArray(last.tool_calls) || last.tool_calls.length === 0) {
                if (!this.seenSteps.has(key)) {
                    this.seenSteps.set(key, now);
                    let content = (last.content || '').trim();
                    if (!content) {
                        content = 'Agent hoàn tất lượt công việc (Không còn yêu cầu công cụ nào khác).';
                    } else if (content.length > 3000) {
                        const cut = content.slice(0, 3000);
                        const lastNl = cut.lastIndexOf('\n');
                        const safe = lastNl > 2200 ? cut.slice(0, lastNl) : cut;
                        content = `${safe.trim()}\n\n*... (Xem chi tiết đầy đủ trong Antigravity)*`;
                    }
                    this.notifier.notify(2, {
                        session: id,
                        summary: content
                    });
                }
                continue;
            }

            // Case 3: Pending tool approval (can be auto-approved)
            const until = this.cooldowns.get(key);
            if (until && until > now) continue;

            if (!best) best = { id, key };
        }

        return best;
    }

    async currentPath() {
        for (const [targetId] of this.handler.connections) {
            try {
                const res = await this.handler._evaluate(targetId, 'window.__TSR_ROUTER__ && window.__TSR_ROUTER__.state.location.pathname');
                const value = res && res.result && res.result.value;
                if (typeof value === 'string' && value) return value;
            } catch (e) {}
        }
        return null;
    }

    async evalPage(targetId, expression) {
        try {
            const res = await this.handler._evaluate(targetId, expression);
            return res && res.result ? res.result.value : null;
        } catch (e) {
            return null;
        }
    }

    async hop(targetId, from, to) {
        await this.evalPage(targetId, `window.__TSR_ROUTER__.navigate({ to: ${JSON.stringify(to)} })`);
        await sleep(HOP_SETTLE_MS);

        const approved = await this.evalPage(targetId, PAGE_HAS_APPROVAL);
        if (approved) {
            const sid = to.replace('/c/', '');
            this.log(`[MultiSession] Approved pending request in ${sid}`);
            this.notifier.notify(3, {
                session: sid,
                summary: `Tự động phê duyệt quyền (Always Allow) thành công cho phiên \`${sid}\``
            });
            await sleep(SETTLE_BACK_MS);
        }

        // Only restore if the user has not navigated somewhere else meanwhile.
        const now = await this.currentPath();
        if (now && now === to) {
            await this.evalPage(targetId, `window.__TSR_ROUTER__.navigate({ to: ${JSON.stringify(from)} })`);
            this.log(`[MultiSession] Returned to ${from}`);
        }
    }

    async tick() {
        if (this.busy) return;
        this.busy = true;
        try {
            const pending = this.findPending();
            if (!pending) return;

            const from = await this.currentPath();
            if (!from || !from.startsWith('/c/')) return;
            if (from === `/c/${pending.id}`) return;

            let targetId = null;
            for (const [id] of this.handler.connections) {
                targetId = id;
                break;
            }
            if (!targetId) return;

            await this.hop(targetId, from, `/c/${pending.id}`);
            this.cooldowns.set(pending.key, Date.now() + COOLDOWN_MS);
        } catch (e) {
            this.log(`[MultiSession] ${e.message}`);
        } finally {
            this.busy = false;
        }
    }

    /**
     * Dispatch a user prompt into Antigravity input field and send it
     */
    async sendPrompt(text, newSession = false) {
        if (!text || !text.trim()) return { ok: false, error: 'Nội dung prompt trống' };
        let targetId = null;
        for (const [id] of this.handler.connections) {
            targetId = id;
            break;
        }
        if (!targetId) return { ok: false, error: 'Antigravity CDP chưa kết nối' };

        const expr = `(async () => {
            try {
                if (${newSession} && window.__TSR_ROUTER__) {
                    await window.__TSR_ROUTER__.navigate({ to: '/' });
                    await new Promise(r => setTimeout(r, 600));
                }

                // Find input textarea or contenteditable
                const textarea = document.querySelector('textarea, [contenteditable="true"]');
                if (!textarea) return { ok: false, error: 'Không tìm thấy khung chat trong Antigravity' };

                textarea.focus();
                if (textarea.tagName.toLowerCase() === 'textarea') {
                    // Bypass React controlled input cache
                    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                    if (nativeSetter) {
                        nativeSetter.call(textarea, ${JSON.stringify(text)});
                    } else {
                        textarea.value = ${JSON.stringify(text)};
                    }
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    textarea.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    textarea.textContent = ${JSON.stringify(text)};
                    textarea.dispatchEvent(new InputEvent('input', { bubbles: true, data: ${JSON.stringify(text)} }));
                }

                await new Promise(r => setTimeout(r, 300));

                // Find send button
                const buttons = Array.from(document.querySelectorAll('button'));
                const sendBtn = buttons.find(b => {
                    const label = (b.getAttribute('aria-label') || '').toLowerCase();
                    const bText = (b.textContent || '').toLowerCase().trim();
                    return !b.disabled && (
                        label.includes('send') || 
                        label.includes('gửi') || 
                        bText === 'send' || 
                        bText === 'gửi' ||
                        b.querySelector('svg')
                    );
                });

                if (sendBtn) {
                    sendBtn.click();
                    return { ok: true, method: 'button' };
                } else {
                    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                    return { ok: true, method: 'enter' };
                }
            } catch (err) {
                return { ok: false, error: err.message };
            }
        })()`;

        const res = await this.evalPage(targetId, expr);
        return res || { ok: false, error: 'Không thể thực thi script trong webview' };
    }

    /**
     * Emergency stop the running task in Antigravity
     */
    async stopCurrentTask() {
        let targetId = null;
        for (const [id] of this.handler.connections) {
            targetId = id;
            break;
        }
        if (!targetId) return { ok: false, error: 'Antigravity CDP chưa kết nối' };

        const expr = `(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const stopBtn = buttons.find(b => {
                const label = (b.getAttribute('aria-label') || '').toLowerCase();
                const bText = (b.textContent || '').toLowerCase().trim();
                return !b.disabled && (
                    label.includes('stop') || 
                    label.includes('cancel') || 
                    label.includes('dừng') ||
                    bText.includes('stop') || 
                    bText.includes('dừng')
                );
            });
            if (stopBtn) {
                stopBtn.click();
                return { ok: true };
            }
            return { ok: false, error: 'Không tìm thấy nút Stop/Dừng đang hoạt động' };
        })()`;

        const res = await this.evalPage(targetId, expr);
        return res || { ok: false, error: 'Không thể thực thi script' };
    }
}

module.exports = { MultiSessionRouter };
