import { AGENTS, systemPrefix, type Dna, type RunContext } from "@dotaka/agents";
import type { TaskStatus } from "@dotaka/contracts";
import { activeDna, audit, bizSettings, byId, emit, insert, q, tx, update, type Row } from "@dotaka/db";
import { BudgetExceeded, generate } from "@dotaka/llm-gateway";
import { retrieve } from "@dotaka/chat-engine";
import { AppError, logger, nowIso } from "@dotaka/shared";
import { agentPlaybook } from "@dotaka/skills";
import { enqueue } from "./queue.ts";
import { findingsOf, reviewOutput } from "./review.ts";
import { createAdsProposals } from "./ads.ts";
import { ensurePostImage, postImageKind } from "./post-image.ts";

/** Hạn của mục duyệt theo cài đặt "approvalExpiryHours" (mặc định 72 giờ) — dùng chung mọi loại duyệt (bài, video…). */
export function approvalExpiresAt(bizId: string, from = Date.now()): string {
  const h = Number(bizSettings(bizId).approvalExpiryHours) || 72;
  return new Date(from + h * 3600_000).toISOString();
}

// ---------------- Task state machine (spec §5) ----------------
const NEXT: Record<string, TaskStatus[]> = {
  pending: ["ready", "cancelled"],
  ready: ["running", "cancelled", "blocked"],
  running: ["in_review", "failed", "blocked", "done", "awaiting_approval"],
  in_review: ["revising", "awaiting_approval", "done", "blocked"],
  revising: ["running", "cancelled"],
  awaiting_approval: ["approved", "rejected", "expired", "cancelled"],
  approved: ["executing", "done"],
  executing: ["done", "failed"],
  failed: ["ready", "cancelled"],
  blocked: ["ready", "cancelled"],
  rejected: ["ready"],
  expired: ["ready", "cancelled"],
};
export function setTaskStatus(task: Row, to: TaskStatus, patch: Row = {}, actor = "orchestrator") {
  if (task.status !== to && !NEXT[task.status]?.includes(to)) throw new AppError("BAD_TRANSITION", `Task ${task.status} → ${to} không hợp lệ`);
  update("task", task.id, { status: to, ...patch });
  audit(task.biz_id, actor, "task.status", { type: "task", id: task.id }, { from: task.status, to, agent: task.agent_key });
  emit(task.biz_id, "task.updated", { taskId: task.id, status: to, agent: task.agent_key });
  Object.assign(task, { status: to, ...patch });
}

// ---------------- Goals -> task graph (graph templates defined in code) ----------------
export function createGoal(bizId: string, input: { title: string; description: string; template: "launch_campaign" | "weekly_content"; budgetAds: number; dueDate?: string; contentCount?: number; params?: Row }, actor = "ceo") {
  return tx(() => {
    const goal = insert("goal", { biz_id: bizId, title: input.title, description: input.description, template: input.template, budget_ads: input.budgetAds, due_date: input.dueDate ?? null, status: "active", params: input.params ?? {} });
    const brief = insert("task", { biz_id: bizId, goal_id: goal.id, agent_key: "brief", title: "Chuẩn hóa brief", status: "ready", input: {}, depends_on: [] });
    let prev = brief.id;
    if (input.template === "launch_campaign") {
      const r = insert("task", { biz_id: bizId, goal_id: goal.id, agent_key: "market_research", title: "Nghiên cứu thị trường & đối thủ", status: "pending", input: {}, depends_on: [prev] });
      prev = r.id;
    }
    insert("task", { biz_id: bizId, goal_id: goal.id, agent_key: "strategy", title: "Chiến lược & kế hoạch nội dung", status: "pending", input: { contentCount: input.contentCount ?? (input.template === "launch_campaign" ? 5 : 4) }, depends_on: [prev] });
    audit(bizId, actor, "goal.created", { type: "goal", id: goal.id }, input);
    emit(bizId, "goal.created", { goalId: goal.id });
    enqueue("agent", "agent.run", { taskId: brief.id }, { bizId, idempotencyKey: `run:${brief.id}:0` });
    return goal;
  });
}

