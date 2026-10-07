# Antigravity Tự Động Phê Duyệt ⚡

<p align="center">
  <img src="media/icon.png" width="128" height="128" alt="Logo Antigravity Tự Động Phê Duyệt" />
</p>

<p align="center">
  <strong>Giải pháp tự động hóa hoàn toàn không cần chạm tay cho Antigravity 2.0 & AI Coding Agents</strong><br />
  Tự động xử lý hộp thoại cấp quyền, câu hỏi trắc nghiệm, lựa chọn "Luôn cho phép trong dự án này", xác nhận chạy lệnh terminal mà không làm gián đoạn tiến trình công việc của bạn.
</p>

<p align="center">
  <a href="https://github.com/valzevox/antigravity-auto-accept/releases"><img src="https://img.shields.io/github/v/release/valzevox/antigravity-auto-accept?style=flat-square&color=blue" alt="Phiên bản phát hành"></a>
  <a href="https://github.com/valzevox/antigravity-auto-accept/blob/main/LICENSE"><img src="https://img.shields.io/badge/giấy_phép-MIT-green?style=flat-square" alt="Giấy phép"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/phiên_bản_node-%3E%3D18.0.0-brightgreen?style=flat-square" alt="Phiên bản Node"></a>
  <a href="https://github.com/valzevox/antigravity-auto-accept/stargazers"><img src="https://img.shields.io/github/stars/valzevox/antigravity-auto-accept?style=flat-square" alt="Lượt thích"></a>
  <a href="https://github.com/valzevox/antigravity-auto-accept/issues"><img src="https://img.shields.io/badge/đóng_góp-chào_đón-brightgreen.svg?style=flat-square" alt="Chào đón đóng góp"></a>
</p>

<p align="center">
  <a href="README.md">🇻🇳 Bản Tiếng Việt</a> | <a href="README_EN.md">🇬🇧 English Documentation</a>
</p>

---

## 🌟 Tại sao bạn cần Antigravity Tự Động Phê Duyệt?

Khi xây dựng các dự án phần mềm lớn hoặc giao cho AI tự chủ hoàn thành các kế hoạch nhiều bước phức tạp, **Antigravity 2.0** thường xuyên dừng lại để chờ bạn xác nhận thủ công:
- Yêu cầu cấp quyền tìm kiếm và đọc tập tin mã nguồn
- Xác nhận cho phép thực thi lệnh trong terminal
- Hộp thoại hỏi trắc nghiệm quyền truy cập (`1. Cho phép lần này`, `2. Đồng ý và luôn cho phép...`)
- Các câu hỏi lựa chọn phương án giải quyết và nút `Gửi (Submit)`

**Antigravity Tự Động Phê Duyệt** kết nối trực tiếp vào giao thức Chrome DevTools (cổng 9000) của Antigravity, tự động phát hiện và phê duyệt các hộp thoại này trong thời gian thực. Bạn có thể thoải mái rời máy tính hoặc tập trung làm việc khác mà không lo AI bị dừng giữa chừng!

---

## ✨ Tính năng nổi bật

