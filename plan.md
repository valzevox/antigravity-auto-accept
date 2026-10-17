# Kế hoạch mở rộng Auto Accept cho Antigravity IDE và Antigravity CLI (`agy`)

## 1. Tổng quan kiến trúc hiện tại vs Mở rộng

| Platform | Bản chất nền tảng | Phương thức tương tác hiện tại | Phương án Auto Accept tối ưu |
| :--- | :--- | :--- | :--- |
| **Antigravity 2.0 (App hiện tại)** | Electron Desktop (Web tech) | CDP (Chrome DevTools Protocol) + DOM Injection | Đã hoàn thiện (CDP Port 9000, MultiSession, Discord Bot) |
| **Antigravity IDE** | VS Code Fork (Electron-based) | UI Editor, Extension Host, Monaco Editor | **1. Extension VSIX gốc** (đã có sẵn `extension.js`)<br>**2. CDP Bridge** qua port debug của IDE |
| **Antigravity CLI (`agy`)** | Terminal / Console TUI Process | Stdout / Stdin, ANSI prompts, config JSON | **1. Native Settings / Config Auto-Approve**<br>**2. PTY/ChildProcess Interceptor** (`agy-wrapper`) |

---

## 2. Phân tích chi tiết từng nền tảng

### A. Antigravity IDE (VS Code Fork)
- **Đặc điểm**: Antigravity IDE chia sẻ lõi VS Code / Electron, hiển thị thanh chat AI ở Sidebar và các prompt phê duyệt chạy lệnh terminal / sửa file.
- **Tính khả thi**: **100% Khả thi và Rất dễ tích hợp**.
- **Cách triển khai**:
  1. **Chế độ Extension (`.vsix`)**: Dự án `antigravity-auto-accept` vốn đã có sẵn [`extension.js`](file:///c:/Users/Admin/.gemini/antigravity-auto-accept/extension.js) và lệnh `npm run build:vsix`. Khi đóng gói thành file `.vsix` và cài đặt trực tiếp vào Antigravity IDE, nó sẽ chạy native bên trong Extension Host, bắt sự kiện VS Code API và tự động phê duyệt mà không cần chạy daemon ngoài.
  2. **Chế độ Daemon ngoài (CDP)**: Tương tự như Antigravity 2.0, chỉ cần cấu hình shortcut Antigravity IDE với `--remote-debugging-port=9001` (để không xung đột với port 9000 của Antigravity 2.0). Daemon hiện tại chỉ cần lắng nghe đồng thời cả 2 port.

### B. Antigravity CLI (`agy`)
- **Đặc điểm**: Chạy thuần túy trong Terminal (CMD / PowerShell / Bash). Các yêu cầu cấp quyền (permission check, file edits, run command) hiển thị dạng text/ANSI prompt (ví dụ: `Allow running command? [y/N]` hoặc danh sách chọn 1-2-3).
- **Tính khả thi**: **100% Khả thi**.
- **Cách triển khai**:
  1. **Giải pháp 1 (Native Config & Flags - Tối ưu nhất)**:
     - Antigravity CLI lưu cấu hình tại `~/.gemini/antigravity-cli/settings.json` hoặc hỗ trợ flags khi khởi động (như `agy -y` hoặc `--auto-approve`).
     - Chúng ta có thể kiểm tra cấu hình `settings.json` để bật chế độ tự động phê duyệt sẵn mà không cần can thiệp process.
  2. **Giải pháp 2 (Wrapper Process - PTY / Stream Interceptor)**:
     - Tạo một wrapper CLI: `agy-auto` (Node.js script).
     - Khi chạy `agy-auto`: Script dùng `node-pty` hoặc `child_process.spawn` để bọc lấy tiến trình `agy`.
     - Script giám sát luồng `stdout`: Khi phát hiện các pattern prompt như `[y/N]`, `Allow [Y/n]`, hoặc interactive radio selector, wrapper sẽ tự động ghi `y\n` hoặc `Enter` vào `stdin` của `agy`.
     - Đồng thời, wrapper có thể forward trạng thái ra Discord Webhook giống hệt như phiên bản desktop!

---

## 3. Lộ trình phát triển đề xuất (Roadmap)

### Giai đoạn 1: Hỗ trợ Antigravity IDE (VS Code Fork)
1. Kiểm tra build gói `.vsix` từ `extension.js`.
2. Kiểm tra khả năng mở cổng CDP độc lập (`--remote-debugging-port=9001`) cho Antigravity IDE.
3. Cập nhật `daemon.js` để quét đa cổng (9000 cho Antigravity 2.0, 9001 cho Antigravity IDE).

### Giai đoạn 2: Hỗ trợ Antigravity CLI (`agy`)
1. Khảo sát cấu hình `~/.gemini/antigravity-cli/settings.json` và các cờ runtime của lệnh `agy`.
2. Xây dựng module `cli-interceptor` (dùng `child_process`/`pty`) để bắt prompt dòng lệnh.
3. Tích hợp webhook Discord thông báo tiến độ dòng lệnh từ CLI.

---

## 4. Quyết định & Bước tiếp theo
- Bạn muốn ưu tiên triển khai nền tảng nào trước: **Antigravity IDE** hay **Antigravity CLI (`agy`)**?
