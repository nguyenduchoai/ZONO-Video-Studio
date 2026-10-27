import { createReadStream, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { byId, type Row } from "@dotaka/db";
import { TASK_CATEGORIES, allProvidersStatus, cliInfo, effectiveProvider, llmSettings, modelCatalog, modelFor } from "@dotaka/llm-gateway";
import {
  createTelegramPairCode, removeTelegramChat, telegramAssistantStatus,
  ASSISTANT, assistantBusy, assistantFindings, assistantSettings, checkActionPath, createAction, createThread, deleteThread, dispatchAgentTask,
  finishAction, getThread, listDispatches, listFeedback, listThreads, recordDispatch, saveAssistantSettings, sendAssistantMessage, setFeedback, stopAssistant, synthesizeMessageTts,
  getMuseState, updateMuseSettings, runMuseConnectorAction, addCustomMuseConnector, removeCustomMuseConnector,
  MUSE_EXTRACTED_API_CATALOG, executeMuseRpc,
  getUsersQuotaOverview, getLocalCoworkerState, saveManagedUser, deleteManagedUser, runUserRagAction, ingestUserRagFromChat, purgeAllDemoData,
  saveContextOptimizerConfig, toggleEventTrigger, scanInboxAutoFolder, applyIndustryAgentBundle, exportCustomAgentBundle,
  runMultiAgentWorkflowChain, listOpenAiCompatibleModels, runOpenAiCompatibleCompletion,
} from "@dotaka/orchestrator";
import { AppError } from "@dotaka/shared";
import { currentBizId, routes, type Ctx } from "../http.ts";

/** Hiền An — the CEO's command chat. Tool calls arrive with an x-zono-actor header (see zono-mcp.mjs). */
export function assistantRoutes(app: FastifyInstance) {
  const r = routes(app);
  // Only the CEO's own clicks may confirm cards or change Hiền An's permissions — never her tools.
  const ceoOnly = (c: Ctx) => { if (c.req.headers["x-zono-actor"]) throw new AppError("FORBIDDEN", "Chỉ Sếp mới làm được thao tác này", 403); };

  /** Run a confirmed card through the normal API (same validation, audit, kill switch). */
  async function execute(bizId: string, id: string, actor: string) {
    const a = byId<Row>("assistant_action", id);
    if (!a || a.biz_id !== bizId) throw new AppError("NOT_FOUND", "Không thấy thẻ", 404);
    if (a.status !== "pending") throw new AppError("DONE", "Thẻ này đã xử lý", 409);
    const req = a.params as { method: "POST" | "PUT" | "DELETE"; path: string; body?: unknown };
    checkActionPath(req.path);
    const res = await app.inject({
      method: req.method, url: req.path, payload: req.body === undefined ? undefined : (req.body as any),
      headers: { "x-zono-actor": encodeURIComponent(actor), "idempotency-key": `assistant-action:${id}` },
    });
    let body: unknown = res.body;
    try { body = res.json(); } catch { /* not JSON */ }
    return finishAction(bizId, id, res.statusCode < 400 ? "done" : "failed", res.statusCode < 400 ? body : { status: res.statusCode, error: (body as any)?.message ?? body }, actor);
  }

  r.get("/v1/assistant", ({ bizId }) => {
    const eff = effectiveProvider(bizId);
    const s = llmSettings(bizId);
    const cloudReady = eff.provider === "claude_cli" ? (cliInfo().available && cliInfo().loggedIn !== false) : (eff.provider === "codex_cli" || eff.provider === "gemini_cli") ? eff.ready === true : false;
    const authError = eff.provider === "claude_cli" ? (cliInfo().loggedIn === false ? (cliInfo().authError ?? "Claude CLI chạm hạn mức/hết phiên — tự động dự phòng sang Gemini/OpenAI/Local Engine") : undefined) : eff.reason;
    return {
      name: ASSISTANT.name,
      settings: assistantSettings(bizId),
      defaultModel: modelFor(bizId, ASSISTANT.key, "medium"),
      models: modelCatalog(bizId),
      ready: true,
      cloudReady,
      authError,
      taskRouting: s.taskRouting,
      providerPriority: s.providerPriority,
      multiProviderEnabled: s.multiProviderEnabled,
      providersStatus: allProvidersStatus(bizId),
      taskCategories: TASK_CATEGORIES,
      suggestions: [
        "Tạo video hoạt hình về Giải pháp AI tự động hóa Marketing 2026 (Local Remotion + VieNeu-TTS)",
        "Thiết kế ảnh poster ra mắt sản phẩm AI Agent 4:5 (OpenAI / Local Chrome 1080×1350)",
        "Viết bài chuẩn SEO về phần mềm quản lý bán hàng AI cho doanh nghiệp 1 người (Gemini)",
        "Phân tích Muse.app bằng skill REA (reverse-engineer-anything) & kiến trúc Hatch v9.0",
        "Rà dự án này theo luật Việt Nam (vn-legal-check: dữ liệu cá nhân, TMĐT, thuế 1 tỷ, NĐ 363/2026)",
        "Hôm nay hệ thống có gì cần em để ý không?",
      ],
    };
  });
  r.put("/v1/assistant/settings", (c) => {
    ceoOnly(c);
    const p = z.object({ model: z.string().nullable().optional(), autoConfirm: z.boolean().optional() }).parse(c.body);
    return saveAssistantSettings(c.bizId, p, c.actor);
  });

  r.get("/v1/assistant/threads", ({ bizId }) => listThreads(bizId));
  r.post("/v1/assistant/threads", ({ bizId }) => createThread(bizId));
  r.get("/v1/assistant/threads/:id", ({ bizId, params }) => getThread(bizId, params.id));
  r.del("/v1/assistant/threads/:id", (c) => { ceoOnly(c); deleteThread(c.bizId, c.params.id); });
  r.post("/v1/assistant/threads/:id/messages", (c) => {
    ceoOnly(c);
    const p = z.object({
      text: z.string().min(1).max(8000),
      model: z.string().optional(),
      provider: z.enum(["claude_cli", "codex_cli", "gemini_cli", "local_studio", "sandbox"]).optional(),
      taskCategory: z.enum(["complex", "general", "image", "seo", "video"]).optional(),
    }).parse(c.body);
    return sendAssistantMessage(c.bizId, c.params.id, p.text, { model: p.model, provider: p.provider, taskCategory: p.taskCategory });
  });
  r.post("/v1/assistant/threads/:id/stop", ({ params }) => { stopAssistant(params.id); return { running: assistantBusy(params.id) }; });

  // Stream synthesized VieNeu-TTS 48kHz audio for any assistant message
  app.get("/v1/assistant/messages/:id/tts", (req, reply) => {
    const bizId = currentBizId(req);
    const id = (req.params as { id: string }).id;
    const voice = String((req.query as Record<string, unknown>)?.voice ?? "Binh (nam miền Bắc)");
    const { audioPath } = synthesizeMessageTts(bizId, id, voice);
    reply.header("content-type", "audio/wav");
    reply.header("cache-control", "public, max-age=3600");
    return reply.send(createReadStream(audioPath));
  });

  r.get("/v1/assistant/findings", ({ bizId }) => assistantFindings(bizId));
  r.get("/v1/assistant/feedback", ({ bizId }) => listFeedback(bizId));
  r.post("/v1/assistant/messages/:id/feedback", (c) => {
    ceoOnly(c);
    const p = z.object({ feedback: z.enum(["up", "down"]).nullable(), note: z.string().max(1000).optional() }).parse(c.body);
    return setFeedback(c.bizId, c.params.id, p);
  });
  r.get("/v1/assistant/dispatches", ({ bizId }) => listDispatches(bizId));
  r.post("/v1/assistant/dispatches", ({ bizId, body }) => {
    const p = z.object({ threadId: z.string().nullable().optional(), kind: z.string(), refType: z.enum(["task", "goal", "creative_job", "job"]), refId: z.string(), title: z.string() }).parse(body);
    return recordDispatch(bizId, p);
  });
  r.post("/v1/assistant/agent-task", ({ bizId, body, actor }) => {
    const p = z.object({
      threadId: z.string().nullable().optional(), agent: z.enum(["content", "video_script", "seo_web"]), instruction: z.string().min(5).max(4000),
      channel: z.string().optional(), format: z.string().optional(), keyword: z.string().optional(), funnel: z.string().optional(),
    }).parse(body);
    return dispatchAgentTask(bizId, p as any, actor);
  });

  // Confirm cards
  r.post("/v1/assistant/actions", async ({ bizId, body }) => {
    const p = z.object({
      threadId: z.string().nullable().optional(), title: z.string().min(2), summary: z.string().default(""),
      request: z.object({ method: z.enum(["POST", "PUT", "DELETE"]), path: z.string(), body: z.unknown().optional() }),
    }).parse(body);
    const a = createAction(bizId, p);
    if (!assistantSettings(bizId).autoConfirm) return a;
    return execute(bizId, a.id, `${ASSISTANT.actor} · tự thực hiện`);
  });
  // Hiền An trên Telegram: trạng thái, mã ghép nối, bỏ ghép nối 1 chat.
  r.get("/v1/assistant/telegram", ({ bizId }) => telegramAssistantStatus(bizId));
  r.post("/v1/assistant/telegram/pair", (c) => { ceoOnly(c); return createTelegramPairCode(c.bizId, c.actor); });
  r.del("/v1/assistant/telegram/chats/:id", (c) => { ceoOnly(c); return removeTelegramChat(c.bizId, c.params.id, c.actor); });
  r.post("/v1/assistant/actions/:id/confirm", async (c) => { ceoOnly(c); return execute(c.bizId, c.params.id, "Sếp · qua Hiền An"); });
  r.post("/v1/assistant/actions/:id/cancel", (c) => {
    ceoOnly(c);
    const a = byId<Row>("assistant_action", c.params.id);
    if (!a || a.biz_id !== c.bizId) throw new AppError("NOT_FOUND", "Không thấy thẻ", 404);
    if (a.status !== "pending") throw new AppError("DONE", "Thẻ này đã xử lý", 409);
    return finishAction(c.bizId, a.id, "cancelled", null, c.actor);
  });

  // ── Muse.app (Hatch v9.0) Connectors & Local Mac Execution Routes ───────────
  r.get("/v1/muse", ({ bizId }) => getMuseState(bizId));
  r.get("/v1/muse/api-catalog", () => MUSE_EXTRACTED_API_CATALOG);
  r.post("/v1/muse/rpc", async ({ bizId, body, actor }) => {
    const p = z.object({
      method: z.string().min(2),
      params: z.record(z.string(), z.unknown()).default({}),
    }).parse(body ?? {});
    return executeMuseRpc(bizId, p.method, p.params, actor);
  });
  // Native Muse.app REST compatibility routes (/api/client/runtime-state, /api/permissions/inventory, /api/enable_media)
  r.get("/api/client/runtime-state", ({ bizId }) => getMuseState(bizId));
  r.get("/api/permissions/inventory", ({ bizId }) => ({
    ok: true,
    connectors: getMuseState(bizId).connectors,
    extractedApiCatalog: MUSE_EXTRACTED_API_CATALOG,
  }));
  r.post("/api/enable_media", async ({ bizId, body, actor }) => {
    const p = z.record(z.string(), z.unknown()).default({}).parse(body ?? {});
    return executeMuseRpc(bizId, "hatch.message.agent_media_generation", p, actor);
  });
  r.put("/v1/muse/settings", ({ bizId, body, actor }) => {
    const p = z.object({
      permissions: z.record(z.string(), z.enum(["read_write", "read_only", "always_ask", "off"])).optional(),
      keepAwake: z.boolean().optional(),
      floatingButton: z.boolean().optional(),
      autoShareNotes: z.boolean().optional(),
      defaultVoice: z.string().optional(),
    }).parse(body);
    return updateMuseSettings(bizId, p, actor);
  });
  r.post("/v1/muse/connectors/:id/run", async ({ bizId, params, body, actor }) => {
    const p = z.object({
      prompt: z.string().optional(),
      targetPath: z.string().optional(),
      url: z.string().optional(),
      voice: z.string().optional(),
    }).passthrough().default({}).parse(body ?? {});
    return runMuseConnectorAction(bizId, params.id, p, actor);
  });
  r.post("/v1/muse/custom-connectors", ({ bizId, body, actor }) => {
    const p = z.object({
      name: z.string().min(2).max(120),
      url: z.string().min(3).max(500).optional(),
      endpointUrl: z.string().min(3).max(500).optional(),
      kind: z.enum(["mcp_sse", "http_webhook", "local_cli"]).default("mcp_sse").optional(),
      description: z.string().max(400).optional(),
    }).parse(body);
    return addCustomMuseConnector(bizId, {
      name: p.name,
      endpointUrl: p.endpointUrl ?? p.url ?? "http://localhost:8787/mcp",
      description: p.description,
    }, actor);
  });
  r.del("/v1/muse/custom-connectors/:id", ({ bizId, params, actor }) => {
    return removeCustomMuseConnector(bizId, params.id, actor);
  });
  app.get("/v1/muse/tts-file/:file", (req, reply) => {
    const file = String((req.params as { file: string }).file ?? "").replace(/[^a-zA-Z0-9._-]/g, "");
    const p = resolve(process.cwd(), "data", "assistant", "tts", file);
    if (!existsSync(p)) throw new AppError("NOT_FOUND", "Không tìm thấy tệp âm thanh", 404);
    reply.header("content-type", "audio/wav");
    return reply.send(createReadStream(p));
  });

  // ── Multi-User AI + DNA RAG + Centralized Token & Quota Hub ────────────────
  r.get("/v1/users-quota", ({ bizId }) => getUsersQuotaOverview(bizId));
  r.get("/v1/users-quota/coworker-state", ({ bizId }) => getLocalCoworkerState(bizId, false));
  r.post("/v1/users-quota/rescan-cli", ({ bizId }) => getLocalCoworkerState(bizId, true));
  r.post("/v1/users-quota/users", ({ bizId, body, actor }) => {
    const p = z.object({
      id: z.string().optional(),
      name: z.string().min(2).max(120),
      email: z.string().min(3).max(200),
      role: z.string().optional(),
      status: z.string().optional(),
      planId: z.enum(["starter", "growth", "pro", "enterprise"]).default("growth"),
      tokenLimit: z.number().optional(),
      videoLimit: z.number().optional(),
      postLimit: z.number().optional(),
      zaloMsgLimit: z.number().optional(),
      preferredProvider: z.enum(["auto", "claude_cli", "codex_cli", "gemini_cli", "local_studio"]).optional(),
      ragEnabled: z.boolean().optional(),
      zaloPersonalPhone: z.string().optional(),
      zaloAutoFollowUp: z.boolean().optional(),
      pancakeSyncEnabled: z.boolean().optional(),
      brandName: z.string().optional(),
      industry: z.string().optional(),
      productsSummary: z.string().optional(),
      ragKnowledgeText: z.string().optional(),
    }).parse(body);
    return saveManagedUser(bizId, p, actor);
  });
  r.del("/v1/users-quota/users/:id", ({ bizId, params, actor }) => {
    return deleteManagedUser(bizId, params.id, actor);
  });
  r.post("/v1/users-quota/users/:id/run", async ({ bizId, params, body, actor }) => {
    const p = z.object({
      mode: z.enum(["post", "image", "video", "zalo_sale"]),
      prompt: z.string().optional(),
      agentKey: z.string().optional(),
      skillKey: z.string().optional(),
      providerOverride: z.enum(["auto", "claude_cli", "codex_cli", "gemini_cli"]).optional(),
      effort: z.enum(["low", "medium", "high"]).optional(),
    }).parse(body ?? {});
    return runUserRagAction(bizId, params.id, p, actor);
  });
  r.post("/v1/users-quota/users/:id/ingest-chat", async ({ bizId, params, body, actor }) => {
    const p = z.object({
      fileName: z.string().optional(),
      filePath: z.string().optional(),
      fileBase64: z.string().optional(),
      websiteUrl: z.string().optional(),
      rawText: z.string().optional(),
    }).parse(body ?? {});
    return ingestUserRagFromChat(bizId, params.id, p, actor);
  });
  r.post("/v1/users-quota/purge-demo", ({ bizId, actor }) => {
    return purgeAllDemoData(bizId, actor);
  });

  // ── 4 CORE SUBSYSTEMS LEARNED FROM AICoworker.app ──────────────────────────
  // Core 1: LLM Context Optimizer & Smart Skill Pruning
  r.post("/v1/users-quota/context-optimizer", ({ bizId, body, actor }) => {
    const p = z.object({
      mode: z.enum(["aggressive", "balanced", "full"]).optional(),
      maxRagChunks: z.number().min(1).max(20).optional(),
      maxSkillChars: z.number().min(1000).max(25000).optional(),
      convCacheEnabled: z.boolean().optional(),
    }).parse(body ?? {});
    return saveContextOptimizerConfig(bizId, p, actor);
  });

  // Core 2: Auto-Watch Folder (`data/inbox-auto/`) & Event Triggers
  r.post("/v1/users-quota/triggers/:id/toggle", ({ bizId, params, body, actor }) => {
    const p = z.object({ enabled: z.boolean() }).parse(body ?? {});
    return toggleEventTrigger(bizId, params.id, p.enabled, actor);
  });
  r.post("/v1/users-quota/inbox-scan", async ({ bizId }) => {
    return scanInboxAutoFolder(bizId);
  });

  // Core 3: 1-Click Industry Agent Bundles & Setup Kickoff
  r.post("/v1/users-quota/bundles/apply", ({ bizId, body, actor }) => {
    const p = z.object({
      userId: z.string().optional(),
      bundleId: z.string(),
    }).parse(body ?? {});
    return applyIndustryAgentBundle(bizId, p.userId ?? "", p.bundleId, actor);
  });
  r.get("/v1/users-quota/bundles/export", ({ bizId, query }) => {
    const qObj = (query ?? {}) as { userId?: string };
    return exportCustomAgentBundle(bizId, qObj.userId);
  });

  // Core 4A: 1-Click Multi-Agent Workflow Chains (DAG)
  r.post("/v1/users-quota/users/:id/workflow", async ({ bizId, params, body, actor }) => {
    const p = z.object({
      workflowId: z.string(),
      topicPrompt: z.string().optional(),
      providerOverride: z.enum(["auto", "claude_cli", "codex_cli", "gemini_cli"]).optional(),
    }).parse(body ?? {});
    return runMultiAgentWorkflowChain(bizId, params.id, p, actor);
  });

  // Core 4B: OpenAI-Compatible Local Agent API (`/v1/models` & `/v1/chat/completions`)
  r.get("/v1/models", ({ bizId }) => listOpenAiCompatibleModels(bizId));
  r.post("/v1/chat/completions", async ({ bizId, body, actor }) => {
    const p = z.object({
      model: z.string().optional(),
      messages: z.array(z.object({ role: z.string(), content: z.unknown() })).optional(),
      prompt: z.string().optional(),
    }).passthrough().parse(body ?? {});
    return runOpenAiCompatibleCompletion(bizId, p, actor);
  });
}
