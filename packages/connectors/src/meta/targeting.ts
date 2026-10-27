import { graphGet } from "./graph.ts";

/**
 * Targeting block for the adset — ported from ZonoAcademy-AI/ads-os (lib/ads/targeting.ts). The silent failure
 * modes are the dangerous ones: a missing field lets Facebook pick a much wider default, an empty array matches
 * nobody. Rule: a field the user did not set is NOT sent (absent = no limit, [] = nothing).
 */
export interface Interest { id: string; name: string }
export interface GeoLocation { type: "city" | "region"; key: string; name: string }
export interface Placements { automatic: boolean; publisherPlatforms?: string[]; facebookPositions?: string[]; instagramPositions?: string[] }
export interface TargetingSpec {
  countries: string[];
  locations: GeoLocation[];
  ageMin: number;
  ageMax: number;
  /** Facebook convention: 1 = male, 2 = female. Empty = all. */
  genders: number[];
  interests: Interest[];
  placements: Placements;
  advantageAudience: boolean;
}

export function buildTargeting(t: TargetingSpec): Record<string, unknown> {
  const geo: Record<string, unknown> = {};
  // Cities/regions REPLACE countries — sending both targets the whole country, the opposite of what was meant.
  const cities = t.locations.filter((l) => l.type === "city");
  const regions = t.locations.filter((l) => l.type === "region");
  if (cities.length || regions.length) {
    if (cities.length) geo.cities = cities.map((c) => ({ key: c.key }));
    if (regions.length) geo.regions = regions.map((r) => ({ key: r.key }));
  } else geo.countries = t.countries.length ? t.countries : ["VN"];

  const out: Record<string, unknown> = { geo_locations: geo };
  if (t.advantageAudience) {
    // With Advantage+ audience, age/gender become suggestions. Sending age_max < 65 with advantage_audience=1 is
    // rejected (100/1870189). The shape Ads Manager itself sends: age_min capped at 25, age_max 65, the real range
    // as age_range, and individual_setting marking age/gender as suggestions — without it the same error returns.
    out.age_min = Math.min(t.ageMin, 25);
    out.age_max = 65;
    out.age_range = [t.ageMin, t.ageMax];
    out.targeting_automation = { advantage_audience: 1, individual_setting: { age: 1, gender: 1 } };
  } else {
    out.age_min = t.ageMin;
    out.age_max = t.ageMax;
    out.targeting_automation = { advantage_audience: 0 }; // required from v23
  }
  if (t.genders.length === 1) out.genders = t.genders; // [] would show the ad to nobody
  if (t.interests.length) out.flexible_spec = [{ interests: t.interests.map((i) => ({ id: i.id, name: i.name })) }];
  if (!t.placements.automatic) {
    const p = t.placements;
    const platforms = p.publisherPlatforms ?? [];
    if (platforms.length) out.publisher_platforms = platforms;
    if (p.facebookPositions?.length) out.facebook_positions = p.facebookPositions;
    if (p.instagramPositions?.length) out.instagram_positions = p.instagramPositions;
    // Messenger / Audience Network have no default positions: naming the platform with no position rejects the adset.
    if (platforms.includes("messenger")) out.messenger_positions = ["messenger_home"];
    if (platforms.includes("audience_network")) out.audience_network_positions = ["classic"];
  }
  return out;
}

const clampAge = (v: unknown, d: number) => Math.min(65, Math.max(13, Number.isFinite(Number(v)) && v !== null && v !== "" ? Math.round(Number(v)) : d));
const GENDER: Record<string, number> = { "1": 1, male: 1, nam: 1, m: 1, "2": 2, female: 2, "nữ": 2, nu: 2, f: 2 };

/**
 * Template definition (Thư viện nội dung) → TargetingSpec. Accepts the existing shape
 * `{ audience: { locations: ["VN"], ageMin, ageMax, genders, interests } }` plus the richer ads-os fields when present:
 * `audience.geo` [{type,key,name}], interests as [{id,name}] (plain strings are notes only and NOT sent),
 * `advantageAudience` (default on), `placements` ("auto" or {automatic, publisherPlatforms, …}).
 */
export function templateTargeting(def: any): TargetingSpec {
  const a = def?.audience ?? {};
  const countries = (Array.isArray(a.locations) ? a.locations : ["VN"]).map((s: unknown) => String(s).trim().toUpperCase()).filter((s: string) => /^[A-Z]{2}$/.test(s));
  const locations: GeoLocation[] = (Array.isArray(a.geo) ? a.geo : []).filter((g: any) => g && (g.type === "city" || g.type === "region") && g.key).map((g: any) => ({ type: g.type, key: String(g.key), name: String(g.name ?? g.key) }));
  const genders = [...new Set((Array.isArray(a.genders) ? a.genders : []).map((g: unknown) => GENDER[String(g).toLowerCase()]).filter(Boolean))] as number[];
  const interests: Interest[] = (Array.isArray(a.interests) ? a.interests : []).filter((i: any) => i && typeof i === "object" && i.id).map((i: any) => ({ id: String(i.id), name: String(i.name ?? i.id) }));
  const p = def?.placements;
  const placements: Placements = p && typeof p === "object" && p.automatic === false
    ? { automatic: false, publisherPlatforms: p.publisherPlatforms ?? [], facebookPositions: p.facebookPositions ?? [], instagramPositions: p.instagramPositions ?? [] }
    : { automatic: true };
  let ageMin = clampAge(a.ageMin, 18), ageMax = clampAge(a.ageMax, 65);
  if (ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];
  return { countries: countries.length ? countries : ["VN"], locations, ageMin, ageMax, genders: genders.length === 2 ? [] : genders, interests, placements, advantageAudience: def?.advantageAudience !== false };
}

/**
 * Audience size estimate — also the cheapest way to validate a targeting block: read-only, but Facebook checks the
 * whole block exactly as at adset creation.
 */
export async function estimateReach(token: string, actId: string, t: TargetingSpec, optimizationGoal = "POST_ENGAGEMENT") {
  const r = await graphGet(token, `${actId}/delivery_estimate`, { optimization_goal: optimizationGoal, targeting_spec: buildTargeting(t) });
  const d = r.data?.[0];
  return { lower: Number(d?.estimate_mau_lower_bound ?? 0), upper: Number(d?.estimate_mau_upper_bound ?? 0) };
}

export async function searchInterests(token: string, q: string): Promise<(Interest & { audience: number })[]> {
  const r = await graphGet(token, "search", { type: "adinterest", q, limit: "25", locale: "vi_VN" });
  return (r.data ?? []).filter((x: any) => x.id).map((x: any) => ({ id: String(x.id), name: String(x.name), audience: Number(x.audience_size_lower_bound ?? 0) }));
}

export async function searchLocations(token: string, q: string, country = "VN"): Promise<GeoLocation[]> {
  const r = await graphGet(token, "search", { type: "adgeolocation", location_types: '["city","region"]', q, limit: "25", country_code: country, locale: "vi_VN" });
  return (r.data ?? []).filter((x: any) => x.key && (x.type === "city" || x.type === "region"))
    .map((x: any) => ({ type: x.type, key: String(x.key), name: x.region && x.type === "city" ? `${x.name}, ${x.region}` : String(x.name) }));
}

export async function listPixels(token: string, actId: string): Promise<{ id: string; name: string; lastFired: string | null }[]> {
  const r = await graphGet(token, `${actId}/adspixels`, { fields: "id,name,last_fired_time", limit: 50 });
  return (r.data ?? []).map((p: any) => ({ id: String(p.id), name: String(p.name ?? p.id), lastFired: p.last_fired_time ?? null }));
}
