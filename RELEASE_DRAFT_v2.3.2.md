# Release v2.3.2: Resilient CDP Port Discovery & Robust Question Submit Handling

### 🚀 Highlights & Improvements

- **Robust Interactive Question & Option Submission (`answerQuestion`)**:
  - Hỗ trợ đầy đủ các modal lựa chọn của Antigravity (`ask_question`, grill-me, plan confirmation, tool permissions).
  - Tự động nhận diện nút **Submit** linh hoạt (hỗ trợ `Submit ↵`, `Submit`, icon Enter, text tiếng Việt `Gửi`,...).
  - Kích hoạt sự kiện chuột toàn diện (`pointerdown`, `mousedown`, `click`) kèm dispatch mã phím native CDP `Enter` để đảm bảo form được submit thành công ngay sau khi chọn phương án trên Discord hoặc Telegram.
  - Đồng bộ logic xử lý tập trung giữa `MultiSessionRouter`, `DiscordGatewayBridge` và `TelegramAnswerBridge`.

- **Resilient Dynamic CDP Port Discovery (`daemon.js`)**:
  - Tự động đọc cổng active từ file `DevToolsActivePort` của Electron/Antigravity nếu có sự thay đổi cổng do khởi động lại.
  - Quét dự phòng dải cổng (9000 -> 9005) thay vì chỉ hardcode đơn lẻ, tránh tình trạng daemon bị treo chờ khi cổng bị lệch tạm thời sau khi Antigravity tự động cập nhật.

---

### 📦 Quick Install / Update:

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/valzevox/antigravity-auto-accept/main/scripts/install.ps1")))
```