- 🎯 **Hỗ trợ toàn diện hộp thoại trắc nghiệm Antigravity 2.0**: Tự động nhận diện các hộp thoại xin quyền gồm 5 lựa chọn, ưu tiên chọn *"Đồng ý và luôn cho phép trong cuộc trò chuyện/dự án này"* và tự nhấn nút `Gửi (Submit)`.
- 🔄 **Bảng theo dõi tiến độ thời gian thực trên Discord**: Thẻ trạng thái động tự cập nhật mỗi 2.5 giây. Hiển thị luồng suy nghĩ của Agent, công cụ đang chạy, số lượng sub-agent hoạt động và đồng hồ đếm thời gian. Tự động chuyển thành thẻ hoàn tất màu xanh khi xong việc.
- ⚠️ **Cảnh báo khẩn cấp khi hết hạn mức token**: Tự động phát hiện khi tài khoản chạm ngưỡng giới hạn token hoặc gặp lỗi và ngắt quãng, lập tức gửi thông báo màu đỏ nổi bật kèm nhắc tên (`@user`) đến điện thoại/máy tính của bạn.
- 🔁 **Tự động thử lại khi gặp sự cố (Auto-Retry)**: Tự động nhấn nút `Retry` khi model gặp sự cố đường truyền hoặc lỗi tạm thời ("Agent terminated due to error"). Có thể tùy chỉnh số lần thử lại tối đa (mặc định 5 lần). Nếu quá số lần cho phép mà model vẫn không phản hồi, hệ thống sẽ tạm dừng tác vụ và gửi cảnh báo để tránh vòng lặp vô tận.
- 🎙️ **Điều khiển bằng giọng nói siêu tốc (Groq Whisper)**: Gửi tin nhắn thoại hoặc tập tin âm thanh trên Discord để hỏi trạng thái, chuyển phiên làm việc, dừng tác vụ hoặc nạp yêu cầu vào Antigravity với tốc độ nhận diện chỉ khoảng 300ms.
- 🔀 **Tự động chuyển phiên làm việc trong nền**: Theo dõi tất cả các cuộc trò chuyện chạy ngầm. Khi một phiên khác bị dừng chờ cấp quyền, hệ thống tự chuyển sang phiên đó duyệt quyền rồi quay về phiên bạn đang theo dõi.
- 🎮 **Tương tác hai chiều qua nút bấm (Discord & Telegram)**: Khi Agent đặt câu hỏi lựa chọn (`ask_question`), bot sẽ gửi thông báo kèm các nút bấm phương án. Bạn chỉ cần nhấn nút trên điện thoại để gửi câu trả lời về máy tính!
- ⚡ **Kết nối Discord Gateway trực tiếp**: Kết nối qua giao thức WebSocket chính thức của Discord, hoạt động 24/7 mà không cần mở cổng modem, không cần IP tĩnh hay ngrok.
- 🔔 **Hệ thống thông báo phân loại rõ ràng**: Phân chia theo 4 mức độ (Cần quyết định, Hoàn thành tác vụ, Tự động duyệt, Báo lỗi/Hết hạn mức).
- 🛡️ **Bộ lọc bảo vệ lệnh nguy hiểm**: Tự động chặn các câu lệnh có khả năng gây hại hệ thống (`rm -rf /`, `format c:`, xóa ổ đĩa hệ thống...).
- 🔄 **Tự động kết nối lại**: Tự phát hiện khi Antigravity mở hoặc đóng để tái kết nối nhanh chóng trong 3 giây.

---

## 📦 Sơ đồ kiến trúc hệ thống

```
                      +-----------------------------+
                      |       Antigravity 2.0       |
                      |  (--remote-debugging-port)  |
                      +--------------+--------------+
                                     ^
                                     | Kết nối WebSocket (:9000)
                                     v
+-------------------------------------------------------------------+
|            Tiến trình nền Tự Động Phê Duyệt                       |
|                                                                   |
|   +-----------------------+           +-----------------------+   |
|   |  Quét cổng kết nối    |  ------>  |  Bộ nạp mã giao diện  |   |
|   +-----------------------+           +-----------+-----------+   |
|               |                                   |               |
|               v                                   v               |
|   +-----------------------+         +-------------------------+   |
|   |  Điều phối đa phiên   |         |  Xử lý trên màn hình    |   |
|   |  - Theo dõi ổ đĩa     |         |  - Chọn mục cấp quyền   |   |
|   |  - Tự nhảy phiên & về | <=====> |  - Nhấn nút gửi         |   |
|   +-----------------------+         |  - Tiếp tục tiến trình  |   |
|                                     +-------------------------+   |
+-------------------------------------------------------------------+
```

---

## 🚀 Hướng dẫn cài đặt nhanh

> ⚡ **Cài đặt chỉ với 1 dòng lệnh duy nhất:**  
> Toàn bộ quá trình kiểm tra môi trường, cấu hình cổng 9000 cho Antigravity, nhập thông tin bot và đăng ký tự khởi động cùng máy tính được thực hiện tự động hoàn toàn bằng tập lệnh PowerShell!

### Cách 1: Cài đặt trực tiếp qua PowerShell (Khuyên dùng)

