// Chat routing eval (spec §12): Jev judgments + code policy vs. expected outcomes. No actions, no sends.
import { readFileSync } from "node:fs";
import { activeDna, insert } from "@dotaka/db";
import { chatTurnHeuristic, chatTurnQuestions, decideChat, jevEnabled, judge } from "@dotaka/jev";

export async function runChatEval(bizId: string, log: (line: string) => void = () => {}) {
  const dna = activeDna(bizId)!.data;
  const products = dna.products as any[];
  const keys = products.map((p) => p.key);
  const cases = JSON.parse(readFileSync(new URL("./chat/cases.json", import.meta.url), "utf8")) as any[];
  let passed = 0;
  const rows: any[] = [];
  for (const c of cases) {
    const state = {
      business: { name: dna.company.name, offering: "Business training programs for CEOs, startup founders and SME owners in Vietnam", products: products.map((p) => ({ key: p.key, name: p.name, aliases: p.aliases, summary: p.summary })), published_offers: dna.offers },
      conversation: [{ from: "customer", text: c.text }],
      latest_customer_message: c.text,
    };
    const j = await judge({ bizId, purpose: "eval.chat", state, questions: chatTurnQuestions(keys), heuristic: chatTurnHeuristic(keys) });
    const d = decideChat(j.answers, { phoneShared: /(0|\+84)\d{9,10}/.test(c.text.replace(/[\s.]/g, "")) }) as any;
    const fails = Object.entries(c.expect).filter(([k, v]) => d[k] !== v).map(([k, v]) => `${k}: muốn ${v}, được ${d[k]}`);
    if (!fails.length) passed++;
    rows.push({ id: c.id, text: c.text, tags: c.tags, ok: !fails.length, fails });
    log(`${fails.length ? "✗" : "✓"} ${c.id.padEnd(16)} [${c.tags.join(",")}] ${fails.join("; ")}`);
  }
  const source = jevEnabled() ? "jev" : "heuristic";
  const score = passed / cases.length;
  const run = insert("eval_run", { biz_id: bizId, agent_key: "chat", cases: cases.length, passed, avg_score: score * 100, report: { source, rows } });
  return { id: run.id, cases: cases.length, passed, score, source, rows, threshold: 0.8, ok: score >= 0.8 };
}
