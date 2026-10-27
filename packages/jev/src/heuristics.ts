// Offline stand-ins that return the exact Jev answer shapes. They are deliberately simple
// and transparent; they exist so the system runs without a key, not to compete with Jev.

/** Lowercase + strip Vietnamese diacritics for robust keyword matching. */
export function vn(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
}
/** Token-boundary phrase match (diacritic-stripped short words like "tệ"→"te" must not match inside "system"). */
const tokens = (s: string) => ` ${vn(s).replace(/[^a-z0-9%]+/g, " ").trim()} `;
export function hasAny(text: string, words: string[]): boolean {
  const t = tokens(text);
  return words.some((w) => t.includes(tokens(w)));
}
export function countAny(text: string, words: string[]): number {
  const t = tokens(text);
  return words.filter((w) => t.includes(tokens(w))).length;
}

/** Forbidden phrases that appear un-negated ("không cam kết kết quả" is the approved wording, not a claim). */
export function forbiddenHits(text: string, phrases: string[]): string[] {
  const t = vn(text);
  return phrases.filter((ph) => {
    const p = vn(ph);
    let i = t.indexOf(p);
    while (i >= 0) {
      const before = t.slice(Math.max(0, i - 16), i);
      if (!/(khong|chang|tuyet doi khong|khong he|khong bao gio)\s*$/.test(before)) return true;
      i = t.indexOf(p, i + p.length);
    }
    return false;
  });
}

export const hNoul = (p: number) => ({ type: "noul" as const, noul: clamp01(p) });

export function hChoice<K extends string>(options: readonly K[], winner: K, p = 0.7) {
  const rest = (1 - p) / Math.max(1, options.length - 1);
  const probabilities = Object.fromEntries(options.map((o) => [o, o === winner ? p : rest])) as Record<K, number>;
  const n = options.length;
  return { type: "choice" as const, choice: winner, probabilities, confidence: clamp01((n * p - 1) / (n - 1)) };
}

/** Score answer centred on `value` (0..1 normalized) across n levels. */
export function hScore(n: number, value: number, spread = 0.25) {
  const target = clamp01(value) * (n - 1);
  const lo = Math.floor(target);
  const hi = Math.min(n - 1, lo + 1);
  const wHi = target - lo;
  const probs: Record<string, number> = {};
  for (let i = 0; i < n; i++) probs[String(i)] = 0;
  probs[String(lo)] += (1 - wHi) * (1 - spread);
  probs[String(hi)] += wHi * (1 - spread);
  for (let i = 0; i < n; i++) probs[String(i)] += spread / n;
  const score = Object.entries(probs).reduce((a, [k, p]) => a + Number(k) * p, 0);
  const peak = Math.max(...Object.values(probs));
  return {
    type: "score" as const,
    score,
    probabilities: probs,
    confidence: clamp01((n * peak - 1) / (n - 1)),
    legend: Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), `level ${i}`])),
  };
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
