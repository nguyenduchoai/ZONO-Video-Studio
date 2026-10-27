import { describe, expect, it } from "vitest";
import { RuleDefinition } from "@dotaka/contracts";
import { evaluateRule, metricValue, type RuleEntity } from "./index.ts";

const m = (spend: number, results: number, impressions = 10_000, clicks = 100) => ({ spend, results, impressions, clicks });

const pauseLosers = RuleDefinition.parse({
  scope: { platform: "meta", level: "ad" },
  trigger: { type: "schedule", every: "15m" },
  conditions: { all: [{ metric: "spend", window: "today", op: ">", value: 1_500_000 }, { metric: "results", window: "today", op: "==", value: 0 }] },
  minData: { spend: 1_000_000, impressions: 1000 },
  actions: [{ type: "pause_ad" }, { type: "notify", channel: "telegram" }],
  limits: {},
  budgetGuard: {},
});

const scaleWinners = RuleDefinition.parse({
  scope: { platform: "any", level: "ad" },
  trigger: { type: "schedule", every: "1d" },
  conditions: { all: [{ metric: "cpa", window: "today", op: "<", ref: "target_cpa", consecutiveDays: 3 }] },
  minData: { spend: 500_000 },
  actions: [{ type: "budget_change", pct: 35 }],
  limits: { cooldownHours: 24, maxActionsPerRun: 2, maxActionsPerDay: 3 },
  budgetGuard: { maxStepPct: 20, maxDailyBudgetPerEntity: 10_000_000, maxTotalDailyBudget: 30_000_000 },
});

const ent = (over: Partial<RuleEntity>): RuleEntity => ({
  id: "a1", name: "2026_ad", platform: "meta", level: "ad", status: "active", dailyBudget: 5_000_000,
  metrics: { today: m(2_000_000, 0) }, ...over,
});
const ctx = { now: new Date("2026-09-30T10:00:00Z"), actionsToday: 0, totalDailyBudget: 10_000_000 };

describe("metricValue", () => {
  it("returns null (not 0) for CPA when there are no results", () => {
    expect(metricValue(m(100, 0), "cpa")).toBeNull();
    expect(metricValue(m(100, 4), "cpa")).toBe(25);
  });
});

describe("evaluateRule", () => {
  it("pauses a losing ad and notifies", () => {
    const r = evaluateRule(pauseLosers, [ent({})], ctx);
    expect(r.matched).toBe(1);
    expect(r.actions.map((a) => a.type)).toEqual(["pause_ad", "notify"]);
    expect(r.actions[0].before).toEqual({ status: "active" });
  });

  it("skips entities below minData instead of concluding", () => {
    const r = evaluateRule(pauseLosers, [ent({ metrics: { today: m(900_000, 0) } })], ctx);
    expect(r.matched).toBe(0);
    expect(r.skipped[0].reason).toMatch(/chưa đủ dữ liệu/);
  });

  it("respects cooldown", () => {
    const r = evaluateRule(pauseLosers, [ent({ cooldownUntil: "2026-09-30T20:00:00Z" })], ctx);
    expect(r.actions).toHaveLength(0);
    expect(r.skipped[0].reason).toMatch(/cooldown/);
  });

  it("does not pause an already paused ad", () => {
    const r = evaluateRule(pauseLosers, [ent({ status: "paused" })], ctx);
    expect(r.actions.map((a) => a.type)).toEqual(["notify"]);
  });

  it("clamps budget step to maxStepPct and requires consecutive days", () => {
    const good = [m(1_000_000, 10), m(1_000_000, 12), m(1_000_000, 11)];
    const r = evaluateRule(scaleWinners, [ent({ platform: "tiktok", metrics: { today: good[2] }, dailyHistory: good, refs: { target_cpa: 150_000 } })], ctx);
    expect(r.actions[0].type).toBe("update_budget");
    expect(r.actions[0].after.daily_budget).toBe(6_000_000); // +20%, not +35%
    expect(r.actions[0].reason).toMatch(/cắt bước nhảy/);

    const short = evaluateRule(scaleWinners, [ent({ dailyHistory: good.slice(1), refs: { target_cpa: 150_000 }, metrics: { today: good[2] } })], ctx);
    expect(short.actions).toHaveLength(0);
  });

  it("skips (does not guess) when a reference like target_cpa is missing", () => {
    const good = [m(1_000_000, 10), m(1_000_000, 12), m(1_000_000, 11)];
    const r = evaluateRule(scaleWinners, [ent({ dailyHistory: good, metrics: { today: good[2] } })], ctx);
    expect(r.actions).toHaveLength(0);
    expect(r.skipped[0].reason).toMatch(/target_cpa/);
  });

  it("property: never exceeds total daily budget or action caps on random data", () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let trial = 0; trial < 300; trial++) {
      const entities: RuleEntity[] = Array.from({ length: 1 + Math.floor(rnd() * 12) }, (_, i) => {
        const hist = Array.from({ length: 3 }, () => m(Math.round(rnd() * 3_000_000), Math.floor(rnd() * 30)));
        return ent({ id: `e${i}`, dailyBudget: 1_000_000 + Math.round(rnd() * 9_000_000), metrics: { today: hist[2] }, dailyHistory: hist, refs: { target_cpa: 200_000 } });
      });
      const total = entities.reduce((a, e) => a + (e.dailyBudget ?? 0), 0);
      const r = evaluateRule(scaleWinners, entities, { ...ctx, totalDailyBudget: total, actionsToday: Math.floor(rnd() * 3) });
      const applied = r.actions.filter((a) => !a.blocked && a.type === "update_budget");
      const after = total + applied.reduce((s, a) => s + (Number(a.after.daily_budget) - Number(a.before.daily_budget)), 0);
      expect(after).toBeLessThanOrEqual(Math.max(total, scaleWinners.budgetGuard.maxTotalDailyBudget));
      expect(applied.length).toBeLessThanOrEqual(scaleWinners.limits.maxActionsPerRun);
      for (const a of applied) {
        const pct = (Number(a.after.daily_budget) / Number(a.before.daily_budget) - 1) * 100;
        expect(pct).toBeLessThanOrEqual(scaleWinners.budgetGuard.maxStepPct + 0.1);
        expect(Number(a.after.daily_budget)).toBeLessThanOrEqual(scaleWinners.budgetGuard.maxDailyBudgetPerEntity);
      }
    }
  });
});
