import { TypeSafeClient, type Questions, type SystemOneResult } from "@typesafe-ai/sdk";
import { insert, update } from "@dotaka/db";
import { logger } from "@dotaka/shared";

export * from "./questions.ts";
export * from "./heuristics.ts";

/**
 * Jev (TypeSafe System One) = the fast judgment layer of the Agentic AI system.
 * Code owns the workflow; Jev returns typed, calibrated answers (Noul/Choice/Score)
 * that code turns into decisions with explicit thresholds.
 * When TYPESAFE_API_KEY is absent we fall back to transparent keyword heuristics that
 * return the same answer shapes, flagged source="heuristic" everywhere in the UI.
 */
export const JEV_MODEL = process.env.JEV_MODEL ?? "jev-latest";
const PRICE_PER_MTOK_USD = 0.042; // input only; output free (docs.typesafe.ai/models)

let client: TypeSafeClient | null = null;
export function jevEnabled(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}
function getClient(): TypeSafeClient {
  if (!client) client = new TypeSafeClient({ defaultModel: JEV_MODEL, timeout: 20_000, retry: { maxRetries: 2 } });
  return client;
}

export type Answers<Q extends Questions> = SystemOneResult<Q>["answers"];

export interface Judgment<Q extends Questions> {
  id: string;
  answers: Answers<Q>;
  source: "jev" | "heuristic";
  model: string;
  latencyMs: number;
  error?: string;
}

export interface JudgeOptions<Q extends Questions> {
  bizId: string;
  purpose: string; // e.g. "chat.turn", "review.content"
  subject?: { type: string; id: string };
  state: Record<string, unknown> | string;
  questions: Q;
  heuristic: (state: any) => Answers<Q>;
}

export async function judge<Q extends Questions>(opts: JudgeOptions<Q>): Promise<Judgment<Q>> {
  const started = Date.now();
  let answers: Answers<Q>;
  let source: "jev" | "heuristic" = "heuristic";
  let model = "heuristic-v1";
  let tokensIn = 0;
  let error: string | undefined;

  if (jevEnabled()) {
    try {
      const res = await getClient().systemOne({ state: opts.state as any, questions: opts.questions, model: JEV_MODEL });
      answers = res.answers as Answers<Q>;
      source = "jev";
      model = res.model;
      tokensIn = res.usage?.input_tokens ?? 0;
    } catch (e) {
      // Service failure is not a model judgment: fall back, and record it separately.
      error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      logger.warn("jev.fallback", { purpose: opts.purpose, error });
      answers = opts.heuristic(opts.state);
    }
  } else {
    answers = opts.heuristic(opts.state);
  }

  const latencyMs = Date.now() - started;
  const row = insert("jev_judgment", {
    biz_id: opts.bizId,
    purpose: opts.purpose,
    subject_type: opts.subject?.type ?? null,
    subject_id: opts.subject?.id ?? null,
    source,
    model,
    state: typeof opts.state === "string" ? { text: opts.state } : opts.state,
    questions: opts.questions,
    answers,
    tokens_in: tokensIn,
    latency_ms: latencyMs,
    cost_micros: Math.round(tokensIn * PRICE_PER_MTOK_USD * 1000) / 1000, // USD micros
    error: error ?? null,
  });
  return { id: row.id, answers, source, model, latencyMs, error };
}

/** Attach the code-side decision to a judgment row, so the log shows answer -> action. */
export function recordDecision(judgmentId: string, decision: Record<string, unknown>) {
  update("jev_judgment", judgmentId, { decision });
}

/** Normalized 0..1 position of a Score answer across its levels. */
export function norm(ans: { score: number; probabilities: Record<string, number> }): number {
  const n = Object.keys(ans.probabilities).length;
  return n > 1 ? ans.score / (n - 1) : 0;
}
