/**
 * What counts as a "result" per campaign objective — ported from ZonoAcademy-AI/ads-os (lib/ads/facebook.ts).
 * The array order is PRIORITY: take the first type present, never sum (Facebook reports both `purchase` and
 * `omni_purchase` for one order). No generic fallback on purpose: a sales campaign with 0 orders must read 0,
 * not fall back to clicks and make CPA look cheap — the auto-off guard would then never fire.
 */
export const CONVERSION_ACTIONS: Record<string, string[]> = {
  messages: ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.total_messaging_connection"],
  leads: ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"],
  sales: ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"],
  traffic: ["landing_page_view", "link_click"],
  // OUTCOME_ENGAGEMENT bundles messaging, post engagement and video: messaging first (most VN campaigns are Tin nhắn).
  engagement: ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.total_messaging_connection", "post_engagement", "link_click"],
  video_views: ["video_view"],
  awareness: [],
};

/** Connection setting "Tính 'kết quả' theo" (fixed action types) — kept for connections created before the port. */
export const RESULT_SETTING: Record<string, string[]> = {
  messaging: CONVERSION_ACTIONS.messages,
  lead: CONVERSION_ACTIONS.leads,
  purchase: CONVERSION_ACTIONS.sales,
  link_click: ["link_click"],
};

/** Facebook objective (ODAX OUTCOME_* or legacy names) → our objective family. */
export function mapObjective(fb: string): string {
  const o = String(fb ?? "").toUpperCase();
  if (o.includes("MESSAG")) return "messages";
  if (o.includes("LEAD")) return "leads";
  if (o.includes("SALES") || o.includes("CONVERSION") || o.includes("CATALOG")) return "sales";
  if (o.includes("TRAFFIC") || o.includes("LINK_CLICK")) return "traffic";
  if (o.includes("ENGAGEMENT")) return "engagement"; // before VIDEO: keep engagement so messaging counts first
  if (o.includes("VIDEO")) return "video_views";
  if (o.includes("AWARENESS") || o.includes("REACH") || o.includes("BRAND")) return "awareness";
  return "unknown";
}

/** `actionType === null` = NOT measurable (different from "measured and 0"). */
export function countConversions(actions: { action_type: string; value: string }[] | undefined, wanted: string[]): { count: number; actionType: string | null } {
  if (!wanted.length || !actions?.length) return { count: 0, actionType: null };
  for (const t of wanted) {
    const hit = actions.find((a) => a.action_type === t);
    if (hit) return { count: Number(hit.value) || 0, actionType: t };
  }
  return { count: 0, actionType: null };
}
