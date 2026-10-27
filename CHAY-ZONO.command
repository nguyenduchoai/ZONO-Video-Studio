#!/bin/bash
# ZONO Agentic AI - chạy hệ thống trên Mac (API 8787, giao diện 5173, ZL-CRM 3000/5174).
# Nhấp đúp file này. Dừng: đóng cửa sổ này (hoặc Ctrl+C).
cd "$(dirname "$0")" || exit 1
for p in /opt/homebrew/bin /usr/local/bin; do [ -x "$p/brew" ] && eval "$("$p/brew" shellenv)"; done
export PATH="$HOME/.local/bin:$PATH"
stop() { echo; echo "$1"; printf 'Nhấn Enter để đóng...'; read -r _; exit 1; }
command -v node >/dev/null 2>&1 || stop "Chưa có Node.js - hãy chạy CAI-DAT-MAC.command trước."
command -v pnpm >/dev/null 2>&1 || stop "Chưa có pnpm - hãy chạy CAI-DAT-MAC.command trước."
[ -d node_modules ] || stop "Chưa cài thư viện - hãy chạy CAI-DAT-MAC.command trước."
for port in 5173 8787; do
  if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then stop "Cổng $port đang bị chương trình khác dùng - tắt chương trình đó rồi chạy lại."; fi
done
(sleep 6; open "http://localhost:5173") &
pnpm dev
