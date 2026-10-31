# CLAUDE.md — Hướng dẫn Tự Động Cài Đặt, Vận Hành & Hướng Dẫn Sử Dụng cho Claude Code (`claude`)

Khi người dùng gửi link GitHub `https://github.com/nguyenduchoai/ZONO-Video-Studio` hoặc mở thư mục này và yêu cầu cài đặt / chạy / hướng dẫn sử dụng, **Claude Code PHẢI thực hiện tự động toàn bộ quy trình dưới đây mà không cần hỏi lại người dùng**:

## 1. Quy trình Tự động Cài đặt & Khởi chạy (Zero-Prompt Setup)

Chạy tuần tự các lệnh sau:

```bash
# Bước 1: Kiểm tra ffmpeg (cài qua Homebrew nếu thiếu trên macOS)
command -v ffmpeg >/dev/null 2>&1 || (command -v brew >/dev/null 2>&1 && brew install ffmpeg)

# Bước 2: Chạy bootstrap cài đặt Node.js packages + Python .venv (Pillow, faster-whisper, VieNeu-TTS / edge-tts)
pnpm bootstrap

# Bước 3: Tự động quét và nạp phiên đăng nhập Claude CLI, Gemini CLI, Codex CLI trên máy
pnpm run scan-cli

# Bước 4: Khởi chạy Web Studio (port 5173) và API Server (port 8787)
pnpm dev
```

- **Web Studio**: `http://localhost:5173`
- **API Server**: `http://localhost:8787`

---

## 2. Hướng dẫn Sử dụng gửi cho Người dùng sau khi Khởi chạy xong

Sau khi chạy `pnpm dev` và xác nhận `http://localhost:5173` hoạt động, hãy trình bày cho người dùng bản hướng dẫn ngắn gọn, rõ ràng sau:

1. **Mở trình duyệt tại `http://localhost:5173`** (vào thẳng **🎬 Studio Phim AI**):
   - **Chọn bộ não CLI AI** ở thanh trên cùng (`Claude CLI` · `Gemini CLI` · `Codex CLI`).
   - **Bước 1 (Decode Video Mẫu)**: Bấm **"Tải Video Mẫu cần Decode (.mp4/.mov)"** hoặc chọn video có sẵn trên máy. Hệ thống sẽ tự động bóc tách cảnh quay, nhận diện lời gốc, dùng CLI AI viết kịch bản mới và dựng luôn file **Video MP4 Mới** ngay tại Bước 1.
2. **Dùng 💬 Khung Chat Đạo Diễn AI (Ngay trong Bước 1)**:
   - Chọn nhanh **📍 Vị trí đặt chữ Phụ đề**: `⬆️ Trên cao` · `🎯 Chính giữa` · `⬇️ Dưới đáy` · `🙈 Ẩn chữ`.
   - Bấm các nút gợi ý 1-Click hoặc gõ yêu cầu bất kỳ vào ô Chat để sửa:
     - **Cách cắt**: *"Đổi cách cắt sang nhịp nhanh TikTok + Zoom Punch"*, *"Đổi sang chuyển cảnh mượt Dissolve"*, *"Cắt cảnh 2 từ giây 3 đến giây 8"*.
     - **Lời thoại**: *"Viết lại lời thoại ngắn gọn, chốt đơn mạnh hơn"*.
     - **Vị trí chữ**: *"Đưa chữ phụ đề ra chính giữa màn hình"*.
   - Bấm **"Gửi AI & Dựng Lại MP4"**, hệ thống sẽ tự động sửa kịch bản/nhịp cắt và kết xuất lại file `.mp4` ngay lập tức.
3. **Bước 2 & Bước 3 (Ghép Video Quay Sẵn & Tinh chỉnh chi tiết)**:
   - Tải lên các clip quay sẵn của cửa hàng ở Bước 2, chọn giọng đọc tiếng Việt `VieNeu-TTS` (tự động tắt tiếng cũ và che phụ đề cũ của video gốc).
   - Ở Bước 3, có thể chỉnh trực tiếp từng cảnh (`Từ giây -> Đến giây`, `Zoom`, `Chuyển cảnh`, `Chữ nổi`, `Lời thoại`) và bấm **"Tải MP4 về máy"**.
4. **Các phân khu khác trên thanh điều hướng**:
   - **`🎞️ Xưởng Làm Video` (`/video-flow`)**: Dựng video hàng loạt từ clip quay thô, cắt khoảng lặng, chèn nhạc nền.
   - **`🧬 DNA Sản Phẩm` (`/dna`)**: Khai báo thương hiệu & sản phẩm để AI viết lời thoại sát thực tế.
   - **`⚙️ CLI AI` (`/settings`)**: Kiểm tra và quản lý kết nối `Claude CLI`, `Gemini CLI`, `Codex CLI`.
