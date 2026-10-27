import { useEffect, useMemo, useRef, useState } from "react";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation } from "d3-force";

/**
 * "Mạng trí nhớ" of Agentic Brain: one dot per note, lines = [[links]]. Notes gather by region (note type / folder);
 * each region shows a pill label at its centre. Canvas (thousands of notes stay smooth).
 * Wheel = zoom, drag = pan, double-click = reset, click a dot = open the note; `focus` highlights one region.
 */
export type GNode = { id: string; title: string; cluster: string; degree: number; mtime: string; x?: number; y?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null };
export type GLink = { source: string | GNode; target: string | GNode };
const PALETTE: Record<string, string> = {
  "Tổng quan": "#ef4444", "Hộp thư": "#64748b", "Nhật ký": "#f97316", "Kế hoạch": "#14b8a6", "Thương hiệu": "#a855f7", "Thị trường": "#0891b2",
  "Chiến dịch": "#f59e0b", "Nội dung": "#10b981", "Video": "#e11d48", "Quảng cáo": "#2563eb", "Bán hàng": "#16a34a", "Review": "#d97706",
  "Feedback loop": "#7c3aed", "Số liệu": "#0d9488", "Tri thức": "#0ea5e9", "Quy trình": "#8b5cf6", "Đội AI": "#ec4899", "Ý tưởng": "#6366f1",
  "Mẫu thắng": "#eab308", "Lưu trữ": "#94a3b8", "Tệp": "#a3a3a3",
};
const EXTRA = ["#0ea5e9", "#84cc16", "#f43f5e", "#a855f7", "#14b8a6", "#f59e0b", "#6366f1", "#ec4899"];
export const clusterColor = (key: string) => PALETTE[key] ?? EXTRA[[...key].reduce((a, c) => a + c.charCodeAt(0), 0) % EXTRA.length];

