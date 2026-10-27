import { CATALOG } from "@dotaka/agents";
import { activeDna, bus, byId, emit, q, type Row } from "@dotaka/db";
import { effectiveProvider, generate } from "@dotaka/llm-gateway";
import { logger, nowIso } from "@dotaka/shared";
import { z } from "zod";
import {
  DASHBOARD_NOTE, F, activeVault, appendToNote, renameNote, createVault, freePath, noteExists, parseFrontmatter, readNoteFile, safeName, scanVault, stringifyFrontmatter, upsertAutoBlock, writeNoteFile,
} from "./brain.ts";
import { notifyDesktop } from "./creative.ts";

/**
 * Agentic Brain runs itself: the system writes its own memory into the vault —
 * daily / weekly / monthly logs, a live "Bảng điều hành", one note per agent, a wiki note per skill, product & knowledge
 * notes, the brand DNA, every finished piece of agent work, videos, conversations with Ngân Nguyệt, lessons,
 * and reminders that fire on time. Generated text lives between `zono:auto` markers, so the CEO's own writing
 * in the same note is never overwritten.
 */
const TZ = "Asia/Ho_Chi_Minh";
export const vnDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const vnTime = (iso: string) => new Date(iso).toLocaleTimeString("vi-VN", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayStart = (date: string) => new Date(`${date}T00:00:00+07:00`);
const addDays = (date: string, n: number) => vnDate(new Date(dayStart(date).getTime() + n * 86400_000 + 3600_000));
const vnDow = (date: string) => new Date(`${date}T12:00:00+07:00`).getUTCDay(); // 0 = Chủ nhật
export function isoWeek(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 86400_000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
const weekStart = (date: string) => addDays(date, -((vnDow(date) + 6) % 7)); // Monday
const viDate = (date: string) => date.split("-").reverse().join("/");
const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
const agentLabel = (key: string) => CATALOG.find((c) => c.key === key)?.label ?? key;
const agentLink = (key: string) => `[[${agentLabel(key)}]]`;

/** JSON agent output → readable Markdown. */
export function toMd(v: unknown, depth = 0): string {
  if (v == null) return "";
  if (typeof v !== "object") return String(v);
  if (Array.isArray(v)) {
    return v.map((x) => (x && typeof x === "object" ? `- ${Object.entries(x).map(([k, y]) => `**${k}**: ${typeof y === "object" ? JSON.stringify(y) : y}`).join(" · ")}` : `- ${x}`)).join("\n");
  }
  return Object.entries(v as Row).filter(([, x]) => x != null && x !== "" && !(Array.isArray(x) && !x.length)).map(([k, x]) => {
    const head = depth === 0 ? `## ${k}` : `**${k}**`;
    return x && typeof x === "object" ? `${head}\n${toMd(x, depth + 1)}` : `${head}: ${x}`;
  }).join("\n\n");
}

function vaultFor(bizId: string): Row | null {
  try { return activeVault(bizId); } catch { return null; }
}
/** Note created once (by an id in its frontmatter), later only its auto block is refreshed. A system note found outside
 *  its folder (written under an older layout / rule) is moved there first — [[links]] to it keep working. */
function upsertById(v: Row, idKey: string, id: string, folder: string, title: string, meta: Row, block: string) {
  const found = q.get<Row>(`SELECT path FROM brain_note WHERE vault_id = ? AND json_extract(meta, '$.${idKey}') = ?`, v.id, id);
  let rel = found?.path ?? freePath(v, folder, title);
  if (found && !found.path.startsWith(`${folder}/`)) {
    try { rel = renameNote(v, found.path, freePath(v, folder, found.path.split("/").pop()!.replace(/\.md$/, "")), "system").path; } catch (e) { logger.warn("brain.relocate_failed", { path: found.path, error: String(e) }); }
  }
  return upsertAutoBlock(v, rel, block, () => `${stringifyFrontmatter({ ...meta, [idKey]: id })}# ${title}\n`);
}

// ---------------- Default vault ----------------
export function ensureDefaultVault(bizId: string) {
  if (q.get("SELECT id FROM brain_vault WHERE biz_id = ?", bizId)) return;
  const biz = byId<Row>("biz", bizId);
  createVault(bizId, { name: `Agentic Brain · ${biz?.name ?? "ZONO"}` }, "system");
}

// ---------------- Identity, knowledge, skills, agents, lessons ----------------
function syncDna(v: Row) {
  const dna = activeDna(v.biz_id);
  if (!dna) return;
  const d = dna.data as any;
  const products = (d.products ?? []) as Row[];
  for (const p of products) {
    upsertById(v, "product_key", p.key, `${F.knowledge}/Sản phẩm`, p.name, { type: "fact", tags: ["sản-phẩm"] }, [
      `**Sản phẩm:** ${p.name}${p.aliases?.length ? ` (còn gọi: ${p.aliases.join(", ")})` : ""}`,
      `**Hình thức:** ${p.format ?? "—"} · **Giá:** ${p.price == null ? "liên hệ" : p.price === 0 ? "miễn phí" : vnd(p.price)}`,
      p.audience ? `**Dành cho:** ${p.audience}` : "", p.link ? `**Link:** ${p.link}` : "",
      "", p.summary ?? "", "", `Thuộc [[DNA thương hiệu]] · ${d.company?.brand ?? ""}`,
    ].filter((x) => x !== undefined).join("\n"));
  }
  upsertById(v, "dna", "active", F.brand, "DNA thương hiệu", { type: "identity" }, [
    `_Phiên bản DNA ${dna.version} · tự đồng bộ từ "Mục tiêu & DNA" — sửa DNA trong hệ thống, ghi chú này tự cập nhật._`, "",
    toMd({
      "Doanh nghiệp": d.company, "Định vị": d.positioning, "Sứ mệnh": d.mission, "Khách hàng mục tiêu": d.audience, "Ưu đãi": d.offers,
      "Khác biệt": d.differentiators, "Giọng thương hiệu": d.voice, "Claim bị cấm": d.forbiddenClaims, "Kênh": d.channels, "Mục tiêu": d.goals, "Cần xác nhận": d.pendingConfirmations,
    }),
    "", "## Sản phẩm", ...products.map((p) => `- [[${safeName(p.name)}]]`),
  ].join("\n"));
}
function syncKnowledgeDocs(v: Row) {
  for (const d of q.all<Row>("SELECT * FROM knowledge_doc WHERE biz_id = ? AND source NOT LIKE 'brain:%'", v.biz_id)) {
    const found = q.get<Row>("SELECT path, mtime FROM brain_note WHERE vault_id = ? AND json_extract(meta, '$.source') = ?", v.id, `knowledge_doc:${d.id}`);
    if (found && found.mtime >= d.updated_at) continue;
    const rel = found?.path ?? freePath(v, F.knowledge, d.title);
    writeNoteFile(v, rel, `${stringifyFrontmatter({ type: "fact", kind: d.kind, source: `knowledge_doc:${d.id}`, tags: d.tags })}# ${d.title}\n\n_Từ Kho tri thức (${d.source}). Sửa trong trang Kho tri thức để agent dùng bản mới._\n\n${d.body}\n`);
  }
}
function syncSkills(v: Row) {
  const users = new Map<string, string[]>();
  for (const a of q.all<Row>("SELECT agent_key, skill_key FROM agent_skill WHERE biz_id = ? AND enabled = 1", v.biz_id)) users.set(a.skill_key, [...(users.get(a.skill_key) ?? []), a.agent_key]);
  for (const s of q.all<Row>("SELECT key, kind, name, description, body, grp, version, hash FROM skill WHERE biz_id = ? AND status = 'active'", v.biz_id)) {
    const found = q.get<Row>("SELECT path, meta FROM brain_note WHERE vault_id = ? AND json_extract(meta, '$.skill') = ?", v.id, s.key);
    if (found?.meta?.hash === s.hash) continue;
    const rel = found?.path ?? freePath(v, `${F.playbook}/Kỹ năng${s.grp ? `/${safeName(s.grp)}` : ""}`, s.name);
    const body = String(s.body).replace(/^---[\s\S]*?---\n?/, "");
    writeNoteFile(v, rel, `${stringifyFrontmatter({ type: "skill", skill: s.key, kind: s.kind, group: s.grp, version: s.version, hash: s.hash })}# ${s.name}\n\n> ${String(s.description).replace(/\n/g, " ").slice(0, 600)}\n\n**Nhóm:** ${s.grp ?? "—"} · **Phiên bản:** ${s.version}\n**Agent dùng:** ${(users.get(s.key) ?? []).map(agentLink).join(", ") || "—"}\n\n---\n\n${body}\n`);
  }
}
function syncAgents(v: Row) {
  const skills = new Map(q.all<Row>("SELECT key, name FROM skill WHERE biz_id = ?", v.biz_id).map((s) => [s.key, s.name]));
  for (const c of CATALOG) {
    const cfg = q.get<Row>("SELECT enabled, autonomy, limits FROM agent_config WHERE biz_id = ? AND agent_key = ?", v.biz_id, c.key);
    const st = q.get<Row>("SELECT COUNT(*) n, SUM(status = 'done') ok, SUM(status IN ('failed','blocked')) bad FROM task WHERE biz_id = ? AND agent_key = ?", v.biz_id, c.key);
    const mine = q.all<Row>("SELECT skill_key FROM agent_skill WHERE biz_id = ? AND agent_key = ? AND enabled = 1 ORDER BY priority", v.biz_id, c.key);
    const recent = q.all<Row>("SELECT path, title FROM brain_note WHERE vault_id = ? AND json_extract(meta, '$.agent') = ? AND json_extract(meta, '$.type') != 'agent' ORDER BY mtime DESC LIMIT 8", v.id, c.key);
    // Own id key: `agent:` is also on every note an agent produced (would match those instead).
    upsertById(v, "agent_profile", c.key, F.team, c.label, { type: "agent" }, [
      `**Vai trò:** ${c.description}`,
      `**Khâu:** ${c.stage === 0 ? "Tổng điều phối" : c.stage} · **Trạng thái:** ${cfg?.enabled ? "đang bật" : "đang tắt"} · **Tự chủ:** ${cfg?.autonomy ?? c.autonomy} · **Model:** ${cfg?.limits?.model ?? `theo tầng ${c.tier}`}`,
      `**Công cụ:** ${c.tools.join(", ")}`,
      `**Tác vụ:** ${st?.n ?? 0} (xong ${st?.ok ?? 0}, lỗi/chặn ${st?.bad ?? 0})`, "",
      "## Skill đang dùng", mine.length ? mine.map((m) => `- [[${safeName(skills.get(m.skill_key) ?? m.skill_key)}]]`).join("\n") : "—", "",
      "## Việc gần đây", recent.length ? recent.map((r) => `- [[${r.path.replace(/\.md$/, "")}|${r.title}]]`).join("\n") : "—", "",
      c.key === "assistant" ? "Điều phối tất cả: " + CATALOG.filter((x) => x.key !== "assistant").map((x) => agentLink(x.key)).join(" · ") : "Điều phối bởi [[Ngân Nguyệt]]",
    ].join("\n"));
  }
}
function syncLessons(v: Row) {
  for (const l of q.all<Row>("SELECT * FROM lesson WHERE biz_id = ?", v.biz_id)) {
    if (q.get("SELECT 1 FROM brain_note WHERE vault_id = ? AND json_extract(meta, '$.lesson_id') = ?", v.id, l.id)) continue;
    upsertById(v, "lesson_id", l.id, `${F.feedback}/Bài học`, String(l.statement).slice(0, 80), { type: "lesson", agent: l.agent_key ?? undefined, status: l.status }, [
      `**Bài học:** ${l.statement}`, l.applies_when ? `**Áp dụng khi:** ${JSON.stringify(l.applies_when)}` : "", `**Bằng chứng:** ${typeof l.evidence === "string" ? l.evidence : JSON.stringify(l.evidence)}`,
      l.agent_key ? `**Agent:** ${agentLink(l.agent_key)}` : "", `Rút ra ngày [[${vnDate(new Date(l.created_at))}]]`,
    ].filter(Boolean).join("\n"));
  }
}

function syncFeedback(v: Row) {
  const rows = q.all<Row>("SELECT m.text, m.feedback, m.feedback_note, m.updated_at, t.title FROM assistant_message m JOIN assistant_thread t ON t.id = m.thread_id WHERE m.biz_id = ? AND m.feedback IS NOT NULL ORDER BY m.updated_at DESC LIMIT 200", v.biz_id);
  if (!rows.length) return;
  upsertAutoBlock(v, `${F.feedback}/Phản hồi cho Ngân Nguyệt.md`, [
    `Sếp chấm ${rows.length} câu trả lời của [[Ngân Nguyệt]] · 👍 ${rows.filter((r) => r.feedback === "up").length} · 👎 ${rows.filter((r) => r.feedback === "down").length}. Góp ý có ghi chú được Ngân Nguyệt áp dụng ngay từ tin nhắn sau.`, "",
    ...rows.map((r) => `- ${r.feedback === "up" ? "👍" : "👎"} ${viDate(vnDate(new Date(r.updated_at)))} · _${r.title}_${r.feedback_note ? ` — **${r.feedback_note}**` : ""}\n  > ${String(r.text).replace(/\s+/g, " ").slice(0, 160)}…`),
  ].join("\n"), () => `${stringifyFrontmatter({ type: "lesson", agent: "assistant" })}# Phản hồi cho Ngân Nguyệt\n`);
}

// ---------------- Khách hàng & thị trường ----------------
function syncMarket(v: Row) {
  const d = activeDna(v.biz_id)?.data as any;
  if (!d) return;
  for (const a of (d.audience ?? []) as Row[]) {
    const name = String(a.name ?? "Khách hàng").split(/[(/]/)[0].trim();
    upsertById(v, "persona", String(a.name), `${F.market}/Chân dung khách hàng`, name, { type: "persona" }, [
      `**Phân khúc:** ${a.name}`, "", "## Nỗi đau", ...(a.pains ?? []).map((x: string) => `- ${x}`), "", "## Mong muốn", ...(a.goals ?? []).map((x: string) => `- ${x}`),
      "", `Nguồn: [[DNA thương hiệu]] · Sản phẩm phù hợp: ${(d.products ?? []).slice(0, 4).map((p: Row) => `[[${safeName(p.name)}]]`).join(", ")}`,
    ].join("\n"));
  }
  for (const c of (d.goals?.competitors ?? []) as string[]) {
    upsertById(v, "competitor", c, `${F.market}/Đối thủ`, c, { type: "competitor" }, [
      `Đối thủ được ghi trong [[DNA thương hiệu]]. Research Agent và Ngân Nguyệt bổ sung các mục bên dưới khi nghiên cứu.`,
    ].join("\n"));
    const rel = q.get<Row>("SELECT path FROM brain_note WHERE vault_id = ? AND json_extract(meta, '$.competitor') = ?", v.id, c)?.path;
    if (rel && !readNoteFile(v, rel).includes("## Điểm mạnh")) {
      appendToNote(v, rel, ["## Sản phẩm & giá", "", "## Kênh & cách làm nội dung", "", "## Điểm mạnh", "", "## Điểm yếu", "", "## Cơ hội cho chúng ta", "", "## Nguồn tham khảo", ""].join("\n"));
    }
  }
}

// ---------------- Review & kiểm duyệt ----------------
function syncReview(v: Row) {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const rows = q.all<Row>("SELECT id, subject_type, subject_id, rubric_key, total, verdict, result, created_at FROM review_score WHERE biz_id = ? AND created_at > ? ORDER BY created_at DESC", v.biz_id, since);
  const fails = new Map<string, number>(), weak = new Map<string, number>(), verdicts = new Map<string, number>(), byRubric = new Map<string, number[]>();
  for (const r of rows) {
    verdicts.set(r.verdict, (verdicts.get(r.verdict) ?? 0) + 1);
    byRubric.set(r.rubric_key, [...(byRubric.get(r.rubric_key) ?? []), Number(r.total)]);
    for (const c of (r.result?.deterministic ?? []) as Row[]) if (!c.passed) fails.set(c.check, (fails.get(c.check) ?? 0) + 1);
    for (const c of (r.result?.criteria ?? []) as Row[]) if (Number(c.score) < 0.6) weak.set(c.label, (weak.get(c.label) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  upsertAutoBlock(v, `${F.review}/Lỗi hay gặp.md`, [
    `30 ngày qua: **${rows.length}** lượt Review Agent chấm · ${[...verdicts.entries()].map(([k, n]) => `${k} ${n}`).join(" · ") || "chưa có"}`, "",
    "## Kiểm tra bắt buộc bị trượt", top(fails).length ? top(fails).map(([k, n]) => `- ${k} — **${n}** lần`).join("\n") : "- Không có",
    "", "## Tiêu chí điểm thấp (< 60%)", top(weak).length ? top(weak).map(([k, n]) => `- ${k} — **${n}** lần`).join("\n") : "- Không có",
    "", "## Điểm trung bình theo bộ tiêu chí", [...byRubric.entries()].map(([k, a]) => `- ${k}: **${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)}** (${a.length} lượt)`).join("\n") || "- Chưa có",
    "", "Các lỗi lặp lại được [[Feedback loop — Bài học đang áp dụng|Feedback loop]] chuyển thành bài học cho agent.",
  ].join("\n"), () => `${stringifyFrontmatter({ type: "review" })}# Lỗi hay gặp\n`);
  const latest = new Map<string, Row>();
  for (const r of rows) if (!latest.has(r.rubric_key)) latest.set(r.rubric_key, r);
  upsertAutoBlock(v, `${F.review}/Bộ tiêu chí chấm.md`, [...latest.entries()].map(([k, r]) => [
    `## ${k} (phiên bản ${r.result?.rubricVersion ?? "?"})`, "**Kiểm tra bắt buộc:**", ...((r.result?.deterministic ?? []) as Row[]).map((c) => `- ${c.check} _(${c.severity})_`),
    "**Tiêu chí chấm:**", ...((r.result?.criteria ?? []) as Row[]).map((c) => `- ${c.label}`),
  ].join("\n")).join("\n\n") || "Chưa có lượt chấm nào.", () => `${stringifyFrontmatter({ type: "review" })}# Bộ tiêu chí chấm\n`);
  for (const r of q.all<Row>("SELECT * FROM review_score WHERE biz_id = ? AND verdict = 'block' ORDER BY created_at DESC LIMIT 50", v.biz_id)) {
    const ci = r.subject_type === "content_item" ? byId<Row>("content_item", r.subject_id) : null;
    const title = ci?.title ?? `${r.subject_type} ${String(r.subject_id).slice(-6)}`;
    const date = vnDate(new Date(r.created_at));
    const failed = [...((r.result?.deterministic ?? []) as Row[]).filter((c) => !c.passed).map((c) => `${c.check}${c.detail ? ` (${c.detail})` : ""}`), ...((r.result?.fatalFindings ?? []) as string[])];
    upsertById(v, "review_id", r.id, `${F.review}/Bị chặn`, `${date} ${title}`, { type: "review", date, agent: ci?.agent_key ?? undefined }, [
      `**Điểm:** ${Number(r.total).toFixed(1)} · **Kết luận:** chặn · **Bộ tiêu chí:** ${r.rubric_key} · [[${date}]]${ci?.agent_key ? ` · ${agentLink(ci.agent_key)}` : ""}`,
      "", "## Lý do bị chặn", failed.length ? failed.map((f) => `- ${f}`).join("\n") : "- (không ghi lý do)", ci?.body ? `\n## Nội dung bị chặn\n${String(ci.body).slice(0, 3000)}` : "",
    ].join("\n"));
  }
}

// ---------------- Feedback loop ----------------
function syncFeedbackLoop(v: Row) {
  const months = new Map<string, Row[]>();
  for (const a of q.all<Row>("SELECT title, subject_type, agent_key, status, decision_note, decided_by, decided_at FROM approval WHERE biz_id = ? AND decided_at IS NOT NULL AND (status = 'rejected' OR (decision_note IS NOT NULL AND decision_note != '')) ORDER BY decided_at DESC LIMIT 500", v.biz_id)) {
    const m = vnDate(new Date(a.decided_at)).slice(0, 7);
    months.set(m, [...(months.get(m) ?? []), a]);
  }
  for (const [m, list] of months) {
    upsertAutoBlock(v, `${F.feedback}/Sếp từ chối/${m}.md`, [
      `Tháng ${m.split("-").reverse().join("/")}: **${list.filter((a) => a.status === "rejected").length}** mục bị từ chối · ${list.filter((a) => a.status !== "rejected").length} mục duyệt kèm góp ý.`, "",
      ...list.map((a) => `- ${a.status === "rejected" ? "❌" : "✏️"} **${a.title}**${a.agent_key ? ` — ${agentLink(a.agent_key)}` : ""} · ${viDate(vnDate(new Date(a.decided_at)))}${a.decision_note ? `\n  > ${a.decision_note}` : ""}`),
      "", "Agent đọc các lý do này (qua bài học) để không lặp lại.",
    ].join("\n"), () => `${stringifyFrontmatter({ type: "rejection", month: m })}# Sếp từ chối / góp ý — ${m}\n`);
  }
  for (const c of q.all<Row>("SELECT * FROM change_proposal WHERE biz_id = ? ORDER BY created_at DESC LIMIT 100", v.biz_id)) {
    upsertById(v, "proposal_id", c.id, `${F.feedback}/Đề xuất thay đổi`, String(c.title).slice(0, 90), { type: "proposal", status: c.status }, [
      `**Trạng thái:** ${c.status} · **Rủi ro:** ${c.risk ?? "—"} · **Áp dụng cho:** ${c.target_type}`, "", `## Vì sao\n${c.rationale}`, "", `## Thay đổi đề xuất\n${toMd(c.diff)}`,
    ].join("\n"));
  }
  const lessons = q.all<Row>("SELECT agent_key, statement, review_at, created_at FROM lesson WHERE biz_id = ? AND status = 'active' ORDER BY agent_key", v.biz_id);
  const by = new Map<string, Row[]>();
  for (const l of lessons) by.set(l.agent_key ?? "chung", [...(by.get(l.agent_key ?? "chung") ?? []), l]);
  upsertAutoBlock(v, `${F.feedback}/Feedback loop — Bài học đang áp dụng.md`, [
    "Vòng phản hồi: **Sếp từ chối / Review chấm thấp / số liệu kém → bài học → agent đọc trước khi làm lần sau → đo lại kết quả.**", "",
    `**${lessons.length}** bài học đang hiệu lực:`, "",
    ...[...by.entries()].map(([k, ls]) => `## ${k === "chung" ? "Chung" : agentLink(k)}\n${ls.map((l) => `- ${l.statement}${l.review_at ? ` _(xem lại ${viDate(String(l.review_at).slice(0, 10))})_` : ""}`).join("\n")}`),
    "", "Liên quan: [[Lỗi hay gặp]] · [[Phản hồi cho Ngân Nguyệt]] · thư mục Sếp từ chối, Đề xuất thay đổi, Thử nghiệm.",
  ].join("\n"), () => `${stringifyFrontmatter({ type: "lesson" })}# Feedback loop — Bài học đang áp dụng\n`);
}

// ---------------- Mẫu thắng, kho hook ----------------
function syncWinners(v: Row) {
  for (const e of q.all<Row>("SELECT * FROM exemplar WHERE biz_id = ? AND kind = 'winner' ORDER BY created_at DESC LIMIT 200", v.biz_id)) {
    const isVideo = ["video_script", "creative"].includes(e.agent_key);
    const firstLine = String(e.text).split("\n").find((x) => x.trim())?.replace(/[#*>]/g, "").trim().slice(0, 70) ?? "Mẫu thắng";
    upsertById(v, "exemplar_id", e.id, isVideo ? `${F.video}/Thư viện video thắng` : `${F.content}/Thư viện bài thắng`, firstLine, { type: "winner", agent: e.agent_key }, [
      `**Kết quả:** ${typeof e.outcome === "string" ? e.outcome : JSON.stringify(e.outcome)} · ${agentLink(e.agent_key)} dùng làm ví dụ mẫu khi viết bài mới.`, "", String(e.text),
    ].join("\n"));
  }
  const hooks: string[] = [];
  for (const t of q.all<Row>("SELECT id, agent_key, title, output, updated_at FROM task WHERE biz_id = ? AND status = 'done' AND agent_key IN ('video_script','content') ORDER BY updated_at DESC LIMIT 80", v.biz_id)) {
    const o = t.output ?? {};
    const hs = [...(o.hooks ?? []), ...((o.variants ?? []) as Row[]).map((x) => x.hook)].filter(Boolean).slice(0, 4);
    const src = q.get<Row>("SELECT path FROM brain_note WHERE vault_id = ? AND json_extract(meta, '$.task_id') = ?", v.id, t.id)?.path;
    for (const h of hs) hooks.push(`- ${String(h).replace(/\n/g, " ")} — ${agentLink(t.agent_key)}${src ? ` · [[${src.replace(/\.md$/, "")}|nguồn]]` : ""}`);
  }
  if (hooks.length) upsertAutoBlock(v, `${F.video}/Kho hook/Kho hook.md`, [`${hooks.length} câu hook từ các bài/kịch bản đã làm (mới nhất trước). Thêm hook hay của Sếp ở trên phần tự động.`, "", ...hooks].join("\n"),
    () => `${stringifyFrontmatter({ type: "hook" })}# Kho hook\n\n## Hook Sếp sưu tầm\n\n`);
}

// ---------------- Quảng cáo: quyết định ----------------
function syncAdsDecisions(v: Row) {
  const days = new Map<string, Row[]>();
  for (const a of q.all<Row>("SELECT a.*, ad.name ad_name FROM action a LEFT JOIN ad ON ad.id = a.target_id WHERE a.biz_id = ? AND a.created_at > ? ORDER BY a.created_at", v.biz_id, new Date(Date.now() - 90 * 86400_000).toISOString())) {
    const d = vnDate(new Date(a.created_at));
    days.set(d, [...(days.get(d) ?? []), a]);
  }
  const label: Record<string, string> = { pause_ad: "Tạm dừng", resume_ad: "Chạy lại", update_budget: "Đổi ngân sách", create_ad: "Tạo quảng cáo" };
  for (const [d, list] of days) {
    upsertAutoBlock(v, `${F.ads}/Quyết định/${d}.md`, [
      `[[${d}]] · ${list.length} quyết định quảng cáo`, "",
      ...list.map((a) => `- **${label[a.type] ?? a.type}** ${a.ad_name ?? a.target_id}${a.params?.amount ? ` → ${vnd(a.params.amount)}` : ""} · ${a.status} · bởi ${a.actor}${a.reason ? `\n  > ${a.reason}` : ""}`),
    ].join("\n"), () => `${stringifyFrontmatter({ type: "ads_decision", date: d })}# Quyết định quảng cáo ${viDate(d)}\n`);
  }
}

// ---------------- Bán hàng & chăm sóc ----------------
function syncSales(v: Row) {
  const hot = q.all<Row>("SELECT l.name, l.grade, l.score, l.product_interest, c.id cid, c.channel, c.state, c.last_message_at, c.last_preview FROM lead l JOIN conversation c ON c.id = l.conversation_id WHERE l.biz_id = ? AND l.grade IN ('hot','warm') ORDER BY l.score DESC LIMIT 40", v.biz_id);
  const waiting = q.all<Row>("SELECT id, customer_name, channel, last_preview, last_message_at FROM conversation WHERE biz_id = ? AND state = 'handoff_pending' ORDER BY last_message_at DESC LIMIT 20", v.biz_id);
  upsertAutoBlock(v, `${F.sales}/Lead nóng.md`, [
    `## Đang chờ người trả lời (${waiting.length})`, waiting.length ? waiting.map((c) => `- **${c.customer_name}** (${c.channel}) — “${String(c.last_preview ?? "").slice(0, 100)}” · [mở](http://localhost:5173/chat?id=${c.id})`).join("\n") : "- Không có",
    "", `## Lead nóng & ấm (${hot.length})`, hot.length ? hot.map((l) => `- **${l.name}** · ${l.grade} ${Math.round(Number(l.score))} điểm · quan tâm: ${l.product_interest ?? "—"} · ${l.channel} · ${l.state}`).join("\n") : "- Chưa có lead nóng",
  ].join("\n"), () => `${stringifyFrontmatter({ type: "lead" })}# Lead nóng\n`);
  const plans = q.all<Row>("SELECT status, COUNT(*) n FROM follow_up_plan WHERE biz_id = ? GROUP BY status", v.biz_id);
  const next = q.all<Row>("SELECT f.next_at, f.step, f.template, c.customer_name, c.channel FROM follow_up_plan f JOIN conversation c ON c.id = f.conversation_id WHERE f.biz_id = ? AND f.status IN ('active','scheduled','pending') AND f.next_at IS NOT NULL ORDER BY f.next_at LIMIT 20", v.biz_id);
  upsertAutoBlock(v, `${F.sales}/Follow-up Zalo.md`, [
    `**Kế hoạch follow-up:** ${plans.map((p) => `${p.status} ${p.n}`).join(" · ") || "chưa có"} · do [[Follow-up Agent]] soạn, gửi qua ZL-CRM (cần Sếp duyệt theo cài đặt).`, "",
    "## Sắp tới", next.length ? next.map((f) => `- ${viDate(vnDate(new Date(f.next_at)))} ${new Date(f.next_at).toLocaleTimeString("vi-VN", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })} · **${f.customer_name}** (${f.channel}) · bước ${f.step} · ${f.template}`).join("\n") : "- Không có",
  ].join("\n"), () => `${stringifyFrontmatter({ type: "sales" })}# Follow-up Zalo\n`);
}

// ---------------- Số liệu & mục tiêu ----------------
function syncMetrics(v: Row) {
  const today = vnDate();
  const sum = (n: number) => {
    const days = Array.from({ length: n }, (_, i) => dayStats(v.biz_id, addDays(today, -i)));
    const t = (f: (x: ReturnType<typeof dayStats>) => number) => days.reduce((a, x) => a + f(x), 0);
    return {
      spend: t((x) => x.spend), results: t((x) => x.results), clicks: t((x) => x.clicks), convs: t((x) => x.convs),
      leads: t((x) => x.leads.reduce((a, l) => a + Number(l.n), 0)), hot: t((x) => x.leads.filter((l) => l.grade === "hot").reduce((a, l) => a + Number(l.n), 0)),
      orders: t((x) => Number(x.orders?.n ?? 0)), revenue: t((x) => Number(x.orders?.s ?? 0)), content: t((x) => x.content.reduce((a, c) => a + Number(c.n), 0)),
      done: t((x) => x.tasks.filter((k) => k.status === "done").reduce((a, k) => a + Number(k.n), 0)),
    };
  };
  const w = sum(7), m = sum(30);
  const row = (l: string, a: string | number, b: string | number) => `| ${l} | ${a} | ${b} |`;
  upsertAutoBlock(v, `${F.metrics}/Chỉ số KPI.md`, [
    "| Chỉ số | 7 ngày | 30 ngày |", "|---|---|---|",
    row("Nội dung agent tạo", w.content, m.content), row("Tác vụ agent hoàn thành", w.done, m.done),
    row("Chi tiêu quảng cáo", vnd(w.spend), vnd(m.spend)), row("Kết quả quảng cáo", w.results, m.results),
    row("CPA", w.results ? vnd(w.spend / w.results) : "—", m.results ? vnd(m.spend / m.results) : "—"),
    row("Hội thoại mới", w.convs, m.convs), row("Lead (nóng)", `${w.leads} (${w.hot})`, `${m.leads} (${m.hot})`),
    row("Đơn hàng", w.orders, m.orders), row("Doanh thu", vnd(w.revenue), vnd(m.revenue)),
    "", `Phễu 30 ngày: **${m.content}** nội dung → **${m.results}** kết quả ads → **${m.convs}** hội thoại → **${m.leads}** lead → **${m.orders}** đơn.`,
    "", `Chi tiết từng ngày: [[${today}]] · tuần [[${isoWeek(today)}]] · tháng [[${today.slice(0, 7)}]]`,
  ].join("\n"), () => `${stringifyFrontmatter({ type: "metrics" })}# Chỉ số KPI\n`);
}
function goalProgress(bizId: string) {
  const d = activeDna(bizId)?.data as any;
  const target = Number(d?.goals?.yearTarget ?? 0);
  const year = vnDate().slice(0, 4);
  const revenue = q.scalar<number>("SELECT COALESCE(SUM(total),0) FROM orders WHERE biz_id = ? AND created_at >= ?", bizId, new Date(`${year}-01-01T00:00:00+07:00`).toISOString()) ?? 0;
  if (!target) return "## Tiến độ mục tiêu năm\n- Chưa đặt mục tiêu doanh thu năm trong DNA (Mục tiêu & DNA).";
  const month = Number(vnDate().slice(5, 7));
  const left = Math.max(0, target - revenue);
  return [
    `## Tiến độ mục tiêu năm ${year}`,
    `- Mục tiêu: **${vnd(target)}** · Đã đạt (đơn ghi nhận trong hệ thống): **${vnd(revenue)}** (${((revenue / target) * 100).toFixed(1)}%)`,
    `- Còn lại: **${vnd(left)}** trong ${13 - month} tháng → cần trung bình **${vnd(left / Math.max(1, 13 - month))}/tháng**`,
    d?.goals?.painPoint ? `- Nỗi đau ưu tiên giải: _${d.goals.painPoint}_` : "",
  ].filter(Boolean).join("\n");
}

// ---------------- Mẫu ghi chú ----------------
const TEMPLATES: [string, string][] = [
  ["Brief chiến dịch", "## Mục tiêu (số đo được)\n\n## Khách hàng mục tiêu\n[[Chân dung khách hàng]]\n\n## Sản phẩm / ưu đãi\n\n## Thông điệp chính\n\n## Kênh & ngân sách\n\n## KPI & hạn\n\n## Rủi ro / claim cần tránh\n"],
  ["Kịch bản video", "## Hook (0-3 giây)\n\n## Vấn đề của khách\n\n## Giải pháp / demo\n\n## Bằng chứng\n\n## Kêu gọi hành động\n\n## Ghi chú quay / Flow\n- Công cụ: \n- Thời lượng: \n- Ảnh tham chiếu: \n"],
  ["Phân tích đối thủ", "## Đối thủ\n\n## Sản phẩm & giá\n\n## Kênh & cách làm nội dung\n\n## Điểm mạnh\n\n## Điểm yếu\n\n## Cơ hội cho chúng ta\n\n## Nguồn tham khảo\n"],
  ["Chân dung khách hàng", "## Họ là ai\n\n## Nỗi đau\n\n## Mong muốn\n\n## Phản đối thường gặp\n\n## Kênh họ dùng\n\n## Câu nói đắt giá của khách\n"],
  ["Thử nghiệm A-B", "## Giả thuyết\n\n## Biến thể A\n\n## Biến thể B\n\n## Chỉ số đo & ngưỡng thắng\n\n## Kết quả\n\n## Bài học rút ra\n→ ghi vào [[Feedback loop — Bài học đang áp dụng]]\n"],
  ["Kịch bản chốt sale", "## Tình huống khách\n\n## Câu mở\n\n## Câu hỏi khai thác\n\n## Xử lý từ chối\n\n## Câu chốt\n\n## Follow-up nếu chưa chốt\n"],
  ["Biên bản họp", "## Thành phần\n\n## Nội dung chính\n\n## Quyết định\n\n## Việc cần làm (ai · hạn)\n- [ ] \n"],
];
function syncTemplates(v: Row) {
  for (const [name, body] of TEMPLATES) {
    const rel = `${F.playbook}/Mẫu ghi chú/Mẫu - ${name}.md`;
    if (!noteExists(v, rel)) writeNoteFile(v, rel, `${stringifyFrontmatter({ type: "template" })}# ${name}\n\n${body}`);
  }
}

// ---------------- Work archive (event hooks) ----------------
export function archiveTask(taskId: string) {
  const t = byId<Row>("task", taskId);
  if (!t || t.status !== "done") return;
  const v = vaultFor(t.biz_id);
  if (!v) return;
  const date = vnDate(new Date(t.updated_at));
  const goal = t.goal_id ? byId<Row>("goal", t.goal_id) : null;
  const ci = q.get<Row>("SELECT * FROM content_item WHERE task_id = ?", t.id);
  const review = ci?.review_score_id ? byId<Row>("review_score", ci.review_score_id) : null;
  const meta = { type: "content", agent: t.agent_key, date, status: ci?.status ?? t.status, channel: ci?.channel ?? undefined };
  const links = `${agentLink(t.agent_key)} · [[${date}]]${goal ? ` · [[${safeName(goal.title)}]]` : ""}`;
  if (["content", "video_script", "seo_web"].includes(t.agent_key)) {
    const folder = t.agent_key === "video_script" ? `${F.video}/Kịch bản` : t.agent_key === "seo_web" ? `${F.content}/SEO` : `${F.content}/Bài viết`;
    upsertById(v, "task_id", t.id, folder, `${date} ${t.title}`, { ...meta, type: t.agent_key === "video_script" ? "video_script" : "content" }, [
      links, review ? `**Điểm review:** ${review.total} (${review.verdict})` : null, `**Kênh:** ${ci?.channel ?? "—"} · **Trạng thái:** ${ci?.status ?? t.status}`, "",
      ci?.body ?? toMd(t.output),
    ].filter((x) => x != null).join("\n"));
  } else if (t.agent_key === "ads") {
    upsertById(v, "task_id", t.id, `${F.ads}/Báo cáo`, `${date} ${t.title}`, { ...meta, type: "report" }, `${links}\n\n${toMd(t.output)}`);
  } else if (goal) {
    upsertById(v, "task_id", t.id, `${F.campaigns}/${safeName(goal.title)}`, `${agentLabel(t.agent_key)} — ${goal.title}`, { ...meta, type: "project" }, `${links}\n\n${toMd(t.output)}`);
  } else {
    upsertById(v, "task_id", t.id, `${F.campaigns}/Việc lẻ`, `${date} ${t.title}`, { ...meta, type: "project" }, `${links}\n\n${toMd(t.output)}`);
  }
  if (goal) syncGoal(v, goal.id);
}
function syncGoal(v: Row, goalId: string) {
  const g = byId<Row>("goal", goalId);
  if (!g) return;
  const tasks = q.all<Row>("SELECT id, agent_key, title, status FROM task WHERE goal_id = ? ORDER BY created_at", g.id);
  const notes = new Map(q.all<Row>("SELECT path, json_extract(meta, '$.task_id') tid FROM brain_note WHERE vault_id = ? AND json_extract(meta, '$.task_id') IS NOT NULL", v.id).map((r) => [r.tid, r.path]));
  upsertById(v, "goal_id", g.id, `${F.campaigns}/${safeName(g.title)}`, g.title, { type: "project", status: g.status }, [
    `**Mục tiêu:** ${g.description}`, `**Loại:** ${g.template} · **Ngân sách ads:** ${vnd(g.budget_ads ?? 0)} · **Hạn:** ${g.due_date ?? "—"} · **Trạng thái:** ${g.status}`, "",
    "## Tác vụ", ...tasks.map((t) => `- [${t.status === "done" ? "x" : " "}] ${notes.get(t.id) ? `[[${notes.get(t.id).replace(/\.md$/, "")}|${t.title}]]` : t.title} — ${agentLink(t.agent_key)} · ${t.status}`),
  ].join("\n"));
}
export function archiveVideo(jobId: string) {
  const j = byId<Row>("creative_job", jobId);
  if (!j || !["done", "approved", "drafted"].includes(j.status)) return; // finished videos, also after approval / draft upload
  const v = vaultFor(j.biz_id);
  if (!v) return;
  const date = vnDate(new Date(j.ended_at ?? j.updated_at));
  const a = j.asset_id ? byId<Row>("creative_asset", j.asset_id) : null;
  const r = (j.result ?? {}) as Row;
  const sub = j.tool === "auto-video" ? "Video tự động" : j.tool === "portrait" ? "Ảnh cử động" : "Video Flow";
  upsertById(v, "creative_job", j.id, `${F.video}/${sub}`, `${date} ${j.title}`, { type: "video", agent: "creative", date, tool: j.tool }, [
    `${agentLink("creative")} · [[${date}]] · công cụ: ${j.tool === "auto-video" ? "Video tự động (MoneyPrinterTurbo)" : j.tool === "portrait" ? "Ảnh cử động (LivePortrait)" : `Google Flow · ${j.tool}`}`,
    a ? `**File:** \`${a.path}\` · ${Number(a.duration ?? 0).toFixed(1)}s · ${a.width}x${a.height}` : "", "",
    r.caption ? `## Caption\n${r.caption}` : "",
    r.script?.length ? `## Lời thoại\n${(r.script as Row[]).map((s) => `${s.canh}. ${s.loi_thoai}`).join("\n")}` : "",
    r.notes ? `## Ghi chú sản xuất\n${r.notes}` : "",
  ].filter(Boolean).join("\n"));
}
export function archiveConversation(threadId: string) {
  const t = byId<Row>("assistant_thread", threadId);
  if (!t) return;
  const v = vaultFor(t.biz_id);
  if (!v) return;
  const msgs = q.all<Row>("SELECT role, text, created_at FROM assistant_message WHERE thread_id = ? ORDER BY created_at", t.id);
  if (!msgs.length) return;
  const date = vnDate(new Date(t.created_at));
  const acts = q.all<Row>("SELECT title, status FROM assistant_action WHERE thread_id = ?", t.id);
  const disp = q.all<Row>("SELECT title, kind FROM assistant_dispatch WHERE thread_id = ?", t.id);
  upsertById(v, "thread_id", t.id, `${F.ideas}/Hội thoại`, `${date} ${t.title}`, { type: "conversation", agent: "assistant", date }, [
    `Trò chuyện với [[Ngân Nguyệt]] · [[${date}]]`,
    disp.length ? `\n**Việc đã giao:** ${disp.map((d) => `${d.title} (${d.kind})`).join("; ")}` : "",
    acts.length ? `**Thẻ xác nhận:** ${acts.map((a) => `${a.title} → ${a.status}`).join("; ")}` : "", "",
    ...msgs.map((m) => `### ${m.role === "user" ? "Sếp" : "Ngân Nguyệt"} · ${vnTime(m.created_at)}\n${m.text}`),
  ].filter((x) => x !== undefined).join("\n"));
}

// ---------------- Logs ----------------
function dayStats(bizId: string, date: string) {
  const from = dayStart(date).toISOString(), to = dayStart(addDays(date, 1)).toISOString();
  const between = "BETWEEN ? AND ?";
  const tasks = q.all<Row>(`SELECT agent_key, status, COUNT(*) n FROM task WHERE biz_id = ? AND updated_at ${between} GROUP BY agent_key, status`, bizId, from, to);
  const content = q.all<Row>(`SELECT status, COUNT(*) n FROM content_item WHERE biz_id = ? AND created_at ${between} GROUP BY status`, bizId, from, to);
  const approvals = q.all<Row>(`SELECT status, COUNT(*) n FROM approval WHERE biz_id = ? AND decided_at ${between} GROUP BY status`, bizId, from, to);
  const pending = q.scalar<number>("SELECT COUNT(*) FROM approval WHERE biz_id = ? AND status = 'pending'", bizId) ?? 0;
  const videos = q.all<Row>(`SELECT title, status FROM creative_job WHERE biz_id = ? AND updated_at ${between}`, bizId, from, to);
  let spend = 0, results = 0, clicks = 0;
  for (const m of q.all<Row>("SELECT metrics FROM metric_snapshot WHERE biz_id = ? AND entity_type = 'ad' AND day = ?", bizId, date)) { spend += Number(m.metrics?.spend ?? 0); results += Number(m.metrics?.results ?? 0); clicks += Number(m.metrics?.clicks ?? 0); }
  const convs = q.scalar<number>(`SELECT COUNT(*) FROM conversation WHERE biz_id = ? AND created_at ${between}`, bizId, from, to) ?? 0;
  const leads = q.all<Row>(`SELECT grade, COUNT(*) n FROM lead WHERE biz_id = ? AND created_at ${between} GROUP BY grade`, bizId, from, to);
  const orders = q.get<Row>(`SELECT COUNT(*) n, COALESCE(SUM(total),0) s FROM orders WHERE biz_id = ? AND created_at ${between}`, bizId, from, to);
  const threads = q.all<Row>(`SELECT id, title FROM assistant_thread WHERE biz_id = ? AND last_message_at ${between}`, bizId, from, to);
  const dispatches = q.all<Row>(`SELECT title, kind FROM assistant_dispatch WHERE biz_id = ? AND created_at ${between}`, bizId, from, to);
  return { tasks, content, approvals, pending, videos, spend, results, clicks, convs, leads, orders, threads, dispatches };
}
function statsMd(s: ReturnType<typeof dayStats>) {
  const byAgent = new Map<string, Row>();
  for (const t of s.tasks) { const a = byAgent.get(t.agent_key) ?? {}; a[t.status] = t.n; byAgent.set(t.agent_key, a); }
  const sum = (rows: Row[], st?: string) => rows.filter((r) => !st || r.status === st).reduce((a, r) => a + Number(r.n), 0);
  return [
    "## Các agent đã làm",
    byAgent.size ? [...byAgent.entries()].map(([k, a]) => `- ${agentLink(k)}: ${Object.entries(a).map(([st, n]) => `${st} ${n}`).join(", ")}`).join("\n") : "- Không có tác vụ nào.",
    "", "## Nội dung & duyệt",
    `- Nội dung mới: **${sum(s.content)}** · Đã quyết duyệt: **${sum(s.approvals)}** (duyệt ${sum(s.approvals, "approved")}, từ chối ${sum(s.approvals, "rejected")}) · Đang chờ duyệt: **${s.pending}**`,
    s.videos.length ? `- Video Flow: ${s.videos.map((x) => `${x.title} (${x.status})`).join("; ")}` : null,
    "", "## Quảng cáo & khách hàng",
    `- Chi tiêu ads: **${vnd(s.spend)}** · Kết quả: **${s.results}** · Click: ${s.clicks}${s.results ? ` · CPA ${vnd(s.spend / s.results)}` : ""}`,
    `- Hội thoại mới: **${s.convs}** · Lead: ${s.leads.map((l) => `${l.grade} ${l.n}`).join(", ") || "0"} · Đơn: **${s.orders?.n ?? 0}** (${vnd(s.orders?.s ?? 0)})`,
    "", "## Ngân Nguyệt",
    s.dispatches.length ? s.dispatches.map((d) => `- Đã giao: ${d.title} (${d.kind})`).join("\n") : "- Chưa giao việc nào.",
    s.threads.length ? `- Hội thoại: ${s.threads.map((t) => t.title).join("; ")}` : null,
  ].filter((x) => x != null).join("\n");
}
export function writeDaily(bizId: string, date = vnDate()) {
  const v = vaultFor(bizId);
  if (!v) return null;
  const rel = `${F.daily}/${date}.md`;
  const created = q.all<Row>("SELECT path, title FROM brain_note WHERE vault_id = ? AND json_extract(meta, '$.date') = ? AND path != ?", v.id, date, rel);
  const due = q.all<Row>("SELECT path, title FROM brain_note WHERE vault_id = ? AND json_extract(meta, '$.type') = 'reminder' AND substr(json_extract(meta, '$.due'), 1, 10) = ?", v.id, date);
  const block = [
    `← [[${addDays(date, -1)}]] · [[${isoWeek(date)}]] · [[${addDays(date, 1)}]] →`, "",
    statsMd(dayStats(bizId, date)),
    due.length ? `\n## Nhắc việc hôm nay\n${due.map((r) => `- [[${r.path.replace(/\.md$/, "")}|${r.title}]]`).join("\n")}` : "",
    created.length ? `\n## Ghi chú sinh ra trong ngày\n${created.map((r) => `- [[${r.path.replace(/\.md$/, "")}|${r.title}]]`).join("\n")}` : "",
    `\n_Cập nhật tự động lúc ${vnTime(nowIso())}_`,
  ].join("\n");
  return upsertAutoBlock(v, rel, block, () => `${stringifyFrontmatter({ type: "daily", date })}# Nhật ký ${viDate(date)}\n\n## Ghi chú của Sếp\n\n`);
}

const Summary = z.object({ summary: z.string(), highlights: z.array(z.string()), next: z.array(z.string()) });
async function aiSummary(bizId: string, what: string, facts: string) {
  if (effectiveProvider(bizId).provider === "sandbox") return null;
  try {
    const r = await generate({
      bizId, agentKey: "assistant", tier: "small", schema: Summary,
      system: "Bạn là Ngân Nguyệt, trợ lý điều phối. Tóm tắt ngắn gọn, đúng số liệu được cho, tiếng Việt, không bịa.",
      user: `Tóm tắt ${what} cho CEO từ dữ liệu sau (Markdown). Trả JSON: summary (2-4 câu), highlights (3-5 ý), next (2-4 việc nên làm tiếp).\n\n${facts}`,
      sandbox: () => ({ summary: "", highlights: [], next: [] }),
    });
    return r.output;
  } catch (e) { logger.warn("brain.summary_failed", { error: String(e).slice(0, 200) }); return null; }
}
export async function writeWeekly(bizId: string, anyDayOfWeek: string) {
  const v = vaultFor(bizId);
  if (!v) return null;
  const mon = weekStart(anyDayOfWeek);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const week = isoWeek(mon);
  const facts = days.map((d) => `### ${viDate(d)}\n${statsMd(dayStats(bizId, d))}`).join("\n\n");
  const ai = await aiSummary(bizId, `tuần ${week}`, facts);
  const block = [
    `Tuần ${week}: ${viDate(days[0])} → ${viDate(days[6])} · [[${mon.slice(0, 7)}]]`, "",
    ai ? `## Tóm tắt (Ngân Nguyệt)\n${ai.summary}\n\n**Điểm nổi bật**\n${ai.highlights.map((h) => `- ${h}`).join("\n")}\n\n**Nên làm tiếp**\n${ai.next.map((h) => `- [ ] ${h}`).join("\n")}\n` : "",
    "## Các ngày", ...days.map((d) => `- [[${d}]]`), "", "## Số liệu từng ngày", facts,
  ].join("\n");
  return upsertAutoBlock(v, `${F.weekly}/${week}.md`, block, () => `${stringifyFrontmatter({ type: "weekly", week, date: mon })}# Tổng kết tuần ${week}\n\n## Nhận xét của Sếp\n\n`);
}
export async function writeMonthly(bizId: string, month: string) {
  const v = vaultFor(bizId);
  if (!v) return null;
  const first = `${month}-01`;
  const days: string[] = [];
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) days.push(d);
  const weeks = [...new Set(days.map(isoWeek))];
  const s = days.map((d) => dayStats(bizId, d));
  const total = (f: (x: ReturnType<typeof dayStats>) => number) => s.reduce((a, x) => a + f(x), 0);
  const facts = [
    `- Tác vụ agent xong: ${total((x) => x.tasks.filter((t) => t.status === "done").reduce((a, t) => a + Number(t.n), 0))}`,
    `- Nội dung mới: ${total((x) => x.content.reduce((a, t) => a + Number(t.n), 0))}`,
    `- Chi tiêu ads: ${vnd(total((x) => x.spend))} · Kết quả: ${total((x) => x.results)}`,
    `- Hội thoại mới: ${total((x) => x.convs)} · Đơn: ${total((x) => Number(x.orders?.n ?? 0))} (${vnd(total((x) => Number(x.orders?.s ?? 0)))})`,
    `- Video Flow: ${total((x) => x.videos.length)}`,
  ].join("\n");
  const ai = await aiSummary(bizId, `tháng ${month}`, facts);
  const block = [
    `Tháng ${month.split("-").reverse().join("/")}`, "",
    ai ? `## Tóm tắt (Ngân Nguyệt)\n${ai.summary}\n\n**Điểm nổi bật**\n${ai.highlights.map((h) => `- ${h}`).join("\n")}\n\n**Nên làm tiếp**\n${ai.next.map((h) => `- [ ] ${h}`).join("\n")}\n` : "",
    "## Tổng số", facts, "", "## Các tuần", ...weeks.map((w) => `- [[${w}]]`),
  ].join("\n");
  return upsertAutoBlock(v, `${F.monthly}/${month}.md`, block, () => `${stringifyFrontmatter({ type: "monthly", month, date: first })}# Tổng kết tháng ${month}\n\n## Nhận xét của Sếp\n\n`);
}

function updateDashboard(v: Row) {
  const b = v.biz_id;
  const today = vnDate();
  const pending = q.all<Row>("SELECT title, created_at FROM approval WHERE biz_id = ? AND status = 'pending' ORDER BY created_at LIMIT 8", b);
  const running = q.all<Row>("SELECT title, agent_key, step FROM task WHERE biz_id = ? AND status IN ('ready','running','in_review','revising') ORDER BY updated_at DESC LIMIT 8", b);
  const bad = q.all<Row>("SELECT title, agent_key, status FROM task WHERE biz_id = ? AND status IN ('failed','blocked') AND updated_at > datetime('now','-3 day') LIMIT 6", b);
  const reminders = upcomingReminders(v, 6);
  const notes = q.scalar<number>("SELECT COUNT(*) FROM brain_note WHERE vault_id = ?", v.id) ?? 0;
  upsertAutoBlock(v, DASHBOARD_NOTE, [
    `**Hôm nay:** [[${today}]] · **Tuần này:** [[${isoWeek(today)}]] · **Tháng:** [[${today.slice(0, 7)}]] · [[Chỉ số KPI]] · [[Lead nóng]] · [[Lỗi hay gặp]] · [[Feedback loop — Bài học đang áp dụng|Feedback loop]] · ${notes} ghi chú`, "",
    goalProgress(v.biz_id), "",
    `## Chờ Sếp duyệt (${pending.length})`, pending.length ? pending.map((p) => `- ${p.title}`).join("\n") : "- Không có", "",
    `## Agent đang làm (${running.length})`, running.length ? running.map((t) => `- ${agentLink(t.agent_key)}: ${t.title}${t.step ? ` — _${t.step}_` : ""}`).join("\n") : "- Không có", "",
    bad.length ? `## Cần xử lý\n${bad.map((t) => `- ${agentLink(t.agent_key)}: ${t.title} (${t.status})`).join("\n")}\n` : "",
    "## Nhắc việc sắp tới", reminders.length ? reminders.map((r) => `- ${viDate(String(r.due).slice(0, 10))} ${String(r.due).slice(11, 16)} · [[${r.path.replace(/\.md$/, "")}|${r.title}]]`).join("\n") : "- Không có", "",
    "## Đội AI", CATALOG.map((c) => agentLink(c.key)).join(" · "), "",
    `_Cập nhật lúc ${vnTime(nowIso())}_`,
  ].join("\n"), () => `${stringifyFrontmatter({ type: "dashboard" })}# Bảng điều hành\n`);
}

// ---------------- Reminders ("Kế hoạch & nhắc việc") ----------------
export function createReminder(bizId: string, p: { title: string; due: string; note?: string; by?: string }) {
  const v = activeVault(bizId);
  // "YYYY-MM-DD HH:mm" without a zone = Vietnam time (the CEO's clock), whatever the server's zone is.
  const raw = p.due.trim();
  const due = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw.replace(" ", "T")}${raw.length <= 16 ? ":00" : ""}+07:00`);
  if (Number.isNaN(due.getTime())) throw new Error("Thời gian nhắc không hợp lệ");
  const local = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(due).replace(" ", "T");
  const rel = freePath(v, F.reminders, `${local.slice(0, 10)} ${p.title}`);
  writeNoteFile(v, rel, `${stringifyFrontmatter({ type: "reminder", due: `${local}:00+07:00`, done: false, notified: false, by: p.by ?? "Sếp", date: local.slice(0, 10) })}# ${p.title}\n\n${p.note ?? ""}\n\nNhắc lúc ${local.slice(11, 16)} ngày ${viDate(local.slice(0, 10))} · [[${local.slice(0, 10)}]]\n`);
  emit(bizId, "assistant.updated", { reminder: rel });
  return { path: rel, due: `${local}:00+07:00`, title: p.title };
}
export function upcomingReminders(v: Row, limit = 50, includeDone = false) {
  return q.all<Row>(`SELECT path, title, json_extract(meta, '$.due') due, json_extract(meta, '$.done') done, json_extract(meta, '$.notified') notified FROM brain_note
    WHERE vault_id = ? AND json_extract(meta, '$.type') = 'reminder' ${includeDone ? "" : "AND COALESCE(json_extract(meta, '$.done'), 0) = 0"} ORDER BY json_extract(meta, '$.due') LIMIT ?`, v.id, limit);
}
export function setNoteMeta(v: Row, rel: string, patch: Row) {
  const text = readNoteFile(v, rel);
  const { meta, body } = parseFrontmatter(text);
  writeNoteFile(v, rel, `${stringifyFrontmatter({ ...meta, ...patch })}${body}`);
}
function fireReminders(v: Row) {
  const now = Date.now();
  for (const r of upcomingReminders(v, 200)) {
    if (r.notified || !r.due || new Date(r.due).getTime() > now) continue;
    notifyDesktop(`Nhắc việc: ${r.title}`, `Ngân Nguyệt nhắc Sếp — ${String(r.due).slice(11, 16)}`);
    emit(v.biz_id, "alert.raised", { level: "info", text: `⏰ Nhắc việc: ${r.title}` });
    try { setNoteMeta(v, r.path, { notified: true }); } catch (e) { logger.warn("brain.reminder_mark_failed", { error: String(e) }); }
  }
}

// ---------------- Tick + hooks ----------------
let lastSlow = 0;
const running = new Set<string>();
/** Every few minutes: today's log, dashboard, reminders; hourly: agents/skills/knowledge/DNA/lessons; week/month rollups. */
export async function brainTick(bizId: string, opts: { full?: boolean } = {}) {
  if (running.has(bizId)) return;
  running.add(bizId);
  try {
    if (!q.get("SELECT id FROM brain_vault WHERE biz_id = ?", bizId)) { ensureDefaultVault(bizId); opts = { ...opts, full: true }; }
    const v = vaultFor(bizId);
    if (!v) return;
    scanVault(v.id);
    fireReminders(v);
    for (const f of [syncFeedback, syncSales, syncMetrics]) { try { f(v); } catch (e) { logger.warn("brain.sync_failed", { step: f.name, error: String(e) }); } }
    if (opts.full || Date.now() - lastSlow > 3600_000) {
      lastSlow = Date.now();
      for (const f of [syncDna, syncMarket, syncKnowledgeDocs, syncSkills, syncLessons, syncTemplates, syncWinners, syncReview, syncFeedbackLoop, syncAdsDecisions, syncAgents]) { try { f(v); } catch (e) { logger.warn("brain.sync_failed", { step: f.name, error: String(e) }); } }
      if (opts.full) {
        for (const t of q.all<Row>("SELECT id FROM task WHERE biz_id = ? AND status = 'done' ORDER BY updated_at DESC LIMIT 60", bizId)) archiveTask(t.id);
        for (const j of q.all<Row>("SELECT id FROM creative_job WHERE biz_id = ? AND status IN ('done','approved','drafted')", bizId)) archiveVideo(j.id);
        for (const t of q.all<Row>("SELECT id FROM assistant_thread WHERE biz_id = ?", bizId)) archiveConversation(t.id);
      }
    }
    const today = vnDate();
    writeDaily(bizId, today);
    if (!noteExists(v, `${F.daily}/${addDays(today, -1)}.md`) || opts.full) writeDaily(bizId, addDays(today, -1));
    const lastWeekDay = addDays(weekStart(today), -1);
    if (!noteExists(v, `${F.weekly}/${isoWeek(lastWeekDay)}.md`)) await writeWeekly(bizId, lastWeekDay);
    const prevMonth = addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
    if (!noteExists(v, `${F.monthly}/${prevMonth}.md`)) await writeMonthly(bizId, prevMonth);
    updateDashboard(v);
  } finally {
    running.delete(bizId);
  }
}

/** Finished work lands in the brain the moment it is done. */
export function registerBrainHooks() {
  const safe = (f: () => void) => setTimeout(() => { try { f(); } catch (e) { logger.warn("brain.hook_failed", { error: String(e).slice(0, 300) }); } }, 500);
  bus.on("task.updated", (p: Row) => { if (p.status === "done" && p.taskId) safe(() => archiveTask(p.taskId)); });
  bus.on("creative.updated", (p: Row) => { if (p.status === "done" && p.jobId) safe(() => archiveVideo(p.jobId)); });
  bus.on("assistant.updated", (p: Row) => { if (p.status === "done" && p.threadId) safe(() => archiveConversation(p.threadId)); });
}
