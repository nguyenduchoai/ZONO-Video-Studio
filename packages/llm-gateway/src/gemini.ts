import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { AppError } from "@dotaka/shared";
import { safeJson } from "./cli.ts";
import { findSystemBinary, scanSystemAiClis } from "./system-scanner.ts";

/**
 * Google Gemini CLI provider (`agy` / `@google/gemini-cli`):
 * Tự động quét hệ thống tìm `agy` hoặc `gemini` và phiên đăng nhập Google OAuth trên máy.
 */
const WORKDIR = join(tmpdir(), "zono-gemini-cli");
const TIMEOUT_MS = Number(process.env.GEMINI_CLI_TIMEOUT_MS ?? 180_000);

export function geminiCommand(): { bin: string; args: string[]; isAgy?: boolean } {
  const discovered = findSystemBinary(
    ["agy", "gemini"],
    process.env.GEMINI_CLI_PATH,
    [join("node_modules", "@google", "gemini-cli", "bundle", "gemini.js")],
  );
  const isAgy = Boolean((discovered.resolvedPath ?? discovered.bin) && /\bagy(?:\.exe|\.cmd)?$/i.test(discovered.resolvedPath ?? discovered.bin));
  return { bin: discovered.bin, args: discovered.args, isAgy };
}

let cachedInfo: { available: boolean; version?: string; loggedIn: boolean; bin?: string; authSource?: string; checkedAt: number } | null = null;

export function geminiInfo() {
  if (!cachedInfo || !cachedInfo.available || Date.now() - cachedInfo.checkedAt > 30_000) {
    const scan = scanSystemAiClis().gemini;
    cachedInfo = {
      available: scan.found,
      version: scan.version,
      loggedIn: scan.loggedIn,
      bin: scan.resolvedPath ?? scan.bin,
      authSource: scan.authSource,
      checkedAt: Date.now(),
    };
  }
  return cachedInfo;
}

export const GEMINI_MODELS = [
  { id: "gemini-3.8-flash-medium", label: "Gemini 3.8 Flash", note: "Nhanh, tiết kiệm — trực chat, viết bài nhanh, tóm tắt" },
  { id: "gemini-4-argon-medium", label: "Gemini 4 Argon", note: "Mạnh, suy luận sâu — viết bài chuẩn SEO, chiến lược, kịch bản" },
  { id: "gemini-4-argon-high", label: "Gemini 4 Argon High", note: "Suy luận tối đa — phân tích chuyên sâu" },
] as const;

export const DEFAULT_GEMINI_MODELS = {
  small: "gemini-3.8-flash-medium",
  medium: "gemini-3.8-flash-medium",
  large: "gemini-4-argon-medium",
} as const;

function resolveAgyModel(model: string): string {
  if (!model || model === "default" || model === "gemini-2.5-flash" || model === "gemini-2.0-flash") return "gemini-3.8-flash-medium";
  if (model === "gemini-2.5-pro") return "gemini-4-argon-medium";
  return model;
}

export async function runGeminiCli(opts: {
  prompt: string;
  system: string;
  model: string;
  jsonSchema: object;
}): Promise<{ structured: unknown; model: string; usage: { input: number; output: number; cached: number }; durationMs: number }> {
  const cmd = geminiCommand();
  mkdirSync(WORKDIR, { recursive: true });
  const fullPrompt = [
    opts.system,
    "",
    "YÊU CẦU ĐẦU RA BẮT BUỘC: Chỉ trả về ĐÚNG MỘT đối tượng JSON hợp lệ khớp với JSON Schema bên dưới. Không bọc markdown, không giải thích thêm.",
    `JSON Schema: ${JSON.stringify(opts.jsonSchema)}`,
    "",
    opts.prompt,
  ].join("\n");

  const effectiveModel = cmd.isAgy ? resolveAgyModel(opts.model) : opts.model;
  const args = cmd.isAgy
    ? [...cmd.args, "-p", fullPrompt, "--output-format", "json", "--disable-slash-commands", "--model", effectiveModel]
    : [...cmd.args, "-p", fullPrompt, ...(effectiveModel && effectiveModel !== "default" ? ["-m", effectiveModel] : [])];

  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(cmd.bin, args, {
      cwd: WORKDIR,
      env: { ...process.env, NO_COLOR: "1", GEMINI_CLI_TRUST_WORKSPACE: "true" },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new AppError("GEMINI_TIMEOUT", "Gemini CLI quá thời gian phản hồi", 504));
    }, TIMEOUT_MS);

    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new AppError("GEMINI_SPAWN_ERROR", `Không chạy được lệnh gemini: ${e.message}`, 500));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - started;
      if (code !== 0 && !out.trim()) {
        const raw = `${out}\n${err}`.trim();
        if (/login|auth|credential|unauthenticated/i.test(raw)) {
          return reject(new AppError("GEMINI_AUTH", "Chưa đăng nhập Gemini CLI — mở Terminal gõ `agy` hoặc `gemini` để đăng nhập tài khoản Google.", 401));
        }
        return reject(new AppError("GEMINI_FAILED", `Gemini CLI báo lỗi: ${raw.slice(0, 240)}`, 502));
      }
      let rawText = out.trim();
      let estIn = Math.max(1, Math.round(fullPrompt.length / 4));
      let estOut = Math.max(1, Math.round(out.length / 4));
      let cached = 0;

      // Nếu chạy qua `agy --output-format json`, giải nén lớp vỏ JSON ngoài (`{ status: "SUCCESS", response: "...", usage: {...} }`)
      const outer = safeJson(rawText) as Record<string, any> | undefined;
      if (outer && typeof outer === "object" && typeof outer.response === "string" && ("conversation_id" in outer || "status" in outer)) {
        rawText = outer.response.trim();
        if (outer.usage && typeof outer.usage === "object") {
          estIn = Number(outer.usage.input_tokens) || estIn;
          estOut = Number(outer.usage.output_tokens) || estOut;
          cached = Number(outer.usage.cache_read_tokens) || 0;
        }
      }

      const structured = safeJson(rawText);
      if (structured === undefined) {
        return reject(new AppError("GEMINI_INVALID_JSON", `Gemini CLI không trả về JSON hợp lệ: ${rawText.slice(0, 200)}`, 502));
      }
      resolve({
        structured,
        model: effectiveModel || "gemini-3.8-flash-medium",
        usage: { input: estIn, output: estOut, cached },
        durationMs,
      });
    });
  });
}
