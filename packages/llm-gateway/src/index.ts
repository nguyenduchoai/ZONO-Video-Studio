import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { bizSettings, insert, q, update } from "@dotaka/db";
import { AppError, logger } from "@dotaka/shared";
import { cliAvailable, cliInfo, runClaudeCli } from "./cli.ts";
import { codexInfo, runCodexCli, runCodexImage } from "./codex.ts";
import { DEFAULT_GEMINI_MODELS, GEMINI_MODELS, geminiInfo, runGeminiCli } from "./gemini.ts";
import { listAiAccounts, selectedAiAccount, withAiAccount } from "./ai-accounts.ts";
import { discoverSystemPathDirs, findSystemBinary, scanSystemAiClis, type SystemCliScanResult } from "./system-scanner.ts";

export { codexInfo, runCodexAgent, runCodexImage } from "./codex.ts";
export { DEFAULT_GEMINI_MODELS, GEMINI_MODELS, geminiInfo, runGeminiCli } from "./gemini.ts";
export { aiAccountHome, cancelAiLogin, checkAiAccount, createAiAccount, disconnectAiAccount, listAiAccounts, mustAiAccount, removeAiAccount, selectedAiAccount, startAiLogin, withAiAccount } from "./ai-accounts.ts";
export { discoverSystemPathDirs, findSystemBinary, scanSystemAiClis, type SystemCliScanResult } from "./system-scanner.ts";

export { buildCliArgs, runInLane, cliAvailable, cliInfo, cliSystemPrompt, fastEnv, fastJsonInstruction, followClaudeRun, noteCliAuth, permissionPath, probeCliAuth, RESUME_PROMPT, runClaudeAgent, runClaudeInTerminal, safeJson, type AgentRunOptions, type AgentRunResult, type ApproverOptions, type TerminalRunOptions } from "./cli.ts";

/**
 * LLM Gateway (spec §16): the ONLY place that calls a language model.
 * Text/vision agents use the selected Claude CLI, OpenAI Codex CLI, or Google Gemini CLI.
 * No provider API keys are used. Only Jev (TypeSafe) uses its own API.
 * Providers (Cài đặt → Chế độ AI, stored in biz settings):
 *  - claude_cli (default) — Claude Code CLI.
 *  - codex_cli — Codex CLI, with an explicitly selected business-owned ChatGPT login profile.
 *  - gemini_cli — Google Gemini CLI (`gemini`), using the user's Google account login.
 *  - sandbox — deterministic drafts from the agent's own generator, offline (also the fallback when `claude` is missing).
 * Model per tier (small/medium/large) is configurable, and any agent can override it.
 * Every call: token budget check before, schema-validated output with up to 2 repair rounds,
 * a model_usage row after.
 */
export type Tier = "small" | "medium" | "large";
export type Provider = "claude_cli" | "codex_cli" | "gemini_cli" | "sandbox";
export type TaskCategory = "complex" | "general" | "image" | "seo" | "video";

export const TASK_CATEGORIES: { id: TaskCategory; label: string; desc: string; recommended: Provider; agents: string[] }[] = [
  { id: "complex", label: "Công việc phức tạp · Chiến lược · Pháp lý · Code/REA", desc: "Phân tích sâu, lập kế hoạch chiến lược, rà soát pháp lý VN (vn-legal-check), dịch ngược ứng dụng (REA)", recommended: "claude_cli", agents: ["brief", "market_research", "strategy", "review", "analytics"] },
  { id: "general", label: "Trò chuyện điều phối · Bán hàng · CRM", desc: "Trợ lý Hiền An / Muse Chat, tư vấn khách hàng, chăm sóc lead, viết bài mạng xã hội thường ngày", recommended: "claude_cli", agents: ["assistant", "chat", "follow_up", "content", "ads"] },
  { id: "image", label: "Tạo Ảnh AI & Thiết kế Visual (4:5 / Banner)", desc: "Sinh ảnh sản phẩm, minh hoạ quảng cáo bằng OpenAI (ChatGPT/Codex) hoặc thiết kế SVG/HTML Chrome Local", recommended: "codex_cli", agents: ["post_image"] },
  { id: "seo", label: "Viết bài chuẩn SEO · Nội dung dài · Tổng hợp Web", desc: "Bài viết chuẩn SEO Website, nghiên cứu từ khóa, tổng hợp tin tức báo chí dài", recommended: "gemini_cli", agents: ["seo_web"] },
  { id: "video", label: "Sản xuất Video · Giải mã Video & Local Studio", desc: "Giải mã Video Mẫu (Decode), dựng phim từ Video Quay Sẵn, kịch bản video ngắn + VieNeu-TTS Local", recommended: "claude_cli", agents: ["video_script", "creative"] },
];