function expandFromStrategy(strategyTask: Row) {
  const goal = byId<Row>("goal", strategyTask.goal_id);
  const created: string[] = [];
  for (const [i, item] of planForGoal(goal, strategyTask.output?.contentPlan ?? []).entries()) {
    const agent = item.format === "reel" || item.format === "video" ? "video_script" : "content";
    const t = insert("task", {
      biz_id: strategyTask.biz_id, goal_id: strategyTask.goal_id, parent_id: strategyTask.id, agent_key: agent,
      title: `${agent === "video_script" ? "Kịch bản" : "Bài"} ${item.channel}: ${item.topic}`, status: "ready", input: { item, index: i }, depends_on: [strategyTask.id],
    });
    created.push(t.id);
  }
  if (goal?.template === "launch_campaign") {
    const site = activeDna(strategyTask.biz_id)?.data?.company?.website ?? "website";
    const t = insert("task", { biz_id: strategyTask.biz_id, goal_id: strategyTask.goal_id, parent_id: strategyTask.id, agent_key: "seo_web", title: `Bài SEO ${site}`, status: "ready", input: { keyword: "ứng dụng AI cho doanh nghiệp" }, depends_on: [strategyTask.id] });
    created.push(t.id);
  }
  for (const id of created) enqueue("agent", "agent.run", { taskId: id }, { bizId: strategyTask.biz_id, idempotencyKey: `run:${id}:0` });
}

/**
 * Chiến dịch của Lái tự động (goal.params.autopilot): mọi nội dung về đúng nền tảng đã chọn, đúng số bài,
 * TikTok luôn là video ngắn, chế độ "không làm video" thì đổi video → bài ảnh. Chiến dịch thường giữ nguyên kế hoạch.
 */
export function planForGoal(goal: Row | undefined, plan: Row[]): Row[] {
  const ap = goal?.params?.autopilot;
  if (!ap?.platform) return plan;
  const isVideo = (f: string) => f === "video" || f === "reel";
  return plan.slice(0, Math.max(1, Number(ap.contentCount) || plan.length)).map((item) => {
    let format = String(item.format ?? "text");
    if (ap.platform === "tiktok") format = "reel";
    else if (ap.videoMode === "none" && isVideo(format)) format = "image";
    return { ...item, channel: ap.platform, format };
  });
}

/** Khâu chiến dịch dừng tại đây? (Sếp chọn "Dừng sau bước …" khi tạo kế hoạch). Việc giao riêng luôn dừng ở chính nó. */
export function stopsHere(task: Row, goal?: Row): boolean {
  return Boolean(task.input?.standalone) || (goal?.params?.stopAfter != null && goal.params.stopAfter === task.agent_key);
}

export function onTaskDone(task: Row) {
  const goal = task.goal_id ? byId<Row>("goal", task.goal_id) : undefined;
  if (task.agent_key === "strategy" && !stopsHere(task, goal)) expandFromStrategy(task);
  if (task.agent_key === "ads") createAdsProposals(task);
  // Dừng sau bước Sếp chọn: không mở khâu tiếp theo, chiến dịch "Tạm dừng" chờ Sếp bấm Triển khai tiếp.
  if (goal && stopsHere(task, goal)) {
    if (goal.status === "active") {
      update("goal", goal.id, { status: "paused" });
      audit(task.biz_id, "orchestrator", "goal.stopped_after", { type: "goal", id: goal.id }, { agent: task.agent_key, taskId: task.id });
      emit(task.biz_id, "goal.updated", { goalId: goal.id, status: "paused" });
    }
    return;
  }
  const deps = q.all<Row>("SELECT * FROM task WHERE goal_id = ? AND status = 'pending'", task.goal_id);
  for (const d of deps) {
    const ok = (d.depends_on as string[]).every((id) => byId<Row>("task", id)?.status === "done");
    if (ok) {
      setTaskStatus(d, "ready");
      enqueue("agent", "agent.run", { taskId: d.id }, { bizId: d.biz_id, idempotencyKey: `run:${d.id}:0` });
    }
  }
  const open = q.scalar<number>("SELECT COUNT(*) FROM task WHERE goal_id = ? AND status NOT IN ('done','cancelled','rejected')", task.goal_id);
  if (open === 0 && task.goal_id) update("goal", task.goal_id, { status: "done" });
}