export function BrainGraph({ nodes, links, clusters, onOpen, showLabels, recentHours, focus }: {
  nodes: GNode[]; links: GLink[]; clusters: { key: string; count: number; pct: number }[];
  onOpen: (path: string) => void; showLabels: boolean; recentHours: number | null; focus: string | null;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const view = useRef({ k: 1, x: 0, y: 0 });
  const hover = useRef<GNode | null>(null);
  const sim = useRef<Simulation<GNode, undefined> | null>(null);
  const [, force] = useState(0);
  const draw = useRef<() => void>(() => {});

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(200, e.contentRect.width), h: Math.max(200, e.contentRect.height) }));
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  // Region centres on a ring; neighbours alternate sides so big regions don't sit next to each other.
  const anchors = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    const n = clusters.length;
    const rx = Math.min(size.w * 0.3, 420), ry = Math.min(size.h * 0.3, 260);
    clusters.forEach((c, i) => {
      const a = -Math.PI / 2 + (n > 1 ? (i / n) * Math.PI * 2 : 0) + (i % 2 ? Math.PI / n : 0);
      m.set(c.key, { x: Math.cos(a) * rx, y: Math.sin(a) * ry });
    });
    return m;
  }, [clusters, size.w, size.h]);

  const nodesRef = useRef<GNode[]>([]);
  useEffect(() => {
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    const ns = nodes.map((n) => {
      const p = prev.get(n.id);
      const a = anchors.get(n.cluster);
      return { ...n, x: p?.x ?? (a?.x ?? 0) + (Math.random() - 0.5) * 60, y: p?.y ?? (a?.y ?? 0) + (Math.random() - 0.5) * 60 };
    });
    nodesRef.current = ns;
    const ids = new Set(ns.map((n) => n.id));
    const ls = links.filter((l) => ids.has(String((l.source as any).id ?? l.source)) && ids.has(String((l.target as any).id ?? l.target))).map((l) => ({ source: String((l.source as any).id ?? l.source), target: String((l.target as any).id ?? l.target) }));
    sim.current?.stop();
    const s = forceSimulation<GNode>(ns)
      .force("link", forceLink<GNode, any>(ls).id((d) => d.id).distance(22).strength(0.03))
      .force("charge", forceManyBody<GNode>().strength(-10).distanceMax(180))
      .force("x", forceX<GNode>((d) => anchors.get(d.cluster)?.x ?? 0).strength(0.09))
      .force("y", forceY<GNode>((d) => anchors.get(d.cluster)?.y ?? 0).strength(0.09))
      .force("collide", forceCollide<GNode>((d) => 3 + Math.sqrt(d.degree)))
      .alpha(prev.size ? 0.4 : 1).alphaDecay(0.03)
      .on("tick", () => draw.current());
    (s as any).__links = ls;
    sim.current = s;
    return () => { s.stop(); };
  }, [nodes, links, anchors]);

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };
  draw.current = () => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== size.w * dpr) { c.width = size.w * dpr; c.height = size.h * dpr; }
    const ctx = c.getContext("2d")!;
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--ink").trim() || "#1f2937";
    const dark = document.documentElement.classList.contains("dark");
    const { k, x: tx, y: ty } = view.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.translate(size.w / 2 + tx, size.h / 2 + ty);
    ctx.scale(k, k);
    const h = hover.current;
    const neighbors = new Set<string>();
    const ls = ((sim.current as any)?.__links ?? []) as { source: GNode; target: GNode }[];
    if (h) for (const l of ls) { if (l.source.id === h.id) neighbors.add(l.target.id); if (l.target.id === h.id) neighbors.add(l.source.id); }
    const dim = (n: GNode) => (h ? n.id !== h.id && !neighbors.has(n.id) : focus ? n.cluster !== focus : false);
    // links: gently curved
    ctx.lineWidth = 0.7 / k;
    for (const l of ls) {
      if (l.source.x == null || l.target.x == null) continue;
      const on = h && (l.source.id === h.id || l.target.id === h.id);
      const faded = dim(l.source) && dim(l.target);
      ctx.strokeStyle = on ? clusterColor(l.source.cluster) : faded ? (dark ? "rgba(148,163,184,0.04)" : "rgba(100,116,139,0.05)") : (dark ? "rgba(148,163,184,0.14)" : "rgba(99,102,241,0.13)");
      const mx = (l.source.x + l.target.x) / 2, my = (l.source.y! + l.target.y!) / 2;
      ctx.beginPath(); ctx.moveTo(l.source.x, l.source.y!); ctx.quadraticCurveTo(mx + (l.target.y! - l.source.y!) * 0.12, my - (l.target.x - l.source.x) * 0.12, l.target.x, l.target.y!); ctx.stroke();
    }
    // nodes: soft halo + core
    const recentCut = recentHours ? Date.now() - recentHours * 3600_000 : null;
    const centroid = new Map<string, { x: number; y: number; n: number }>();
    for (const n of nodesRef.current) {
      if (n.x == null) continue;
      const cc = centroid.get(n.cluster) ?? { x: 0, y: 0, n: 0 };
      cc.x += n.x; cc.y += n.y!; cc.n++; centroid.set(n.cluster, cc);
      const r = 2.2 + Math.sqrt(n.degree) * 0.9;
      const recent = recentCut && new Date(n.mtime).getTime() > recentCut;
      ctx.globalAlpha = dim(n) ? 0.14 : recentCut && !recent ? 0.3 : 1;
      const col = clusterColor(n.cluster);
      ctx.fillStyle = `${col}33`;
      ctx.beginPath(); ctx.arc(n.x, n.y!, r + 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(n.x, n.y!, n.id === h?.id ? r + 1.8 : r, 0, Math.PI * 2); ctx.fill();
      if (recent) { ctx.strokeStyle = "#8b5cf6"; ctx.lineWidth = 1.3 / k; ctx.beginPath(); ctx.arc(n.x, n.y!, r + 4, 0, Math.PI * 2); ctx.stroke(); }
      if (n.id === h?.id || (h && neighbors.has(n.id) && k > 0.9) || (k > 1.8 && !dim(n))) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = ink;
        ctx.font = `${(n.id === h?.id ? 12 : 10) / k}px "Be Vietnam Pro", system-ui`;
        ctx.fillText(n.title.slice(0, 48), n.x + r + 4, n.y! + 3 / k);
      }
    }
    ctx.globalAlpha = 1;
    // region pills at each region's centre
    if (showLabels) {
      const counts = new Map(clusters.map((c) => [c.key, c.count]));
      for (const [key, cc] of centroid) {
        if (focus ? key !== focus : (counts.get(key) ?? cc.n) < 2) continue; // tiny regions: label on focus only
        const x = cc.x / cc.n, y = cc.y / cc.n - 14;
        const label = `${key} · ${counts.get(key) ?? cc.n}`;
        ctx.font = `600 ${11.5 / k}px "Be Vietnam Pro", system-ui`;
        const w = ctx.measureText(label).width + 26 / k, hh = 22 / k;
        ctx.fillStyle = dark ? "rgba(18,26,43,0.92)" : "rgba(255,255,255,0.92)";
        roundRect(ctx, x - w / 2, y - hh / 2, w, hh, hh / 2); ctx.fill();
        ctx.strokeStyle = clusterColor(key); ctx.lineWidth = 1.2 / k; ctx.stroke();
        ctx.fillStyle = clusterColor(key);
        ctx.beginPath(); ctx.arc(x - w / 2 + 11 / k, y, 3.5 / k, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = ink; ctx.textAlign = "left";
        ctx.fillText(label, x - w / 2 + 19 / k, y + 4 / k);
      }
    }
  };
  useEffect(() => { draw.current(); }, [size, showLabels, recentHours, clusters, focus]);

  const toWorld = (cx: number, cy: number) => {
    const r = canvas.current!.getBoundingClientRect();
    const { k, x, y } = view.current;
    return { x: (cx - r.left - size.w / 2 - x) / k, y: (cy - r.top - size.h / 2 - y) / k };
  };
  const pick = (cx: number, cy: number) => {
    const p = toWorld(cx, cy);
    let best: GNode | null = null, bd = (9 / view.current.k) ** 2;
    for (const n of nodesRef.current) {
      if (n.x == null) continue;
      const d = (n.x - p.x) ** 2 + (n.y! - p.y) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  };
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  return (
    <div ref={wrap} className="absolute inset-0">
      <canvas
        ref={canvas} style={{ width: size.w, height: size.h, cursor: hover.current ? "pointer" : drag.current ? "grabbing" : "grab" }}
        onWheel={(e) => {
          const r = canvas.current!.getBoundingClientRect();
          const v = view.current;
          const k2 = Math.min(6, Math.max(0.25, v.k * (e.deltaY < 0 ? 1.12 : 0.89)));
          const mx = e.clientX - r.left - size.w / 2, my = e.clientY - r.top - size.h / 2;
          v.x = mx - ((mx - v.x) * k2) / v.k; v.y = my - ((my - v.y) * k2) / v.k; v.k = k2;
          draw.current();
        }}
        onMouseDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, moved: false }; }}
        onMouseMove={(e) => {
          if (drag.current) {
            const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
            view.current.x += dx; view.current.y += dy;
            drag.current.x = e.clientX; drag.current.y = e.clientY;
            draw.current();
            return;
          }
          const n = pick(e.clientX, e.clientY);
          if (n !== hover.current) { hover.current = n; draw.current(); force((x) => x + 1); }
        }}
        onMouseUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved) { const n = pick(e.clientX, e.clientY); if (n) onOpen(n.id); }
        }}
        onMouseLeave={() => { drag.current = null; if (hover.current) { hover.current = null; draw.current(); } }}
        onDoubleClick={() => { view.current = { k: 1, x: 0, y: 0 }; draw.current(); }}
      />
      {hover.current && (
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-sm rounded-xl border border-line bg-card/95 px-3 py-2 text-xs shadow">
          <p className="flex items-center gap-1.5 font-semibold text-ink"><span className="h-2 w-2 rounded-full" style={{ background: clusterColor(hover.current.cluster) }} />{hover.current.title}</p>
          <p className="text-muted">{hover.current.id} · {hover.current.degree} liên kết</p>
        </div>
      )}
    </div>
  );
}
