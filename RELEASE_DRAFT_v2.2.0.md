# Release v2.2.0: Interactive Discord Controls, Auto-Retry Engine & Multi-Session Resilience

### 🚀 Highlights & Features

- **Interactive Discord Action Buttons (1-Click UI)**:
  - Bổ sung Action Row Components (Buttons) ngay dưới embed của `!help`, `!config` và `!status`.
  - **Chuyển đổi ngôn ngữ tức thì**: Nút bấm `[🇻🇳 Tiếng Việt]` và `[🇬🇧 English]` cho phép đổi ngôn ngữ bot 1-click mà không cần gõ lệnh.
  - **Quick Controls**: Nút bấm `[⏸️ Tạm dừng Auto-Accept]`, `[▶️ Tiếp tục]`, `[🛑 Dừng Task]`, và `[🔄 Retry ngay]`.
- **Intelligent Auto-Retry Engine**:
  - Tự động phát hiện và bấm nút `Retry` / `Try again` / `Thử lại` / `Continue generating` khi model gặp lỗi gián đoạn hoặc ngắt kết nối.
  - Hỗ trợ giới hạn số lần thử lại tối đa (cấu hình qua `!setretry <number>`, mặc định 5 lần).
  - Tự động tạm dừng và gửi cảnh báo chi tiết khi vượt quá số lần retry mà model vẫn không phản hồi.
  - Loại bỏ hoàn toàn lỗi nhận diện nhầm file pills (như `find-retry-buttons.js`) và lọc bỏ lỗi công cụ cũ trong transcript.
- **Multi-Session Cross-Hop Anti-Spam & Dedup Engine**:
  - Khắc phục triệt để lỗi spam thông báo "Tác vụ hoàn tất" khi chuyển đổi giữa nhiều session đang chạy đồng thời.
  - Bộ đệm `notifiedDone` và hash nội dung ngăn chặn phát lặp thông báo trong 10 phút.
  - `LoadingWatcher` tự động bỏ qua các phiên đã hoàn tất (`DONE`) và chỉ tập trung vào phiên đang hoạt động.
- **Strict Bilingual Separation (Thuần Việt & Thuần Anh)**:
  - Tách bạch 100% tài liệu `README.md` (Tiếng Việt) và `README_EN.md` (Tiếng Anh), không pha trộn ngôn ngữ.
  - Hệ thống từ điển `i18n.js` tự động đồng bộ tin nhắn Discord Bot và Telegram theo đúng ngôn ngữ đã chọn.

---

### 📦 Quick Install:

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/valzevox/antigravity-auto-accept/main/scripts/install.ps1")))
```
