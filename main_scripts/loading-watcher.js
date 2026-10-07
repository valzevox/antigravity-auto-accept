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
        if (!state) return;

        state.isCompleted = true;
        const gateway = this.router.notifier?.gateway;
        if (gateway && state.messageId && state.channelId) {
            const elapsed = Math.round((Date.now() - state.startTime) / 1000);
            const embed = {
                title: isError ? '❌ Tác vụ thất bại / Bị dừng' : '✅ Tác vụ hoàn tất thành công!',
                description: summary ? `**Kết quả tóm tắt:**\n${summary.slice(0, 1500)}` : 'Agent đã hoàn tất lượt xử lý.',
                color: isError ? 0xED4245 : 0x57F287,
                fields: [
                    { name: '📂 Phiên', value: `\`${state.sessionId.slice(0, 8)}\` (${state.sessionTitle})`, inline: true },
                    { name: '⏱️ Tổng thời gian', value: `${elapsed} giây`, inline: true }
                ],
                footer: { text: `Antigravity • ${new Date().toLocaleTimeString('vi-VN')}` }
            };

            try {
                await gateway.editMessage(state.channelId, state.messageId, { embeds: [embed] });
            } catch (e) {}
        }

        this.activeSessions.delete(sessionId);
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
            const readBytes = Math.min(stat.size, 64 * 1024); // read last 64KB
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
        let isDone = false;

        for (let i = lines.length - 1; i >= 0; i--) {
            try {
                const record = JSON.parse(lines[i]);
                if (!lastStepIndex && record.step_index) {
                    lastStepIndex = record.step_index;
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
                        // Take the most descriptive recent thought line
                        lastThought = thoughtLines[thoughtLines.length - 1].replace(/^m:\s*/i, '');
                    }
                }

                if (lastThought && currentAction) break;
            } catch (e) {}
        }

        return {
            lastThought: lastThought || 'Đang phân tích và xử lý mã nguồn...',
            currentAction: currentAction || 'Đang thực thi tác vụ...',
            subagents: activeSubagents,
            lastStepIndex
        };
    }

    /**
     * Build Discord Embed for live loading state
     */
    buildLoadingEmbed(state) {
        const frame = PROGRESS_FRAMES[this.frameIndex % PROGRESS_FRAMES.length];
        const elapsed = Math.round((Date.now() - state.startTime) / 1000);

        const subagentText = state.subagents && state.subagents.length > 0
            ? `🟢 **${state.subagents.length} sub-agent đang hoạt động:**\n> ${state.subagents.map(s => `• ${s}`).join('\n> ')}`
            : '⚪ *Không có sub-agent nào độc lập (Agent chính xử lý trực tiếp)*';

        const acceptsText = this.recentAccepts && this.recentAccepts.length > 0
            ? this.recentAccepts.slice(0, 3).map(a => `> ✅ \`[${a.time}]\` Duyệt: **${a.action}** ${a.details ? `(${a.details})` : ''}`).join('\n')
            : '⚪ *Chưa có hành động cần cấp quyền gần đây*';

        return {
            title: `🔄 Antigravity Đang Xử Lý: ${state.sessionTitle}`,
            description: `\`${frame}\` **Đang hoạt động (${elapsed}s)**`,
            color: 0x5865F2,
            fields: [
                {
                    name: '🧠 Luồng suy nghĩ (Thinking)',
                    value: `> "${(state.lastThought || 'Đang suy nghĩ...').slice(0, 250)}"`
                },
                {
                    name: '⚙️ Hành động hiện tại',
                    value: `\`${(state.currentAction || 'Đang thực thi...').slice(0, 100)}\``
                },
                {
                    name: '👥 Tiến trình Sub-agents',
                    value: subagentText
                },
                {
                    name: '⚡ Tự động phê duyệt gần đây (Auto-Accept)',
                    value: acceptsText
                }
            ],
            footer: {
                text: `Phiên ID: ${state.sessionId.slice(0, 8)} • Cập nhật trực tiếp mỗi 2.5s`
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

        // Auto-detect active running session if not explicitly registered
        if (this.activeSessions.size === 0) {
            try {
                const cur = await this.router.getSessions();
                if (cur && cur.currentId) {
                    // Check if page has cancel button (currently generating)
                    for (const [targetId] of this.router.handler.connections) {
                        const isGen = await this.router.evalPage(targetId, '!!document.querySelector(\'[data-tooltip-id*="cancel-tooltip"], button[aria-label*="Cancel"]\')');
                        if (isGen) {
                            await this.trackSession(cur.currentId, cur.currentTitle);
                            break;
                        }
                    }
                }
            } catch (e) {}
        }

        // Update all active sessions
        for (const [sessionId, state] of this.activeSessions.entries()) {
            if (state.isCompleted) continue;

            const live = this.readLiveTranscript(sessionId);
            if (live) {
                state.lastThought = live.lastThought;
                state.currentAction = live.currentAction;
                if (live.subagents.length > 0) state.subagents = live.subagents;
                state.lastStepIndex = live.lastStepIndex;
            }

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
