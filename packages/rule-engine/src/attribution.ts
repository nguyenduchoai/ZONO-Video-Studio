/**
 * Attribution-aware CPA — "không tắt oan". Ported from ZonoAcademy-AI/ads-os (lib/ads/attribution.ts), amounts in
 * account currency units (VND) instead of micros. Pure: no I/O.
 *
 * Facebook/Google revise numbers retroactively: conversions of the last few days are still arriving, so CPA of
 * recent days always looks worse than it is. Pausing on raw CPA pauses good campaigns. Conclusions are therefore
 * drawn only on SETTLED data (day <= today − attribution window), and the window is measured from the account's
 * own revision history instead of guessed.
 */
export interface DayRow { day: string; spend: number; results: number; clicks: number }

export interface AttributionOptions {
  /** Days at the end treated as NOT settled. */
  attributionDays: number;
  /** Minimum settled conversions before daring a conclusion. */
  minConversions: number;
  /** Minimum settled clicks — blocks conclusions from tiny samples. */
  minClicks: number;
  /** Today, YYYY-MM-DD (passed in so it is testable). */
  today: string;
}
export const DEFAULT_ATTRIBUTION = { attributionDays: 7, minConversions: 10, minClicks: 100 } as const;

export type CpaVerdict = "ok" | "saved" | "holding" | "over";
export interface CpaAssessment {
  cpaRaw: number;
  cpaSettled: number;
  settledConversions: number;
  settledClicks: number;
  hasSettledData: boolean;
  overRaw: boolean;
  overSettled: boolean;
  verdict: CpaVerdict;
  reason: string;
  blockedBy: "no_target" | "attribution_window" | null;
  cutoff: string;
}

export function settledCutoff(today: string, attributionDays: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - attributionDays);
  return d.toISOString().slice(0, 10);
}
const fmt = (v: number) => `${Math.round(v).toLocaleString("vi-VN")}đ`;

export function assessCpa(rows: DayRow[], targetCpa: number, opts: AttributionOptions): CpaAssessment {
  const cutoff = settledCutoff(opts.today, opts.attributionDays);
  let spendAll = 0, convAll = 0, spendSettled = 0, convSettled = 0, clicksSettled = 0;
  for (const r of rows) {
    spendAll += r.spend;
    convAll += r.results;
    if (r.day <= cutoff) { spendSettled += r.spend; convSettled += r.results; clicksSettled += r.clicks; }
  }
  const cpaRaw = convAll > 0 ? spendAll / convAll : spendAll > 0 ? Infinity : 0;
  const cpaSettled = convSettled > 0 ? spendSettled / convSettled : 0;
  const hasSettledData = convSettled >= opts.minConversions && clicksSettled >= opts.minClicks;
  const overRaw = targetCpa > 0 && cpaRaw > targetCpa;
  const overSettled = targetCpa > 0 && hasSettledData && cpaSettled > targetCpa;
  const base = { cpaRaw, cpaSettled, settledConversions: convSettled, settledClicks: clicksSettled, hasSettledData, overRaw, overSettled, cutoff };
  const rawTxt = Number.isFinite(cpaRaw) ? fmt(cpaRaw) : "chưa có chuyển đổi";

  if (!targetCpa) return { ...base, verdict: "ok", blockedBy: "no_target", reason: "Chưa có ngưỡng CPA — không đánh giá." };
  if (!hasSettledData) return {
    ...base, verdict: "holding", blockedBy: "attribution_window",
    reason: `GIỮ LẠI: chưa đủ dữ liệu đã chín để kết luận — ${convSettled} chuyển đổi / ${clicksSettled} click tính tới ${cutoff} `
      + `(cần ≥ ${opts.minConversions} chuyển đổi và ≥ ${opts.minClicks} click). CPA thô ${rawTxt} còn thiếu chuyển đổi chưa về.`,
  };
  if (overSettled) return {
    ...base, verdict: "over", blockedBy: null,
    reason: `CPA đã chín ${fmt(cpaSettled)} vượt ngưỡng ${fmt(targetCpa)} (dữ liệu tới ${cutoff}, ${convSettled} chuyển đổi) — không bị ảnh hưởng bởi chuyển đổi chưa về.`,
  };
  if (overRaw) return {
    ...base, verdict: "saved", blockedBy: "attribution_window",
    reason: `GIỮ LẠI: CPA thô ${rawTxt} vượt ngưỡng ${fmt(targetCpa)} nhưng CPA đã chín chỉ ${fmt(cpaSettled)} — vẫn dưới ngưỡng. `
      + `Chênh lệch là do chuyển đổi của ${opts.attributionDays} ngày gần nhất chưa về đủ; tắt theo CPA thô là tắt oan.`,
  };
  return { ...base, verdict: "ok", blockedBy: null, reason: `CPA đã chín ${fmt(cpaSettled)} trong ngưỡng ${fmt(targetCpa)}.` };
}

// ---- Measuring the account's real attribution window from revision history ----
export interface MetricRevision {
  /** Series id (ad / campaign). REQUIRED when mixing series, else different ads on one day merge into one series. */
  seriesId?: string;
  /** Day of the data, YYYY-MM-DD. */
  date: string;
  /** When it was fetched, ISO timestamp. */
  fetchedAt: string;
  conversions: number;
}
export interface LagPoint { dayOffset: number; reportedRatio: number; samples: number }

/** With data fetched N days later, on average what share of the FINAL conversions had been reported. */
export function measureAttributionLag(revisions: MetricRevision[]): LagPoint[] {
  const byKey = new Map<string, MetricRevision[]>();
  for (const r of revisions) {
    const key = `${r.seriesId ?? ""} ${r.date}`;
    const list = byKey.get(key);
    if (list) list.push(r); else byKey.set(key, [r]);
  }
  const acc = new Map<number, { sum: number; n: number }>();
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt));
    const final = sorted[sorted.length - 1].conversions;
    if (final <= 0) continue;
    const dataDay = new Date(`${key.slice(key.indexOf(" ") + 1)}T00:00:00Z`).getTime();
    const perOffset = new Map<number, number>(); // latest fetch of each offset day = end-of-day state
    for (const rev of sorted) {
      const offset = Math.floor((new Date(rev.fetchedAt).getTime() - dataDay) / 86_400_000);
      if (offset >= 0) perOffset.set(offset, rev.conversions);
    }
    for (const [offset, conv] of perOffset) {
      const cur = acc.get(offset) ?? { sum: 0, n: 0 };
      cur.sum += Math.min(1, conv / final);
      cur.n += 1;
      acc.set(offset, cur);
    }
  }
  return [...acc.entries()].map(([dayOffset, { sum, n }]) => ({ dayOffset, reportedRatio: sum / n, samples: n })).sort((a, b) => a.dayOffset - b.dayOffset);
}

/** Smallest offset whose reported ratio reaches the threshold; null when the data cannot tell yet. */
export function suggestAttributionDays(curve: LagPoint[], threshold = 0.95, minSamples = 5): number | null {
  const usable = curve.filter((p) => p.samples >= minSamples);
  if (!usable.length) return null;
  return usable.find((p) => p.reportedRatio >= threshold)?.dayOffset ?? null;
}
