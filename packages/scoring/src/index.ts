/**
 * Post score (spec §9.1). Deterministic formula; the only model inputs are upstream
 * judgments already stored as numbers (Jev comment labels -> intent, Jev post fit -> fit).
 * Reasons are generated from the components by fixed templates so they always match the data.
 */
export const FORMULA_VERSION = 1;
export const DEFAULT_WEIGHTS = { eng: 0.25, vel: 0.25, intent: 0.2, fmt: 0.1, fresh: 0.1, fit: 0.1 };
export type Weights = typeof DEFAULT_WEIGHTS;

export interface PostSnapshot { mark: "1h" | "6h" | "24h" | "72h"; reach: number; reactions: number; comments: number; shares: number; saves: number }
export interface ScoreInput {
  kind: "text" | "image" | "video" | "reel" | "link" | "article";
  hasCta: boolean;
  ageHours: number;
  snapshots: PostSnapshot[];
  /** Engagement rates of recent posts on the same channel (for percentile). */
  channelEngagementRates: number[];
  /** Median weighted engagement of the channel at the 6h mark. */
  channelMedianEarly: number;
  commentLabels: { purchase_intent: number; negative: number; total: number };
  fit: number; // 0..1 from Jev postFit
  penalties?: { bannedWords?: boolean; specialCategory?: boolean; poorPastAds?: number };
}
export interface ScoreOutput {
  score: number;
  lowData: boolean;
  components: Record<keyof Weights, number>;
  penalties: number;
  reasons: string[];
}

const weighted = (s: PostSnapshot) => s.reactions + 2 * s.comments + 3 * s.shares + 2 * s.saves;
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

function percentile(value: number, sample: number[]): number {
  if (!sample.length) return 0.5;
  const below = sample.filter((v) => v < value).length;
  const equal = sample.filter((v) => v === value).length;
  return (below + equal / 2) / sample.length;
}

const FMT_BASE: Record<ScoreInput["kind"], number> = { reel: 0.9, video: 0.85, image: 0.7, article: 0.55, link: 0.5, text: 0.6 };

export function scorePost(input: ScoreInput, w: Weights = DEFAULT_WEIGHTS): ScoreOutput {
  const latest = [...input.snapshots].sort((a, b) => order(b.mark) - order(a.mark))[0];
  const early = input.snapshots.find((s) => s.mark === "6h") ?? input.snapshots.find((s) => s.mark === "1h");
  const lowData = !latest || latest.reach < 300 || order(latest.mark) < order("6h");

  const rate = latest && latest.reach ? weighted(latest) / latest.reach : 0;
  const eng = percentile(rate, input.channelEngagementRates);
  const vel = early && input.channelMedianEarly ? clamp(weighted(early) / input.channelMedianEarly / 3) : 0;
  // Beta prior (alpha=1, beta=9): posts with few comments are not over-read.
  const intent = clamp(((input.commentLabels.purchase_intent + 1) / (input.commentLabels.total + 10)) * 4);
  const fmt = clamp(FMT_BASE[input.kind] + (input.hasCta ? 0.1 : 0));
  const fresh = Math.exp(-input.ageHours / 72);
  const fit = clamp(input.fit);
  const components = { eng, vel, intent, fmt, fresh, fit };

  let penalties = 0;
  const reasons: string[] = [];
  const negRate = input.commentLabels.total ? input.commentLabels.negative / input.commentLabels.total : 0;
  if (negRate > 0.2) { penalties += 15; reasons.push(`Trừ điểm: ${Math.round(negRate * 100)}% bình luận tiêu cực`); }
  if (input.penalties?.bannedWords) { penalties += 30; reasons.push("Trừ điểm: có từ khóa cấm"); }
  if (input.penalties?.specialCategory) { penalties += 10; reasons.push("Danh mục quảng cáo đặc biệt — luôn cần duyệt tay"); }
  if (input.penalties?.poorPastAds) { penalties += 10 * input.penalties.poorPastAds; reasons.push(`Đã chạy ${input.penalties.poorPastAds} lần kết quả kém`); }

  const raw = 100 * (w.eng * eng + w.vel * vel + w.intent * intent + w.fmt * fmt + w.fresh * fresh + w.fit * fit) - penalties;
  const score = Math.round(clamp(raw, 0, 100) * 10) / 10;

  if (latest) {
    const median = input.channelEngagementRates.length ? [...input.channelEngagementRates].sort((a, b) => a - b)[Math.floor(input.channelEngagementRates.length / 2)] : 0;
    if (median > 0) reasons.unshift(`${latest.mark}: tương tác gấp ${(rate / median).toFixed(1)} lần trung vị kênh`);
    if (input.commentLabels.total) reasons.push(`${Math.round((input.commentLabels.purchase_intent / input.commentLabels.total) * 100)}% bình luận có ý định mua (${input.commentLabels.purchase_intent}/${input.commentLabels.total})`);
  }
  if (vel >= 0.66) reasons.push("Tốc độ tương tác giờ đầu vượt trội");
  if (fit >= 0.66) reasons.push("Khớp sản phẩm đang đẩy trong kế hoạch");
  if (lowData) reasons.push("Dữ liệu còn ít (low_data) — chưa đề xuất chạy ads");
  return { score, lowData, components, penalties, reasons };
}

function order(mark: string): number {
  return { "1h": 1, "6h": 2, "24h": 3, "72h": 4 }[mark] ?? 0;
}
