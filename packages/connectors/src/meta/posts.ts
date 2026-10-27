import { graphGet } from "./graph.ts";
import type { AdObjective } from "./objectives.ts";

/**
 * Which post can run with which objective — ported from ZonoAcademy-AI/ads-os (lib/ads/post-fitness.ts + pages.ts).
 * Pure scoring over data fetched in one call. `is_eligible_for_promotion` is deliberately NOT used: ads-os found it
 * false for 0/90 posts across 6 Pages, including posts running real ads.
 * Confidence of each rule: [thực tế] follows from a required Facebook parameter; [kinh nghiệm] is a heuristic.
 */
export interface PostDetail {
  id: string; message: string; createdTime: string; permalink: string | null; image: string | null;
  statusType: string | null; mediaType: string | null; attachmentUrl: string | null;
  reactions: number; comments: number; shares: number;
}
export type FitVerdict = "good" | "ok" | "warn" | "blocked";
export interface ObjectiveFit { objective: AdObjective; verdict: FitVerdict; reason: string }
export interface PostFitness { engagement: number; commentShare: number; kind: "reel" | "video" | "photo" | "link" | "text"; externalLink: string | null; byObjective: Record<"messages" | "engagement" | "sales", ObjectiveFit> }

export const FIT_LABEL: Record<FitVerdict, string> = { good: "Phù hợp", ok: "Chạy được", warn: "Cân nhắc", blocked: "Không chạy được" };

export async function fetchPostsDetailed(pageToken: string, pageId: string, limit = 25): Promise<PostDetail[]> {
  const fields = ["id", "message", "created_time", "permalink_url", "full_picture", "status_type", "attachments{media_type,type,unshimmed_url}",
    "comments.summary(true).limit(0)", "reactions.summary(true).limit(0)", "shares"].join(",");
  const r = await graphGet(pageToken, `${pageId}/published_posts`, { fields, limit });
  return (r.data ?? []).map((p: any) => {
    const att = p.attachments?.data?.[0];
    return {
      id: String(p.id), message: String(p.message ?? ""), createdTime: p.created_time, permalink: p.permalink_url ?? null, image: p.full_picture ?? null,
      statusType: p.status_type ?? null, mediaType: att?.media_type ?? att?.type ?? null, attachmentUrl: att?.unshimmed_url ?? null,
      reactions: p.reactions?.summary?.total_count ?? 0, comments: p.comments?.summary?.total_count ?? 0, shares: p.shares?.count ?? 0,
    };
  });
}

/** Only a link OUTSIDE Facebook is somewhere a conversion ad can send people. */
export function externalLinkOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return /(^|\.)(facebook\.com|fb\.com|fb\.watch|instagram\.com)$/.test(h) ? null : url;
  } catch { return null; }
}

function kindOf(p: PostDetail): PostFitness["kind"] {
  const url = p.attachmentUrl ?? "";
  if (/\/reel\//.test(url)) return "reel";
  if (p.statusType === "added_video" || p.mediaType === "video") return "video";
  if (externalLinkOf(p.attachmentUrl)) return "link";
  if (p.statusType === "added_photos" || p.mediaType === "photo") return "photo";
  return "text";
}

export function assessPost(p: PostDetail, median = 0): PostFitness {
  const engagement = p.reactions + p.comments + p.shares;
  const commentShare = engagement > 0 ? p.comments / engagement : 0;
  const externalLink = externalLinkOf(p.attachmentUrl);
  // [kinh nghiệm] people already asking in comments = messaging intent; Reels DO run Tin nhắn once MESSAGE_PAGE is set.
  const messages: ObjectiveFit = p.comments >= 2 && commentShare >= 0.25
    ? { objective: "messages", verdict: "good", reason: `${p.comments} bình luận trên ${engagement} tương tác — đã có người chủ động hỏi, mục tiêu Tin nhắn thường rẻ hơn.` }
    : { objective: "messages", verdict: "ok", reason: "Chạy được. Chưa thấy dấu hiệu người xem muốn hỏi nên chưa chắc rẻ." };
  // [thực tế] Chuyển đổi sends people to a WEBSITE; no external link = nowhere to go and nothing for the pixel.
  const sales: ObjectiveFit = externalLink
    ? { objective: "sales", verdict: "good", reason: `Có trang đích: ${externalLink.slice(0, 60)}` }
    : { objective: "sales", verdict: "blocked", reason: "Bài không có link ra ngoài Facebook — quảng cáo Chuyển đổi cần trang đích đã gắn pixel." };
  // [kinh nghiệm] compared with THIS Page's typical engagement, not an absolute number.
  const eng: ObjectiveFit = median > 0 && engagement >= Math.max(3, median * 2)
    ? { objective: "engagement", verdict: "good", reason: `${engagement} tương tác — cao hơn hẳn mức thường của Page (${median}).` }
    : engagement === 0
      ? { objective: "engagement", verdict: "warn", reason: "Chưa có tương tác tự nhiên nào — đổ tiền vào thường chỉ mua được lượt hiển thị." }
      : { objective: "engagement", verdict: "ok", reason: `${engagement} tương tác tự nhiên.` };
  return { engagement, commentShare, kind: kindOf(p), externalLink, byObjective: { messages, engagement: eng, sales } };
}

const medianOf = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** Assess a batch: "high" only means something compared with the Page's own median. */
export function assessPosts(posts: PostDetail[]) {
  const median = medianOf(posts.map((p) => p.reactions + p.comments + p.shares));
  const out = posts.map((p) => {
    const fitness = assessPost(p, median);
    const good = (["sales", "messages", "engagement"] as const).find((o) => fitness.byObjective[o].verdict === "good") ?? null;
    return { ...p, fitness, best: good as AdObjective | null };
  });
  const notes: string[] = [];
  if (posts.length && median < 3) notes.push(`Tương tác tự nhiên của Page rất thấp (mức giữa ${median}/bài) — thứ tự bài chỉ nên tham khảo.`);
  if (posts.length && posts.every((p) => !externalLinkOf(p.attachmentUrl))) notes.push("Không bài nào có link ra ngoài Facebook nên mục tiêu Chuyển đổi không chạy được với bài nào.");
  return { posts: out, medianEngagement: median, note: notes.join(" ") || null };
}
