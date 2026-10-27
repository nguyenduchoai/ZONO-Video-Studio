import type { FastifyInstance } from "fastify";
import { bizSettings, q, type Row } from "@dotaka/db";
import { jevEnabled } from "@dotaka/jev";
import { effectiveProvider, llmSettings } from "@dotaka/llm-gateway";
import { today } from "@dotaka/orchestrator";
import { routes } from "../http.ts";

/**
 * "Bản đồ điều phối" — live state of the 12 agent groups around the orchestrator.
 * Status per group (strongest wins): running > error > needs approval > done (30') > idle,
 * derived from tasks, queue jobs, approvals and creative jobs. Events come from the outbox.
 */
type Group = { key: string; label: string; sub: string; agents: string[]; jobs: string[]; link: string; approvals?: string[] };
export const GROUPS: Group[] = [
  { key: "dna", label: "DNA & Mục tiêu", sub: "Nạp tri thức · Chuẩn hóa yêu cầu", agents: ["dna_intake", "brief"], jobs: [], link: "/dna" },
  { key: "research", label: "Nghiên cứu thị trường", sub: "Khách hàng · Đối thủ · Insight", agents: ["market_research"], jobs: [], link: "/agents" },
  { key: "strategy", label: "Chiến lược & Kế hoạch", sub: "Định vị · Phễu · Lịch nội dung", agents: ["strategy"], jobs: [], link: "/plan" },
  { key: "content", label: "Content · Video · SEO", sub: "Bài viết · Kịch bản · Nội dung web", agents: ["content", "video_script", "seo_web"], jobs: [], link: "/content" },
  { key: "media", label: "Thiết kế & Media", sub: "Video Flow · Hậu kỳ · Bản nháp", agents: ["creative"], jobs: ["creative.flow", "publish.draft"], link: "/video-flow", approvals: ["creative_job"] },
  { key: "publish", label: "Xuất bản đa kênh", sub: "Lên lịch · Đăng bài · Xác minh", agents: ["publishing"], jobs: ["publish.schedule", "publish.run"], link: "/publish" },
  { key: "scan", label: "Quét & Chấm điểm bài", sub: "Theo dõi bài · Chọn bài tiềm năng", agents: ["post_scanner"], jobs: ["posts.snapshot"], link: "/publish" },
  { key: "ads", label: "Quảng cáo đa nền tảng", sub: "Meta · TikTok · Google Ads", agents: ["ads"], jobs: ["candidate.publish", "action.execute", "rules.evaluate", "metrics.sync.ads", "automations.tick", "ads.weekly_report"], link: "/ads/flows", approvals: ["ad_candidate", "action"] },
  { key: "analytics", label: "Phân tích & Đo lường", sub: "Bài → Ads → Hội thoại → Đơn", agents: ["analytics"], jobs: ["report.daily"], link: "/reports" },
  { key: "chat", label: "Chat & Chăm sóc khách", sub: "Tư vấn · Follow-up · Chuyển người", agents: ["chat", "follow_up"], jobs: ["chat.ingest", "chat.followup", "zalo.sync"], link: "/chat", approvals: ["follow_up"] },
  { key: "learn", label: "Học & Cải tiến", sub: "Bài học · Thử nghiệm · Đề xuất", agents: ["feedback"], jobs: ["learn.daily"], link: "/knowledge", approvals: ["change_proposal"] },
  { key: "review", label: "Kiểm duyệt chất lượng", sub: "Chấm điểm · Trả sửa · Chặn lỗi", agents: ["review"], jobs: [], link: "/approvals" },
];
const JOB_LABEL: Record<string, string> = {
  "creative.flow": "Đang dựng video trên Flow", "publish.draft": "Đang tải bản nháp", "publish.schedule": "Đang xếp lịch đăng", "publish.run": "Đang đăng bài",
  "posts.snapshot": "Đang quét chỉ số bài", "candidate.publish": "Đang tạo quảng cáo", "action.execute": "Đang thực thi thay đổi ads", "rules.evaluate": "Đang chạy rule quảng cáo",
  "metrics.sync.ads": "Đang kéo chỉ số ads", "automations.tick": "Đang chạy luồng tự động", "ads.weekly_report": "Đang lập báo cáo ads", "report.daily": "Đang lập báo cáo sáng",
  "chat.ingest": "Đang trả lời khách", "chat.followup": "Đang follow-up khách", "zalo.sync": "Đang đồng bộ Zalo", "learn.daily": "Đang rút bài học",
};

