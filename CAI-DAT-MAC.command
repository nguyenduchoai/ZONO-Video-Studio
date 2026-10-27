#!/bin/bash
# ZONO Agentic AI - cài đặt trên máy Mac mới. Nhấp đúp file này (an toàn khi chạy lại nhiều lần).
#   Lần đầu macOS có thể chặn: nhấp chuột phải vào file > Open > Open.
#   Hoặc mở Terminal, kéo file này vào cửa sổ Terminal rồi nhấn Enter.
#   Tuỳ chọn: --no-zlcrm (bỏ ZL-CRM/Zalo) · --no-video-ai (bỏ công cụ video AI, nhẹ hơn ~3 GB)
set -u
cd "$(dirname "$0")" || exit 1
ROOT="$(pwd)"
LOG="$ROOT/install.log"
exec > >(tee -a "$LOG") 2>&1

ok()   { printf '   [OK] %s\n' "$1"; }
warn() { printf '   [!]  %s\n' "$1"; }
step() { printf '\n>> %s\n' "$1"; }
has()  { command -v "$1" >/dev/null 2>&1; }
finish() {
  echo
  if [ "$1" -eq 0 ]; then echo "CÀI ĐẶT XONG. Nhấp đúp CHAY-ZONO.command để chạy hệ thống."
  else echo "CÀI ĐẶT CHƯA HOÀN TẤT (mã lỗi $1). Xem install.log, sửa lỗi rồi chạy lại CAI-DAT-MAC.command."; fi
  if [ -t 0 ]; then printf '\nNhấn Enter để đóng...'; read -r _; fi
  exit "$1"
}

echo "ZONO Agentic AI - cài đặt máy Mac"
echo "Thư mục cài: $ROOT"

# 0) Kiểm tra máy -----------------------------------------------------------------------------------
step "Kiểm tra máy"
[ "$(uname -s)" = "Darwin" ] || { warn "File này dành cho macOS. Windows: dùng INSTALL.cmd."; finish 1; }
FREE_GB=$(df -g "$ROOT" | awk 'NR==2 {print $4}')
if [ "${FREE_GB:-0}" -lt 8 ]; then warn "Ổ đĩa chỉ còn ${FREE_GB} GB trống - cần ít nhất 8 GB (15 GB nếu cài video AI)."; finish 1; fi
ok "macOS $(sw_vers -productVersion), ổ đĩa còn ${FREE_GB} GB trống"
if curl -fsI --max-time 20 https://registry.npmjs.org/ >/dev/null 2>&1; then ok "Có Internet"; else warn "Không kết nối được Internet - cài đặt cần Internet để tải thư viện."; fi

# 1) Homebrew + phần mềm nền --------------------------------------------------------------------------
step "Phần mềm nền (Homebrew, Node.js 24, Git, PostgreSQL 17, ffmpeg, Python, uv)"
export PATH="$HOME/.local/bin:$HOME/bin:$PATH"
for p in /opt/homebrew/bin /usr/local/bin; do [ -x "$p/brew" ] && eval "$("$p/brew" shellenv)"; done
if ! has brew; then
  echo "   Chưa có Homebrew - đang cài (sẽ hỏi mật khẩu máy Mac, gõ rồi nhấn Enter)..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || { warn "Không cài được Homebrew. Cài tay tại https://brew.sh rồi chạy lại."; finish 1; }
  for p in /opt/homebrew/bin /usr/local/bin; do [ -x "$p/brew" ] && eval "$("$p/brew" shellenv)"; done
fi
has brew || { warn "Không tìm thấy Homebrew sau khi cài."; finish 1; }
ok "Homebrew"

