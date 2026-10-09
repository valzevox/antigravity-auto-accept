# Release v2.3.1: Full Chat Pane Screenshot, Smart Bottom-Scroller & Multi-Session Turn Dedup

### 🚀 Highlights & Improvements

- **Full-Pane Response Screenshot (DOM-Direct CDP)**:
  - Tự động cuộn toàn diện xuống đáy khung chat (`scrollTop = scrollHeight + 10000`) bằng cách quét tất cả container có `overflow-y` thực tế.
  - Tự động phát hiện và cuộn trọn vẹn pill `files changed` hoặc thẻ tổng hợp file vào tầm nhìn (`scrollIntoView`).
  - Chụp ảnh bao phủ đầy đủ từ Header phiên (`header` / title bar) xuống tận cùng đáy khung chat (ngay dưới input box / action bar).
  - Khắc phục triệt để tình trạng ảnh bị cắt ngắn, kẹt phía trên, hoặc bị trôi ngược lên lịch sử chat cũ từ các phiên trước.

- **Question & Interaction Card Capture**:
  - Tự động chụp trực tiếp thẻ câu hỏi trắc nghiệm / phê duyệt hành động ngay khi Antigravity hỏi ý kiến người dùng và đính kèm vào tin nhắn Discord / Telegram.

- **Cross-Session Anti-Spam & User Turn Dedup**:
  - Tích hợp `getLastUserStepIndex` và `completedUserTurns` theo dõi trực tiếp lượt prompt của người dùng (`USER_INPUT`).
  - Tuyệt đối không gửi lặp thông báo "Tác vụ hoàn tất" khi người dùng chuyển đổi tab hoặc mở qua lại giữa các phiên đa nhiệm.

- **Process Management (`stop.bat`)**:
  - Bổ sung script `stop.bat` giúp kết thúc nhanh tất cả tiến trình Node.js chạy ngầm liên quan tới `antigravity-auto-accept` chỉ với 1 click.

---

### 📦 Quick Install / Update:

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/valzevox/antigravity-auto-accept/main/scripts/install.ps1")))
```
