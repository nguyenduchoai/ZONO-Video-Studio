#!/usr/bin/env node
// In ra dòng stamp "YYYY-MM-DD HH:MM · branch `X` @ `sha`" để paste vào TODO.local.md
// Usage: node scripts/todo-stamp.mjs

import { execSync } from "node:child_process";

const sh = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();

const branch = sh("git rev-parse --abbrev-ref HEAD");
const sha = sh("git rev-parse --short HEAD");

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

const stampDiscover = `  - 🔍 Phát hiện: ${ts} · branch \`${branch}\` @ \`${sha}\``;
const stampDone = `  - ✔️ Hoàn thành: ${ts} · branch \`${branch}\` @ \`${sha}\``;

console.log("\n--- PHÁT HIỆN (paste khi thêm item mới) ---");
console.log(stampDiscover);
console.log("\n--- HOÀN THÀNH (paste khi tick xong) ---");
console.log(stampDone);
console.log("");
