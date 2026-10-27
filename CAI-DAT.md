# ZONO Agentic AI — Cài đặt máy mới (bản trắng)

Gói này là **bản cài trắng**: đủ mã nguồn, skill và bộ cài, **không kèm dữ liệu nào** (không cơ sở dữ liệu, không DNA, không kênh,
không khóa/token, không dữ liệu Zalo). Lần chạy đầu hệ thống tự tạo một doanh nghiệp mới tên "Doanh nghiệp của tôi" với DNA trống.

## Máy Mac

Yêu cầu: macOS 13 trở lên, còn trống **≥ 8 GB** (≥ 15 GB nếu cài công cụ video AI), có Internet trong lúc cài.

1. Giải nén file zip vào thư mục bất kỳ (ví dụ `~/ZONO`).
2. Nhấp đúp **`CAI-DAT-MAC.command`**. Lần đầu macOS có thể chặn: nhấp chuột phải vào file → **Open** → **Open**.
   Script tự cài Homebrew (hỏi mật khẩu máy), Node.js 24, Git, PostgreSQL 17, ffmpeg, Python, uv, pnpm, Claude Code CLI, rồi cài hệ thống.
   Mất 10–30 phút lần đầu. Chạy lại bao nhiêu lần cũng an toàn.
3. Mở Terminal, gõ `claude`, đăng nhập tài khoản Claude (lệnh `/login`).

Chạy hệ thống: nhấp đúp **`CHAY-ZONO.command`** → tự mở http://localhost:5173

Bản nhẹ: mở Terminal trong thư mục cài, chạy `./CAI-DAT-MAC.command --no-video-ai` (bỏ video AI ~3 GB) hoặc thêm `--no-zlcrm` (bỏ Zalo).

> Máy Mac **đã cài một bản ZONO Agentic AI khác** có ZL-CRM: chạy với `--no-zlcrm`, vì bộ cài sẽ đặt lại mật khẩu
> tài khoản PostgreSQL `zlcrm` dùng chung và làm bản cũ mất kết nối Zalo.

## Máy Windows

Yêu cầu: Windows 10/11 64-bit, còn trống **≥ 15 GB**, có Internet, quyền Admin, có `winget`
(Windows 11 có sẵn; Windows 10: cài "App Installer" từ Microsoft Store).

1. Giải nén file zip vào thư mục **ngắn, không dấu**, ví dụ `C:\ZONO` (tránh lỗi "đường dẫn quá dài").
2. Nhấp đúp **`INSTALL.cmd`** — tự cài Node.js 24, Git, uv, ffmpeg, Chrome, pnpm, Claude Code CLI, Codex CLI, thư viện hệ thống,
   tạo PostgreSQL trống cho ZL-CRM (bản đóng gói sẵn trong `runtime\pgsql`, cổng 5433) và công cụ video AI. Mất 15–40 phút lần đầu.
3. Mở cửa sổ mới, gõ `claude`, đăng nhập tài khoản Claude (lệnh `/login`).

Chạy hệ thống: nhấp đúp **`start-zono.cmd`** (hoặc lối tắt "ZONO Agentic AI" trên Desktop) → http://localhost:5173

Bản nhẹ: `powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1 -SkipVideoAi` (thêm `-SkipZlcrm` để bỏ Zalo).

## Địa chỉ

| Dịch vụ | Địa chỉ |
| --- | --- |
| Giao diện | http://localhost:5173 |
| API | http://127.0.0.1:8787 |
| ZL-CRM (Zalo) | http://localhost:5174 (backend 3000; PostgreSQL: Mac dùng bản hệ thống cổng 5432, Windows dùng bản riêng cổng 5433) |

## Sau khi cài — việc làm 1 lần

1. **Mục tiêu & DNA → Nạp DNA**: đưa tài liệu hoặc link website để AI điền hồ sơ doanh nghiệp.
2. **Trung tâm tích hợp**: kết nối Fanpage, TikTok, Zalo, Pancake… (bản trắng chưa có kết nối nào).
3. **ZL-CRM**: đăng nhập bằng `BOOTSTRAP_ADMIN_PHONE` / `BOOTSTRAP_ADMIN_PASSWORD` trong `services/zl-crm/backend/.env`, rồi quét QR nick Zalo.
4. **Sản xuất video Flow**: chọn hồ sơ Chrome và đăng nhập Google Flow 1 lần.
5. Muốn Jev chạy thật: điền `TYPESAFE_API_KEY` vào `.env` (để trống = chế độ heuristic).

## Khi có lỗi

- Xem **`install.log`** trong thư mục cài. Nguyên nhân thường gặp nhất là mất Internet giữa chừng → chạy lại bộ cài.
- Cổng 5173 / 8787 / 3000 / 5174 (Windows thêm 5433) đang bị chương trình khác dùng → tắt chương trình đó.
- Windows SmartScreen cảnh báo khi chạy `.cmd`: chọn *More info → Run anyway*.
- Muốn xóa sạch làm lại từ đầu: xóa `.env`, thư mục `data` và `services/zl-crm/data`, rồi chạy lại bộ cài.

## Đóng gói lại

- Bản trắng (file này): `python3 scripts/package-blank.py` (xem hướng dẫn ở đầu file).
- Bản kèm toàn bộ dữ liệu của một máy Windows đang chạy: `python scripts\package-release.py`.