// ---------------- Context (DNA slice, knowledge, lessons, exemplars) ----------------
function buildContext(task: Row, dna: Dna): RunContext {
  const goal = task.goal_id ? byId<Row>("goal", task.goal_id) : undefined;
  const done = task.goal_id ? q.all<Row>("SELECT agent_key, output FROM task WHERE goal_id = ? AND status = 'done' AND output IS NOT NULL", task.goal_id) : [];
  // Việc giao riêng có thể dựa trên kết quả các việc trước (vd: lập kế hoạch dựa trên bản nghiên cứu đã làm).
  const basedOn = ((task.input?.basedOn ?? []) as string[]).slice(0, 5);
  const based = basedOn.length
    ? q.all<Row>(`SELECT agent_key, output FROM task WHERE biz_id = ? AND id IN (${basedOn.map(() => "?").join(",")}) AND output IS NOT NULL`, task.biz_id, ...basedOn)
    : [];
  const out = (k: string) => done.find((t) => t.agent_key === k)?.output ?? based.find((t) => t.agent_key === k)?.output;
  const topic = task.input?.item?.topic ?? task.input?.instruction ?? goal?.title ?? "";
  const standaloneGoal = !goal && task.input?.instruction
    ? { title: `Việc Sếp giao riêng cho ${AGENTS[task.agent_key]?.label ?? task.agent_key} (làm xong bước này là dừng)`, description: String(task.input.instruction), budget_ads: Number(task.input.budgetAds ?? 0) }
    : undefined;
  return {
    dna,
    goal: (goal ?? standaloneGoal) as RunContext["goal"],
    upstream: {
      brief: out("brief"),
      research: task.agent_key === "strategy" || based.length ? out("market_research") : undefined,
      strategy: ["content", "video_script", "seo_web"].includes(task.agent_key) && !based.length ? undefined : out("strategy"),
    },
    knowledge: retrieve(task.biz_id, topic, 4).map((k) => ({ ref: k.ref, text: k.text })),
    lessons: q.all<Row>("SELECT statement FROM lesson WHERE biz_id = ? AND status = 'active' AND (agent_key IS NULL OR agent_key = ?) LIMIT 5", task.biz_id, task.agent_key).map((l) => l.statement),
    exemplars: q.all<Row>("SELECT text FROM exemplar WHERE biz_id = ? AND agent_key = ? AND kind = 'winner' ORDER BY created_at DESC LIMIT 2", task.biz_id, task.agent_key).map((e) => e.text),
    findings: task.input?.findings,
    revision: task.revisions ?? 0,
  };
}

function needsApproval(agentKey: string, autonomy: string, verdict: string, total: number, autopilot?: Row, stop = false): boolean {
  // Khâu nội bộ (brief / nghiên cứu / kế hoạch) dừng tại đây: không kích hoạt gì tiếp → Sếp chỉ cần xem kết quả, không cần duyệt.
  if (stop && ["brief", "market_research", "strategy"].includes(agentKey)) return verdict === "escalate";
  // Lái tự động: kế hoạch nội dung (ngân sách ads = 0) đạt chấm điểm thì tự chạy tiếp nếu Sếp bật; bài/kịch bản luôn chờ Sếp nếu bật cổng duyệt.
  if (autopilot && agentKey === "strategy" && autopilot.autoStrategy) return verdict !== "pass";
  if (autopilot?.gate && ["content", "video_script"].includes(agentKey)) return true;
  if (agentKey === "strategy") return true; // strategy/budget split is always the CEO's call
  if (["brief", "market_research"].includes(agentKey)) return false; // internal artefacts, no external effect
  if (autonomy === "L0" || autonomy === "L1") return true;
  if (autonomy === "L2") return !(verdict === "pass" && total >= 80);
  return verdict !== "pass";
}

