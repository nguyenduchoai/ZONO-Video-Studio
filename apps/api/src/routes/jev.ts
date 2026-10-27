import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { activeDna, byId, q, type Row } from "@dotaka/db";
import {
  JEV_MODEL, chatTurnHeuristic, chatTurnQuestions, commentHeuristic, commentQuestions, decideChat, decideGuard, guardHeuristic,
  guardQuestions, jevEnabled, judge, reviewContentHeuristic, reviewContentQuestions,
} from "@dotaka/jev";
import { AppError } from "@dotaka/shared";
import { routes } from "../http.ts";
import { runChatEval } from "../../../../evals/chat-eval.ts";

const PURPOSES: Record<string, string> = {
  "chat.turn": "Định tuyến tin nhắn (9 câu hỏi/lượt)",
  "chat.guard": "Guardrail câu trả lời bot",
  "rag.select": "Chọn đoạn tri thức cho RAG",
  "review.content": "Review Agent chấm nội dung",
  "comments.classify": "Phân loại bình luận",
  "post.fit": "Độ khớp bài – mục tiêu",
  "feedback.rejection": "Phân loại lý do CEO từ chối",
};

export function jevRoutes(app: FastifyInstance) {
  const r = routes(app);

  r.get("/v1/jev/stats", ({ bizId }) => ({
    enabled: jevEnabled(), model: JEV_MODEL, purposes: PURPOSES,
    byPurpose: q.all("SELECT purpose, source, COUNT(*) n, AVG(latency_ms) latency, SUM(tokens_in) tokens, SUM(cost_micros) cost_micros, SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) errors FROM jev_judgment WHERE biz_id = ? GROUP BY 1,2 ORDER BY n DESC", bizId),
    total: q.scalar("SELECT COUNT(*) FROM jev_judgment WHERE biz_id = ?", bizId),
    outcomes: {
      handoffs: q.scalar("SELECT COUNT(*) FROM jev_judgment WHERE biz_id = ? AND purpose = 'chat.turn' AND json_extract(decision,'$.handoff') = 1", bizId),
      injections: q.scalar("SELECT COUNT(*) FROM jev_judgment WHERE biz_id = ? AND purpose = 'chat.turn' AND json_extract(decision,'$.injection') = 1", bizId),
      hotLeads: q.scalar("SELECT COUNT(*) FROM jev_judgment WHERE biz_id = ? AND purpose = 'chat.turn' AND json_extract(decision,'$.leadGrade') = 'hot'", bizId),
      guardBlocked: q.scalar("SELECT COUNT(*) FROM jev_judgment WHERE biz_id = ? AND purpose = 'chat.guard' AND json_extract(decision,'$.pass') = 0", bizId),
      reviewBlocked: q.scalar("SELECT COUNT(*) FROM jev_judgment WHERE biz_id = ? AND purpose = 'review.content' AND json_extract(decision,'$.verdict') = 'block'", bizId),
    },
  }));
  r.get("/v1/jev/judgments", ({ bizId, query }) => q.all(
    `SELECT id, purpose, subject_type, subject_id, source, model, answers, decision, tokens_in, latency_ms, cost_micros, error, created_at FROM jev_judgment WHERE biz_id = ? ${query.purpose ? "AND purpose = ?" : ""} ORDER BY created_at DESC LIMIT 80`,
    ...(query.purpose ? [bizId, query.purpose] : [bizId]),
  ));
  r.get("/v1/jev/judgments/:id", ({ bizId, params }) => {
    const j = byId<Row>("jev_judgment", params.id);
    if (!j || j.biz_id !== bizId) throw new AppError("NOT_FOUND", "Không thấy phán đoán", 404);
    return j;
  });

  r.post("/v1/evals/chat", ({ bizId }) => runChatEval(bizId));
  r.get("/v1/evals", ({ bizId }) => q.all("SELECT id, agent_key, cases, passed, avg_score, json_extract(report,'$.source') source, created_at FROM eval_run WHERE biz_id = ? ORDER BY created_at DESC LIMIT 20", bizId));

  /** Console: run a production question battery on any text, see answers + the code-side decision. */
  r.post("/v1/jev/try", async ({ bizId, body }) => {
    const p = z.object({ preset: z.enum(["chat.turn", "chat.guard", "review.content", "comments.classify"]), text: z.string().min(2).max(4000), context: z.string().optional() }).parse(body);
    const dna = activeDna(bizId)?.data ?? {};
    const products = (dna.products ?? []) as Row[];
    if (p.preset === "chat.turn") {
      const keys = products.map((x) => x.key);
      const state = {
        business: { name: dna.company?.name, offering: "Business training programs for CEOs, startup founders and SME owners in Vietnam", products: products.map((x) => ({ key: x.key, name: x.name, aliases: x.aliases, summary: x.summary })), published_offers: dna.offers ?? [] },
        conversation: [...(p.context ? [{ from: "customer", text: p.context }] : []), { from: "customer", text: p.text }],
        latest_customer_message: p.text,
      };
      const j = await judge({ bizId, purpose: "chat.turn", subject: { type: "console", id: "try" }, state, questions: chatTurnQuestions(keys), heuristic: chatTurnHeuristic(keys) });
      return { judgment: j, decision: decideChat(j.answers, { phoneShared: /(0|\+84)\d{9,10}/.test(p.text.replace(/[\s.]/g, "")) }) };
    }
    if (p.preset === "chat.guard") {
      const j = await judge({ bizId, purpose: "chat.guard", subject: { type: "console", id: "try" }, state: { customer_message: p.context ?? "Học phí bao nhiêu ạ?", draft_reply: p.text, approved_facts: q.all<Row>("SELECT text FROM knowledge_chunk WHERE biz_id = ? LIMIT 12", bizId).map((c) => c.text) }, questions: guardQuestions, heuristic: guardHeuristic });
      return { judgment: j, decision: decideGuard(j.answers, []) };
    }
    if (p.preset === "review.content") {
      const [hook, ...rest] = p.text.split("\n");
      const j = await judge({ bizId, purpose: "review.content", subject: { type: "console", id: "try" }, state: { brand: { name: dna.company?.name, voice: (dna.voice?.style ?? []).join(", "), audience: (dna.audience ?? []).map((a: Row) => a.name).join(" | ") }, channel: "facebook", content: { title: hook, hook, body: rest.join("\n"), cta: rest.at(-1) ?? "" }, facts: [] }, questions: reviewContentQuestions, heuristic: reviewContentHeuristic });
      return { judgment: j };
    }
    const comments = p.text.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const j = await judge({ bizId, purpose: "comments.classify", subject: { type: "console", id: "try" }, state: { post: { title: p.context ?? "Bài viết ZONO Academy" }, comments: comments.map((text) => ({ text })) }, questions: commentQuestions(comments.length), heuristic: commentHeuristic });
    return { judgment: j, comments };
  });
}
