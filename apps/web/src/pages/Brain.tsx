import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bot, BrainCircuit, CalendarDays, ChevronDown, ChevronRight, Clock, FilePlus2, FileText, Folder, FolderOpen, FolderPlus, Layers, Loader2,
  Mic, MicOff, PanelLeftClose, PanelLeftOpen, Paperclip, Plus, RefreshCw, Search, SendHorizontal, Sparkles, Tag, Trash2, Workflow, X,
} from "lucide-react";
import { api, useApi, useEvents } from "../lib/api";
import { timeAgo } from "../lib/format";
import { useSpeech } from "../lib/speech";
import { BrainGraph, clusterColor } from "../components/BrainGraph";
import { NoteView } from "../components/NoteView";
import { Button, Modal, cx, inputCls, useToast } from "../components/ui";

/**
 * Agentic Brain — the company's memory (Markdown vault, Obsidian-compatible), in ZONO's own look:
 * left = "Ngăn trí nhớ" (folders + search), centre = "Mạng trí nhớ" (graph) or the open note, right = "Vùng trí nhớ"
 * (regions with share bars, click to highlight), bottom = command bar to Hiền An (voice, attach, drop files).
 */
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } } };
const ask = (text: string) => window.dispatchEvent(new CustomEvent("nguyet:ask", { detail: text }));
const readFile = (f: File) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });

