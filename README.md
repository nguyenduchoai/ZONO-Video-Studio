# 🎬 ZONO Video Studio — Giải Mã Video Mẫu (Decode) & Xưởng Làm Video AI Độc Lập

Nền tảng chuyên biệt 100% cho **tệp khách hàng làm Video thương mại (TikTok / Reels / Shorts / Quảng cáo)** chạy trực tiếp trên máy Local kết hợp cùng các CLI AI (**Claude CLI**, **Gemini CLI**, **Codex CLI**).

---

## ✨ 4 Phân Khu Tinh Gọn Của ZONO Video Studio

1. **🎬 Studio Phim AI (`/` & `/studio`)**:
   - **Bước 1 (Decode Video Mẫu)**: Bóc tách cảnh quay thật (FFmpeg Scene Detection), nhận diện giọng nói gốc (Faster-Whisper), xuất Bảng Contact Sheet và tự động gọi CLI AI (`Claude CLI` / `Gemini CLI` / `Codex CLI`) viết lại lời thoại mới + dựng thành file `.mp4` mới.
   - **💬 Khung Chat Đạo Diễn AI**: Nhắn yêu cầu bằng tiếng Việt tự nhiên hoặc bấm nút chọn nhanh để thay đổi **cách cắt** (giây bắt đầu/kết thúc, Zoom Punch, chuyển cảnh), **lời thoại**, và **vị trí đặt chữ** (`⬆️ Trên cao`, `🎯 Chính giữa`, `⬇️ Dưới đáy`, `🙈 Ẩn chữ`).
   - **Bước 2 & 3**: Ghép các clip quay sẵn (Raw Footage), lồng tiếng Việt AI (`VieNeu-TTS` chuẩn âm `-14 LUFS`, tự động tắt tiếng gốc & che phụ đề cũ của video mẫu) và tải file `.mp4` hoàn chỉnh.
2. **🎞️ Xưởng Làm Video (`/video-flow`)**:
   - Dựng video chuyên sâu từ nhiều clip quay sẵn, tự động cắt bỏ khoảng lặng, chèn nhạc nền, hiệu ứng chuyển cảnh và phụ đề karaoke.
3. **🧬 DNA Sản Phẩm & Thương Hiệu (`/dna`)**:
   - Lưu thông tin thương hiệu, sản phẩm chủ lực, điểm mạnh và tệp khách hàng để AI viết kịch bản/lời thoại chuẩn xác.
4. **⚙️ Cấu Hình CLI AI (`/settings`)**:
   - Quét và kết nối một chạm với `claude` (Anthropic Claude CLI), `gemini`/`agy` (Google Gemini CLI) và `codex` (OpenAI Codex CLI) trên máy.

---

## 🚀 Cài Đặt & Khởi Chạy Nhanh

```bash
# 1. Cài đặt dependencies & quét tự động các CLI AI trên máy
pnpm bootstrap
pnpm run scan-cli

# 2. Khởi chạy ZONO Video Studio
pnpm dev
```

- **Giao diện Web Studio**: `http://localhost:5173`
- **API Server**: `http://localhost:8787`