export const DEFAULT_TASK_ROUTING: Record<TaskCategory, Provider> = {
  complex: "claude_cli",
  general: "claude_cli",
  image: "codex_cli",
  seo: "gemini_cli",
  video: "claude_cli",
};

export const DEFAULT_PROVIDER_PRIORITY: Provider[] = ["claude_cli", "gemini_cli", "codex_cli", "sandbox"];

export function taskCategoryForAgent(agentKey: string, promptHint?: string): TaskCategory {
  if (promptHint) {
    const p = promptHint.toLowerCase();
    if (/\b(tạo ảnh|vẽ ảnh|thiết kế ảnh|banner|poster|image|thumbnail)\b/i.test(p)) return "image";
    if (/\b(tạo video|dựng video|video hoạt hình|veo 3|remotion|lồng tiếng|vieneu)\b/i.test(p)) return "video";
    if (/\b(bài seo|chuẩn seo|từ khóa seo|viết bài website|blog seo)\b/i.test(p)) return "seo";
    if (/\b(chiến lược|pháp lý|luật việt nam|vn-legal|rea|dịch ngược|reverse engineer|báo cáo thường niên|kế hoạch chi tiết|phân tích sâu)\b/i.test(p)) return "complex";
  }
  for (const c of TASK_CATEGORIES) {
    if (c.agents.includes(agentKey)) return c.id;
  }
  return "general";
}

/** Models offered in the UI. `id` is what we pass to `claude --model`. */
export const MODEL_CATALOG = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", note: "Nhanh, rẻ — phân loại, chat, tóm tắt" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", note: "Cân bằng — viết nội dung, kịch bản" },
  { id: "claude-opus-5", label: "Claude Opus 5", note: "Mạnh — chiến lược, nghiên cứu" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Opus mới nhất" },
  { id: "claude-fable-5-1", label: "Claude Fable 5.1", note: "Mạnh nhất — việc khó, chậm & tốn hạn mức hơn" },
] as const;
export const CODEX_MODELS = [{ id: "default", label: "Model mặc định của Codex", note: "Theo phiên bản CLI và quyền tài khoản ChatGPT" }];
export const DEFAULT_CODEX_MODELS: Record<Tier, string> = { small: "default", medium: "default", large: "default" };
export function modelCatalog(bizId: string) {
  const p = llmSettings(bizId).provider;
  if (p === "gemini_cli") return [...GEMINI_MODELS];
  if (p !== "codex_cli") return [...MODEL_CATALOG];
  const models = new Set([...Object.values(llmSettings(bizId).models), ...q.all<{ limits: { model?: string } }>("SELECT limits FROM agent_config WHERE biz_id = ?", bizId).map((c) => c.limits?.model).filter((m): m is string => !!m && modelMatchesProvider(m, "codex_cli"))]);
  return [...CODEX_MODELS, ...[...models].filter((m) => m !== "default").map((id) => ({ id, label: id, note: "Model do người dùng chọn; kiểm tra quyền với tài khoản đang dùng" }))];
}
export function modelMatchesProvider(model: string, provider: Provider) {
  if (provider === "codex_cli") return model === "default" || /^gpt-[a-z0-9._-]+$/i.test(model);
  if (provider === "gemini_cli") return /^gemini-[a-z0-9._-]+$/i.test(model);
  return /^(?:claude-[a-z0-9._-]+|haiku|sonnet|opus)$/i.test(model);
}

export const DEFAULT_LLM = {
  provider: (process.env.LLM_PROVIDER === "sandbox" ? "sandbox" : "claude_cli") as Provider,
  models: {
    small: process.env.LLM_MODEL_SMALL ?? "claude-haiku-4-5",
    medium: process.env.LLM_MODEL_MEDIUM ?? "claude-sonnet-5",
    large: process.env.LLM_MODEL_LARGE ?? "claude-opus-5",
  } as Record<Tier, string>,
  effort: "medium" as "low" | "medium" | "high",
  codexAccountId: null as string | null,
  providerModels: {} as Partial<Record<Provider, Record<Tier, string>>>,
  multiProviderEnabled: true,
  taskRouting: { ...DEFAULT_TASK_ROUTING } as Record<TaskCategory, Provider>,
  providerPriority: [...DEFAULT_PROVIDER_PRIORITY] as Provider[],
};
export type LlmSettings = typeof DEFAULT_LLM;

