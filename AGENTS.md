# ZONO Agentic AI — Hướng dẫn tự động cài đặt & vận hành cho AI Agent

Khi người dùng đưa mã nguồn này và yêu cầu **"Cài đặt và chạy hệ thống"**, hãy thực hiện tuần tự các bước tự động sau mà không cần hỏi lại người dùng:

## 1. Tự động cài đặt & quét toàn bộ CLI AI trên hệ thống
Chạy lệnh một chạm:
```bash
pnpm bootstrap --no-video-ai
pnpm run scan-cli
```
Lệnh `pnpm run scan-cli` (từ `scripts/scan-system-cli.ts` và `packages/llm-gateway/src/system-scanner.ts`) sẽ **tự động đi quét toàn bộ hệ thống** (`PATH`, login shell `zsh`/`bash`, `~/.local/bin`, `/opt/homebrew/bin`, `/usr/local/bin`, `nvm`, `fnm`, `volta`, `asdf`, `mise`, `bun`, `pnpm`, Windows `%APPDATA%/npm`) để tìm và đồng bộ:
1. **Anthropic Claude CLI (`claude`)**: tự động đọc phiên đăng nhập từ `~/.claude/.credentials.json`, `~/.claude.json`, hoặc macOS Keychain.
2. **Google Gemini / Antigravity CLI (`agy` hoặc `gemini`)**: tự động đọc phiên đăng nhập Google OAuth từ `~/.gemini/jetski-standalone-oauth-token`, `~/.gemini/oauth_creds.json`, hoặc `~/.gemini/google_accounts.json`.
3. **OpenAI Codex CLI (`codex`)**: tự động đọc phiên đăng nhập ChatGPT từ `~/.codex/auth.json` và nạp vào cơ sở dữ liệu (`ai_account`).

## 2. Khởi chạy hệ thống
```bash
pnpm dev
```
- Giao diện Web: `http://localhost:5173`
- API Server: `http://localhost:8787` (khi khởi động sẽ tự động chạy `autoConfigureSystemClis()` để quét lại CLI, chọn nhà cung cấp sẵn sàng làm mặc định và kích hoạt cơ chế tự động chuyển đổi dự phòng Multi-Provider Failover).
