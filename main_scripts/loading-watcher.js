/**
 * Antigravity Auto Accept - Live Loading State & Activity Watcher
 * 
 * Features:
 * - Real-time progress card in Discord for active sessions
 * - Live agent thinking stream
 * - Active sub-agents counter and roles
 * - Recent auto-approvals feed
 * - Dynamic Discord message editing every 2.5s
 */

const fs = require('fs');
const path = require('path');
const { I18nManager } = require('./i18n');

const PROGRESS_FRAMES = [
    '▰▱▱▱▱▱▱▱',
    '▰▰▱▱▱▱▱▱',
    '▰▰▰▱▱▱▱▱',
    '▰▰▰▰▱▱▱▱',
    '▰▰▰▰▰▱▱▱',
    '▰▰▰▰▰▰▱▱',
    '▰▰▰▰▰▰▰▱',
    '▰▰▰▰▰▰▰▰',
];

class LoadingWatcher {
    constructor(router, options = {}) {
        this.router = router;
        this.brainDir = router.brainDir || path.join(
            process.env.USERPROFILE || process.env.HOME || '',
            '.gemini', 'antigravity', 'brain'
        );
        this.log = options.log || console.log;
        
        // Active monitored sessions: sessionId -> state
        this.activeSessions = new Map();
        
        // Anti-spam deduplication: Map of sessionId -> lastFinishedStepIndex
        this.finishedSteps = new Map();

        // Recent auto-approvals log across all sessions (max 5)
        this.recentAccepts = [];
        
        this.timer = null;
        this.frameIndex = 0;
    }