export function llmSettings(bizId?: string): LlmSettings {
  const s = bizId ? ((bizSettings(bizId) as any).llm as Partial<LlmSettings> | undefined) : undefined;
  const merged: LlmSettings = {
    ...DEFAULT_LLM,
    ...(s ?? {}),
    models: { ...DEFAULT_LLM.models, ...(s?.models ?? {}) },
    taskRouting: { ...DEFAULT_TASK_ROUTING, ...(s?.taskRouting ?? {}) },
    providerPriority: Array.isArray(s?.providerPriority) && s.providerPriority.length > 0 ? s.providerPriority : [...DEFAULT_PROVIDER_PRIORITY],
    multiProviderEnabled: s?.multiProviderEnabled ?? true,
  };
  // Older settings may still say "anthropic_api" — that path no longer exists: everything runs on the CLI.
  if (!["sandbox", "claude_cli", "codex_cli", "gemini_cli"].includes(merged.provider)) merged.provider = "claude_cli";
  if (merged.provider === "codex_cli") {
    merged.models = Object.fromEntries((["small", "medium", "large"] as Tier[]).map((t) => [t, modelMatchesProvider(merged.models[t], "codex_cli") ? merged.models[t] : DEFAULT_CODEX_MODELS[t]])) as Record<Tier, string>;
  } else if (merged.provider === "gemini_cli") {
    merged.models = Object.fromEntries((["small", "medium", "large"] as Tier[]).map((t) => [t, modelMatchesProvider(merged.models[t], "gemini_cli") ? merged.models[t] : DEFAULT_GEMINI_MODELS[t]])) as Record<Tier, string>;
  }
  return merged;
}

/** Check whether a specific AI provider is installed and logged in. */
export function providerStatus(bizId: string | undefined, want: Provider): { provider: Provider; ready: boolean; reason?: string } {
  if (want === "claude_cli") {
    const c = cliInfo();
    if (!cliAvailable()) return { provider: "claude_cli", ready: false, reason: "Không tìm thấy lệnh `claude` (Claude Code CLI)" };
    if (c.loggedIn === false) return { provider: "claude_cli", ready: false, reason: c.authError ?? "Claude CLI hết phiên hoặc chạm hạn mức tuần" };
    return { provider: "claude_cli", ready: true };
  }
  if (want === "codex_cli") {
    const account = bizId ? selectedAiAccount(bizId) : null;
    const reason = !codexInfo().available ? "Chưa cài Codex CLI" : !account ? "Chọn hồ sơ tài khoản ChatGPT trong Kết nối AI" : account.login?.state === "waiting" ? "Đang chờ đăng nhập ChatGPT" : !account.loggedIn ? "Hồ sơ ChatGPT chưa đăng nhập" : undefined;
    return { provider: "codex_cli", ready: !reason, ...(reason ? { reason } : {}) };
  }
  if (want === "gemini_cli") {
    const g = geminiInfo();
    const reason = !g.available ? "Chưa cài Gemini CLI (`npm i -g @google/gemini-cli`)" : !g.loggedIn ? "Chưa đăng nhập tài khoản Google trên Gemini CLI (`gemini`)" : undefined;
    return { provider: "gemini_cli", ready: !reason, ...(reason ? { reason } : {}) };
  }
  return { provider: "sandbox", ready: true };
}

/** Status of all AI providers simultaneously for the Multi-Provider Matrix UI. */
export function allProvidersStatus(bizId?: string) {
  return {
    claude_cli: providerStatus(bizId, "claude_cli"),
    codex_cli: providerStatus(bizId, "codex_cli"),
    gemini_cli: providerStatus(bizId, "gemini_cli"),
    sandbox: providerStatus(bizId, "sandbox"),
  };
}

