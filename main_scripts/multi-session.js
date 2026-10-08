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
const DONE_DEDUP_MS = 600000; // 10 minutes — suppress duplicate completion alerts

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Cheap fingerprint for a completion summary so a hop-back to a finished
 * session cannot re-fire the same "Task completed" alert.
 */
function hashContent(text) {
    let h = 2166136261;
    const s = String(text || '');
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

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
        this.quotaAlerted = new Map();
        // Cross-session hop deduplication: sessionId -> { stepId, contentHash, timestamp }
        this.notifiedDone = new Map();
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

            const stepId = last.step_index !== undefined ? last.step_index : (last.created_at || stat.mtimeMs);
            const key = `${id}:${stepId}`;

            // Case 0: Agent encountered an Error or Quota Exhaustion!
            const isErrorMessageType = last.type === 'ERROR_MESSAGE' || last.status === 'ERROR' || Boolean(last.error);
            const contentText = typeof last.content === 'string' ? last.content : '';
            const errorText = typeof last.error === 'string' ? last.error : (typeof last.error === 'object' ? JSON.stringify(last.error) : '');
            const combinedText = `${errorText} ${contentText}`.trim();
            const lowerCombined = combinedText.toLowerCase();

            // ponytail: quota is only meaningful on an error record; a normal reply that
            // merely mentions "quota" must not raise an alert.
            const isQuotaExhausted = isErrorMessageType && (
                                     lowerCombined.includes('resource_exhausted') ||
                                     lowerCombined.includes('check quota') ||
                                     lowerCombined.includes('rate limit') ||
                                     lowerCombined.includes('code 429') ||
                                     lowerCombined.includes('too many requests') ||
                                     lowerCombined.includes('out of tokens') ||
                                     lowerCombined.includes('usage limit') ||
                                     lowerCombined.includes('insufficient quota') ||
                                     lowerCombined.includes('capacity reached'));

            const isExecutionError = isErrorMessageType;

            if (isQuotaExhausted) {
                const lastAlert = this.quotaAlerted.get(id) || 0;
                if (!this.seenSteps.has(key) && (now - lastAlert) > 60000) {
                    this.seenSteps.set(key, now);
                    this.quotaAlerted.set(id, now);
                    const isEn = I18nManager.getLanguage() === 'en';
                    const rawErr = (errorText || contentText || '').trim();
                    const summary = isEn
                        ? `**Token quota exhausted — Antigravity paused mid-task.**\n\nYour account has reached the provider usage limit. Please check your account or wait for quota reset.`
                        : `**Hết hạn mức dùng token — Antigravity đã dừng giữa chừng.**\n\nTài khoản đã chạm trần giới hạn của nhà cung cấp, tác vụ chưa xong. Hãy kiểm tra lại tài khoản hoặc chờ mức dùng được hồi lại rồi chạy tiếp.`;
                    const details = rawErr ? (isEn ? `Error details:\n\`\`\`\n${rawErr}\n\`\`\`` : `Chi tiết lỗi từ hệ thống:\n\`\`\`\n${rawErr}\n\`\`\``) : '';

                    this.notifier.notify(4, {
                        session: id,
                        summary,
                        details,
                        isQuota: true
                    });

                    if (this.loadingWatcher) {
                        this.loadingWatcher.finishSession(id, summary, true);
                    }
                }
                continue;
            }

            if (last.type !== 'PLANNER_RESPONSE' || last.status !== 'DONE') continue;

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
                        summary: promptText || 'Agent đang chờ bạn đưa ra quyết định.',
                        details: promptText,
                        options
                    });
                }
                continue;
            }

            // Case 2: Agent completed response with no further tool calls
            if (!Array.isArray(last.tool_calls) || last.tool_calls.length === 0) {
                const doneContent = (last.content || '').trim();
                const doneHash = hashContent(doneContent);

                // Hopping between sessions re-touches the transcript file.
                // Dedup permanently on (stepId || contentHash), so returning to an already
                // completed turn never re-fires completion notifications or ends loading cards again.
                const prior = this.notifiedDone.get(id);
                const isRepeat = prior && (
                    (prior.contentHash === doneHash) ||
                    (prior.stepId === stepId)
                );

                if (!this.seenSteps.has(key) && !isRepeat) {
                    this.seenSteps.set(key, now);
                    this.notifiedDone.set(id, { stepId, contentHash: doneHash, timestamp: now });
                    let content = doneContent;
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
                    if (this.loadingWatcher) {
                        this.loadingWatcher.finishSession(id, content, false);
                    }
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
                summary: `Tự động phê duyệt quyền thành công cho phiên \`${sid}\``
            });
            if (this.loadingWatcher) {
                this.loadingWatcher.recordApproval(sid, 'Luôn cho phép', 'Cấp quyền công cụ');
            }
            await sleep(SETTLE_BACK_MS);
        }

        // Only restore if the user has not navigated somewhere else meanwhile.
        const now = await this.currentPath();
        if (now && now === to) {
            await this.evalPage(targetId, `window.__TSR_ROUTER__.navigate({ to: ${JSON.stringify(from)} })`);
            this.log(`[MultiSession] Returned to ${from}`);
        }
    }

    async checkRetryWarnings() {
        for (const [targetId] of this.handler.connections) {
            try {
                const stats = await this.evalPage(targetId, `(() => {
                    if (!window.__autoAcceptGetStats) return null;
                    const st = window.__autoAcceptGetStats();
                    if (st.needsRetryWarning) {
                        if (window.__autoAcceptFreeState) {
                            window.__autoAcceptFreeState.retryWarningSent = true;
                            window.__autoAcceptFreeState.needsRetryWarning = false;
                        }
                        return st;
                    }
                    return null;
                })()`);

                if (stats) {
                    const from = await this.currentPath();
                    const sid = (from && from.startsWith('/c/')) ? from.replace('/c/', '') : 'active';
                    const isEn = I18nManager.getLanguage() === 'en';
                    const maxR = stats.maxErrorRetries || 5;
                    const countR = stats.errorRetryCount || maxR;
                    const summary = isEn
                        ? `**Model did not respond after ${countR}/${maxR} retries.**\n\nTask has been paused. Waiting for model response or manual retry intervention.`
                        : `**Đã thử bấm Retry ${countR}/${maxR} lần nhưng model vẫn không phản hồi.**\n\nTác vụ tạm thời dừng lại để đợi model trả lời hoặc can thiệp thủ công.`;

                    this.notifier.notify(4, {
                        session: sid,
                        summary,
                        isRetryWarning: true
                    });
                    this.log(`[MultiSession] Retry warning notified: ${countR}/${maxR} retries`);
                    if (this.loadingWatcher) {
                        this.loadingWatcher.pauseOrWarn(sid, summary);
                    }
                }
            } catch (e) {}
        }
    }

    async tick() {
        if (this.busy) return;
        this.busy = true;
        try {
            await this.checkRetryWarnings();

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
     * Get list of open sessions from Antigravity sidebar
     */
    async getSessions() {
        let targetId = null;
        for (const [id] of this.handler.connections) {
            targetId = id;
            break;
        }
        if (!targetId) return { currentId: null, currentTitle: null, sessions: [] };

        const expr = `(() => {
            const pathname = window.location.pathname;
            const currentId = pathname.replace('/c/', '').split('?')[0];

            const links = Array.from(document.querySelectorAll('a[href*="/c/"]')).map(a => {
                const href = a.getAttribute('href') || '';
                const id = href.replace('/c/', '').split('?')[0];
                let title = a.getAttribute('aria-label') ||
                            a.querySelector('span, div')?.textContent?.trim() ||
                            a.textContent?.trim() ||
                            id.slice(0, 8);
                title = title.replace(/\\s+/g, ' ').trim();
                return { id, title, active: id === currentId };
            });

            const unique = [];
            const seen = new Set();
            for (const item of links) {
                if (item.id && !seen.has(item.id)) {
                    seen.add(item.id);
                    unique.push(item);
                }
            }

            return {
                currentId,
                currentTitle: unique.find(s => s.active)?.title || document.title,
                sessions: unique
            };
        })()`;

        const res = await this.evalPage(targetId, expr);
        return res || { currentId: null, currentTitle: null, sessions: [] };
    }

    /**
     * Switch Antigravity view to a specific session by ID or name
     */
    async switchSession(query) {
        if (!query || !query.trim()) return { ok: false, error: 'Vui lòng cung cấp ID hoặc tên session' };
        const q = query.trim().toLowerCase();

        let targetId = null;
        for (const [id] of this.handler.connections) {
            targetId = id;
            break;
        }
        if (!targetId) return { ok: false, error: 'Antigravity CDP chưa kết nối' };

        const { sessions } = await this.getSessions();
        if (!sessions || sessions.length === 0) {
            return { ok: false, error: 'Không tìm thấy danh sách session nào trong Antigravity' };
        }

        const match = sessions.find(s => 
            s.id.toLowerCase() === q ||
            s.id.toLowerCase().startsWith(q) ||
            s.title.toLowerCase().includes(q)
        );

        if (!match) {
            return {
                ok: false,
                error: `Không tìm thấy session nào khớp với "${query}". Dùng \`!sessions\` để xem danh sách.`
            };
        }

        const navExpr = `(() => {
            if (window.__TSR_ROUTER__) {
                window.__TSR_ROUTER__.navigate({ to: '/c/' + ${JSON.stringify(match.id)} });
                return true;
            }
            return false;
        })()`;

        await this.evalPage(targetId, navExpr);
        await sleep(500);

        return { ok: true, session: match };
    }

    /**
     * Dispatch a user prompt into Antigravity input field and send it using native CDP events
     */
    async sendPrompt(text, newSession = false) {
        if (!text || !text.trim()) return { ok: false, error: 'Nội dung prompt trống' };
        let targetId = null;
        for (const [id] of this.handler.connections) {
            targetId = id;
            break;
        }
        if (!targetId) return { ok: false, error: 'Antigravity CDP chưa kết nối' };

        try {
            if (newSession) {
                await this.evalPage(targetId, `window.__TSR_ROUTER__ && window.__TSR_ROUTER__.navigate({ to: '/' })`);
                await sleep(800);
            }

            // Step 1: Focus editor and clean existing content
            await this.evalPage(targetId, `(() => {
                const editor = document.querySelector('[contenteditable="true"]');
                if (editor) {
                    editor.focus();
                    const sel = window.getSelection();
                    sel.selectAllChildren(editor);
                }
            })()`);

            // Step 2: Clear with real Backspace
            try {
                await this.handler._pressKey(targetId, 'Backspace');
            } catch (e) {}

            // Step 3: Insert text via CDP native Input.insertText
            let insertedViaCdp = false;
            try {
                await this.handler._insertText(targetId, text);
                insertedViaCdp = true;
            } catch (e) {
                this.log(`[SendPrompt] _insertText failed: ${e.message}`);
            }

            // Step 4: Ensure DOM has the text and fire input events
            await this.evalPage(targetId, `(() => {
                const editor = document.querySelector('[contenteditable="true"]');
                if (editor) {
                    if (!editor.textContent || editor.textContent.trim().length === 0) {
                        editor.textContent = ${JSON.stringify(text)};
                    }
                    editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: ${JSON.stringify(text)} }));
                    editor.dispatchEvent(new Event('change', { bubbles: true }));
                }
            })()`);

            await sleep(250);

            // Step 5: Click send button inside chat card
            const clickRes = await this.evalPage(targetId, `(() => {
                const editor = document.querySelector('[contenteditable="true"]');
                if (!editor) return { clicked: false, error: 'No editor' };

                const card = editor.closest('.bg-card-border') || editor.parentElement?.parentElement;
                if (!card) return { clicked: false, error: 'No card container' };

                // Look for send button in card
                const sendBtn = Array.from(card.querySelectorAll('button')).find(b => {
                    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                    const tooltip = (b.getAttribute('data-tooltip-id') || '').toLowerCase();
                    return !b.disabled && (
                        aria.includes('send') ||
                        tooltip.includes('input-send-button') ||
                        aria.includes('gửi')
                    );
                });

                if (sendBtn) {
                    sendBtn.click();
                    return { clicked: true, method: 'button-click' };
                }
                return { clicked: false };
            })()`);

            // Step 6: Dispatch native CDP Enter key to guarantee submission
            await this.handler._pressKey(targetId, 'Enter');

            // Get session info for response
            const info = await this.getSessions();
            const activeSession = info.sessions.find(s => s.active) || { id: info.currentId, title: info.currentTitle };

            if (this.loadingWatcher && activeSession.id) {
                // Trigger live loading progress card immediately on Discord
                this.loadingWatcher.trackSession(activeSession.id, activeSession.title);
            }

            return {
                ok: true,
                session: activeSession,
                method: clickRes && clickRes.clicked ? clickRes.method : 'cdp-enter'
            };
        } catch (err) {
            return { ok: false, error: err.message };
        }
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
                const tooltip = (b.getAttribute('data-tooltip-id') || '').toLowerCase();
                return !b.disabled && (
                    label.includes('stop') || 
                    label.includes('cancel') || 
                    label.includes('dừng') ||
                    bText.includes('stop') || 
                    bText.includes('dừng') ||
                    tooltip.includes('cancel-tooltip')
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
