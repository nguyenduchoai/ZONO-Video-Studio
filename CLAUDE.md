# ZONO Agentic AI — Hướng dẫn tự động cài đặt & vận hành cho AI Agent

Xem chi tiết tại [AGENTS.md](./AGENTS.md).

## Quy trình tự động khi được yêu cầu cài đặt từ Source:
1. Chạy `pnpm install` (hoặc `pnpm bootstrap --no-video-ai` nếu máy mới hoàn toàn).
2. Chạy `pnpm run scan-cli` để tự động đi quét toàn bộ hệ thống tìm các CLI AI đã cài (`claude`, `codex`, `agy` / `gemini`), ghi đường dẫn vào `.env` và đồng bộ tài khoản đăng nhập sẵn trên máy vào cơ sở dữ liệu.
3. Chạy `pnpm dev` để mở giao diện tại `http://localhost:5173` và API tại `http://localhost:8787`.
