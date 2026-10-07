/**
 * Internationalization (i18n) module for Antigravity Auto Accept.
 * Supports Vietnamese ('vi') and English ('en').
 * 
 * Strict separation: Never mix languages in strings.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

const DICTIONARIES = {
    vi: {
        brandName: 'Antigravity Tự Động Phê Duyệt',
        brandFooter: 'Antigravity • Tự động hóa tác vụ AI',
        twoWayFooter: 'Antigravity • Điều khiển hai chiều',
        voiceFooter: 'Antigravity • Điều khiển bằng giọng nói',
        events: {
            1: {
                title: 'Cần người dùng quyết định',
                label: 'Agent đang chờ bạn đưa ra lựa chọn...'
            },
            2: {
                title: 'Tác vụ hoàn tất',
                label: 'Agent đã hoàn thành toàn bộ lượt xử lý'
            },
            3: {
                title: 'Tự động phê duyệt',
                label: 'Đã tự động cấp quyền thành công'
            },
            4: {
                title: 'Lỗi thực thi / Gián đoạn',
                label: 'Agent gặp sự cố hoặc gián đoạn'
            },
            quota: {
                title: 'Hết hạn mức dùng token',
                label: 'Antigravity đã chạm trần giới hạn token của tài khoản'
            }
        },
        fields: {
            session: 'Mã phiên',
            time: 'Thời điểm',
            prompt: 'Nội dung yêu cầu',
            options: 'Các lựa chọn'
        },
        watcher: {
            runningTitle: '🔄 Antigravity Đang Xử Lý',
            activeStatus: 'Đang hoạt động',
            thinkingField: '🧠 Luồng suy nghĩ',
            actionField: '⚙️ Hành động hiện tại',
            subagentField: '👥 Tiến trình Sub-agents',
            subagentActive: 'sub-agent đang hoạt động:',
            subagentNone: 'Không có sub-agent nào độc lập (Agent chính xử lý trực tiếp)',
            acceptsField: '⚡ Tự động phê duyệt gần đây',
            acceptsNone: 'Chưa có hành động cần cấp quyền gần đây',
            footerText: 'Cập nhật trực tiếp mỗi 2.5 giây',
            finishSuccessTitle: '✅ Tác vụ hoàn tất thành công!',
            finishQuotaTitle: '⚠️ Tác vụ dừng: Hết hạn mức token của tài khoản',
            finishErrorTitle: '❌ Tác vụ thất bại do sự cố lỗi',
            finishDescSuccess: 'Agent đã hoàn tất lượt xử lý.',
            finishDescError: 'Agent gặp sự cố và đã dừng lại.',
            sessionField: '📂 Phiên làm việc',
            elapsedField: '⏱️ Tổng thời gian',
            seconds: 'giây'
        },
        commands: {
            helpTitle: '🛠️ Danh sách lệnh điều khiển Antigravity',
            helpDesc: 'Các câu lệnh quản lý và tương tác từ xa với Antigravity:',
            promptDesc: '🚀 **Gửi yêu cầu trực tiếp vào Antigravity** để Agent thực thi!',
            newDesc: '✨ Mở phiên làm việc mới và gửi yêu cầu thực thi.',
            stopDesc: '🛑 Dừng ngay tác vụ đang chạy trong Antigravity.',
            sessionsDesc: '📂 Xem danh sách các phiên làm việc đang có.',
            switchDesc: '🔀 Chuyển giao diện Antigravity sang phiên được chỉ định.',
            statusDesc: 'Kiểm tra trạng thái kết nối và phiên đang hoạt động.',
            configDesc: 'Xem cấu hình hiện tại (kênh gửi tin, chế độ nhắc tên, ngôn ngữ).',
            setchannelDesc: 'Thay đổi kênh nhận thông báo và câu hỏi.',
            setpingDesc: 'Cấu hình đối tượng được nhắc tên khi cần trả lời.',
            setlanguageDesc: 'Đổi ngôn ngữ bot (`!lang vi` hoặc `!lang en`).',
            channelsDesc: 'Liệt kê danh sách các kênh trong máy chủ kèm mã nhận diện.',
            statusTitle: '⚡ Trạng thái hệ thống Antigravity',
            connected: '🟢 Đã kết nối',
            disconnected: '🔴 Mất kết nối',
            connField: 'Kết nối Antigravity',
            activeField: 'Phiên đang mở',
            targetField: 'Kênh nhận tin',
            guildField: 'Mã máy chủ',
            langField: 'Ngôn ngữ hiển thị',
            configTitle: '⚙️ Cấu hình Bot Antigravity',
            configChannel: 'Kênh nhận thông báo',
            configPing: 'Chế độ nhắc tên',
            configLang: 'Ngôn ngữ hiển thị',
            configFooter: 'Dùng !setchannel, !setping hoặc !language để điều chỉnh',
            langPromptTitle: '🌐 Chọn ngôn ngữ / Select Language',
            langPromptDesc: 'Chọn ngôn ngữ giao tiếp cho Bot Discord & Telegram:\nSelect your display language for the bot:',
            langSwitched: '✅ Đã chuyển ngôn ngữ sang **Tiếng Việt**!',
            buttonSelected: (user, idx) => `✅ **@${user} đã chọn phương án ${idx}!** Đang áp dụng vào Antigravity...`
        }
    },
    en: {
        brandName: 'Antigravity Auto Accept',
        brandFooter: 'Antigravity • Autonomous AI Automation',
        twoWayFooter: 'Antigravity • Two-Way Remote Controller',
        voiceFooter: 'Antigravity • Voice Control Bridge',
        events: {
            1: {
                title: 'Decision Required',
                label: 'Agent is waiting for your choice...'
            },
            2: {
                title: 'Task Completed',
                label: 'Agent finished its execution cycle'
            },
            3: {
                title: 'Permission Approved',
                label: 'Tool execution permission granted automatically'
            },
            4: {
                title: 'Execution Error / Interrupted',
                label: 'Agent encountered an error or stopped'
            },
            quota: {
                title: 'Token Quota Exhausted',
                label: 'Antigravity has reached your account token limit'
            }
        },
        fields: {
            session: 'Session ID',
            time: 'Timestamp',
            prompt: 'Prompt / Question',
            options: 'Options'
        },
        watcher: {
            runningTitle: '🔄 Antigravity Processing',
            activeStatus: 'Active',
            thinkingField: '🧠 Thinking Process',
            actionField: '⚙️ Current Action',
            subagentField: '👥 Active Sub-agents',
            subagentActive: 'sub-agents currently active:',
            subagentNone: 'No independent sub-agents (Primary agent handling directly)',
            acceptsField: '⚡ Recent Approvals',
            acceptsNone: 'No recent actions requiring approval',
            footerText: 'Live update every 2.5s',
            finishSuccessTitle: '✅ Task Finished Successfully!',
            finishQuotaTitle: '⚠️ Stopped: Token Quota Exhausted',
            finishErrorTitle: '❌ Task Failed: System Error',
            finishDescSuccess: 'Agent has completed all tasks in this cycle.',
            finishDescError: 'Agent encountered an error and was halted.',
            sessionField: '📂 Session',
            elapsedField: '⏱️ Total Elapsed',
            seconds: 's'
        },
        commands: {
            helpTitle: '🛠️ Antigravity Command Reference',
            helpDesc: 'Available commands to manage and interact with Antigravity remotely:',
            promptDesc: '🚀 **Send prompt directly to Antigravity** for Agent execution!',
            newDesc: '✨ Open a new session and send prompt.',
            stopDesc: '🛑 Immediately stop the running task in Antigravity.',
            sessionsDesc: '📂 View list of open conversations & sessions.',
            switchDesc: '🔀 Switch Antigravity interface to specified session.',
            statusDesc: 'Check CDP connection, active session, and daemon status.',
            configDesc: 'View current settings (channel, mention ping, language).',
            setchannelDesc: 'Change notification and prompt channel.',
            setpingDesc: 'Configure who gets pinged on questions / completion.',
            setlanguageDesc: 'Change bot language (`!lang en` or `!lang vi`).',
            channelsDesc: 'List available guild channels with IDs.',
            statusTitle: '⚡ Antigravity System Status',
            connected: '🟢 Connected',
            disconnected: '🔴 Disconnected',
            connField: 'Antigravity CDP',
            activeField: 'Active Session',
            targetField: 'Target Channel',
            guildField: 'Guild ID',
            langField: 'Display Language',
            configTitle: '⚙️ Antigravity Bot Configuration',
            configChannel: 'Notification Channel',
            configPing: 'Mention Target',
            configLang: 'Display Language',
            configFooter: 'Use !setchannel, !setping or !language to adjust',
            langPromptTitle: '🌐 Select Language / Chọn ngôn ngữ',
            langPromptDesc: 'Select your display language for the bot:\nChọn ngôn ngữ giao tiếp cho Bot Discord & Telegram:',
            langSwitched: '✅ Language switched to **English**!',
            buttonSelected: (user, idx) => `✅ **@${user} selected option ${idx}!** Applying in Antigravity...`
        }
    }
};

class I18nManager {
    static getLanguage() {
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                const raw = fs.readFileSync(CONFIG_PATH, 'utf8').replace(/^\uFEFF/, '');
                const cfg = JSON.parse(raw);
                if (cfg.language === 'en') return 'en';
            }
        } catch (e) {}
        return 'vi'; // Default to Vietnamese
    }

    static setLanguage(lang) {
        const target = (lang === 'en' || lang === 'english') ? 'en' : 'vi';
        try {
            let cfg = {};
            if (fs.existsSync(CONFIG_PATH)) {
                const raw = fs.readFileSync(CONFIG_PATH, 'utf8').replace(/^\uFEFF/, '');
                cfg = JSON.parse(raw);
            }
            cfg.language = target;
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 4), 'utf8');
            return target;
        } catch (e) {
            return target;
        }
    }

    static t() {
        const lang = I18nManager.getLanguage();
        return DICTIONARIES[lang] || DICTIONARIES.vi;
    }

    static getLangName(lang) {
        return lang === 'en' ? 'English (Tiếng Anh)' : 'Tiếng Việt (Vietnamese)';
    }
}

module.exports = { I18nManager, DICTIONARIES };
