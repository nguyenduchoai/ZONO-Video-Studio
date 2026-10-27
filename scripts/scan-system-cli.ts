#!/usr/bin/env tsx
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDb, q } from "@dotaka/db";
import { autoConfigureSystemClis, cliInfo, probeCliAuth, scanSystemAiClis } from "@dotaka/llm-gateway";

async function main() {
  console.log("\n🔍 Đang tự động quét các công cụ AI CLI trên toàn hệ thống...\n");
  const scan = scanSystemAiClis(true);

  console.log(`  Hệ điều hành: ${scan.platform} (đã quét ${scan.discoveredPathDirs.length} thư mục PATH hệ thống)`);
  await probeCliAuth().catch(() => null);
  const cInfo = cliInfo();

  const items = [
    {
      label: "1. Anthropic Claude CLI",
      found: scan.claude.found,
      path: scan.claude.resolvedPath ?? scan.claude.bin,
      version: scan.claude.version,
      ready: cInfo.loggedIn === true,
      authNote: cInfo.loggedIn === true
        ? `Sẵn sàng (${scan.claude.authSource ?? "OAuth"})`
        : cInfo.authError ?? (scan.claude.loggedIn ? "Đã có thông tin đăng nhập" : "Chưa đăng nhập"),
      envKey: "CLAUDE_CLI_PATH",
    },
    {
      label: "2. Google Gemini CLI",
      found: scan.gemini.found,
      path: scan.gemini.resolvedPath ?? scan.gemini.bin,
      version: scan.gemini.version,
      ready: scan.gemini.loggedIn,
      authNote: scan.gemini.loggedIn
        ? `Sẵn sàng (${scan.gemini.accountHint ? `${scan.gemini.accountHint} · ` : ""}${scan.gemini.authSource ?? "Google OAuth"})`
        : "Chưa đăng nhập Google",
      envKey: "GEMINI_CLI_PATH",
    },
    {
      label: "3. OpenAI Codex CLI",
      found: scan.codex.found,
      path: scan.codex.resolvedPath ?? scan.codex.bin,
      version: scan.codex.version,
      ready: scan.codex.loggedIn,
      authNote: scan.codex.loggedIn
        ? `Sẵn sàng (${scan.codex.accountHint ? `${scan.codex.accountHint} · ` : ""}${scan.codex.authSource ?? "ChatGPT OAuth"})`
        : "Chưa đăng nhập ChatGPT",
      envKey: "CODEX_CLI_PATH",
    },
  ];

  for (const item of items) {
    const icon = item.found && item.ready ? "✅" : item.found ? "⚠️" : "❌";
    console.log(`  ${icon} ${item.label}`);
    console.log(`     • Đường dẫn: ${item.found ? item.path : "Không tìm thấy trên máy"}`);
    if (item.version) console.log(`     • Phiên bản: ${item.version}`);
    console.log(`     • Trạng thái: ${item.authNote}\n`);
  }

  // Ghi đường dẫn CLI tìm được vào .env nếu .env tồn tại
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    let envContent = readFileSync(envPath, "utf8");
    let updated = false;
    for (const item of items) {
      if (item.found && item.path) {
        const line = `${item.envKey}=${item.path}`;
        const re = new RegExp(`^#?\\s*${item.envKey}=.*$`, "m");
        if (re.test(envContent)) {
          envContent = envContent.replace(re, line);
        } else {
          envContent = `${envContent.trimEnd()}\n${line}\n`;
        }
        updated = true;
      }
    }
    if (updated) {
      writeFileSync(envPath, envContent);
      console.log("  💾 Đã tự động lưu đường dẫn CLI vào file .env");
    }
  }

  // Đồng bộ tài khoản vào Database nếu đã khởi tạo
  try {
    openDb();
    const biz = q.get<{ id: string }>("SELECT id FROM biz LIMIT 1");
    if (biz) {
      autoConfigureSystemClis(biz.id, true);
      console.log("  🔗 Đã tự động đồng bộ hồ sơ đăng nhập CLI vào cơ sở dữ liệu ZONO.\n");
    }
  } catch {
    // Database chưa tạo thì sẽ tự động đồng bộ ngay khi server khởi chạy
  }
}

main().catch((err) => {
  console.error("Lỗi khi quét CLI:", err);
  process.exit(1);
});
