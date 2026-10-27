import { describe, expect, it } from "vitest";
import { scorePost, type ScoreInput } from "./index.ts";

const base: ScoreInput = {
  kind: "reel", hasCta: true, ageHours: 24,
  snapshots: [
    { mark: "1h", reach: 800, reactions: 60, comments: 12, shares: 5, saves: 8 },
    { mark: "6h", reach: 4000, reactions: 300, comments: 60, shares: 30, saves: 40 },
    { mark: "24h", reach: 12000, reactions: 800, comments: 140, shares: 70, saves: 90 },
  ],
  channelEngagementRates: [0.02, 0.03, 0.035, 0.04, 0.05],
  channelMedianEarly: 150,
  commentLabels: { purchase_intent: 25, negative: 2, total: 140 },
  fit: 0.9,
};

describe("scorePost", () => {
  it("scores a strong post high with data-backed reasons", () => {
    const r = scorePost(base);
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.lowData).toBe(false);
    expect(r.reasons[0]).toMatch(/24h: tương tác gấp/);
  });
  it("flags low data for young posts", () => {
    const r = scorePost({ ...base, snapshots: base.snapshots.slice(0, 1) });
    expect(r.lowData).toBe(true);
  });
  it("applies penalties and stays within 0..100", () => {
    const r = scorePost({ ...base, commentLabels: { purchase_intent: 0, negative: 80, total: 140 }, penalties: { bannedWords: true } });
    expect(r.penalties).toBeGreaterThan(0);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThan(scorePost(base).score);
  });
});