// ---------------- Agent Runtime loop ----------------
export async function runTask(taskId: string) {
  const task = byId<Row>("task", taskId);
  if (!task || !["ready", "revising"].includes(task.status)) return;
  const def = AGENTS[task.agent_key];
  if (!def) throw new AppError("NO_AGENT", `Chưa có agent ${task.agent_key}`);
  const cfg = q.get<Row>("SELECT * FROM agent_config WHERE biz_id = ? AND agent_key = ?", task.biz_id, task.agent_key);
  if (!cfg?.enabled) {
    setTaskStatus(task, task.status === "revising" ? "cancelled" : "blocked", { error: { code: "AGENT_DISABLED", message: "Agent đang tắt" } });
    return;
  }
  const dnaRow = activeDna(task.biz_id);
  if (!dnaRow) throw new AppError("NO_DNA", "Chưa có DNA đang hiệu lực");
  const dna = dnaRow.data as Dna;
  const pv = q.get<Row>("SELECT * FROM prompt_version WHERE agent_key = ? AND status = 'active' ORDER BY version DESC LIMIT 1", task.agent_key);

  setTaskStatus(task, "running", { progress: 0.15, step: "Dựng ngữ cảnh" });
  const ctx = buildContext(task, dna);
  const playbook = agentPlaybook(task.biz_id, task.agent_key);
  const run = insert("task_run", { biz_id: task.biz_id, task_id: task.id, attempt: (task.revisions ?? 0) + 1, prompt_version_id: pv?.id ?? "builtin", status: "running", skills: playbook.parts, started_at: nowIso() });
  update("task", task.id, { progress: 0.35, step: "Agent đang tạo đầu ra" });
  emit(task.biz_id, "task.updated", { taskId: task.id, status: "running", agent: task.agent_key });

  let gen;
  try {
    gen = await generate({
      bizId: task.biz_id, agentKey: task.agent_key, tier: def.tier, taskRunId: run.id,
      system: systemPrefix(dna, def), systemSuffix: playbook.text, user: def.buildUser(task.input, ctx), schema: def.output,
      budget: { perRun: cfg.token_budget_run, perDay: cfg.token_budget_day },
      sandbox: () => def.sandbox(task.input, ctx),
    });
  } catch (e) {
    const blocked = e instanceof BudgetExceeded;
    update("task_run", run.id, { status: "failed", error: { message: String(e) }, ended_at: nowIso() });
    setTaskStatus(task, blocked ? "blocked" : "failed", { error: { code: blocked ? "TOKEN_BUDGET_EXCEEDED" : "RUN_FAILED", message: e instanceof Error ? e.message : String(e) }, step: null });
    if (blocked) emit(task.biz_id, "alert.raised", { level: "warning", text: `Agent ${task.agent_key} chạm trần token` });
    logger.error("task.failed", { taskId, error: String(e) });
    return;
  }
  update("task_run", run.id, {
    status: "done", output: gen.output, model: gen.model, tokens_in: gen.usage.input, tokens_out: gen.usage.output,
    tokens_cached: gen.usage.cached, cost_micros: gen.usage.costMicros, ended_at: nowIso(),
  });

  // Kênh do Chiến lược giao là chuẩn (agent viết bài không tự đổi kênh) — kể cả cho bước chấm độ dài theo kênh.
  const assigned = task.input?.item?.channel;
  if (assigned && gen.output && typeof (gen.output as any).channel === "string") (gen.output as any).channel = assigned;

  // DNA guardrail auto-fix: banned characters (ZONO: em-dash) are corrected in code, not by another model round.
  const autoFixed = def.toContent ? stripBanned(gen.output, dna.bannedChars ?? []) : 0;
  const content = def.toContent?.(gen.output, task.input);
  let contentItemId: string | null = null;
  if (content) {
    const existing = q.get<Row>("SELECT id FROM content_item WHERE task_id = ?", task.id);
    const row = { title: content.title, body: content.body, channel: content.channel, kind: content.kind, status: "in_review" };
    if (existing) { update("content_item", existing.id, row); contentItemId = existing.id; }
    else contentItemId = insert("content_item", { biz_id: task.biz_id, goal_id: task.goal_id, task_id: task.id, agent_key: task.agent_key, ...row }).id;
  }

  setTaskStatus(task, "in_review", { output: gen.output, progress: 0.7, step: "Review Agent chấm" });
  if (!def.rubricKey) {
    setTaskStatus(task, "done", { progress: 1, step: null });
    onTaskDone(task);
    return;
  }
  const v = (gen.output as any).variants?.[0];
  const review = await reviewOutput({
    bizId: task.biz_id, subjectType: content ? "content_item" : "task", subjectId: contentItemId ?? task.id, rubricKey: def.rubricKey,
    output: gen.output, dna, autoFixed,
    contentView: content ? { title: content.title, hook: v?.hook ?? (gen.output as any).hooks?.[0] ?? (gen.output as any).title ?? "", body: v?.body ?? content.body, cta: v?.cta ?? (gen.output as any).cta ?? "", channel: content.channel } : undefined,
  });
  if (contentItemId) update("content_item", contentItemId, { review_score_id: review.id });
  emit(task.biz_id, "review.completed", { taskId: task.id, verdict: review.verdict, total: review.total });

  // Lỗi nghiêm trọng SỬA ĐƯỢC (giá lệch, câu cấm…) → cho agent các vòng sửa trước khi chặn hẳn.
  const fixableBlock = review.verdict === "block" && review.fixable;
  if (review.verdict === "block" && !(fixableBlock && task.revisions < def.maxRevisions)) {
    setTaskStatus(task, "blocked", { progress: 1, step: null, error: { code: "REVIEW_BLOCKED", message: review.fatalFindings.join("; ") } });
    if (contentItemId) update("content_item", contentItemId, { status: "blocked" });
    return;
  }
  if ((review.verdict === "revise" || fixableBlock) && task.revisions < def.maxRevisions) {
    setTaskStatus(task, "revising", { revisions: task.revisions + 1, input: { ...task.input, findings: findingsOf(review) }, progress: 0.5, step: `Sửa theo review (vòng ${task.revisions + 1})` });
    enqueue("agent", "agent.run", { taskId: task.id }, { bizId: task.biz_id, idempotencyKey: `run:${task.id}:${task.revisions}` });
    return;
  }
  // Bài viết đã qua vòng chấm → tạo ảnh đi kèm TRƯỚC khi vào hộp Duyệt / tự duyệt: Sếp duyệt cả chữ lẫn ảnh, và lượt đăng
  // tự đính ảnh (content_item.asset_id). Tạo ảnh lỗi không chặn bài — lý do được ghi vào mục duyệt.
  let image: Awaited<ReturnType<typeof ensurePostImage>> | undefined;
  if (contentItemId && content && postImageKind(content.kind)) {
    update("task", task.id, { progress: 0.8, step: "Tạo ảnh cho bài viết" });
    emit(task.biz_id, "task.updated", { taskId: task.id, status: "in_review", agent: task.agent_key });
    image = await ensurePostImage(task.biz_id, contentItemId, run.id);
  }
  const notPassed = review.verdict === "revise";
  const goalRow = task.goal_id ? byId<Row>("goal", task.goal_id) : undefined;
  const autopilot = goalRow?.params?.autopilot;
  if (needsApproval(task.agent_key, cfg.autonomy, review.verdict, review.total, autopilot, stopsHere(task, goalRow)) || notPassed) {
    setTaskStatus(task, "awaiting_approval", { progress: 0.9, step: "Chờ CEO duyệt" });
    if (contentItemId) update("content_item", contentItemId, { status: "awaiting_approval" });
    const approval = insert("approval", {
      biz_id: task.biz_id, subject_type: "task", subject_id: task.id, agent_key: task.agent_key,
      title: content?.title ?? `${def.label}: ${task.title}`, risk: notPassed || review.verdict === "escalate" ? "medium" : "low",
      status: "pending", review_score_id: review.id,
      preview: { kind: content?.kind ?? task.agent_key, channel: content?.channel ?? null, body: content?.body ?? null, notPassed, escalated: review.verdict === "escalate", ...(image?.assetId ? { assetId: image.assetId } : {}), ...(image?.error ? { imageError: image.error.slice(0, 300) } : {}) },
      expires_at: approvalExpiresAt(task.biz_id), // theo cài đặt "approvalExpiryHours"
    });
    emit(task.biz_id, "approval.created", { approvalId: approval.id, title: approval.title });
    return;
  }
  // Autonomy allows proceeding without the CEO (L2+ and a clean pass).
  setTaskStatus(task, "awaiting_approval", { step: autopilot && task.agent_key === "strategy" ? "Lái tự động: kế hoạch đạt chấm điểm, tự chạy tiếp" : "Tự duyệt theo mức tự chủ" });
  await approveTask(task, autopilot && task.agent_key === "strategy" ? "autopilot" : "auto:" + cfg.autonomy);
}

