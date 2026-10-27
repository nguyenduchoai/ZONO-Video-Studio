import { ConnectorError } from "../errors.ts";
import { graphDelete, graphGet, graphPost } from "./graph.ts";
import { OBJECTIVE, missingRequirement, promotedObject, type AdObjective } from "./objectives.ts";
import { buildTargeting, type TargetingSpec } from "./targeting.ts";

/**
 * Boost an existing Page post — ported from ZonoAcademy-AI/ads-os (lib/ads/facebook-create.ts), the chain that was
 * run end-to-end on real accounts. campaign → adset → creative → ad, ALL created PAUSED; a failing step returns
 * what was created so the caller can clean up (cleanupPartial). Activation, when the user asked to start
 * immediately, is a separate explicit step after the whole chain exists (activateBoost).
 */
export interface BoostSpec {
  adAccountId: string;
  pageId: string;
  /** '<page_id>_<post_id>' exactly as Graph returns it. */
  postId: string;
  campaignName: string;
  /** Major units of the account currency (VND = đồng). */
  dailyBudget: number;
  /** Multiplier to the minor unit Facebook expects (1 for VND, 100 for USD). */
  minorFactor: number;
  targeting: TargetingSpec;
  objective: AdObjective;
  pixelId?: string | null;
  conversionEvent?: string | null;
}
export interface CreatedAd { campaignId: string; adsetId: string; creativeId: string; adId: string }

export class AdCreateError extends ConnectorError {
  constructor(base: ConnectorError, readonly step: "campaign" | "adset" | "creative" | "ad", readonly created: Partial<CreatedAd>) {
    super(base.kind, `${base.message} (bước ${STEP_VI[step]})`);
  }
}
const STEP_VI = { campaign: "tạo chiến dịch", adset: "tạo nhóm quảng cáo", creative: "tạo nội dung", ad: "tạo quảng cáo" } as const;

const act = (s: BoostSpec) => (s.adAccountId.startsWith("act_") ? s.adAccountId : `act_${s.adAccountId}`);
export const storyIdOf = (pageId: string, postId: string) => (postId.includes("_") ? postId : `${pageId}_${postId}`);

function campaignBody(s: BoostSpec): Record<string, unknown> {
  return {
    name: s.campaignName,
    objective: OBJECTIVE[s.objective].fbObjective,
    status: "PAUSED",
    special_ad_categories: "[]",
    // Budget lives on the adset (ABO); false = Facebook may not drift from the amount the user set.
    is_adset_budget_sharing_enabled: "false",
  };
}

async function step<T>(created: Partial<CreatedAd>, name: AdCreateError["step"], fn: () => Promise<T>): Promise<T> {
  try {
    const r: any = await fn();
    if (!r?.id) throw new ConnectorError("InvalidRequest", "Meta: phản hồi không có id");
    return r;
  } catch (e) {
    throw new AdCreateError(e instanceof ConnectorError ? e : new ConnectorError("InvalidRequest", String(e)), name, created);
  }
}

/**
 * Checks the campaign payload WITHOUT creating anything (execution_options=validate_only). Catches what usually
 * breaks at the account level (blocked ad creation, broken token, 31/3858385) — not a guarantee for the whole
 * chain, since the adset/ad checks need real parent ids.
 */
export async function validateBoost(token: string, s: BoostSpec): Promise<void> {
  const missing = missingRequirement(s.objective, s);
  if (missing) throw new ConnectorError("InvalidRequest", missing);
  await graphPost(token, `${act(s)}/campaigns`, { ...campaignBody(s), execution_options: '["validate_only"]' });
}

export async function createBoost(token: string, s: BoostSpec): Promise<CreatedAd> {
  const created: Partial<CreatedAd> = {};
  const obj = OBJECTIVE[s.objective];
  // Block BEFORE any call: a Chuyển đổi template without pixel would fail at the adset step, after the campaign exists.
  const missing = missingRequirement(s.objective, s);
  if (missing) throw new AdCreateError(new ConnectorError("InvalidRequest", missing), "campaign", created);
  const budget = Math.round(s.dailyBudget * s.minorFactor);
  if (!(budget > 0)) throw new AdCreateError(new ConnectorError("InvalidRequest", "Ngân sách ngày phải lớn hơn 0"), "campaign", created);

  const campaign = await step(created, "campaign", () => graphPost(token, `${act(s)}/campaigns`, campaignBody(s)));
  created.campaignId = String(campaign.id);

  const promoted = promotedObject(s.objective, s);
  const adset = await step(created, "adset", () => graphPost(token, `${act(s)}/adsets`, {
    name: `${s.campaignName} — nhóm 1`,
    campaign_id: created.campaignId,
    daily_budget: String(budget),
    billing_event: "IMPRESSIONS",
    optimization_goal: obj.optimizationGoal,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    // REQUIRED and the hardest to find: without it OUTCOME_ENGAGEMENT is read as website conversions and the AD
    // step fails asking for a pixel.
    destination_type: obj.destinationType,
    // Left out entirely when the objective must not carry it (POST_ENGAGEMENT + promoted_object is rejected).
    ...(promoted ? { promoted_object: JSON.stringify(promoted) } : {}),
    targeting: JSON.stringify(buildTargeting(s.targeting)),
    status: "PAUSED",
  }));
  created.adsetId = String(adset.id);

  const creative = await step(created, "creative", () => graphPost(token, `${act(s)}/adcreatives`, {
    name: `${s.campaignName} — creative`,
    object_story_id: storyIdOf(s.pageId, s.postId),
    // Tin nhắn needs the message button, otherwise the AD step fails with 100/1487891.
    ...(obj.callToAction ? { call_to_action: JSON.stringify(obj.callToAction) } : {}),
  }));
  created.creativeId = String(creative.id);

  const ad = await step(created, "ad", () => graphPost(token, `${act(s)}/ads`, {
    name: `${s.campaignName} — ad`,
    adset_id: created.adsetId,
    creative: JSON.stringify({ creative_id: created.creativeId }),
    status: "PAUSED",
  }));
  return { campaignId: created.campaignId, adsetId: created.adsetId, creativeId: created.creativeId, adId: String(ad.id) };
}

/**
 * Remove what a failed chain created. Deleting the campaign takes the adset/ad with it but NOT the creative
 * (account-level object), so that one is deleted separately — otherwise every failure leaves an orphan.
 */
export async function cleanupPartial(token: string, created: Partial<CreatedAd>): Promise<void> {
  if (created.campaignId) await graphDelete(token, created.campaignId);
  if (created.creativeId) await graphDelete(token, created.creativeId);
}

/** Switch a freshly created (paused) chain on: ad → adset → campaign, then read the ad back. */
export async function activateBoost(token: string, c: CreatedAd): Promise<string | null> {
  for (const id of [c.adId, c.adsetId, c.campaignId]) await graphPost(token, id, { status: "ACTIVE" });
  return readStatus(token, c.adId);
}

/** Read back after a write — trust the data, not the write response. */
export async function readStatus(token: string, id: string): Promise<string | null> {
  try { return ((await graphGet(token, id, { fields: "status" })).status as string) ?? null; } catch { return null; }
}
export async function readDailyBudget(token: string, id: string): Promise<number | null> {
  try { const r = await graphGet(token, id, { fields: "daily_budget" }); return r.daily_budget != null ? Number(r.daily_budget) : null; } catch { return null; }
}