/** Which group an outbox event belongs to (for the live flow feed). */
function groupOfEvent(type: string, p: Row, taskAgent: (id: string) => string | undefined): string {
  const agent = p.agent ?? (p.taskId ? taskAgent(p.taskId) : undefined);
  if (agent) return GROUPS.find((g) => g.agents.includes(agent))?.key ?? "center";
  if (type === "goal.created") return "dna";
  if (type.startsWith("review.")) return "review";
  if (type.startsWith("post.published")) return "publish";
  if (type.startsWith("post.")) return "scan";
  if (type.startsWith("creative.")) return "media";
  if (type.startsWith("conversation.") || type.startsWith("lead.")) return "chat";
  if (type.startsWith("action.") || type.startsWith("metrics.") || type.startsWith("automation.")) return "ads";
  if (type.startsWith("proposal.")) return "learn";
  if (type.startsWith("approval.")) return "center";
  return "analytics";
}
function eventText(type: string, p: Row): string {
  const st: Record<string, string> = { running: "bắt đầu chạy", in_review: "đang được kiểm duyệt", awaiting_approval: "chờ CEO duyệt", done: "hoàn thành", failed: "lỗi", ready: "sẵn sàng", blocked: "bị chặn", rejected: "bị từ chối", revising: "đang sửa theo góp ý" };
  switch (type) {
    case "task.updated": return `${p.title ?? "Tác vụ"} ${st[p.status] ?? p.status}`;
    case "review.completed": return `Kiểm duyệt: ${p.verdict === "pass" ? "đạt" : p.verdict === "revise" ? "trả sửa" : p.verdict} (${p.total ?? "?"} điểm)`;
    case "approval.created": return `Cần duyệt: ${p.title ?? ""}`;
    case "approval.decided": return `CEO ${p.status === "approved" ? "đã duyệt" : p.status === "rejected" ? "từ chối" : p.status === "edited" ? "sửa & duyệt" : p.status}`;
    case "goal.created": return "CEO giao mục tiêu mới";
    case "post.published": return `Đã đăng: ${p.title ?? ""}`;
    case "post.scored": return `Chấm điểm bài: ${p.score != null ? Math.round(p.score) : ""}`;
    case "metrics.updated": return "Cập nhật chỉ số quảng cáo";
    case "action.executed": return `Thực hiện ${p.type ?? ""} ${p.target ?? ""}`;
    case "automation.ran": return `Luồng tự động: ${p.text ?? ""}`;
    case "conversation.message_in": return "Khách nhắn tin mới";
    case "conversation.message_out": return "Đã trả lời khách";
    case "conversation.handoff": return "Chuyển hội thoại cho người";
    case "lead.graded": return `Chấm lead: ${p.grade ?? ""}`;
    case "creative.updated": return `Video: ${p.step ?? p.status ?? "cập nhật"}`;
    case "proposal.created": return `Đề xuất học: ${p.title ?? ""}`;
    case "alert.raised": return p.text ?? "Cảnh báo";
    default: return type;
  }
}