export async function approveTask(task: Row, actor: string, edited?: string) {
  setTaskStatus(task, "approved", {}, actor);
  const ci = q.get<Row>("SELECT * FROM content_item WHERE task_id = ?", task.id);
  if (ci) {
    update("content_item", ci.id, { status: "approved", ...(edited ? { body: edited } : {}) });
    // Việc giao riêng "chỉ viết, không đăng": duyệt xong là dừng — Sếp tự bấm đăng ở trang Nội dung khi muốn.
    if (!task.input?.noPublish && ci.channel && ["facebook", "instagram", "tiktok", "zalo", "website"].includes(ci.channel) && ci.kind !== "video_script") {
      enqueue("publish", "publish.schedule", { contentItemId: ci.id }, { bizId: task.biz_id, idempotencyKey: `sched-pub:${ci.id}` });
    }
  }
  setTaskStatus(task, "done", { progress: 1, step: null }, actor);
  onTaskDone(task);
}

/** Chiến dịch đang dừng sau 1 bước (Sếp chọn) → Sếp bấm "Triển khai tiếp": chạy các khâu còn lại như bình thường. */
export function continueGoal(bizId: string, goalId: string, actor: string) {
  const goal = byId<Row>("goal", goalId);
  if (!goal || goal.biz_id !== bizId) throw new AppError("NOT_FOUND", "Không tìm thấy kế hoạch", 404);
  const stopAt = goal.params?.stopAfter;
  if (goal.status !== "paused" || !stopAt) throw new AppError("NOT_STOPPED", "Kế hoạch này không ở trạng thái dừng chờ triển khai tiếp");
  const last = q.get<Row>("SELECT * FROM task WHERE goal_id = ? AND agent_key = ? AND status = 'done' ORDER BY updated_at DESC LIMIT 1", goalId, stopAt);
  if (!last) throw new AppError("NOT_READY", "Bước dừng chưa xong — chờ bước đó hoàn thành rồi triển khai tiếp");
  update("goal", goalId, { status: "active", params: { ...goal.params, stopAfter: null, continuedAt: nowIso() } });
  audit(bizId, actor, "goal.continued", { type: "goal", id: goalId }, { from: stopAt });
  emit(bizId, "goal.updated", { goalId, status: "active" });
  onTaskDone(last);
  return { goalId, status: "active", from: stopAt };
}

