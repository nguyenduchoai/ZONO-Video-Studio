import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { audit, byId, q, update, type Row } from "@dotaka/db";
import {
  ZaloSettingsPatch, activeZl, planFollowUp, publicConnection, runZaloFollowUps, simulateZalo, stopFollowUp, syncZalo, zaloSettings,
  listZaloPersonalAccounts, saveZaloPersonalAccount, deleteZaloPersonalAccount, launchZaloPersonalQrLogin, sendZaloPersonalTestMessage,
  toggleZaloAccountAi, listZaloCustomerAiRules, saveZaloCustomerAiRule, deleteZaloCustomerAiRule,
  startZcaQrLoginSession, getZcaQrSessionStatus, loginZcaWithCredentials,
} from "@dotaka/orchestrator";
import { AppError } from "@dotaka/shared";
import { routes } from "../http.ts";

/** Follow-up Zalo (ZL-CRM): status, settings, sync, follow-up queue, simulation. */
export function zaloRoutes(app: FastifyInstance) {
  const r = routes(app);
  const mustConn = (bizId: string) => {
    const c = activeZl(bizId);
    if (!c) throw new AppError("NO_CONNECTION", "Chưa kết nối ZL-CRM — vào Trung tâm tích hợp › ZL-CRM (Zalo)");
    return c;
  };

  r.get("/v1/zalo", ({ bizId }) => {
    const personalAccounts = listZaloPersonalAccounts(bizId);
    const c = activeZl(bizId);
    const n = (sql: string, ...a: unknown[]) => q.scalar<number>(sql, bizId, ...a);
    const today = `${new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)}T00:00:00+07:00`;
    return {
      connection: c ? publicConnection(c) : null,
      settings: zaloSettings(c),
      accounts: c?.config?.accounts ?? [],
      personalAccounts,
      customerAiRules: listZaloCustomerAiRules(bizId),
      hasAccountField: c?.config?.hasAccountField ?? null,
      lastSyncAt: c?.config?.lastSyncAt ?? null, lastSync: c?.config?.lastSync ?? null, cursor: c?.config?.cursor ?? null,
      stats: {
        conversations: n("SELECT COUNT(*) FROM conversation WHERE biz_id = ? AND channel = 'zalo'"),
        hot: n("SELECT COUNT(*) FROM conversation WHERE biz_id = ? AND channel = 'zalo' AND lead_grade = 'hot'"),
        warm: n("SELECT COUNT(*) FROM conversation WHERE biz_id = ? AND channel = 'zalo' AND lead_grade = 'warm'"),
        waiting: n("SELECT COUNT(*) FROM conversation WHERE biz_id = ? AND channel = 'zalo' AND state = 'awaiting_customer'"),
        scheduled: n("SELECT COUNT(*) FROM follow_up_plan WHERE biz_id = ? AND template LIKE 'zalo%' AND status = 'active'"),
        awaitingApproval: n("SELECT COUNT(*) FROM follow_up_plan WHERE biz_id = ? AND template LIKE 'zalo%' AND status = 'awaiting_approval'"),
        sentToday: n("SELECT COUNT(*) FROM message m JOIN conversation c ON c.id = m.conversation_id WHERE c.biz_id = ? AND c.channel = 'zalo' AND json_extract(m.meta, '$.kind') = 'follow_up' AND m.sent_at >= ?", new Date(today).toISOString()),
        sentTotal: n("SELECT COUNT(*) FROM message m JOIN conversation c ON c.id = m.conversation_id WHERE c.biz_id = ? AND c.channel = 'zalo' AND json_extract(m.meta, '$.kind') = 'follow_up'"),
        replied: n(`SELECT COUNT(DISTINCT m.conversation_id) FROM message m JOIN conversation c ON c.id = m.conversation_id WHERE c.biz_id = ? AND c.channel = 'zalo' AND m.sender = 'customer'
          AND m.sent_at > (SELECT MIN(x.sent_at) FROM message x WHERE x.conversation_id = m.conversation_id AND json_extract(x.meta, '$.kind') = 'follow_up')`),
      },
    };
  });

  r.put("/v1/zalo/settings", ({ bizId, body, actor }) => {
    const c = mustConn(bizId);
    const patch = ZaloSettingsPatch.parse(body);
    const next = { ...zaloSettings(c), ...patch };
    update("connection", c.id, { config: { ...(c.config ?? {}), followup: next } });
    audit(bizId, actor, "zalo.settings_changed", { type: "connection", id: c.id }, patch);
    return next;
  });

  r.post("/v1/zalo/sync", ({ bizId, actor }) => syncZalo(bizId, actor));
  r.post("/v1/zalo/run", ({ bizId }) => runZaloFollowUps(bizId, new Date(), { ignoreQuiet: false }));

  r.get("/v1/zalo/followups", ({ bizId, query }) => q.all<Row>(`SELECT f.*, c.customer_name, c.lead_grade, c.intent, c.state, c.last_preview, c.last_message_at, c.ext,
      (SELECT a.id FROM approval a WHERE a.subject_type = 'follow_up' AND a.subject_id = f.id AND a.status = 'pending' LIMIT 1) approval_id
    FROM follow_up_plan f JOIN conversation c ON c.id = f.conversation_id
    WHERE f.biz_id = ? AND f.template LIKE 'zalo%' ${query.status ? "AND f.status = ?" : ""} ORDER BY f.updated_at DESC LIMIT 100`, bizId, ...(query.status ? [query.status] : [])));

  r.get("/v1/zalo/conversations", ({ bizId }) => q.all(`SELECT c.id, c.customer_name, c.lead_grade, c.lead_score, c.intent, c.state, c.last_preview, c.last_message_at, c.ext,
      (SELECT status FROM follow_up_plan f WHERE f.conversation_id = c.id ORDER BY f.created_at DESC LIMIT 1) followup
    FROM conversation c WHERE c.biz_id = ? AND c.channel = 'zalo' ORDER BY c.last_message_at DESC LIMIT 60`, bizId));

  r.post("/v1/zalo/followups/:id/stop", ({ bizId, params, actor }) => stopFollowUp(bizId, params.id, actor));
  r.post("/v1/zalo/conversations/:id/follow-up", ({ bizId, params, actor }) => {
    const conv = byId<Row>("conversation", params.id);
    if (!conv || conv.biz_id !== bizId || conv.channel !== "zalo") throw new AppError("NOT_FOUND", "Không tìm thấy hội thoại Zalo", 404);
    if (conv.state !== "awaiting_customer") throw new AppError("NOT_WAITING", "Chỉ follow-up khi tin cuối là của mình và khách chưa trả lời");
    const ok = planFollowUp(bizId, conv, { ...zaloSettings(activeZl(bizId)), minGrade: "all", enabled: true }, { now: true });
    if (!ok) throw new AppError("EXISTS", "Hội thoại đã có lịch follow-up");
    audit(bizId, actor, "zalo.followup_planned", { type: "conversation", id: conv.id });
    return { ok: true };
  });
  r.post("/v1/zalo/simulate", ({ bizId, body, actor }) => simulateZalo(bizId, z.object({ customerName: z.string().min(1), customerText: z.string().min(1), staffText: z.string().min(1) }).parse(body), actor));

  // ── Multi-Zalo Personal Account Login & Management ────────────────────────
  r.get("/v1/zalo/accounts", ({ bizId }) => ({
    ok: true,
    accounts: listZaloPersonalAccounts(bizId),
    customerAiRules: listZaloCustomerAiRules(bizId),
  }));
  r.post("/v1/zalo/accounts", ({ bizId, body, actor }) => {
    const p = z.object({
      id: z.string().optional(),
      ownId: z.string().optional(),
      name: z.string().min(2).max(120),
      phone: z.string().min(6).max(30),
      roleLabel: z.string().optional(),
      loginMethod: z.enum(["zca_qr", "qr_local_chrome", "cookie_imei", "zlcrm_bridge"]).optional(),
      proxyUrl: z.string().optional(),
      cookieFile: z.string().optional(),
      assignedUserId: z.string().optional(),
      status: z.enum(["connected", "qr_pending", "disconnected"]).optional(),
      autoReplyEnabled: z.boolean().optional(),
      groupMentionReplyEnabled: z.boolean().optional(),
      autoFollowUpEnabled: z.boolean().optional(),
      autoPushPancakePos: z.boolean().optional(),
    }).parse(body);
    return saveZaloPersonalAccount(bizId, p, actor);
  });

  // ── Real `zca-js` + `multizlogin` Inline QR Login & Cookie/Proxy Login ────
  r.post("/v1/zalo/zca-qr/start", async ({ bizId, body, actor }) => {
    const p = z.object({
      assignedUserId: z.string().optional(),
      proxyUrl: z.string().optional(),
      roleLabel: z.string().optional(),
      autoReplyEnabled: z.boolean().optional(),
    }).parse(body ?? {});
    return startZcaQrLoginSession(bizId, p, actor);
  });
  r.get("/v1/zalo/zca-qr/:sessionId", ({ bizId, params }) => {
    return getZcaQrSessionStatus(bizId, params.sessionId);
  });
  r.post("/v1/zalo/zca-cookie/login", async ({ bizId, body, actor }) => {
    const p = z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      imei: z.string().min(2),
      cookie: z.unknown(),
      userAgent: z.string().min(5),
      proxyUrl: z.string().optional(),
      assignedUserId: z.string().optional(),
      autoReplyEnabled: z.boolean().optional(),
    }).parse(body);
    return loginZcaWithCredentials(bizId, p, actor);
  });
  r.post("/v1/zalo/accounts/:id/toggle-ai", ({ bizId, params, body, actor }) => {
    const p = z.object({
      autoReplyEnabled: z.boolean().optional(),
      groupMentionReplyEnabled: z.boolean().optional(),
      autoFollowUpEnabled: z.boolean().optional(),
      autoPushPancakePos: z.boolean().optional(),
    }).parse(body ?? {});
    return toggleZaloAccountAi(bizId, params.id, p, actor);
  });
  r.del("/v1/zalo/accounts/:id", ({ bizId, params, actor }) => {
    return deleteZaloPersonalAccount(bizId, params.id, actor);
  });
  r.post("/v1/zalo/accounts/:id/login-qr", ({ bizId, params, actor }) => {
    return launchZaloPersonalQrLogin(bizId, params.id, actor);
  });
  r.post("/v1/zalo/accounts/:id/send-test", ({ bizId, params, body, actor }) => {
    const p = z.object({
      customerName: z.string().optional(),
      customerPhone: z.string().optional(),
      customerMessage: z.string().min(2).max(2000),
      isGroup: z.boolean().optional(),
      groupName: z.string().optional(),
      mentionedInGroup: z.boolean().optional(),
    }).parse(body);
    return sendZaloPersonalTestMessage(bizId, params.id, p, actor);
  });

  // ── Per-Customer AI Reply Toggle (Bật/Tắt AI trả lời cho từng khách hàng Zalo) ──
  r.get("/v1/zalo/customer-rules", ({ bizId }) => ({
    ok: true,
    rules: listZaloCustomerAiRules(bizId),
  }));
  r.post("/v1/zalo/customer-rules", ({ bizId, body, actor }) => {
    const p = z.object({
      id: z.string().optional(),
      customerName: z.string().min(1).max(120),
      customerPhone: z.string().max(30).optional(),
      zaloAccountId: z.string().optional(),
      aiEnabled: z.boolean().optional(),
      note: z.string().max(300).optional(),
    }).parse(body);
    return saveZaloCustomerAiRule(bizId, p, actor);
  });
  r.del("/v1/zalo/customer-rules/:id", ({ bizId, params, actor }) => {
    return deleteZaloCustomerAiRule(bizId, params.id, actor);
  });
}
