# Release v2.1.0: 1-Click PowerShell Installer & Fast Auto-Updater

### 🚀 Highlights

- **1-Click PowerShell Installer (`install.ps1`)**: Cài đặt hoàn toàn tự động chỉ với 1 dòng lệnh duy nhất (theo phong cách Free Claude Code - FCC).
- **Interactive Credentials Onboarding**: Trình hướng dẫn cấu hình tương tác trong terminal giúp người dùng mới nhập Discord Bot Token, Channel ID, Owner User ID, Groq API key và Telegram nhanh chóng.
- **Port 9000 Auto-Patcher**: Tự động quét và vá tham số `--remote-debugging-port=9000` cho mọi shortcut Antigravity trên Desktop và Start Menu.
- **Tối giản hóa Batch Files**: Loại bỏ các file batch rườm rà (`setup.bat`, `run-win11.bat`, `bootstrap.bat`). Thư mục gốc giờ chỉ còn `run.bat`, `update.bat`, `status.bat`.
- **Fast Startup & Auto-Updater**: Windows Task Scheduler tự động chạy `update.bat` (kiểm tra commit mới và cập nhật trong 1s) rồi chuyển tiếp sang `run.bat` khi khởi động lại máy tính (Reboot), không cần chạy lại installer hay hỏi credentials.
- **Khắc phục lỗi UTF-8 BOM**: Loại bỏ ký tự BOM khi đọc/ghi file `config.json` để tránh lỗi parse JSON trên môi trường Windows PowerShell.

---

### 📦 Quick Install:

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/valzevox/antigravity-auto-accept/main/scripts/install.ps1")))
```