export function retryTask(bizId: string, taskId: string, actor = "ceo") {
  const task = byId<Row>("task", taskId);
  if (!task || task.biz_id !== bizId) throw new AppError("NOT_FOUND", "Không tìm thấy task", 404);
  setTaskStatus(task, "ready", { error: null, progress: 0 }, actor);
  reviveGoal(task.goal_id); // chiến dịch "kẹt"/"xong" → chạy lại
  enqueue("agent", "agent.run", { taskId }, { bizId, idempotencyKey: `run:${taskId}:retry:${Date.now()}` });
}

/** Chiến dịch đang "kẹt"/"xong" có khâu được mở lại → về "đang chạy". (Chiến dịch "Tạm dừng" chờ Sếp triển khai tiếp thì KHÔNG mở lại.) */
function reviveGoal(goalId: string | null | undefined) {
  if (!goalId) return;
  const g = byId<Row>("goal", goalId);
  if (!g || !["stalled", "done"].includes(g.status)) return;
  const { stall: _s, ...params } = (g.params ?? {}) as Row;
  update("goal", goalId, { status: "active", params });
  emit(g.biz_id, "goal.updated", { goalId, status: "active" });
}

/**
 * "Tạo lại" 1 nội dung: chạy lại agent viết. Khâu đang chờ duyệt / lỗi / bị từ chối / hết hạn → mở lại đúng khâu đó.
 * Khâu đã xong: nội dung chưa ra ngoài → viết lại tại chỗ (huỷ mục duyệt đăng đang chờ); đã lên lịch/đã đăng → tạo khâu MỚI
 * (bài cũ giữ nguyên lịch sử).
 */