export function orchestraRoutes(app: FastifyInstance) {
  const r = routes(app);

  r.get("/v1/orchestra", ({ bizId }) => {
    const now = Date.now();
    const since30 = new Date(now - 30 * 60_000).toISOString();
    const since24 = new Date(now - 24 * 3600_000).toISOString();
    const dayStart = `${today()}T00:00:00`;
    const cfg = new Map(q.all<Row>("SELECT agent_key, autonomy, enabled FROM agent_config WHERE biz_id = ?", bizId).map((c) => [c.agent_key, c]));
    const pendingByAgent = q.all<Row>("SELECT agent_key, subject_type, COUNT(*) n FROM approval WHERE biz_id = ? AND status = 'pending' GROUP BY 1, 2", bizId);
    const runningJobs = q.all<Row>("SELECT name, COUNT(*) n FROM job WHERE (biz_id = ? OR biz_id IS NULL) AND status = 'running' GROUP BY 1", bizId);
    const deadJobs = q.all<Row>("SELECT name, COUNT(*) n FROM job WHERE (biz_id = ? OR biz_id IS NULL) AND status = 'dead' AND updated_at >= ? GROUP BY 1", bizId, since24);

    const groups = GROUPS.map((g) => {
      const ph = g.agents.map(() => "?").join(",");
      const running = q.all<Row>(`SELECT id, title, step, progress, agent_key, status FROM task WHERE biz_id = ? AND agent_key IN (${ph}) AND status IN ('running','in_review','revising','executing') ORDER BY updated_at DESC`, bizId, ...g.agents);
      const failed = q.scalar<number>(`SELECT COUNT(*) FROM task WHERE biz_id = ? AND agent_key IN (${ph}) AND status IN ('failed','blocked') AND updated_at >= ?`, bizId, ...g.agents, since24);
      const recentDone = q.get<Row>(`SELECT title, updated_at FROM task WHERE biz_id = ? AND agent_key IN (${ph}) AND status IN ('done','awaiting_approval') ORDER BY updated_at DESC LIMIT 1`, bizId, ...g.agents);
      const doneToday = q.scalar<number>(`SELECT COUNT(*) FROM task WHERE biz_id = ? AND agent_key IN (${ph}) AND status = 'done' AND updated_at >= ?`, bizId, ...g.agents, dayStart);
      const queued = q.scalar<number>(`SELECT COUNT(*) FROM task WHERE biz_id = ? AND agent_key IN (${ph}) AND status IN ('ready','pending','approved')`, bizId, ...g.agents);
      const jobsRunning = runningJobs.filter((j) => g.jobs.includes(j.name));
      const jobsDead = deadJobs.filter((j) => g.jobs.includes(j.name)).reduce((a, j) => a + j.n, 0);
      const creative = g.key === "media" ? q.get<Row>("SELECT title, step FROM creative_job WHERE biz_id = ? AND status = 'running' ORDER BY updated_at DESC LIMIT 1", bizId) : undefined;
      const approvals = pendingByAgent.filter((a) => g.agents.includes(a.agent_key) || g.approvals?.includes(a.subject_type)).reduce((a, x) => a + x.n, 0)
        + (g.key === "review" ? q.scalar<number>("SELECT COUNT(*) FROM task WHERE biz_id = ? AND status = 'in_review'", bizId) : 0);
      const status = running.length || jobsRunning.length || creative ? "running"
        : failed || jobsDead ? "error"
        : approvals ? "approval"
        : recentDone && recentDone.updated_at >= since30 ? "done"
        : "idle";
      const current = running[0]
        ? `${running[0].title}${running[0].step ? ` — ${running[0].step}` : ""}`
        : creative ? `${creative.title}${creative.step ? ` — ${creative.step}` : ""}`
        : jobsRunning[0] ? JOB_LABEL[jobsRunning[0].name] ?? jobsRunning[0].name
        : status === "error" ? `${failed + jobsDead} lỗi trong 24 giờ`
        : status === "approval" ? `${approvals} mục chờ CEO duyệt`
        : status === "done" ? `Xong: ${recentDone!.title}`
        : queued ? `${queued} tác vụ trong hàng đợi` : null;
      const autonomy = g.agents.map((a) => cfg.get(a)?.autonomy).filter(Boolean).sort()[0] ?? "L1";
      return { ...g, status, current, progress: running[0]?.progress ?? null, autonomy, approvals, doneToday, queued, running: running.length + jobsRunning.reduce((a, j) => a + j.n, 0) + (creative ? 1 : 0), enabled: g.agents.some((a) => cfg.get(a)?.enabled !== 0) };
    });

    const taskAgent = new Map<string, string>();
    const agentOf = (id: string) => {
      if (!taskAgent.has(id)) taskAgent.set(id, q.get<Row>("SELECT agent_key, title FROM task WHERE id = ?", id)?.agent_key ?? "");
      return taskAgent.get(id) || undefined;
    };
    const events = q.all<Row>("SELECT id, type, payload, created_at FROM outbox WHERE (biz_id = ? OR biz_id IS NULL) ORDER BY created_at DESC LIMIT 40", bizId).map((e) => {
      const p = { ...(e.payload ?? {}) };
      if (e.type === "task.updated" && p.taskId && !p.title) p.title = q.get<Row>("SELECT title FROM task WHERE id = ?", p.taskId)?.title;
      return { id: e.id, type: e.type, at: e.created_at, group: groupOfEvent(e.type, p, agentOf), text: eventText(e.type, p), level: p.level ?? null };
    });

    const s = bizSettings(bizId);
    const agentsBudget = q.scalar<number>("SELECT COALESCE(SUM(token_budget_day),0) FROM agent_config WHERE biz_id = ? AND enabled = 1", bizId);
    const tok = q.get<Row>("SELECT COALESCE(SUM(tokens_in),0) tin, COALESCE(SUM(tokens_out),0) tout FROM model_usage WHERE biz_id = ? AND at >= ?", bizId, dayStart);
    const conns = q.all<Row>("SELECT platform, mode, status FROM connection WHERE biz_id = ? AND status != 'revoked'", bizId);
    const connOf = (p: string) => {
      const c = conns.filter((x) => x.platform === p);
      return c.length ? (c.some((x) => x.mode === "live" && x.status === "active") ? "live" : c.some((x) => x.status === "active") ? "sandbox" : "error") : "none";
    };
    const eff = effectiveProvider(bizId);
    return {
      groups,
      summary: {
        groups: groups.length,
        running: groups.reduce((a, g) => a + g.running, 0),
        pending: q.scalar<number>("SELECT COUNT(*) FROM approval WHERE biz_id = ? AND status = 'pending'", bizId),
        doneToday: groups.reduce((a, g) => a + g.doneToday, 0),
        activeGoal: q.get<Row>("SELECT id, title, status FROM goal WHERE biz_id = ? ORDER BY created_at DESC LIMIT 1", bizId) ?? null,
      },
      inbox: q.all("SELECT id, title, subject_type, agent_key, risk, created_at FROM approval WHERE biz_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 5", bizId),
      limits: {
        maxDailyAdBudget: s.caps.maxTotalDailyAdBudget, maxAdsPerDay: s.caps.maxAdsCreatedPerDay, maxPostsPerDay: s.caps.maxPostsPerDayPerChannel,
        aiTokensToday: (tok?.tin ?? 0) + (tok?.tout ?? 0), aiTokenBudget: agentsBudget,
      },
      killSwitch: s.killSwitch,
      ai: { provider: eff.provider, models: llmSettings(bizId).models, jev: jevEnabled() },
      tokens: { in: tok?.tin ?? 0, out: tok?.tout ?? 0 },
      platforms: [
        { key: "meta", name: "Meta", state: connOf("meta") }, { key: "tiktok", name: "TikTok", state: connOf("tiktok") },
        { key: "google_ads", name: "Google Ads", state: "soon" }, { key: "pancake", name: "Pancake", state: connOf("pancake") },
        { key: "zlcrm", name: "Zalo (ZL-CRM)", state: connOf("zlcrm") }, { key: "messenger", name: "Messenger", state: connOf("meta") },
        { key: "cms", name: "WordPress", state: "soon" }, { key: "sheets", name: "Google Sheets", state: connOf("sheets") },
        { key: "telegram", name: "Telegram", state: connOf("telegram") }, { key: "youtube", name: "YouTube", state: "soon" },
      ],
      events,
    };
  });
}