/** Resolve which AI provider should handle a task category, plus ordered fallback chain. */
export function resolveProviderForTask(
  bizId: string | undefined,
  category: TaskCategory = "general",
  preferredProvider?: Provider | null,
): { provider: Provider; ready: boolean; reason?: string; category: TaskCategory; primaryAssigned: Provider; fallbackChain: Provider[] } {
  const s = llmSettings(bizId);
  const primaryAssigned = preferredProvider ?? (s.multiProviderEnabled ? (s.taskRouting?.[category] ?? s.provider) : s.provider);
  const chain: Provider[] = [];
  const pushUnique = (p: Provider) => { if (!chain.includes(p)) chain.push(p); };
  pushUnique(primaryAssigned);
  if (s.multiProviderEnabled) {
    for (const p of s.providerPriority ?? DEFAULT_PROVIDER_PRIORITY) pushUnique(p);
  }
  pushUnique(s.provider);
  pushUnique("sandbox");

  for (const candidate of chain) {
    if (candidate === "sandbox") continue;
    const st = providerStatus(bizId, candidate);
    if (st.ready) {
      return { provider: candidate, ready: true, category, primaryAssigned, fallbackChain: chain };
    }
  }
  const primarySt = providerStatus(bizId, primaryAssigned);
  return { provider: primaryAssigned, ready: primarySt.ready, reason: primarySt.reason, category, primaryAssigned, fallbackChain: chain };
}

/** The provider actually used: automatically routes to any ready local CLI on the machine before falling back to sandbox. */
export function effectiveProvider(bizId?: string): { provider: Provider; ready?: boolean; reason?: string } {
  const want = llmSettings(bizId).provider;
  const wantStatus = providerStatus(bizId, want);
  if (wantStatus.ready && want !== "sandbox") {
    return { provider: want, ready: true };
  }
  const resolved = resolveProviderForTask(bizId, "general");
  if (resolved.ready && resolved.provider !== "sandbox") {
    return { provider: resolved.provider, ready: true };
  }
  return { provider: want, ready: false, reason: wantStatus.reason };
}

/**
 * Tự động quét toàn bộ hệ thống tìm các CLI AI (`claude`, `codex`, `gemini` / `agy`),
 * đồng bộ tài khoản sẵn có vào cơ sở dữ liệu và kích hoạt tự động để dùng ngay sau khi cài đặt.
 */
export function autoConfigureSystemClis(bizId?: string, force = false) {
  const scan = scanSystemAiClis(force);
  try {
    const bizRows = bizId
      ? [{ id: bizId }]
      : q.all<{ id: string }>("SELECT id FROM biz");
    for (const b of bizRows) {
      // Đồng bộ tài khoản Codex từ ~/.codex/auth.json nếu có
      listAiAccounts(b.id, false);
      const st = allProvidersStatus(b.id);
      const cur = llmSettings(b.id);
      const curStatus = st[cur.provider];
      if (!curStatus?.ready || cur.provider === "sandbox") {
        const firstReady = (["claude_cli", "gemini_cli", "codex_cli"] as Provider[]).find((p) => st[p]?.ready);
        if (firstReady && firstReady !== cur.provider) {
          const raw = (bizSettings(b.id) as any) ?? {};
          update("biz", b.id, {
            settings: {
              ...raw,
              llm: {
                ...(raw.llm ?? {}),
                provider: firstReady,
                multiProviderEnabled: true,
              },
            },
          });
        }
      }
    }
  } catch {
    // DB might not be migrated yet during standalone CLI scan
  }
  return {
    scan,
    providersStatus: bizId ? allProvidersStatus(bizId) : undefined,
  };
}
/** Kept for callers that only need "is a real model on?" */
export function llmEnabled(bizId?: string): boolean {
  const e = effectiveProvider(bizId);
  return e.provider !== "sandbox" && e.ready !== false;
}

/** Model for a specific provider & tier. */
export function modelForProvider(bizId: string, provider: Provider, tier: Tier, agentKey?: string): string {
  if (agentKey) {
    const cfg = q.get<{ limits: Record<string, unknown> }>("SELECT limits FROM agent_config WHERE biz_id = ? AND agent_key = ?", bizId, agentKey);
    const override = cfg?.limits?.model;
    if (typeof override === "string" && override && modelMatchesProvider(override, provider)) return override;
  }
  const s = llmSettings(bizId);
  if (provider === s.provider && modelMatchesProvider(s.models[tier], provider)) return s.models[tier];
  const saved = s.providerModels?.[provider]?.[tier];
  if (saved && modelMatchesProvider(saved, provider)) return saved;
  if (provider === "codex_cli") return DEFAULT_CODEX_MODELS[tier];
  if (provider === "gemini_cli") return DEFAULT_GEMINI_MODELS[tier];
  return DEFAULT_LLM.models[tier];
}