    start() {
        if (this.timer) return;
        this.timer = setInterval(() => this.tick(), 2500);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    /**
     * Record an auto-accepted action for display in the live dashboard
     */
    recordApproval(sessionId, actionName, details = '') {
        const item = {
            sessionId: (sessionId || '').slice(0, 8),
            action: actionName || 'Always Allow',
            details: (details || '').slice(0, 60),
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        this.recentAccepts.unshift(item);
        if (this.recentAccepts.length > 5) this.recentAccepts.pop();
    }

    /**
     * Update active session status when retry limit is reached
     */
    pauseOrWarn(sessionId, warningSummary) {
        const state = this.activeSessions.get(sessionId) || Array.from(this.activeSessions.values())[0];
        if (state) {
            state.currentAction = warningSummary;
            state.lastThought = I18nManager.getLanguage() === 'en'
                ? 'Retry limit reached. Waiting for model response...'
                : 'Đã đạt giới hạn Retry. Đang chờ model phản hồi...';
        }
    }

    /**
     * Start tracking a session and post the initial live loading card
     */
    async trackSession(sessionId, sessionTitle = '', channelId = null) {
        if (!sessionId) return;
        const gateway = this.router.notifier?.gateway;
        const targetChannel = channelId || this.router.notifier?.config?.webhooks?.discordBot?.channelId;
        if (!gateway || !targetChannel) return;

        // If already tracking this session, update its start time or keep tracking
        if (this.activeSessions.has(sessionId)) {
            const current = this.activeSessions.get(sessionId);
            current.sessionTitle = sessionTitle || current.sessionTitle;
            return current;
        }

        // A new card for this session means a genuinely new turn, so drop the old
        // dedup marker from the previous turn.
        this.finishedSteps.delete(sessionId);

        const state = {
            sessionId,
            sessionTitle: sessionTitle || `Session ${sessionId.slice(0, 8)}`,
            channelId: targetChannel,
            messageId: null,
            startTime: Date.now(),
            lastThought: 'Khởi động phiên làm việc...',
            currentAction: 'Đang chuẩn bị ngữ cảnh...',
            subagents: [],
            isCompleted: false,
            lastStepIndex: 0
        };

        this.activeSessions.set(sessionId, state);

        try {
            const embed = this.buildLoadingEmbed(state);
            const msg = await gateway.createRawMessage(targetChannel, { embeds: [embed] });
            if (msg && msg.id) {
                state.messageId = msg.id;
            }
        } catch (e) {
            this.log(`[LoadingWatcher] Failed to send initial card: ${e.message}`);
        }

        return state;
    }

    /**
     * Mark a session as completed and update the live card into a final summary card
     */
    async finishSession(sessionId, summary = '', isError = false) {
        const state = this.activeSessions.get(sessionId);
        if (!state) {
            // Already finished (duplicate call from a second detection path): remember the
            // step so no new card can be created for the same finished turn.
            this.finishedSteps.set(sessionId, this.finishedSteps.get(sessionId) ?? 0);
            return;
        }

        // Remember the finished step BEFORE dropping the session, otherwise the next
        // 2.5s tick picks the same transcript off disk and re-creates a duplicate card.
        const live = this.readLiveTranscript(sessionId);
        const step = live?.lastStepIndex || state.lastStepIndex || 0;
        this.finishedSteps.set(sessionId, step);
        const gateway = this.router.notifier?.gateway;
        if (gateway && state.messageId && state.channelId) {
            const t = I18nManager.t();
            const w = t.watcher;
            const elapsed = Math.round((Date.now() - state.startTime) / 1000);
            const isQuota = isError && /quota|rate limit|resource_exhausted|429|token/i.test(summary);
            const title = isError
                ? (isQuota ? w.finishQuotaTitle : w.finishErrorTitle)
                : w.finishSuccessTitle;
            const embed = {
                title,
                description: summary ? `**${t.fields.prompt}:**\n${summary.slice(0, 1500)}` : (isError ? w.finishDescError : w.finishDescSuccess),
                color: isError ? 0xED4245 : 0x57F287,
                fields: [
                    { name: w.sessionField, value: `\`${state.sessionId.slice(0, 8)}\` (${state.sessionTitle})`, inline: true },
                    { name: w.elapsedField, value: `${elapsed} ${w.seconds}`, inline: true }
                ],
                footer: { text: `Antigravity • ${new Date().toLocaleTimeString(I18nManager.getLanguage() === 'vi' ? 'vi-VN' : 'en-US')}` }
            };

            try {
                await gateway.editMessage(state.channelId, state.messageId, { embeds: [embed] });
            } catch (e) {}
        }

        this.activeSessions.delete(sessionId);
    }

    /**
     * Find most recently active session on disk if CDP is not focused on it
     * Skips sessions that are already completed (last record is PLANNER_RESPONSE with status DONE)
     */
    findRecentlyActiveSession() {
        try {
            const ids = fs.readdirSync(this.brainDir);
            let latest = null;
            let latestMtime = 0;
            const now = Date.now();

            for (const id of ids) {
                const file = path.join(this.brainDir, id, '.system_generated', 'logs', 'transcript.jsonl');
                if (!fs.existsSync(file)) continue;
                try {
                    const mtime = fs.statSync(file).mtimeMs;
                    if (now - mtime >= 15000) continue;

                    // Check if session is actually still generating - read last record
                    const lastRecord = this.getLastRecord(file);
                    if (lastRecord && lastRecord.type === 'PLANNER_RESPONSE' && lastRecord.status === 'DONE') {
                        // Session is completed, not active - skip it
                        continue;
                    }

                    if (mtime > latestMtime) {
                        latestMtime = mtime;
                        latest = { id, mtimeMs: mtime };
                    }
                } catch (e) {}
            }
            return latest;
        } catch (e) {
            return null;
        }
    }

    /**
     * Get the last valid record from transcript file
     */
    getLastRecord(file) {
        let fd;
        try {
            const size = fs.statSync(file).size;
            if (size === 0) return null;
            const length = Math.min(size, 8 * 1024); // read last 8KB for quick check
            const buf = Buffer.alloc(length);
            fd = fs.openSync(file, 'r');
            fs.readSync(fd, buf, 0, length, size - length);
            const lines = buf.toString('utf8').split('\n').filter(l => l.trim());
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

    /**
     * Parse recent steps from transcript.jsonl
     */
    readLiveTranscript(sessionId) {
        const file = path.join(this.brainDir, sessionId, '.system_generated', 'logs', 'transcript.jsonl');
        if (!fs.existsSync(file)) return null;

        let content = '';
        try {
            const stat = fs.statSync(file);
            const readBytes = Math.min(stat.size, 96 * 1024); // read last 96KB
            const fd = fs.openSync(file, 'r');
            const buf = Buffer.alloc(readBytes);
            fs.readSync(fd, buf, 0, readBytes, stat.size - readBytes);
            fs.closeSync(fd);
            content = buf.toString('utf8');
        } catch (e) {
            return null;
        }

        const lines = content.split('\n').filter(l => l.trim());
        let lastThought = '';
        let currentAction = '';
        let activeSubagents = [];
        let lastStepIndex = 0;
        let lastResponseText = '';
        let lastError = null;

        let sawSuccessfulTurn = false;
        for (let i = lines.length - 1; i >= 0; i--) {
            try {
                const record = JSON.parse(lines[i]);
                if (!lastStepIndex && record.step_index) {
                    lastStepIndex = record.step_index;
                }

                if (record.type === 'PLANNER_RESPONSE' && (record.status === 'DONE' || !record.status) && (record.content || (record.tool_calls && record.tool_calls.length > 0))) {
                    sawSuccessfulTurn = true;
                }

                // Check error or quota failure: only from the most recent tail and not succeeded by a successful turn
                if (!lastError && !sawSuccessfulTurn && (record.type === 'ERROR_MESSAGE' || record.status === 'ERROR' || record.error)) {
                    const errStr = typeof record.error === 'string' ? record.error : (typeof record.error === 'object' ? JSON.stringify(record.error) : '');
                    const contentStr = typeof record.content === 'string' ? record.content : '';
                    lastError = (errStr || contentStr).trim();
                }

                // Check final/recent text content
                if (!lastResponseText && record.type === 'PLANNER_RESPONSE' && record.content && (!record.tool_calls || record.tool_calls.length === 0)) {
                    lastResponseText = record.content;
                }

                // Check tool calls
                if (Array.isArray(record.tool_calls) && record.tool_calls.length > 0) {
                    const tc = record.tool_calls[record.tool_calls.length - 1];
                    if (!currentAction) {
                        const name = tc.name || 'tool';
                        const summary = tc.args?.toolSummary || tc.args?.toolAction || '';
                        currentAction = summary ? `${name}: ${summary}` : name;
                    }

                    // Check sub-agents invocation
                    record.tool_calls.forEach(call => {
                        if (call.name === 'invoke_subagent' && Array.isArray(call.args?.Subagents)) {
                            call.args.Subagents.forEach(sub => {
                                const role = sub.Role || sub.TypeName || 'Sub-agent';
                                if (!activeSubagents.includes(role)) activeSubagents.push(role);
                            });
                        }
                    });
                }

                // Check thinking trace
                if (!lastThought && record.thinking) {
                    const thoughtLines = record.thinking.split('\n')
                        .map(l => l.trim())
                        .filter(l => l && !l.startsWith('CRITICAL') && !l.startsWith('...') && l.length > 5);
                    if (thoughtLines.length > 0) {
                        lastThought = thoughtLines[thoughtLines.length - 1].replace(/^m:\s*/i, '');
                    }
                }

                if (lastThought && currentAction && lastResponseText) break;
            } catch (e) {}
        }

        return {
            lastThought: lastThought || 'Đang phân tích và xử lý mã nguồn...',
            currentAction: currentAction || 'Đang thực thi tác vụ...',
            subagents: activeSubagents,
            lastStepIndex,
            lastResponseText,
            lastError
        };
    }

    /**
     * Build Discord Embed for live loading state
     */
    buildLoadingEmbed(state) {
        const t = I18nManager.t();
        const w = t.watcher;
        const frame = PROGRESS_FRAMES[this.frameIndex % PROGRESS_FRAMES.length];
        const elapsed = Math.round((Date.now() - state.startTime) / 1000);

        const subagentText = state.subagents && state.subagents.length > 0
            ? `🟢 **${state.subagents.length} ${w.subagentActive}**\n> ${state.subagents.map(s => `• ${s}`).join('\n> ')}`
            : `⚪ *${w.subagentNone}*`;

        const acceptsText = this.recentAccepts && this.recentAccepts.length > 0
            ? this.recentAccepts.slice(0, 3).map(a => `> ✅ \`[${a.time}]\` ${a.action} ${a.details ? `(${a.details})` : ''}`).join('\n')
            : `⚪ *${w.acceptsNone}*`;

        return {
            title: `${w.runningTitle}: ${state.sessionTitle}`,
            description: `\`${frame}\` **${w.activeStatus} (${elapsed}s)**`,
            color: 0x5865F2,
            fields: [
                {
                    name: w.thinkingField,
                    value: `> "${(state.lastThought || '...').slice(0, 250)}"`
                },
                {
                    name: w.actionField,
                    value: `\`${(state.currentAction || '...').slice(0, 100)}\``
                },
                {
                    name: w.subagentField,
                    value: subagentText
                },
                {
                    name: w.acceptsField,
                    value: acceptsText
                }
            ],
            footer: {
                text: `${t.fields.session}: ${state.sessionId.slice(0, 8)} • ${w.footerText}`
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Heartbeat tick to poll active sessions and update Discord messages
     */
    async tick() {
        this.frameIndex++;
        const gateway = this.router.notifier?.gateway;
        if (!gateway) return;

        // 1. Auto-detect active running session if none is currently tracked
        if (this.activeSessions.size === 0) {
            try {
                let isGenerating = false;
                let activeId = null;
                let activeTitle = null;

                // Priority A: Check CDP for Cancel/Stop button
                for (const [targetId] of this.router.handler.connections) {
                    const status = await this.router.evalPage(targetId, `(() => {
                        const hasCancel = !!document.querySelector('[data-tooltip-id*="cancel-tooltip"], button[aria-label*="Cancel"], button[aria-label*="Stop"]');
                        const pathname = window.location.pathname || '';
                        const id = pathname.replace('/c/', '').split('?')[0];
                        return { hasCancel, id, title: document.title };
                    })()`);
                    if (status && status.hasCancel && status.id) {
                        isGenerating = true;
                        activeId = status.id;
                        activeTitle = status.title;
                        break;
                    }
                }

                // Priority B: Fallback check on disk (transcript modified in last 5s)
                if (!isGenerating) {
                    const recent = this.findRecentlyActiveSession();
                    if (recent) {
                        isGenerating = true;
                        activeId = recent.id;
                    }
                }

                if (isGenerating && activeId) {
                    if (!activeTitle) {
                        const cur = await this.router.getSessions();
                        activeTitle = cur?.sessions?.find(s => s.id === activeId)?.title || cur?.currentTitle || `Session ${activeId.slice(0, 8)}`;
                    }
                    await this.trackSession(activeId, activeTitle);
                }
            } catch (e) {}
        }

        // 2. Update and lifecycle-manage all tracked active sessions
        for (const [sessionId, state] of this.activeSessions.entries()) {
            if (state.isCompleted) continue;

            // Retry initial message if previous call failed
            if (!state.messageId && state.channelId) {
                try {
                    const embed = this.buildLoadingEmbed(state);
                    const msg = await gateway.createRawMessage(state.channelId, { embeds: [embed] });
                    if (msg && msg.id) {
                        state.messageId = msg.id;
                    }
                } catch (e) {}
            }

            const live = this.readLiveTranscript(sessionId);
            if (live) {
                state.lastThought = live.lastThought;
                state.currentAction = live.currentAction;
                if (live.subagents.length > 0) state.subagents = live.subagents;
                state.lastStepIndex = live.lastStepIndex;
            }

            // Check if session has finished generating
            let stillGenerating = false;
            for (const [targetId] of this.router.handler.connections) {
                const isGen = await this.router.evalPage(targetId, `(() => {
                    const hasCancel = !!document.querySelector('[data-tooltip-id*="cancel-tooltip"], button[aria-label*="Cancel"], button[aria-label*="Stop"]');
                    const pathname = window.location.pathname || '';
                    const id = pathname.replace('/c/', '').split('?')[0];
                    return hasCancel && (id === ${JSON.stringify(sessionId)} || !id);
                })()`);
                if (isGen) {
                    stillGenerating = true;
                    break;
                }
            }

            // Anti-spam: skip if session already finished (dedup via finishedSteps)
            if (this.finishedSteps.has(sessionId) && this.finishedSteps.get(sessionId) === live.lastStepIndex) {
                if (state.messageId && state.channelId) {
                    const embed = this.buildLoadingEmbed(state);
                    try {
                        await gateway.editMessage(state.channelId, state.messageId, { embeds: [embed] });
                    } catch (e) {
                        this.log(`[LoadingWatcher] Failed to edit message: ${e.message}`);
                    }
                }
                continue;
            }

            if (!stillGenerating) {
                const transFile = path.join(this.brainDir, sessionId, '.system_generated', 'logs', 'transcript.jsonl');
                if (fs.existsSync(transFile)) {
                    try {
                        const mtime = fs.statSync(transFile).mtimeMs;
                        if (Date.now() - mtime < 4000) {
                            stillGenerating = true;
                        }
                    } catch (e) {}
                }
            }

            // Turn completed or aborted: auto-finish session card
            if (!stillGenerating && (Date.now() - state.startTime > 3000)) {
                const hasError = Boolean(live?.lastError);
                const rawErr = (live?.lastError || '').toLowerCase();
                const isQuota = hasError && (
                    rawErr.includes('resource_exhausted') ||
                    rawErr.includes('quota') ||
                    rawErr.includes('rate limit') ||
                    rawErr.includes('429') ||
                    rawErr.includes('too many requests') ||
                    rawErr.includes('out of tokens') ||
                    rawErr.includes('usage limit')
                );

                // If non-quota error with retry capability, keep card alive and show retry status
                if (hasError && !isQuota) {
                    let isRetrying = false;
                    for (const [targetId] of this.router.handler.connections) {
                        try {
                            const retryStatus = await this.router.evalPage(targetId, `(() => {
                                const st = window.__autoAcceptGetStats ? window.__autoAcceptGetStats() : {};
                                const hasRetryBtn = Array.from(document.querySelectorAll('button, [role="button"], a.monaco-button')).some(b => {
                                    if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
                                    const cls = String(b.className || '');
                                    if (cls.includes('inline-pill') || cls.includes('tab') || cls.includes('breadcrumb') || cls.includes('monaco-list')) return false;
                                    const t = (b.textContent || b.innerText || '').trim();
                                    const aria = (b.getAttribute('aria-label') || '').trim();
                                    const title = (b.getAttribute('title') || '').trim();
                                    const isRetry = /^(retry|try again|thử lại)(\\b|$)/i.test(t) ||
                                                    /^(retry|try again)(\\b|$)/i.test(aria) ||
                                                    /^(retry|try again)(\\b|$)/i.test(title) ||
                                                    /continue generating/i.test(t);
                                    if (!isRetry || /\\b(cancel|reject|deny|stop|close|hủy|bỏ qua)\\b/i.test(t)) return false;
                                    const rect = b.getBoundingClientRect();
                                    return rect.width > 0 && rect.height > 0;
                                });
                                return {
                                    hasRetryBtn,
                                    errorRetryCount: st.errorRetryCount || 0,
                                    maxErrorRetries: st.maxErrorRetries || 5,
                                    exceeded: Boolean(st.errorRetryExceeded)
                                };
                            })()`);

                            if (retryStatus && retryStatus.hasRetryBtn && !retryStatus.exceeded) {
                                isRetrying = true;
                                const isEn = I18nManager.getLanguage() === 'en';
                                state.currentAction = isEn
                                    ? `Retrying model (${retryStatus.errorRetryCount}/${retryStatus.maxErrorRetries})...`
                                    : `Đang thử lại (Retry ${retryStatus.errorRetryCount}/${retryStatus.maxErrorRetries})...`;
                                state.lastThought = isEn
                                    ? 'Agent hit error; auto-retry is attempting recovery...'
                                    : 'Agent gặp sự cố; đang tự động thử lại (Retry)...';
                                break;
                            }
                        } catch (e) {}
                    }

                    if (isRetrying) {
                        if (state.messageId && state.channelId) {
                            const embed = this.buildLoadingEmbed(state);
                            try {
                                await gateway.editMessage(state.channelId, state.messageId, { embeds: [embed] });
                            } catch (e) {}
                        }
                        continue;
                    }
                }

                let summary = live?.lastResponseText || '';
                const isEn = I18nManager.getLanguage() === 'en';
                if (hasError) {
                    if (isQuota) {
                        summary = isEn
                            ? `Antigravity stopped due to quota limit / API token ceiling:\n\`${live.lastError}\`\n\n*Please verify your account or wait for quota reset.*`
                            : `Antigravity đã dừng do hết quota / đạt giới hạn token API:\n\`${live.lastError}\`\n\n*Vui lòng kiểm tra lại tài khoản hoặc đợi hồi quota.*`;
                    } else {
                        summary = isEn
                            ? `Antigravity encountered an error and stopped:\n\`${live.lastError}\``
                            : `Antigravity gặp lỗi thực thi và đã dừng lại:\n\`${live.lastError}\``;
                    }
                }

                await this.finishSession(sessionId, summary, hasError);
                continue;
            }

            // Update live card embed
            if (state.messageId && state.channelId) {
                const embed = this.buildLoadingEmbed(state);
                try {
                    await gateway.editMessage(state.channelId, state.messageId, { embeds: [embed] });
                } catch (e) {
                    this.log(`[LoadingWatcher] Failed to edit message: ${e.message}`);
                }
            }
        }
    }
}

module.exports = { LoadingWatcher };
