import { describe, expect, it } from "vitest";
import { RuleDefinition } from "@dotaka/contracts";
import { assessCpa, measureAttributionLag, settledCutoff, suggestAttributionDays, type DayRow } from "./attribution.ts";
import { evaluateRule, type RuleEntity } from "./index.ts";

const TODAY = "2026-10-20";
const opts = { attributionDays: 7, minConversions: 10, minClicks: 100, today: TODAY };
const day = (n: number) => settledCutoff(TODAY, n); // n days before today
const rows = (spec: [number, number, number, number][]): DayRow[] => spec.map(([ago, spend, results, clicks]) => ({ day: day(ago), spend, results, clicks }));

describe("assessCpa (ads-os: không tắt oan)", () => {
  it("holds when settled data is too thin", () => {
    const a = assessCpa(rows([[1, 900_000, 1, 300], [2, 900_000, 1, 300]]), 200_000, opts);
    expect(a.verdict).toBe("holding");
    expect(a.blockedBy).toBe("attribution_window");
  });
  it("saves a campaign whose raw CPA is over target only because recent conversions have not arrived", () => {
    // settled days (≥7 days ago): 2.4M / 20 = 120k ✓; recent days: lots of spend, conversions still missing
    const a = assessCpa(rows([[10, 1_200_000, 10, 200], [9, 1_200_000, 10, 200], [2, 2_000_000, 1, 300], [1, 2_000_000, 0, 300]]), 150_000, opts);
    expect(a.overRaw).toBe(true);
    expect(a.cpaSettled).toBe(120_000);
    expect(a.verdict).toBe("saved");
  });
  it("lets a pause through when SETTLED CPA is over target", () => {
    const a = assessCpa(rows([[12, 3_000_000, 10, 200], [8, 3_000_000, 10, 200]]), 200_000, opts);
    expect(a.verdict).toBe("over");
    expect(a.blockedBy).toBeNull();
  });
  it("does not judge without a target", () => {
    expect(assessCpa(rows([[9, 1_000_000, 20, 500]]), 0, opts).blockedBy).toBe("no_target");
  });
});

describe("measureAttributionLag / suggestAttributionDays", () => {
  it("measures how fast conversions arrive per series and suggests the window", () => {
    const revs = [];
    for (let s = 0; s < 6; s++) {
      revs.push({ seriesId: `ad${s}`, date: "2026-10-01", fetchedAt: "2026-10-01T20:00:00Z", conversions: 5 });
      revs.push({ seriesId: `ad${s}`, date: "2026-10-01", fetchedAt: "2026-10-02T20:00:00Z", conversions: 8 });
      revs.push({ seriesId: `ad${s}`, date: "2026-10-01", fetchedAt: "2026-10-04T20:00:00Z", conversions: 10 });
    }
    const curve = measureAttributionLag(revs);
    expect(curve.map((p) => [p.dayOffset, Math.round(p.reportedRatio * 100) / 100])).toEqual([[0, 0.5], [1, 0.8], [3, 1]]);
    expect(suggestAttributionDays(curve)).toBe(3);
    expect(suggestAttributionDays(curve, 0.95, 10)).toBeNull(); // not enough samples
  });
  it("does not mix series of different ads on the same day", () => {
    const curve = measureAttributionLag([
      { seriesId: "a", date: "2026-10-01", fetchedAt: "2026-10-01T10:00:00Z", conversions: 10 },
      { seriesId: "a", date: "2026-10-01", fetchedAt: "2026-10-03T10:00:00Z", conversions: 10 },
      { seriesId: "b", date: "2026-10-01", fetchedAt: "2026-10-01T10:00:00Z", conversions: 1 },
      { seriesId: "b", date: "2026-10-01", fetchedAt: "2026-10-03T10:00:00Z", conversions: 2 },
    ]);
    expect(curve.every((p) => p.reportedRatio <= 1)).toBe(true);
  });
});

describe("evaluateRule + attribution guard", () => {
  const cpaPause = RuleDefinition.parse({
    scope: { platform: "any", level: "ad" }, trigger: { type: "schedule", every: "15m" },
    conditions: { all: [{ metric: "cpa", window: "3d", op: ">", value: 150_000 }] }, minData: {},
    actions: [{ type: "pause_ad" }], limits: { cooldownHours: 24, maxActionsPerRun: 10, maxActionsPerDay: 30 },
    budgetGuard: { maxStepPct: 20, maxDailyBudgetPerEntity: 20_000_000, maxTotalDailyBudget: 80_000_000 },
  });
  const ent = (dailyRows: DayRow[]): RuleEntity => ({
    id: "ad1", name: "Ad 1", platform: "meta", level: "ad", status: "active", dailyBudget: 1_000_000,
    metrics: { "3d": { spend: 4_000_000, results: 1, impressions: 50_000, clicks: 600 } }, dailyRows,
  });
  const ctx = { now: new Date(`${TODAY}T08:00:00Z`), actionsToday: 0, totalDailyBudget: 1_000_000, attribution: opts };

  it("blocks the pause when the settled CPA is fine (would have been tắt oan)", () => {
    const r = evaluateRule(cpaPause, [ent(rows([[10, 1_200_000, 10, 200], [9, 1_200_000, 10, 200], [2, 2_000_000, 1, 300], [1, 2_000_000, 0, 300]]))], ctx);
    expect(r.matched).toBe(1);
    expect(r.actions[0].blocked).toMatch(/GIỮ LẠI/);
  });
  it("allows the pause when settled CPA is also over", () => {
    const r = evaluateRule(cpaPause, [ent(rows([[12, 3_000_000, 10, 200], [8, 3_000_000, 10, 200]]))], ctx);
    expect(r.actions[0].blocked).toBeUndefined();
    expect(r.actions[0].reason).toMatch(/CPA đã chín/);
  });
  it("leaves non-CPA rules alone", () => {
    const spendRule = RuleDefinition.parse({ ...cpaPause, conditions: { all: [{ metric: "spend", window: "3d", op: ">", value: 1_000_000 }] } });
    const r = evaluateRule(spendRule, [ent([])], ctx);
    expect(r.actions[0].blocked).toBeUndefined();
  });
  it("guard off = old behaviour", () => {
    const r = evaluateRule(cpaPause, [ent([])], { ...ctx, attribution: undefined });
    expect(r.actions[0].blocked).toBeUndefined();
  });
});