export function regenerateContent(bizId: string, contentItemId: string, actor = "ceo", note?: string) {
  const c = byId<Row>("content_item", contentItemId);
  if (!c || c.biz_id !== bizId) throw new AppError("NOT_FOUND", "Không thấy nội dung", 404);
  if (!c.task_id) throw new AppError("NOT_FOUND", "Nội dung không gắn task", 404);
  const t = byId<Row>("task", c.task_id)!;
  if (["running", "in_review", "revising", "ready"].includes(t.status)) throw new AppError("BUSY", "Agent đang viết nội dung này — chờ xong rồi tạo lại", 409);
  if (t.status === "awaiting_approval") {
    q.run("UPDATE approval SET status = 'cancelled' WHERE subject_type = 'task' AND subject_id = ? AND status = 'pending'", t.id);
    update("task", t.id, { status: "failed" });
    t.status = "failed";
  }
  // Góp ý của Sếp → agent viết lại theo đúng góp ý (như vòng sửa của Review Agent).
  const findings = note ? [`GÓP Ý CỦA SẾP: ${note}`] : undefined;
  if (t.status !== "done") {
    if (findings) update("task", t.id, { input: { ...(t.input ?? {}), findings: [...findings, ...((t.input?.findings ?? []) as string[]).slice(0, 5)] } });
    retryTask(bizId, t.id, actor); return { taskId: t.id, mode: "retry" };
  }
  // "Đã ra ngoài" = có lệnh đăng thật (không phải bản nháp) chưa hỏng, hoặc bài đã lên lịch/đã đăng. Lệnh đăng đã lỗi
  // (failed/needs_setup → bài ở "đăng thủ công") thì viết lại tại chỗ, không đẻ thêm khâu trùng.
  const out = Boolean(q.get("SELECT id FROM publish_job WHERE content_item_id = ? AND mode != 'draft' AND status NOT IN ('failed','needs_setup')", c.id)) || ["scheduled", "published"].includes(c.status);
  if (out) {
    const nt = insert("task", {
      biz_id: bizId, goal_id: t.goal_id, parent_id: t.parent_id ?? null, agent_key: t.agent_key, title: `${t.title} (tạo lại)`, status: "ready",
      input: { ...(t.input ?? {}), findings }, depends_on: t.depends_on ?? [],
    });
    reviveGoal(t.goal_id);
    audit(bizId, actor, "content.regenerate", { type: "content_item", id: c.id }, { newTaskId: nt.id, mode: "new_task" });
    enqueue("agent", "agent.run", { taskId: nt.id }, { bizId, idempotencyKey: `run:${nt.id}:0` });
    return { taskId: nt.id, mode: "new_task" };
  }
  q.run("UPDATE approval SET status = 'cancelled', decided_by = ?, decided_at = ? WHERE subject_type = 'publish' AND subject_id = ? AND status = 'pending'", actor, nowIso(), c.id);
  // Bài viết lại tại chỗ sẽ được duyệt lần nữa → nhả khoá chống trùng của lần duyệt/lần đăng cũ (đã lỗi) để lịch đăng mới không bị bỏ qua.
  q.run("UPDATE publish_job SET idempotency_key = idempotency_key || ':old:' || id WHERE content_item_id = ? AND status IN ('failed','needs_setup')", c.id);
  q.run("UPDATE job SET idempotency_key = idempotency_key || ':old:' || id WHERE idempotency_key = ?", `sched-pub:${c.id}`);
  // done → ready không có trong máy trạng thái thường: đây là lệnh của người, ghi nhật ký rõ.
  update("task", t.id, { status: "ready", error: null, progress: 0, revisions: 0, step: "Tạo lại theo yêu cầu", input: { ...(t.input ?? {}), findings } });
  audit(bizId, actor, "task.status", { type: "task", id: t.id }, { from: "done", to: "ready", reason: "regenerate" });
  reviveGoal(t.goal_id);
  enqueue("agent", "agent.run", { taskId: t.id }, { bizId, idempotencyKey: `run:${t.id}:regen:${Date.now()}` });
  return { taskId: t.id, mode: "rewrite" };
}

/** Replaces banned characters in every string of an agent output (in place). Returns how many were replaced. */
function stripBanned(obj: any, banned: string[]): number {
  if (!banned.length) return 0;
  let n = 0;
  const fix = (v: string) => {
    let out = v;
    for (const c of banned) {
      const parts = out.split(c);
      n += parts.length - 1;
      out = c === "—" ? parts.map((x, i) => (i ? x.replace(/^\s+/, "") : x.replace(/\s+$/, ""))).join(", ") : parts.join("");
    }
    return out;
  };
  const walk = (o: any) => {
    for (const k of Object.keys(o)) {
      if (typeof o[k] === "string") o[k] = fix(o[k]);
      else if (o[k] && typeof o[k] === "object") walk(o[k]);
    }
  };
  walk(obj);
  return n;
}