Mở PowerShell trên máy tính của bạn và dán lệnh sau:

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/valzevox/antigravity-auto-accept/main/scripts/install.ps1")))
```

---

### Cách 2: Tải mã nguồn về máy & chạy cài đặt

```bash
git clone https://github.com/valzevox/antigravity-auto-accept.git
cd antigravity-auto-accept
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```

---

### 🛠️ Tập lệnh cài đặt (`install.ps1`) sẽ tự làm những gì?

1. ✅ **Kiểm tra môi trường:** Tự động phát hiện phiên bản Node.js (từ 18 trở lên) và Git.
2. ✅ **Cài đặt thư viện:** Cài đặt các gói phụ thuộc cần thiết.
3. ✅ **Tự cấu hình cổng 9000:** Tự động gắn cờ `--remote-debugging-port=9000` vào lối tắt (shortcut) khởi động Antigravity trên Màn hình chính (Desktop) và Start Menu.
4. ✅ **Nhập cấu hình tương tác:** Cho phép bạn dán ngay thông tin Discord Bot Token, Mã kênh, Mã người dùng quản trị, Khóa API Groq trực tiếp trên cửa sổ cài đặt.
5. ✅ **Đăng ký khởi động cùng hệ thống:** Đăng ký tác vụ hệ thống trong Windows Task Scheduler để tự chạy mỗi khi bạn đăng nhập vào Windows.
6. ✅ **Kích hoạt ngay:** Khởi chạy tiến trình phục vụ bạn ngay lập tức.

---

### 🔄 Cơ chế tự động cập nhật khi khởi động lại máy tính

Mỗi khi máy tính của bạn khởi động lại:
- Hệ thống sẽ tự động thực hiện: **Kiểm tra bản cập nhật (`update.bat`) ➔ Chạy tiến trình (`run.bat`)**.
- **`update.bat`**: Tự động so sánh phiên bản trên GitHub, nếu có bản mới sẽ tự tải về và cập nhật thư viện trong 1-2 giây.
- **`run.bat`**: Khởi động tiến trình giám sát và hiển thị cửa sổ làm việc trực quan.
- Bạn **không cần** phải chạy lại lệnh cài đặt hay thao tác thủ công nào thêm.

---

## 📋 Danh mục tập lệnh trong thư mục

Thư mục chính được tinh gọn tối đa:

| Tập lệnh | Chức năng |
| :--- | :--- |
| `run.bat` | Khởi chạy chương trình với cửa sổ theo dõi trực quan (tương thích cả Windows 10 & 11) |
| `update.bat` | Kiểm tra và cập nhật mã nguồn mới nhất từ GitHub |
| `status.bat` | Kiểm tra tình trạng hoạt động của tiến trình và cổng kết nối Antigravity |
| `powershell -File scripts\install.ps1` | Chạy lại trình cài đặt hoặc nhập lại cấu hình bất kỳ lúc nào |

---

## ⚙️ Hướng dẫn cấu hình chi tiết (Discord & Telegram)

Mở tập tin **`config.json`** trong thư mục dự án để điền các thông tin của bạn:

```json
{
  "webhooks": {
    "discord": "https://discord.com/api/webhooks/ĐƯỜNG_DẪN_WEBHOOK_CỦA_BẠN",
    "discordBot": {
      "token": "MÃ_TOKEN_BOT_DISCORD",
      "channelId": "MÃ_KÊNH_DISCORD",
      "guildId": "MÃ_MÁY_CHỦ_DISCORD",
      "ownerUserId": "MÃ_NGƯỜI_DÙNG_QUẢN_TRỊ",
      "mentionUserId": "MÃ_NGƯỜI_DÙNG_ĐƯỢC_NHẮC_TÊN"
    },
    "telegram": {
      "botToken": "MÃ_TOKEN_BOT_TELEGRAM",
      "chatId": "MÃ_CUỘC_TRÒ_CHUYỆN_TELEGRAM"
    },
    "customUrl": ""
  },
  "maxErrorRetries": 5,
  "groqApiKey": "KHÓA_API_GROQ",
  "events": {
    "onManualIntervention": true,
    "onTaskCompleted": true,
    "onAutoApproved": true,
    "onError": true
  }
}
```

> 💡 **Lưu ý:** Nếu bạn chỉ sử dụng Discord, các mục của Telegram có thể để trống và ngược lại.

---

### Hướng dẫn lấy thông tin Discord Bot

1. **Tạo ứng dụng và Bot**:
   - Truy cập trang [Discord Developer Portal](https://discord.com/developers/applications) → Nhấn **New Application** → Đặt tên ứng dụng → Nhấn **Create**.
   - Chọn mục **Bot** ở thanh bên trái → Nhấn **Reset Token** → Sao chép mã token và dán vào `discordBot.token`.
2. **Cấp quyền đọc tin nhắn cho Bot**:
   - Trong trang cấu hình Bot, tìm phần **Privileged Gateway Intents** → Bật mục **Message Content Intent** (Bắt buộc để bot nhận lệnh).
3. **Mời Bot vào máy chủ của bạn**:
   - Vào mục **OAuth2** → **URL Generator**.
   - Phần Scopes tích chọn: `bot`.
   - Phần Bot Permissions tích chọn: `Send Messages`, `Read Message History`, `Embed Links`, `Attach Files`.
   - Sao chép đường dẫn được tạo, mở trên trình duyệt và thêm bot vào máy chủ của bạn.
4. **Lấy các mã định danh cần thiết**:
   - Bật **Chế độ nhà phát triển (Developer Mode)** trong Discord: *Cài đặt người dùng → Nâng cao → Chế độ nhà phát triển*.
   - **Mã kênh (`channelId`)**: Nhấp chuột phải vào kênh muốn nhận thông báo → Chọn **Sao chép ID kênh**.
   - **Mã người dùng quản trị (`ownerUserId`)**: Nhấp chuột phải vào tài khoản của bạn → Chọn **Sao chép ID người dùng**.

---

### Hướng dẫn lấy thông tin Telegram Bot

1. Mở ứng dụng Telegram, tìm kiếm **@BotFather** và gửi lệnh `/newbot`.
2. Đặt tên hiển thị và tên định danh (username kết thúc bằng chữ `bot`) cho bot.
3. BotFather sẽ gửi cho bạn chuỗi **HTTP API Token** → dán chuỗi này vào `telegram.botToken`.
4. Để lấy **Mã cuộc trò chuyện (`chatId`)**, nhắn tin cho bot [@userinfobot](https://t.me/userinfobot) để xem mã số ID của bạn.

---

## 🎮 Danh sách lệnh điều khiển trên Discord

Bạn có thể tương tác và quản lý Antigravity trực tiếp từ kênh Discord đã thiết lập:

| Câu lệnh | Mô tả | Ví dụ |
| :--- | :--- | :--- |
| `!prompt <nội dung>` | Gửi yêu cầu công việc trực tiếp vào Antigravity | `!prompt hãy sửa lỗi trong file index.js` |
| `!message <nội dung>` | Tương tự lệnh `!prompt` | `!message viết tài liệu hướng dẫn` |
| `!new <nội dung>` | Tạo một phiên làm việc mới và nạp yêu cầu | `!new thiết kế trang đăng nhập` |
| `!stop` | Dừng ngay lập tức tác vụ đang chạy | `!stop` |
| `!sessions` | Xem danh sách các phiên làm việc đang có | `!sessions` |
| `!switch <mã hoặc tên>` | Chuyển Antigravity sang phiên làm việc được chọn | `!switch 89e10449` |
| `!status` | Kiểm tra tình trạng kết nối và phiên đang hoạt động | `!status` |
| `!config` | Xem cấu hình hiện tại của bot | `!config` |
| `!language` | Mở bảng nút bấm chọn ngôn ngữ hiển thị (Tiếng Việt / English) | `!language` hoặc `!lang en` |
| `!setchannel <#kênh>` | Thay đổi kênh nhận thông báo và câu hỏi | `!setchannel #nhat-ky-agent` |
| `!setping <đối tượng>` | Cài đặt đối tượng nhắc tên khi có câu hỏi hoặc hết hạn mức | `!setping @valzevox` hoặc `!setping off` |
| `!setretry <số lần>` | Cài đặt số lần tự động bấm Retry khi model gặp sự cố (mặc định: 5) | `!setretry 5` |
| `!setvoice <on/off>` | Bật hoặc tắt tính năng điều khiển bằng giọng nói | `!setvoice off` |
| `!setgroq <khóa api>` | Thiết lập khóa API Groq để chuyển giọng nói thành văn bản | `!setgroq gsk_...` |
| `!help` | Hiển thị bảng trợ giúp danh sách câu lệnh | `!help` |