export function Brain() {
  const [params, setParams] = useSearchParams();
  const vaults = useApi<any>("brain/vaults", ["brain."]);
  const vault: string | null = vaults.data?.active ?? null;
  const cur = vaults.data?.vaults?.find((v: any) => v.id === vault);
  const tree = useApi<any>(vault ? `brain/${vault}/tree` : null);
  const graph = useApi<any>(vault ? `brain/${vault}/graph` : null);
  const stats = useApi<any>(vault ? `brain/${vault}/stats` : null);
  const [open, setOpen] = useState<string | null>(params.get("note"));
  const [side, setSide] = useState(store.get("brain.side") !== "0");
  const [labels, setLabels] = useState(true);
  const [focus, setFocus] = useState<string | null>(null);
  const [recentOnly, setRecentOnly] = useState(false);
  const [history, setHistory] = useState(false);
  const [newVault, setNewVault] = useState(false);
  const [newNote, setNewNote] = useState<{ folder: string } | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [removeVault, setRemoveVault] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const toast = useToast();
  const folders = useMemo(() => folderList(tree.data), [tree.data]);
  useEffect(() => store.set("brain.side", side ? "1" : "0"), [side]);
  useEffect(() => { if (open) setParams({ note: open }, { replace: true }); else setParams({}, { replace: true }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // Links like /brain?note=… from elsewhere (reminders, Hiền An) while already on this page
  const pn = params.get("note");
  useEffect(() => { if (pn !== open) setOpen(pn); }, [pn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live: files changed (agents, Obsidian, Finder) → refresh tree/graph/stats (debounced)
  const t = useRef<number | null>(null);
  useEvents((e) => {
    if (e.type !== "brain.updated" || (e.payload?.vaultId && e.payload.vaultId !== vault)) return;
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(() => { tree.reload(); graph.reload(); stats.reload(); vaults.reload(); }, 600);
  });

  // [[link]] → path (same rule as the server: full path, then file name)
  const resolver = useMemo(() => {
    const byPath = new Map<string, string>(), byBase = new Map<string, string>();
    for (const n of graph.data?.nodes ?? []) {
      const p = n.id.replace(/\.md$/i, "").toLowerCase();
      byPath.set(p, n.id);
      const b = p.split("/").pop()!;
      if (!byBase.has(b)) byBase.set(b, n.id);
    }
    return (target: string) => { const t = target.replace(/\.md$/i, "").toLowerCase(); return byPath.get(t) ?? byBase.get(t.split("/").pop()!) ?? null; };
  }, [graph.data]);

  // /brain?link=<Tên ghi chú> (from [[links]] in Hiền An's chat) → open once the graph is known
  const linkParam = params.get("link");
  useEffect(() => {
    if (!linkParam || !graph.data) return;
    const hit = resolver(linkParam);
    if (hit) setOpen(hit);
    else toast(`Chưa có ghi chú "${linkParam}" trong Agentic Brain`, "err");
    setParams(hit ? { note: hit } : {}, { replace: true });
  }, [linkParam, graph.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (files: FileList | File[], folder?: string) => {
    if (!vault) return;
    let last: string | null = null;
    for (const f of Array.from(files).slice(0, 20)) {
      try { const r = await api.post(`/v1/brain/${vault}/upload`, { name: f.name, data: await readFile(f), folder }); last = r.path; } catch (e: any) { toast(`${f.name}: ${e.message}`, "err"); }
    }
    if (last) { toast("Đã lưu vào Agentic Brain · Hộp thư"); setOpen(last); }
  };
  const daily = async () => { if (!vault) return; try { const r = await api.post(`brain/${vault}/daily`); setOpen(r.path); } catch (e: any) { toast(e.message, "err"); } };
  const rescan = async () => { if (!vault) return; setSyncing(true); try { const r = await api.post(`brain/vaults/${vault}/rescan`); toast(`Đã đồng bộ: +${r.added} mới · ${r.changed} cập nhật · ${r.removed} gỡ`); } catch (e: any) { toast(e.message, "err"); } finally { setSyncing(false); } };

  const nodes = graph.data?.nodes ?? [];
  const clusters: any[] = graph.data?.clusters ?? [];
  // Fill exactly the space under the app header (long side lists scroll instead of stretching the page)
  const root = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const fit = () => { if (root.current) setHeight(Math.max(420, window.innerHeight - root.current.getBoundingClientRect().top)); };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div ref={root} style={height ? { height } : undefined} className="-m-4 flex flex-col overflow-hidden bg-page md:-m-6"
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDropping(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDropping(false); }}
      onDrop={(e) => { e.preventDefault(); setDropping(false); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-gradient-to-r from-indigo-500/[0.06] via-violet-500/[0.06] to-fuchsia-500/[0.06] px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-sm"><BrainCircuit className="h-5 w-5" /></span>
        <div className="leading-tight">
          <p className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-lg font-extrabold text-transparent">Agentic Brain</p>
          <p className="text-[11px] text-muted">Trí nhớ chung của Sếp và đội AI</p>
        </div>
        <div className="relative ml-2">
          <select value={vault ?? ""} onChange={async (e) => { await api.post(`brain/vaults/${e.target.value}/activate`); setOpen(null); vaults.reload(); }}
            className="appearance-none rounded-full border border-violet-300/60 bg-card py-1.5 pl-3.5 pr-8 text-sm font-medium text-ink dark:border-violet-500/30" title="Chọn kho trí nhớ">
            {(vaults.data?.vaults ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted" />
        </div>
        <div className="flex items-center rounded-full border border-line bg-card">
          <button onClick={() => setNewVault(true)} className="rounded-l-full px-2.5 py-1.5 text-muted hover:bg-soft" title="Thêm kho trí nhớ (tạo mới hoặc nối thư mục Obsidian có sẵn)"><Plus className="h-4 w-4" /></button>
          <button onClick={() => vault && api.post(`brain/vaults/${vault}/open`)} className="border-x border-line px-2.5 py-1.5 text-muted hover:bg-soft" title="Mở kho trong Finder / Obsidian"><FolderOpen className="h-4 w-4" /></button>
          <button onClick={() => setRemoveVault(true)} className="rounded-r-full px-2.5 py-1.5 text-muted hover:bg-soft" title="Gỡ kho khỏi hệ thống (giữ nguyên file)"><Trash2 className="h-4 w-4" /></button>
        </div>
        {stats.data && (
          <div className="hidden items-center gap-1.5 lg:flex">
            {[[FileText, `${stats.data.notes} ghi chú`], [Layers, `${stats.data.links} liên kết`], [Bot, `${stats.data.agents} trợ lý AI`], [Sparkles, `${stats.data.skills} kỹ năng`], [Workflow, `${stats.data.workflows} quy trình tự động`]].map(([I, t]: any) => (
              <span key={t} className="flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs text-muted ring-1 ring-line"><I className="h-3.5 w-3.5 text-violet-500" />{t}</span>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <button onClick={daily} className="flex items-center gap-1.5 rounded-full bg-violet-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"><CalendarDays className="h-4 w-4" />Hôm nay</button>
        <button onClick={rescan} className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-sm text-ink hover:bg-soft" title="Đồng bộ lại với file trên máy"><RefreshCw className={cx("h-4 w-4", syncing && "animate-spin")} />Đồng bộ</button>
        <button onClick={() => setHistory((h) => !h)} className={cx("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm", history ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300" : "border-line bg-card text-ink hover:bg-soft")}><Clock className="h-4 w-4" />Vừa cập nhật</button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {side ? (
          <div className="flex min-h-0 w-72 shrink-0 flex-col border-r border-line bg-card">
            <VaultPanel vault={vault} tree={tree.data} openPath={open} onOpen={setOpen} onNewNote={(folder) => setNewNote({ folder })} onNewFolder={() => setNewFolder(true)} onRescan={rescan} onCollapse={() => setSide(false)} />
          </div>
        ) : (
          <button onClick={() => setSide(true)} className="m-2 h-9 self-start rounded-lg border border-line bg-card p-2 text-muted hover:bg-soft" title="Mở ngăn trí nhớ"><PanelLeftOpen className="h-4 w-4" /></button>
        )}

        {/* Centre: memory network or the open note */}
        <div className="relative min-w-0 flex-1 overflow-hidden" style={{ backgroundImage: "radial-gradient(circle, rgba(139,92,246,0.10) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
          {open && vault ? (
            <div className="absolute inset-0 bg-card"><NoteView vault={vault} path={open} onOpen={setOpen} onClose={() => setOpen(null)} onAsk={ask} resolve={resolver} /></div>
          ) : !graph.data ? (
            <div className="grid h-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
          ) : (
            <>
              <BrainGraph nodes={nodes} links={graph.data.links} clusters={clusters} onOpen={setOpen} showLabels={labels} recentHours={recentOnly ? 48 : null} focus={focus} />
              <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-line bg-card/95 p-1 text-xs shadow-sm">
                <span className="px-2 font-semibold text-ink">Mạng trí nhớ</span>
                <button onClick={() => setLabels((v) => !v)} className={cx("flex items-center gap-1 rounded-full px-2.5 py-1", labels ? "bg-violet-600 text-white" : "text-muted hover:bg-soft")}><Tag className="h-3.5 w-3.5" />Tên vùng</button>
                <button onClick={() => setRecentOnly((v) => !v)} className={cx("flex items-center gap-1 rounded-full px-2.5 py-1", recentOnly ? "bg-violet-600 text-white" : "text-muted hover:bg-soft")}><Clock className="h-3.5 w-3.5" />Mới 48 giờ</button>
              </div>
              <p className="pointer-events-none absolute bottom-3 right-3 text-[11px] text-muted">Cuộn để phóng to · kéo để di chuyển · nhấp đúp để về giữa</p>
              {!nodes.length && <p className="absolute inset-x-0 top-1/3 text-center text-sm text-muted">Agentic Brain đang trống — thả file vào đây, tạo ghi chú mới, hoặc bấm "Hôm nay".</p>}
            </>
          )}
          {dropping && <div className="pointer-events-none absolute inset-3 grid place-items-center rounded-2xl border-2 border-dashed border-violet-400 bg-violet-500/10 text-lg font-semibold text-violet-700 dark:text-violet-200">Thả file để lưu vào Hộp thư của Agentic Brain</div>}
        </div>

        {/* Right: memory regions (or recent changes) */}
        {history && vault ? <HistoryDrawer vault={vault} onOpen={setOpen} onClose={() => setHistory(false)} /> : !open && clusters.length > 0 && (
          <div className="hidden min-h-0 w-64 shrink-0 flex-col border-l border-line bg-card xl:flex">
            <div className="px-4 pb-2 pt-4"><p className="text-sm font-bold text-ink">Vùng trí nhớ</p><p className="text-[11px] text-muted">Bấm một vùng để làm nổi trên mạng</p></div>
            <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-3 scroll-thin">
              {clusters.map((c) => (
                <button key={c.key} onClick={() => setFocus((f) => (f === c.key ? null : c.key))} className={cx("block w-full rounded-xl px-2.5 py-2 text-left", focus === c.key ? "bg-violet-500/10 ring-1 ring-violet-400/50" : "hover:bg-soft")}>
                  <div className="flex items-center gap-2 text-[13px]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: clusterColor(c.key) }} /><span className="flex-1 font-medium text-ink">{c.key}</span><span className="tabular-nums text-muted">{c.count}</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full" style={{ width: `${Math.max(3, c.pct)}%`, background: clusterColor(c.key) }} /></div>
                  <p className="mt-0.5 text-right text-[10px] text-muted">{c.pct}% trí nhớ</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <AskBar vault={vault} openPath={open} onUpload={upload} />

      <NewVaultModal open={newVault} onClose={() => setNewVault(false)} onDone={() => { setNewVault(false); setOpen(null); vaults.reload(); }} />
      <NewNoteModal vault={vault} folders={folders} init={newNote} onClose={() => setNewNote(null)} onDone={(p) => { setNewNote(null); setOpen(p); }} />
      <NewFolderModal vault={vault} open={newFolder} onClose={() => setNewFolder(false)} onDone={() => { setNewFolder(false); tree.reload(); }} />
      <Modal open={removeVault} onClose={() => setRemoveVault(false)} title={`Gỡ kho "${cur?.name ?? ""}" khỏi hệ thống?`} footer={<><Button variant="ghost" onClick={() => setRemoveVault(false)}>Hủy</Button><Button variant="danger" onClick={async () => { try { await api.del(`brain/vaults/${vault}`); toast("Đã gỡ — toàn bộ file vẫn còn nguyên trên máy"); setRemoveVault(false); setOpen(null); vaults.reload(); } catch (e: any) { toast(e.message, "err"); } }}>Gỡ khỏi hệ thống</Button></>}>
        <p className="text-sm">Hệ thống ngừng đọc/ghi kho trí nhớ này. <b>Không xóa file nào</b>: thư mục <code className="break-all text-xs">{cur?.path}</code> vẫn còn, có thể nối lại bất cứ lúc nào bằng nút +.</p>
      </Modal>
    </div>
  );
}

function folderList(tree: any): string[] {
  const out: string[] = [];
  const walk = (n: any) => { for (const c of n?.children ?? []) if (c.type === "folder") { out.push(c.path); walk(c); } };
  walk(tree);
  return out;
}

function VaultPanel({ vault, tree, openPath, onOpen, onNewNote, onNewFolder, onRescan, onCollapse }: { vault: string | null; tree: any; openPath: string | null; onOpen: (p: string) => void; onNewNote: (folder: string) => void; onNewFolder: () => void; onRescan: () => void; onCollapse: () => void }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"name" | "content">("name");
  const [results, setResults] = useState<any[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(JSON.parse(store.get("brain.expanded") ?? "[]")));
  useEffect(() => store.set("brain.expanded", JSON.stringify([...expanded])), [expanded]);
  useEffect(() => {
    if (!q.trim() || !vault) { setResults(null); return; }
    const h = window.setTimeout(() => { api.get(`brain/${vault}/search?q=${encodeURIComponent(q)}&mode=${mode}`).then(setResults).catch(() => setResults([])); }, 220);
    return () => window.clearTimeout(h);
  }, [q, mode, vault]);
  // Reveal the open note's folders
  useEffect(() => {
    if (!openPath) return;
    const parts = openPath.split("/").slice(0, -1);
    setExpanded((s) => { const n = new Set(s); parts.forEach((_, i) => n.add(parts.slice(0, i + 1).join("/"))); return n; });
  }, [openPath]);
  const toggle = (p: string) => setExpanded((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });

  const Node = ({ n, depth }: { n: any; depth: number }) => n.type === "folder" ? (
    <div>
      <div className="group flex items-center rounded-lg hover:bg-soft" style={{ paddingLeft: depth * 12 }}>
        <button onClick={() => toggle(n.path)} className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pl-1 text-left text-[13.5px] text-ink">
          {expanded.has(n.path) ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />}
          {expanded.has(n.path) ? <FolderOpen className="h-4 w-4 shrink-0 text-violet-500" /> : <Folder className="h-4 w-4 shrink-0 text-violet-400/80" />}
          <span className="truncate">{n.name}</span>
          {n.count > 0 && <span className="ml-auto pr-1 text-[10px] text-muted">{n.count}</span>}
        </button>
        <button onClick={() => onNewNote(n.path)} className="hidden rounded p-1 text-muted hover:text-blue-600 group-hover:block" title="Ghi chú mới trong thư mục này"><FilePlus2 className="h-3.5 w-3.5" /></button>
      </div>
      {expanded.has(n.path) && n.children?.map((c: any) => <Node key={c.path} n={c} depth={depth + 1} />)}
    </div>
  ) : (
    <button onClick={() => onOpen(n.path)} style={{ paddingLeft: depth * 12 + 22 }} title={n.title}
      className={cx("flex w-full items-center gap-1.5 rounded-lg py-1 pr-2 text-left text-[13px]", openPath === n.path ? "bg-violet-500/10 font-medium text-violet-700 dark:text-violet-300" : "text-ink/80 hover:bg-soft")}>
      <FileText className="h-3.5 w-3.5 shrink-0 text-muted" /><span className="truncate">{n.name}</span>
    </button>
  );

  return (
    <>
      <div className="flex items-center gap-1 px-3 pb-2 pt-3">
        <p className="flex-1 text-sm font-bold text-ink">Ngăn trí nhớ</p>
        <button onClick={() => onNewNote("2. Hộp thư")} className="rounded-lg border border-line p-1.5 text-muted hover:bg-soft" title="Ghi chú mới"><Plus className="h-3.5 w-3.5" /></button>
        <button onClick={onNewFolder} className="rounded-lg border border-line p-1.5 text-muted hover:bg-soft" title="Thư mục mới"><FolderPlus className="h-3.5 w-3.5" /></button>
        <button onClick={onRescan} className="rounded-lg border border-line p-1.5 text-muted hover:bg-soft" title="Quét lại"><RefreshCw className="h-3.5 w-3.5" /></button>
        <button onClick={onCollapse} className="rounded-lg border border-line p-1.5 text-muted hover:bg-soft" title="Thu gọn"><PanelLeftClose className="h-3.5 w-3.5" /></button>
      </div>
      <div className="px-3">
        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm ghi chú (gõ không dấu cũng được)…" className={cx(inputCls, "pl-8")} />{q && <button onClick={() => setQ("")} className="absolute right-2 top-2.5 text-muted"><X className="h-4 w-4" /></button>}</div>
        <div className="mt-2 grid grid-cols-2 rounded-lg bg-soft p-0.5 text-xs">
          {([["name", "Theo tiêu đề"], ["content", "Toàn văn"]] as const).map(([k, l]) => <button key={k} onClick={() => setMode(k)} className={cx("rounded-md py-1", mode === k ? "bg-card font-semibold text-violet-700 shadow-sm dark:text-violet-300" : "text-muted")}>{l}</button>)}
        </div>
      </div>
      <div className="mt-2 flex-1 overflow-y-auto px-2 pb-3 scroll-thin">
        {results ? (
          results.length ? results.map((r) => (
            <button key={r.path} onClick={() => onOpen(r.path)} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-soft">
              <p className="truncate text-[13px] font-medium text-ink">{r.title}</p>
              <p className="truncate text-[10.5px] text-muted">{r.path}</p>
              {r.snippet && <p className="line-clamp-2 text-[11px] text-muted">{String(r.snippet).replace(/«/g, "").replace(/»/g, "")}</p>}
            </button>
          )) : <p className="p-3 text-xs text-muted">Không thấy ghi chú phù hợp.</p>
        ) : !tree ? <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-muted" /> : tree.children?.map((c: any) => <Node key={c.path} n={c} depth={0} />)}
      </div>
    </>
  );
}

function HistoryDrawer({ vault, onOpen, onClose }: { vault: string; onOpen: (p: string) => void; onClose: () => void }) {
  const { data } = useApi<any[]>(`brain/${vault}/recent?limit=60`, ["brain."]);
  return (
    <div className="flex min-h-0 w-72 shrink-0 flex-col border-l border-line bg-card">
      <div className="flex items-center justify-between px-3 py-3"><p className="text-sm font-bold text-ink">Vừa cập nhật</p><button onClick={onClose} className="text-muted"><X className="h-4 w-4" /></button></div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 scroll-thin">
        {!data ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted" /> : data.map((n) => (
          <button key={n.path} onClick={() => onOpen(n.path)} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-soft">
            <p className="truncate text-[13px] text-ink">{n.title}</p><p className="truncate text-[10.5px] text-muted">{timeAgo(n.mtime)} · {n.folder || "gốc"}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function AskBar({ vault, openPath, onUpload }: { vault: string | null; openPath: string | null; onUpload: (f: FileList | File[]) => void }) {
  const [text, setText] = useState("");
  const { data: info } = useApi<any>("assistant");
  const file = useRef<HTMLInputElement>(null);
  const speech = useSpeech((t) => setText((x) => (x ? `${x} ${t}` : t)));
  const send = () => {
    const msg = text.trim();
    if (!msg) return;
    ask(openPath ? `${msg}\n\n(Sếp đang xem ghi chú "${openPath}" trong Agentic Brain)` : msg);
    setText("");
  };
  return (
    <div className="border-t border-line bg-card px-4 pb-3 pt-2">
      <p className="mb-1.5 flex items-center gap-2 text-xs text-muted"><span className={cx("h-2 w-2 rounded-full", info?.ready ? "bg-emerald-500" : "bg-amber-500")} />Hiền An {info?.ready ? "sẵn sàng" : "chưa sẵn sàng"} · Claude CLI · {info?.settings?.model ?? info?.defaultModel ?? "…"}{openPath && <span className="truncate">· đang xem: {openPath}</span>}<button onClick={() => window.dispatchEvent(new CustomEvent("nguyet:open"))} className="ml-auto shrink-0 font-medium text-violet-600 hover:underline">Mở khung chat Hiền An</button></p>
      <div className="flex items-end gap-2">
        <button onClick={speech.toggle} disabled={!speech.supported} title={speech.supported ? (speech.listening ? "Dừng nghe" : "Nói (tiếng Việt)") : "Trình duyệt chưa hỗ trợ nhận giọng nói"}
          className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-full border", speech.listening ? "animate-pulse border-rose-400 bg-rose-500 text-white" : "border-line text-ink hover:bg-soft disabled:opacity-40")}>{speech.listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
        <button onClick={() => file.current?.click()} disabled={!vault} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line text-ink hover:bg-soft" title="Lưu file vào Hộp thư của Agentic Brain"><Paperclip className="h-5 w-5" /></button>
        <input ref={file} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) onUpload(e.target.files); e.target.value = ""; }} />
        <textarea rows={1} value={speech.interim ? `${text} ${speech.interim}` : text} onChange={(e) => setText(e.target.value)} placeholder="Giao việc, hỏi hoặc nhờ Hiền An ghi lại… (thả file vào để lưu)"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); onUpload(e.clipboardData.files); } }}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-line bg-card px-4 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-violet-400" />
        <button onClick={send} disabled={!text.trim()} className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"><SendHorizontal className="h-4 w-4" />Giao</button>
      </div>
    </div>
  );
}

function NewVaultModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [scaffold, setScaffold] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const go = async () => {
    setBusy(true);
    try { await api.post("brain/vaults", { name, path: path.trim() || undefined, scaffold }); toast("Đã thêm kho trí nhớ"); setName(""); setPath(""); onDone(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Thêm kho trí nhớ" footer={<><Button variant="ghost" onClick={onClose}>Hủy</Button><Button variant="primary" loading={busy} disabled={name.trim().length < 2} onClick={go}>Thêm</Button></>}>
      <div className="space-y-3 text-sm">
        <div><p className="mb-1 font-medium">Tên</p><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Agentic Brain · Đỗ Thu Trà" autoFocus /></div>
        <div><p className="mb-1 font-medium">Thư mục có sẵn (tùy chọn)</p><input className={inputCls} value={path} onChange={(e) => setPath(e.target.value)} placeholder="/Users/…/Obsidian/… — để trống = tạo kho mới đủ 20 ngăn" /></div>
        {path.trim() && <label className="flex items-center gap-2"><input type="checkbox" checked={scaffold} onChange={(e) => setScaffold(e.target.checked)} />Thêm 20 ngăn chuẩn (1. Tổng quan … 20. Tệp & hình ảnh) nếu chưa có</label>}
        <p className="text-xs text-muted">Agentic Brain lưu bằng file Markdown thường — mở được bằng Obsidian. Nối thư mục Obsidian có sẵn: hệ thống đọc tất cả ghi chú, không đổi gì nếu không được bảo.</p>
      </div>
    </Modal>
  );
}
const TEMPLATE_DIR = "16. Sổ tay quy trình/Mẫu ghi chú";
function NewNoteModal({ vault, folders, init, onClose, onDone }: { vault: string | null; folders: string[]; init: { folder: string } | null; onClose: () => void; onDone: (p: string) => void }) {
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("2. Hộp thư");
  const [tpl, setTpl] = useState("");
  const [templates, setTemplates] = useState<{ path: string; title: string }[]>([]);
  const toast = useToast();
  useEffect(() => {
    if (!init) return;
    setFolder(init.folder); setTitle(""); setTpl("");
    if (vault) api.get(`brain/${vault}/tree`).then((t) => {
      const dir = (function find(n: any): any { if (n.path === TEMPLATE_DIR) return n; for (const c of n.children ?? []) { const f = find(c); if (f) return f; } return null; })(t);
      setTemplates((dir?.children ?? []).filter((c: any) => c.type === "note").map((c: any) => ({ path: c.path, title: c.title })));
    }).catch(() => {});
  }, [init, vault]);
  const go = async () => {
    try {
      let content: string | undefined;
      if (tpl) { const n = await api.get(`brain/${vault}/note?path=${encodeURIComponent(tpl)}`); content = String(n.content).replace(/^---[\s\S]*?---\n?/, "").replace(/^#\s.*\n+/, ""); }
      const r = await api.post(`brain/${vault}/note`, { folder, title, content });
      onDone(r.path);
    } catch (e: any) { toast(e.message, "err"); }
  };
  return (
    <Modal open={!!init} onClose={onClose} title="Ghi chú mới" footer={<><Button variant="ghost" onClick={onClose}>Hủy</Button><Button variant="primary" disabled={!title.trim()} onClick={go}>Tạo</Button></>}>
      <div className="space-y-3 text-sm">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && title.trim() && go()} placeholder="Tên ghi chú" autoFocus />
        <select className={inputCls} value={folder} onChange={(e) => setFolder(e.target.value)}>{folders.map((f) => <option key={f} value={f}>{f}</option>)}</select>
        <select className={inputCls} value={tpl} onChange={(e) => setTpl(e.target.value)}>
          <option value="">Ghi chú trống</option>
          {templates.map((t) => <option key={t.path} value={t.path}>Dùng mẫu: {t.title}</option>)}
        </select>
      </div>
    </Modal>
  );
}
function NewFolderModal({ vault, open, onClose, onDone }: { vault: string | null; open: boolean; onClose: () => void; onDone: () => void }) {
  const [path, setPath] = useState("");
  const toast = useToast();
  const go = async () => { try { await api.post(`brain/${vault}/folder`, { path }); setPath(""); onDone(); } catch (e: any) { toast(e.message, "err"); } };
  return (
    <Modal open={open} onClose={onClose} title="Thư mục mới" footer={<><Button variant="ghost" onClick={onClose}>Hủy</Button><Button variant="primary" disabled={!path.trim()} onClick={go}>Tạo</Button></>}>
      <input className={inputCls} value={path} onChange={(e) => setPath(e.target.value)} onKeyDown={(e) => e.key === "Enter" && path.trim() && go()} placeholder="7. Chiến dịch/Chiến dịch Tết 2027" autoFocus />
    </Modal>
  );
}
