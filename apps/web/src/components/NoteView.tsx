import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, BookOpen, FolderOpen, Link2, Loader2, Moon, Pencil, Save, Tag, Trash2, Type } from "lucide-react";
import { api, useApi, useEvents } from "../lib/api";
import { timeAgo } from "../lib/format";
import { Badge, Modal, Button, cx, inputCls, useToast } from "./ui";

/** Strip front matter + system markers, turn [[wikilinks]] / ![[embeds]] into Markdown links the renderer understands. */
function prepare(content: string, vault: string) {
  let body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  body = body.replace(/^<!-- \/?zono:auto -->\s*$/gm, "");
  body = body.replace(/!\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]/g, (_m, t) => /\.(png|jpe?g|gif|webp|svg)$/i.test(t) ? `![${t}](/v1/brain/${vault}/file?path=${encodeURIComponent(t)})` : `[📎 ${t}](wiki:${encodeURIComponent(t)})`);
  body = body.replace(/\[\[([^\]|#^]+)(?:[#^][^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t, alias) => `[${(alias ?? t.split("/").pop()).replace(/[[\]]/g, "")}](wiki:${encodeURIComponent(t.trim())})`);
  return body;
}

export function NoteView({ vault, path, onOpen, onClose, onAsk, resolve }: {
  vault: string; path: string; onOpen: (p: string) => void; onClose: () => void; onAsk: (text: string) => void; resolve: (target: string) => string | null;
}) {
  const { data, reload, error } = useApi<any>(`brain/${vault}/note?path=${encodeURIComponent(path)}`);
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rename, setRename] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const toast = useToast();
  const timer = useRef<number | null>(null);
  useEffect(() => { setMode("read"); setDirty(false); }, [path]);
  useEffect(() => { if (data && !dirty) setText(data.content); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  // External change (system / Obsidian) while reading → refresh
  useEvents((e) => { if (e.type === "brain.updated" && (!e.payload?.path || e.payload.path === path) && !dirty) reload(); });

  const save = async (content = text) => {
    setSaving(true);
    try { await api.put(`brain/${vault}/note`, { path, content }); setDirty(false); } catch (e: any) { toast(e.message, "err"); } finally { setSaving(false); }
  };
  const onEdit = (v: string) => {
    setText(v); setDirty(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(v), 1500); // autosave
  };
  const openWiki = async (target: string) => {
    const hit = resolve(target);
    if (hit) return onOpen(hit);
    if (/\.(png|jpe?g|gif|webp|svg|pdf|mp4|mp3|docx?|xlsx?)$/i.test(target)) return window.open(`/v1/brain/${vault}/file?path=${encodeURIComponent(target)}`, "_blank");
    try { const r = await api.post(`brain/${vault}/note`, { folder: "2. Hộp thư", title: target.split("/").pop() }); toast(`Đã tạo ghi chú mới "${target}"`); onOpen(r.path); } catch (e: any) { toast(e.message, "err"); }
  };
  const doRename = async () => {
    if (!rename?.trim()) return;
    const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
    const to = rename.includes("/") ? rename : `${dir}${rename}`;
    try { const r = await api.post(`brain/${vault}/rename`, { from: path, to }); toast(r.relinked ? `Đã đổi tên, sửa ${r.relinked} liên kết` : "Đã đổi tên"); setRename(null); onOpen(r.path); } catch (e: any) { toast(e.message, "err"); }
  };
  const del = async () => {
    try { await api.del(`brain/${vault}/note?path=${encodeURIComponent(path)}`); toast("Đã chuyển vào thùng rác (.trash) của Agentic Brain — khôi phục được"); onClose(); } catch (e: any) { toast(e.message, "err"); }
  };
  const md = useMemo(() => prepare(text, vault), [text, vault]);
  const meta = data?.meta ?? {};

  if (error) return <div className="p-6 text-sm text-rose-600">{error} <button className="ml-2 text-blue-600" onClick={onClose}>Quay lại bản đồ</button></div>;
  if (!data) return <div className="grid h-full place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>;
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-card/70 px-4 py-2.5 backdrop-blur">
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-soft" title="Về bản đồ"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-muted">{path.split("/").slice(0, -1).join(" / ") || "Gốc"}</p>
          <p className="truncate font-semibold text-ink">{data.title}</p>
        </div>
        <span className="text-[11px] text-muted">{saving ? "Đang lưu…" : dirty ? "Chưa lưu" : `Lưu ${timeAgo(data.mtime)}`} · {data.words} từ</span>
        <div className="flex rounded-lg border border-line p-0.5">
          <button onClick={() => setMode("read")} className={cx("flex items-center gap-1 rounded-md px-2 py-1 text-xs", mode === "read" ? "bg-blue-600 text-white" : "text-muted")}><BookOpen className="h-3.5 w-3.5" />Đọc</button>
          <button onClick={() => setMode("edit")} className={cx("flex items-center gap-1 rounded-md px-2 py-1 text-xs", mode === "edit" ? "bg-blue-600 text-white" : "text-muted")}><Pencil className="h-3.5 w-3.5" />Sửa</button>
        </div>
        {dirty && <Button size="sm" variant="primary" icon={Save} loading={saving} onClick={() => save()}>Lưu</Button>}
        <button onClick={() => onAsk(`Đọc ghi chú "${path}" trong Agentic Brain rồi tóm tắt và đề xuất việc nên làm tiếp.`)} className="rounded-lg p-1.5 text-violet-600 hover:bg-violet-500/10" title="Hỏi Ngân Nguyệt về ghi chú này"><Moon className="h-4 w-4" /></button>
        <button onClick={() => setRename(data.title)} className="rounded-lg p-1.5 text-muted hover:bg-soft" title="Đổi tên / chuyển thư mục"><Type className="h-4 w-4" /></button>
        <button onClick={() => api.post(`brain/vaults/${vault}/open`, { path })} className="rounded-lg p-1.5 text-muted hover:bg-soft" title="Mở trong Finder"><FolderOpen className="h-4 w-4" /></button>
        <button onClick={() => setConfirmDel(true)} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-600" title="Xóa (vào thùng rác)"><Trash2 className="h-4 w-4" /></button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto scroll-thin">
          {mode === "edit" ? (
            <textarea value={text} onChange={(e) => onEdit(e.target.value)} spellCheck={false}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); void save(); } }}
              className="h-full min-h-full w-full resize-none bg-transparent p-6 font-mono text-[13px] leading-6 text-ink outline-none" />
          ) : (
            <article className="brain-md mx-auto max-w-3xl px-6 py-5 text-[14.5px] leading-7 text-ink">
              {Object.keys(meta).length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {Object.entries(meta).filter(([k]) => !["hash"].includes(k)).slice(0, 10).map(([k, v]) => <span key={k} className="rounded-full bg-soft px-2 py-0.5 text-[11px] text-muted"><b className="font-medium text-ink">{k}</b>: {Array.isArray(v) ? v.join(", ") : String(v)}</span>)}
                </div>
              )}
              <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={(u) => (/^(wiki:|\/|https?:|mailto:|#)/i.test(u) ? u : "")} components={{
                a: ({ href, children }) => {
                  if (href?.startsWith("wiki:")) { const t = decodeURIComponent(href.slice(5)); const ok = !!resolve(t); return <button onClick={() => void openWiki(t)} className={cx("font-medium hover:underline", ok ? "text-violet-600 dark:text-violet-300" : "text-violet-400/70 italic")} title={ok ? t : `${t} (chưa có — bấm để tạo)`}>{children}</button>; }
                  if (href?.startsWith("/")) return <Link to={href} className="text-blue-600 hover:underline">{children}</Link>;
                  return <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{children}</a>;
                },
                img: ({ src, alt }) => <img src={src} alt={alt} className="my-2 max-h-96 rounded-xl border border-line" />,
              }}>{md}</ReactMarkdown>
            </article>
          )}
        </div>
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-line p-3 text-xs scroll-thin lg:block">
          {data.tags?.length > 0 && <div className="mb-4"><p className="mb-1.5 flex items-center gap-1 font-semibold text-ink"><Tag className="h-3.5 w-3.5" />Thẻ</p><div className="flex flex-wrap gap-1">{data.tags.map((t: string) => <Badge key={t}>#{t}</Badge>)}</div></div>}
          <p className="mb-1.5 flex items-center gap-1 font-semibold text-ink"><Link2 className="h-3.5 w-3.5" />Ghi chú trỏ về đây ({data.backlinks.length})</p>
          <div className="mb-4 space-y-0.5">{data.backlinks.length ? data.backlinks.map((b: any) => <button key={b.path} onClick={() => onOpen(b.path)} className="block w-full truncate rounded px-1.5 py-1 text-left text-violet-700 hover:bg-soft dark:text-violet-300" title={b.path}>{b.title}</button>) : <p className="text-muted">Chưa có ghi chú nào liên kết tới.</p>}</div>
          <p className="mb-1.5 font-semibold text-ink">Ghi chú này trỏ tới ({data.links.length})</p>
          <div className="space-y-0.5">{data.links.map((l: any, i: number) => <button key={i} onClick={() => void openWiki(l.target)} className={cx("block w-full truncate rounded px-1.5 py-1 text-left hover:bg-soft", l.path ? "text-ink" : "italic text-muted")} title={l.path ?? "Chưa có — bấm để tạo"}>{l.target}</button>)}</div>
        </aside>
      </div>

      <Modal open={rename !== null} onClose={() => setRename(null)} title="Đổi tên / chuyển ghi chú" footer={<><Button variant="ghost" onClick={() => setRename(null)}>Hủy</Button><Button variant="primary" onClick={doRename}>Đổi</Button></>}>
        <input className={inputCls} value={rename ?? ""} onChange={(e) => setRename(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doRename()} autoFocus />
        <p className="mt-2 text-xs text-muted">Gõ tên mới, hoặc đường dẫn có thư mục (vd: <code>19. Lưu trữ/Tên cũ</code>) để chuyển. Các [[liên kết]] trỏ tới ghi chú này được sửa theo.</p>
      </Modal>
      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="Xóa ghi chú?" footer={<><Button variant="ghost" onClick={() => setConfirmDel(false)}>Hủy</Button><Button variant="danger" onClick={del}>Chuyển vào thùng rác</Button></>}>
        <p className="text-sm">"{data.title}" sẽ được chuyển vào thư mục <code>.trash</code> của Agentic Brain (không xóa vĩnh viễn, khôi phục được trong Finder/Obsidian).</p>
      </Modal>
    </div>
  );
}