---

## 🛡️ Danh mục câu lệnh nguy hiểm được bảo vệ

Hệ thống tích hợp sẵn cơ chế bảo vệ máy tính, tự động từ chối tự phê duyệt các lệnh có nguy cơ xóa hoặc làm hư hại hệ điều hành:
- Các lệnh xóa gốc: `rm -rf /`, `rm -rf ~`, `rm -rf *`
- Các lệnh định dạng lại ổ đĩa: `format c:`, `del /f /s /q`
- Các thao tác ghi đè ổ đĩa hoặc fork bomb làm treo máy

---

## 💖 Đóng góp & Ủng hộ tác giả

Nếu dự án **Antigravity Tự Động Phê Duyệt** giúp ích cho công việc hàng ngày của bạn, hãy cân nhắc ủng hộ tác giả một ly cà phê nhé:

<p align="left">
  <a href="https://ko-fi.com/m1n698"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Ủng hộ qua Ko-fi" /></a>
  &nbsp;&nbsp;
  <a href="https://zypage.com/m1n6"><img src="https://img.shields.io/badge/Ủng_hộ-ZyPage-blueviolet?style=for-the-badge&logo=heart" alt="Ủng hộ qua ZyPage" /></a>
</p>

- **Ko-fi:** [ko-fi.com/m1n698](https://ko-fi.com/m1n698)
- **ZyPage:** [zypage.com/m1n6](https://zypage.com/m1n6)

---

## 👤 Tác giả

**valzevox**
- GitHub: [@valzevox](https://github.com/valzevox)
- Thư điện tử: [valzevox@gmail.com](mailto:valzevox@gmail.com)

---

## 📄 Giấy phép

Dự án được phân phối dưới giấy phép mã nguồn mở MIT - xem chi tiết tại tập tin [LICENSE](LICENSE).