node_major() { has node && node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
if [ "$(node_major)" -lt 24 ]; then
  brew install node@24 && brew link --overwrite --force node@24
fi
if [ "$(node_major)" -lt 24 ]; then warn "Cần Node.js 24 trở lên (đang có $(has node && node -v || echo 'không có')). Cài từ https://nodejs.org rồi chạy lại."; finish 1; fi
ok "Node.js $(node -v)"
has git || brew install git
has git && ok "$(git --version)" || { warn "Chưa có Git."; finish 1; }

SKIP_ZL=0; SKIP_VIDEO_AI=0
for a in "$@"; do [ "$a" = "--no-zlcrm" ] && SKIP_ZL=1; [ "$a" = "--no-video-ai" ] && SKIP_VIDEO_AI=1; done
if [ "$SKIP_ZL" -eq 0 ]; then
  if ! has psql; then brew install postgresql@17 && brew link --overwrite --force postgresql@17 || warn "Chưa cài được PostgreSQL - ZL-CRM (Zalo) sẽ bị bỏ qua."; fi
  if has psql; then
    pg_isready -q 2>/dev/null || brew services start postgresql@17 >/dev/null 2>&1 || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do pg_isready -q 2>/dev/null && break; sleep 1; done
    pg_isready -q 2>/dev/null && ok "PostgreSQL đang chạy" || warn "PostgreSQL chưa chạy - thử: brew services start postgresql@17"
  fi
fi
has ffmpeg || brew install ffmpeg || warn "Chưa cài được ffmpeg (ghép video sẽ không chạy)."
has python3 || brew install python || warn "Chưa cài được Python 3."
has uv || brew install uv || warn "Chưa cài được uv (công cụ video AI sẽ không cài được)."

# 2) pnpm + Quét các CLI AI trên hệ thống (Claude, OpenAI Codex, Google Gemini) ------------------------
step "pnpm & Quét các công cụ AI CLI trên máy"
PNPM_WANTED=$(node -p 'require("./package.json").packageManager.split("@")[1]')
has pnpm || npm install -g "pnpm@$PNPM_WANTED" || { warn "Không cài được pnpm."; finish 1; }
ok "pnpm $(pnpm -v) (repo khóa $PNPM_WANTED)"
has claude && ok "Đã phát hiện Claude CLI: $(command -v claude)"
has codex && ok "Đã phát hiện OpenAI Codex CLI: $(command -v codex)"
if has agy; then ok "Đã phát hiện Google Gemini (Antigravity) CLI: $(command -v agy)"
elif has gemini; then ok "Đã phát hiện Google Gemini CLI: $(command -v gemini)"
fi
if ! has claude && ! has codex && ! has agy && ! has gemini; then
  npm install -g @anthropic-ai/claude-code || warn "Chưa cài sẵn CLI AI nào trên máy."
fi

# 3) Hệ thống: thư viện, .env, skill, công cụ video, ZL-CRM, tự kiểm tra ------------------------------------
step "Cài hệ thống (bootstrap)"
BOOT_ARGS=()
# Gói trắng = không kèm .env và data/dotaka.db → tạo doanh nghiệp mới, DNA trống, không cấu hình của ZONO.
if [ ! -f .env ] && [ ! -f data/dotaka.db ]; then BOOT_ARGS+=(--new-business); echo "   Chế độ: cài TRẮNG (doanh nghiệp mới, chưa có dữ liệu)"; fi
[ "$SKIP_ZL" -eq 1 ] && BOOT_ARGS+=(--no-zlcrm)
[ "$SKIP_VIDEO_AI" -eq 1 ] && BOOT_ARGS+=(--no-video-ai)
export CI=true
node scripts/bootstrap.mjs ${BOOT_ARGS[@]+"${BOOT_ARGS[@]}"} || finish $?

chmod +x CHAY-ZONO.command 2>/dev/null || true
echo
echo "Việc cần làm 1 lần trên máy mới:"
echo "  1. Mở Terminal, gõ:  claude   rồi đăng nhập tài khoản Claude (lệnh /login)."
echo "  2. Chạy hệ thống: nhấp đúp CHAY-ZONO.command  ->  http://localhost:5173"
echo "  3. Vào Mục tiêu & DNA > Nạp DNA để khai báo doanh nghiệp, rồi kết nối kênh trong Trung tâm tích hợp."
finish 0