/** Model for an agent: per-agent override (agent_config.limits.model) > tier default. */
export function modelFor(bizId: string, agentKey: string, tier: Tier): string {
  return modelForProvider(bizId, llmSettings(bizId).provider, tier, agentKey);
}

export interface GenerateRequest<T> {
  bizId: string;
  agentKey: string;
  tier: Tier;
  taskCategory?: TaskCategory;
  preferredProvider?: Provider;
  taskRunId?: string;
  /** Stable prefix: role, rules, brand DNA. Must not contain timestamps/ids (cacheable). */
  system: string;
  /** Per-task content: retrieved knowledge, lessons, input, reviewer findings. */
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  budget?: { perRun?: number | null; perDay?: number | null };
  sandbox: () => T;
  /** Force a specific model (connection test); normally resolved from agent/tier settings. */
  model?: string;
  /** Skill playbook (DNA + persona + skills) appended after the stable prefix. */
  systemSuffix?: string;
  /**
   * Ảnh cho model xem (bước "bot xem ảnh khách gửi"): tệp trên máy, đã kiểm là ảnh. CLI: chép vào thư mục tạm riêng,
   * chỉ cho công cụ Read trong thư mục đó. Sandbox: bỏ qua (dùng `sandbox()`).
   */
  images?: GenerateImage[];
  /**
   * Câu trả lời cần tức thì (bot chat): CLI chạy chế độ nhanh (JSON thuần trong văn bản, 1 vòng ~5 giây thay vì 9 đến 44 giây).
   * Sai schema thì tự chạy lại bằng chế độ schema chắc chắn. Không áp dụng khi có ảnh.
   */
  fast?: boolean;
}
export type GenerateImage = { path: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" };
export interface GenerateResult<T> {
  output: T;
  model: string;
  source: "claude" | "codex" | "gemini" | "sandbox";
  provider: Provider;
  usage: { input: number; output: number; cached: number; costMicros: number };
}

export class BudgetExceeded extends AppError {
  constructor(msg: string) {
    super("TOKEN_BUDGET_EXCEEDED", msg, 429);
  }
}

export function tokensUsedToday(bizId: string, agentKey: string): number {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  return q.scalar<number>("SELECT COALESCE(SUM(tokens_in + tokens_out), 0) FROM model_usage WHERE biz_id = ? AND agent_key = ? AND at >= ?", bizId, agentKey, since.toISOString()) ?? 0;
}

const FALLBACK: Record<Tier, Tier | null> = { large: "medium", medium: "small", small: null };

export async function generate<T>(input: GenerateRequest<T>): Promise<GenerateResult<T>> {
  const req = input.systemSuffix ? { ...input, system: `${input.system}\n\n${input.systemSuffix}` } : input;
  if (req.budget?.perDay) {
    const used = tokensUsedToday(req.bizId, req.agentKey);
    if (used >= req.budget.perDay) throw new BudgetExceeded(`Agent ${req.agentKey} đã dùng ${used} token hôm nay (trần ${req.budget.perDay}).`);
  }

  // System test or explicit single-provider mode
  const s = llmSettings(req.bizId);
  if (req.agentKey === "system_test" || !s.multiProviderEnabled) {
    const { provider, ready, reason } = effectiveProvider(req.bizId);
    if (provider === "codex_cli" && ready === false) throw new AppError("CODEX_NOT_READY", reason ?? "ChatGPT chưa sẵn sàng", 400);
    if (provider === "gemini_cli" && ready === false) throw new AppError("GEMINI_NOT_READY", reason ?? "Gemini CLI chưa sẵn sàng", 400);
    if (provider === "sandbox") {
      const output = req.schema.parse(req.sandbox());
      record(req, "sandbox", "sandbox", { input: 0, output: 0, cached: 0 }, 0, 0);
      return { output, model: "sandbox", source: "sandbox", provider, usage: { input: 0, output: 0, cached: 0, costMicros: 0 } };
    }
    const model = req.model ?? modelForProvider(req.bizId, provider, req.tier, req.agentKey);
    if (!modelMatchesProvider(model, provider)) throw new AppError("BAD_MODEL", "Model không thuộc kết nối AI đang chọn", 400);
    return executeOnProvider(req, provider, model);
  }

  // Multi-provider Task Routing + Priority Fallback
  const category = req.taskCategory ?? taskCategoryForAgent(req.agentKey, req.user);
  const resolved = resolveProviderForTask(req.bizId, category, req.preferredProvider);
  let lastErr: unknown;

  for (const candidate of resolved.fallbackChain) {
    if (candidate === "sandbox") {
      try {
        const output = req.schema.parse(req.sandbox());
        record(req, "sandbox", "sandbox", { input: 0, output: 0, cached: 0 }, 0, 0);
        return { output, model: "sandbox", source: "sandbox", provider: "sandbox", usage: { input: 0, output: 0, cached: 0, costMicros: 0 } };
      } catch (sandboxErr) {
        if (lastErr) throw lastErr;
        throw sandboxErr;
      }
    }
    const st = providerStatus(req.bizId, candidate);
    if (!st.ready) continue;
    const model = (req.model && modelMatchesProvider(req.model, candidate)) ? req.model : modelForProvider(req.bizId, candidate, req.tier, req.agentKey);
    try {
      return await executeOnProvider(req, candidate, model);
    } catch (e) {
      lastErr = e;
      if (e instanceof BudgetExceeded) throw e;
      logger.warn("llm.multi_provider_fallback", { agent: req.agentKey, category, failedProvider: candidate, error: String(e).slice(0, 300) });
    }
  }

  if (lastErr) throw lastErr;
  const output = req.schema.parse(req.sandbox());
  record(req, "sandbox", "sandbox", { input: 0, output: 0, cached: 0 }, 0, 0);
  return { output, model: "sandbox", source: "sandbox", provider: "sandbox", usage: { input: 0, output: 0, cached: 0, costMicros: 0 } };
}

async function executeOnProvider<T>(req: GenerateRequest<T>, provider: Provider, initialModel: string): Promise<GenerateResult<T>> {
  if (provider === "codex_cli") return viaCodex(req, initialModel);
  if (provider === "gemini_cli") return viaGemini(req, initialModel);
  let model = initialModel;
  let tier: Tier | null = req.tier;
  let lastErr: unknown;
  while (true) {
    try {
      return await viaCli(req, model);
    } catch (e) {
      lastErr = e;
      if (e instanceof BudgetExceeded) throw e;
      tier = tier ? FALLBACK[tier] : null;
      if (!tier) break;
      const next = modelForProvider(req.bizId, "claude_cli", tier);
      if (next === model) break;
      logger.warn("llm.fallback", { agent: req.agentKey, from: model, to: next, error: String(e).slice(0, 300) });
      model = next;
    }
  }
  throw lastErr;
}

async function viaGemini<T>(req: GenerateRequest<T>, model: string): Promise<GenerateResult<T>> {
  const { $schema: _drop, ...jsonSchema } = z.toJSONSchema(req.schema as z.ZodType, { target: "draft-7", unrepresentable: "any" }) as Record<string, unknown>;
  const totals = { input: 0, output: 0, cached: 0, costMicros: 0 };
  let prompt = req.user;
  for (let round = 0; round < 3; round++) {
    if (req.budget?.perDay && tokensUsedToday(req.bizId, req.agentKey) >= req.budget.perDay) throw new BudgetExceeded("Agent đã đạt trần token/ngày");
    const r = await runGeminiCli({ prompt, system: req.system, model, jsonSchema });
    totals.input += r.usage.input; totals.output += r.usage.output; totals.cached += r.usage.cached;
    record(req, "gemini_cli", r.model, r.usage, r.durationMs, 0);
    if (req.budget?.perRun && totals.input + totals.output > req.budget.perRun) throw new BudgetExceeded(`Task vượt trần ${req.budget.perRun} token/lần chạy.`);
    const parsed = req.schema.safeParse(r.structured);
    if (parsed.success) return { output: parsed.data, model: r.model, source: "gemini", provider: "gemini_cli", usage: totals };
    prompt = `${req.user}\n\nĐầu ra trước sai schema: ${parsed.error.message.slice(0, 1200)}. Trả lại JSON đúng schema.`;
  }
  throw new AppError("SCHEMA_REPAIR_FAILED", "Đầu ra Gemini CLI sai schema sau 2 vòng sửa", 502);
}

async function viaCodex<T>(req: GenerateRequest<T>, model: string): Promise<GenerateResult<T>> {
  const account = selectedAiAccount(req.bizId);
  if (!account) throw new AppError("CODEX_ACCOUNT_REQUIRED", "Chọn hồ sơ ChatGPT trước khi gọi AI", 400);
  const { $schema: _drop, ...jsonSchema } = z.toJSONSchema(req.schema as z.ZodType, { target: "draft-7", unrepresentable: "any" }) as Record<string, unknown>;
  return withAiAccount(req.bizId, account.id, async (home, signal) => {
    const totals = { input: 0, output: 0, cached: 0, costMicros: 0 };
    let prompt = req.user;
    for (let round = 0; round < 3; round++) {
      if (req.budget?.perDay && tokensUsedToday(req.bizId, req.agentKey) >= req.budget.perDay) throw new BudgetExceeded("Agent đã đạt trần token/ngày");
      const r = await runCodexCli({ home, signal, prompt, system: req.system, model, jsonSchema, effort: llmSettings(req.bizId).effort, images: req.images?.map((i) => i.path) });
      totals.input += r.usage.input; totals.output += r.usage.output; totals.cached += r.usage.cached;
      record(req, "codex_cli", r.model, r.usage, r.durationMs, 0);
      if (req.budget?.perRun && totals.input + totals.output > req.budget.perRun) throw new BudgetExceeded(`Task vượt trần ${req.budget.perRun} token/lần chạy.`);
      const parsed = req.schema.safeParse(r.structured);
      if (parsed.success) return { output: parsed.data, model: r.model, source: "codex", provider: "codex_cli", usage: totals };
      prompt = `${req.user}\n\nĐầu ra trước sai schema: ${parsed.error.message.slice(0, 1200)}. Trả lại JSON đúng schema.`;
    }
    throw new AppError("SCHEMA_REPAIR_FAILED", "Đầu ra ChatGPT sai schema sau 2 vòng sửa", 502);
  });
}

// ---------------- Provider: Claude Code CLI (subscription login) ----------------
async function viaCli<T>(req: GenerateRequest<T>, model: string): Promise<GenerateResult<T>> {
  // The CLI validates with draft-07 and rejects the 2020-12 `$schema` URI zod emits by default.
  const { $schema: _drop, ...jsonSchema } = z.toJSONSchema(req.schema as z.ZodType, { target: "draft-7", unrepresentable: "any" }) as Record<string, unknown>;
  // Ảnh: chép vào 1 thư mục tạm RIÊNG cho lượt này (tên tệp trung tính, không lộ mã tin/doanh nghiệp) → Read chỉ thấy đúng các ảnh này.
  const imageDir = req.images?.length ? join(tmpdir(), "dotaka-vision", randomUUID()) : undefined;
  let imageNote = "";
  if (imageDir) {
    mkdirSync(imageDir, { recursive: true });
    const paths = req.images!.map((img, i) => {
      const dest = join(imageDir, `anh-${i + 1}${extname(img.path).toLowerCase() || ".jpg"}`);
      copyFileSync(img.path, dest);
      return dest;
    });
    imageNote = `\n\nẢNH CẦN XEM (dùng công cụ Read mở từng tệp, chỉ đọc, không làm gì khác):\n${paths.map((p) => `- ${p}`).join("\n")}`;
  }
  try {
    return await cliRounds(req, model, jsonSchema, imageDir, imageNote);
  } finally {
    if (imageDir) rmSync(imageDir, { recursive: true, force: true });
  }
}

async function cliRounds<T>(req: GenerateRequest<T>, model: string, jsonSchema: object, imageDir: string | undefined, imageNote: string): Promise<GenerateResult<T>> {
  let prompt = req.user + imageNote;
  const totals = { input: 0, output: 0, cached: 0, costMicros: 0 };
  for (let round = 0; round < 3; round++) {
    const started = Date.now();
    // Chỉ vòng đầu chạy nhanh; sai schema → các vòng sửa dùng chế độ schema (chắc chắn đúng định dạng).
    const fast = Boolean(req.fast) && !imageDir && round === 0;
    const r = await runClaudeCli({ prompt, system: req.system, model, jsonSchema, effort: llmSettings(req.bizId).effort, ...(imageDir ? { imageDir } : {}), ...(fast ? { fast } : {}), ...(req.agentKey === "chat" || req.agentKey === "chat_vision" ? { priority: true } : {}) });
    totals.input += r.usage.input; totals.output += r.usage.output; totals.cached += r.usage.cached; totals.costMicros += r.costMicros;
    record(req, "claude_cli", r.model, r.usage, Date.now() - started, r.costMicros);
    if (req.budget?.perRun && totals.input + totals.output > req.budget.perRun) throw new BudgetExceeded(`Task vượt trần ${req.budget.perRun} token/lần chạy.`);
    const check = req.schema.safeParse(r.structured);
    if (check.success) return { output: check.data, model: r.model, source: "claude", provider: "claude_cli", usage: totals };
    prompt = `${req.user}${imageNote}\n\nLẦN TRƯỚC ĐẦU RA SAI SCHEMA: ${check.error.message.slice(0, 1200)}\nHãy trả lại JSON đúng schema.`;
  }
  throw new AppError("SCHEMA_REPAIR_FAILED", "Đầu ra của Claude CLI sai schema sau 2 vòng sửa", 502);
}

function record(req: { bizId: string; agentKey: string; taskRunId?: string }, provider: string, model: string, t: { input: number; output: number; cached: number }, latencyMs: number, costMicros: number) {
  insert("model_usage", {
    biz_id: req.bizId, task_run_id: req.taskRunId ?? null, agent_key: req.agentKey, provider, model,
    tokens_in: t.input, tokens_out: t.output, tokens_cached: t.cached, cost_micros: costMicros, latency_ms: latencyMs, at: new Date().toISOString(),
  });
}

/**
 * Tạo ảnh bằng ChatGPT (chỉ khi kết nối AI đang chọn là Codex CLI + hồ sơ đã đăng nhập). Ảnh PNG được chép ra `outFile`.
 * Kết nối Claude không có model tạo ảnh — nơi gọi tự thiết kế ảnh bằng `generate()` (xem orchestrator/post-image.ts).
 */
export async function generateImageFile(req: { bizId: string; agentKey: string; taskRunId?: string; system: string; prompt: string; outFile: string; tier?: Tier }): Promise<{ path: string; model: string; provider: Provider }> {
  const s = llmSettings(req.bizId);
  const want = s.multiProviderEnabled ? (s.taskRouting?.image ?? s.provider) : s.provider;
  const st = providerStatus(req.bizId, "codex_cli");
  if (want !== "codex_cli" && s.provider !== "codex_cli") throw new AppError("IMAGE_PROVIDER", "Tạo ảnh bằng ChatGPT cần chọn ChatGPT (Codex CLI) cho mục Tạo Ảnh", 400);
  if (!st.ready) throw new AppError("CODEX_NOT_READY", st.reason ?? "ChatGPT chưa sẵn sàng", 400);
  const account = selectedAiAccount(req.bizId);
  if (!account) throw new AppError("CODEX_ACCOUNT_REQUIRED", "Chọn hồ sơ ChatGPT trước khi gọi AI", 400);
  const model = modelForProvider(req.bizId, "codex_cli", req.tier ?? "medium", req.agentKey);
  return withAiAccount(req.bizId, account.id, async (home, signal) => {
    const r = await runCodexImage({ home, signal, prompt: req.prompt, system: req.system, model, effort: "low", outFile: req.outFile });
    record(req, "codex_cli", r.model, r.usage, r.durationMs, 0);
    return { path: r.path, model: r.model, provider: "codex_cli" as const };
  });
}

/** Short free-text helper (handoff summaries). Falls back to the given text on any failure. */
export async function summarize(bizId: string, agentKey: string, instruction: string, content: string, fallback: string): Promise<string> {
  const { provider } = effectiveProvider(bizId);
  if (provider === "sandbox") return fallback;
  try {
    const Out = z.object({ summary: z.string() });
    const r = await generate({ bizId, agentKey, tier: "small", system: instruction, user: content, schema: Out, sandbox: () => ({ summary: fallback }), fast: true });
    return r.output.summary.trim() || fallback;
  } catch (e) {
    logger.warn("llm.summarize_failed", { error: String(e).slice(0, 300) });
    return fallback;
  }
}

/** Connection test for the settings page. */
export async function testModel(bizId: string, model: string) {
  const { provider, reason } = effectiveProvider(bizId);
  if (provider === "sandbox" || effectiveProvider(bizId).ready === false) return { ok: false, provider, reason: reason ?? "Đang ở chế độ sandbox" };
  const started = Date.now();
  const r = await generate({
    bizId, agentKey: "system_test", tier: "small", system: "Bạn là trợ lý kiểm tra kết nối. Trả JSON theo schema.",
    user: "Chào đội Marketing bằng một câu ngắn tiếng Việt.", schema: z.object({ greeting: z.string() }), sandbox: () => ({ greeting: "" }), model,
  }).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }) as const);
  if ("error" in r) return { ok: false, provider, model, reason: r.error };
  return { ok: true, provider, model: r.model, reply: r.output.greeting, latencyMs: Date.now() - started, requested: model };
}
