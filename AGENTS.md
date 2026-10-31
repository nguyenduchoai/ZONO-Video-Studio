# AGENTS.md — Hướng dẫn Tự Động Cài Đặt, Vận Hành & Hướng Dẫn Sử Dụng cho OpenAI Codex (`codex`), Claude (`claude`) & Gemini (`agy`)

Khi người dùng đưa link GitHub `https://github.com/nguyenduchoai/ZONO-Video-Studio` hoặc mở mã nguồn này và yêu cầu **"Cài đặt"**, **"Chạy hệ thống"** hoặc **"Hướng dẫn sử dụng"**, AI Agent (**Codex / Claude / Gemini**) **PHẢI** tự động thực hiện tuần tự các bước dưới đây mà không cần hỏi lại người dùng:

## 1. Tự động Cài đặt & Quét toàn bộ CLI AI trên hệ thống

```bash
# Nếu chưa clone repo về máy:
# git clone https://github.com/nguyenduchoai/ZONO-Video-Studio.git && cd ZONO-Video-Studio

# 1. Đảm bảo đã có ffmpeg trên máy
command -v ffmpeg >/dev/null 2>&1 || (command -v brew >/dev/null 2>&1 && brew install ffmpeg)

# 2. Cài đặt dependencies Node.js + Python .venv (Pillow, faster-whisper, VieNeu-TTS / edge-tts)
pnpm bootstrap

# 3. Tự động quét và đồng bộ các CLI AI trên máy (Claude CLI, OpenAI Codex CLI, Google Gemini CLI)
pnpm run scan-cli
```

Lệnh `pnpm run scan-cli` sẽ tự động đi quét toàn bộ hệ thống (`PATH`, `~/.local/bin`, `/opt/homebrew/bin`, `/usr/local/bin`, `nvm`, `fnm`, `volta`, `bun`, `pnpm`) để tìm và đồng bộ:
1. **Anthropic Claude CLI (`claude`)**: tự động đọc phiên đăng nhập từ `~/.claude/.credentials.json`, `~/.claude.json`, hoặc macOS Keychain.
2. **OpenAI Codex CLI (`codex`)**: tự động đọc phiên đăng nhập ChatGPT từ `~/.codex/auth.json`.
3. **Google Gemini / Antigravity CLI (`agy` hoặc `gemini`)**: tự động đọc phiên đăng nhập Google OAuth từ `~/.gemini/`.

## 2. Khởi chạy hệ thống

```bash
pnpm dev
```
- **Giao diện Web Video Studio**: `http://localhost:5173`
- **API Server**: `http://localhost:8787`

## 3. Hướng dẫn Sử dụng gửi cho Người dùng sau khi Khởi chạy

Sau khi hệ thống đã chạy tại `http://localhost:5173`, hãy gửi hướng dẫn sử dụng sau cho người dùng:

- **Bước 1 — Giải Mã Video Mẫu (`http://localhost:5173`)**:
  - Chọn CLI AI muốn dùng (`Claude CLI` · `Gemini CLI` · `Codex CLI`) ở góc trên bên phải hoặc đầu Bước 1.
  - Bấm **"Tải Video Mẫu cần Decode (.mp4/.mov)"** hoặc chọn video có sẵn trong kho máy. Hệ thống sẽ tự động tách cảnh bằng FFmpeg, nhận diện lời gốc bằng Faster-Whisper, dùng CLI AI viết lại lời thoại mới và kết xuất **Video MP4 Mới** ngay tại Bước 1.
- **💬 Khung Chat Đạo Diễn AI (Ngay trong Bước 1)**:
  - Đổi **Vị trí đặt chữ Phụ đề** chỉ với 1 cú nhấp chuột: `⬆️ Trên cao (22%)` · `🎯 Chính giữa (52%)` · `⬇️ Dưới đáy (77%)` · `🙈 Ẩn chữ`.
  - Nhắn trực tiếp vào ô Chat hoặc bấm nút gợi ý nhanh để yêu cầu AI đổi **Cách cắt** (giây bắt đầu/kết thúc, Zoom Punch, chuyển cảnh Dissolve/Slide/Cut), **Lời thoại**, hoặc **Vị trí chữ**, rồi bấm **"Gửi AI & Dựng Lại MP4"**.
- **Bước 2 & Bước 3 — Ghép Video Quay Sẵn & Xuất MP4**:
  - Tải các clip quay sản phẩm/cửa hàng lên ở Bước 2, chọn giọng đọc tiếng Việt `VieNeu-TTS` (tự động tắt tiếng gốc và che phụ đề cũ của video mẫu).
  - Tinh chỉnh giây cắt (`Từ ...s → ...s`), hiệu ứng Zoom, Chuyển cảnh, Lời thoại ở Bước 3 và bấm **"Tải MP4 về máy"**.
- **Các trang công cụ đi kèm**:
  - `http://localhost:5173/video-flow`: **Xưởng Làm Video** (dựng hàng loạt từ clip quay sẵn).
  - `http://localhost:5173/dna`: **DNA Sản Phẩm & Thương Hiệu** (cung cấp thông tin sản phẩm cho AI).
  - `http://localhost:5173/settings`: **Cấu Hình CLI AI** (quản lý tài khoản Claude / Gemini / Codex CLI).
