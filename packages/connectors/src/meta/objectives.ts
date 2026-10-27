/**
 * Campaign objectives and the parameter set Facebook demands for each — ported from ZonoAcademy-AI/ads-os
 * (lib/ads/objectives.ts). The four fields below must match as a SET: change the objective but not
 * optimization_goal / promoted_object and Facebook rejects at the adset step — or worse, at the ad step after half
 * the chain exists. engagement / messages / sales were probed with validate_only and run for real on live
 * accounts by ads-os; `traffic` is kept for templates created before the port and is NOT verified there.
 */
export type AdObjective = "engagement" | "messages" | "sales" | "traffic";
export const AD_OBJECTIVES: AdObjective[] = ["engagement", "messages", "sales", "traffic"];

export interface ObjectiveSpec {
  label: string;
  hint: string;
  fbObjective: string;
  optimizationGoal: string;
  destinationType: string;
  /** null = NEVER send promoted_object (POST_ENGAGEMENT rejects it); page = {page_id}; pixel = {pixel_id, custom_event_type}. */
  promoted: null | "page" | "pixel";
  /**
   * call_to_action on the creative. MESSENGER destination without MESSAGE_PAGE fails at the AD step with
   * 100/1487891 — and validate_only on the creative step does NOT catch it.
   */
  callToAction?: { type: string; value: Record<string, string> };
  verified: boolean;
}

export const OBJECTIVE: Record<AdObjective, ObjectiveSpec> = {
  engagement: {
    label: "Tương tác", hint: "Đẩy bài viết cho nhiều người thấy và tương tác. Không đo được đơn hàng.",
    fbObjective: "OUTCOME_ENGAGEMENT", optimizationGoal: "POST_ENGAGEMENT", destinationType: "ON_POST", promoted: null, verified: true,
  },
  messages: {
    label: "Tin nhắn", hint: "Người xem bấm vào là mở Messenger nhắn cho Page. Phổ biến nhất ở Việt Nam.",
    fbObjective: "OUTCOME_ENGAGEMENT", optimizationGoal: "CONVERSATIONS", destinationType: "MESSENGER", promoted: "page",
    callToAction: { type: "MESSAGE_PAGE", value: { app_destination: "MESSENGER" } }, verified: true,
  },
  sales: {
    label: "Chuyển đổi", hint: "Tối ưu theo sự kiện pixel trên website. Cần pixel đã gắn và đang nhận dữ liệu.",
    fbObjective: "OUTCOME_SALES", optimizationGoal: "OFFSITE_CONVERSIONS", destinationType: "WEBSITE", promoted: "pixel", verified: true,
  },
  traffic: {
    label: "Lượt truy cập website", hint: "Đưa người xem tới link trong bài. Chưa được ads-os kiểm thật.",
    fbObjective: "OUTCOME_TRAFFIC", optimizationGoal: "LINK_CLICKS", destinationType: "WEBSITE", promoted: null, verified: false,
  },
};

/**
 * Conversion events usable with OUTCOME_SALES — the probed list, not everything Facebook documents:
 * INITIATE_CHECKOUT and LEAD were rejected at the adset step.
 */
export const CONVERSION_EVENTS: { value: string; label: string }[] = [
  { value: "PURCHASE", label: "Mua hàng" },
  { value: "ADD_TO_CART", label: "Thêm vào giỏ" },
  { value: "COMPLETE_REGISTRATION", label: "Đăng ký xong" },
  { value: "CONTENT_VIEW", label: "Xem nội dung" },
  { value: "ADD_TO_WISHLIST", label: "Thêm vào yêu thích" },
  { value: "SUBSCRIBE", label: "Đăng ký gói" },
];
export const isConversionEvent = (v: string) => CONVERSION_EVENTS.some((e) => e.value === v);

/** Map whatever a template stored to one of our objectives (older templates used other names). */
export function toObjective(v: unknown): AdObjective {
  const s = String(v ?? "").toLowerCase();
  if (s === "engagement" || s === "post_engagement") return "engagement";
  if (s === "sales" || s === "conversions" || s === "purchase") return "sales";
  if (s === "traffic" || s === "link_clicks") return "traffic";
  return "messages";
}

/** promoted_object for the adset, or null when the field must be left out entirely (null ≠ {}). */
export function promotedObject(objective: AdObjective, src: { pageId: string; pixelId?: string | null; conversionEvent?: string | null }): Record<string, string> | null {
  const spec = OBJECTIVE[objective];
  if (spec.promoted === "page") return { page_id: src.pageId };
  if (spec.promoted === "pixel") return src.pixelId && src.conversionEvent ? { pixel_id: src.pixelId, custom_event_type: src.conversionEvent } : null;
  return null;
}

/** What is missing to create an ad with this objective — null when complete. Checked BEFORE any Graph call. */
export function missingRequirement(objective: AdObjective, src: { pixelId?: string | null; conversionEvent?: string | null }): string | null {
  if (objective !== "sales") return null;
  if (!src.pixelId) return "Mục tiêu Chuyển đổi cần chọn pixel (sửa mẫu quảng cáo)";
  if (!src.conversionEvent) return "Mục tiêu Chuyển đổi cần chọn sự kiện chuyển đổi (sửa mẫu quảng cáo)";
  if (!isConversionEvent(src.conversionEvent)) return `Sự kiện "${src.conversionEvent}" không dùng được với mục tiêu Chuyển đổi`;
  return null;
}
