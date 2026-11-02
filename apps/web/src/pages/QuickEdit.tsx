import React, { useEffect, useRef, useState } from "react";
import { api, apiUrl, currentBizId } from "../lib/api";

/**
 * ⚡ Dựng nhanh từ 1 clip quay sẵn — giao diện của ZONO, động cơ dựng chạy trên máy (whisper + Claude + FFmpeg).
 * Thả clip → chọn kiểu chữ → bấm một nút → xem & tải Video Final. Không cần Video Mẫu.
 */

async function uploadClip(file: File): Promise<{ path: string; name: string }> {
  const res = await fetch(apiUrl(`/v1/uploads/stream?name=${encodeURIComponent(file.name)}`), {
    method: "PUT",
    headers: { "content-type": "application/octet-stream", ...(currentBizId() ? { "x-biz-id": currentBizId()! } : {}) },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Lỗi tải tệp (${res.status})`);
  return { path: data.path, name: file.name };
}

const THEMES: [string, string][] = [["gold", "Vàng + trắng"], ["yellow_full", "Full vàng"], ["emerald", "Xanh ngọc"], ["coral", "Đỏ cam"], ["cyan", "Xanh cyan"], ["violet", "Tím"]];
const BGS: [string, string][] = [["solid_dark", "Hộp đen đậm"], ["translucent", "Hộp đen mờ"], ["brand_box", "Hộp màu thương hiệu"], ["none", "Không nền"]];
const POSITIONS: [string, string][] = [["bottom", "Dưới"], ["center", "Giữa"], ["top", "Trên"], ["hidden", "Ẩn chữ"]];
const STYLES: [string, string][] = [["dynamic", "Năng động (TikTok/Reels)"], ["smooth", "Mượt, sang"], ["clean", "Gọn, chuyên nghiệp"]];

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 18, marginBottom: 16 };
const input: React.CSSProperties = { width: "100%", border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" };
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#334155", margin: "10px 0 4px", display: "block" };

function Pills({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(([id, text]) => (
        <button key={id} type="button" onClick={() => onChange(id)}
          style={{ padding: "6px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", border: value === id ? "1.5px solid #6366f1" : "1px solid #cbd5e1", background: value === id ? "#eef2ff" : "#fff", color: value === id ? "#4338ca" : "#475569" }}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function QuickEdit() {
  const [clips, setClips] = useState<{ path: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [hook, setHook] = useState("");
  const [cta, setCta] = useState("");
  const [style, setStyle] = useState("dynamic");
  const [aspect, setAspect] = useState("9:16");
  const [theme, setTheme] = useState("gold");
  const [bg, setBg] = useState("solid_dark");
  const [capPos, setCapPos] = useState("bottom");
  const [music, setMusic] = useState("auto");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // theo dõi tiến độ job mỗi 4 giây tới khi xong
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      try {
        const j: any = await api.get(`creative/jobs/${jobId}`);
        if (stop) return;
        setJob(j);
        if (["queued", "running"].includes(j.status)) setTimeout(tick, 4000);
      } catch (e: any) { if (!stop) { setErr(e.message); setTimeout(tick, 6000); } }
    };
    tick();
    return () => { stop = true; };
  }, [jobId]);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true); setErr(null);
    try {
      const out: { path: string; name: string }[] = [];
      for (const f of Array.from(files)) out.push(await uploadClip(f));
      setClips((c) => [...c, ...out]);
      if (!title) setTitle(out[0].name.replace(/\.[^.]+$/, "").slice(0, 60));
    } catch (e: any) { setErr(e.message); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const start = async () => {
    setBusy(true); setErr(null); setJob(null);
    try {
      const j: any = await api.post("creative/jobs", {
        tool: "edit-source",
        title: (title.trim() || "Video dựng nhanh").slice(0, 120),
        brief: brief.trim().length >= 5 ? brief.trim() : "Giữ lời người nói, chọn các câu hay nhất, hook mạnh 3 giây đầu, nhấn từ khoá, dựng gọn.",
        hookTitle: hook.trim() || undefined,
        cta: cta.trim() || undefined,
        durationSec: 40,
        channels: ["tiktok"],
        brand: "other",
        images: [],
        video: { materials: clips.map((c) => c.path), aspect, style, music, textTheme: theme, captionBgStyle: bg, captionPosition: capPos, headlinePosition: capPos === "top" ? "center" : "top" },
      });
      setJobId(j.id);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const running = job && ["queued", "running"].includes(job.status);
  const lastLogs = ((job?.log ?? []) as any[]).slice(-6).reverse();

  return (
    <div style={{ ...card, border: "2px solid #6366f1", background: "linear-gradient(180deg,#f8faff,#fff)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#1e1b4b" }}>⚡ Dựng nhanh từ 1 clip — thả clip, chọn kiểu chữ, bấm một nút</div>
          <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>Không cần Video Mẫu. AI nghe lời nói, chọn câu hay, cắt, zoom, phụ đề từng từ, hiệu ứng âm thanh, nhạc nền — chạy ngay trên máy.</div>
        </div>
      </div>

      <label style={label}>1. Clip quay sẵn (có người nói càng tốt)</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input ref={fileRef} type="file" accept="video/*" multiple style={{ display: "none" }} onChange={(e) => pick(e.target.files)} />
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
          style={{ background: "#4f46e5", color: "#fff", border: 0, borderRadius: 10, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          {uploading ? "Đang tải lên…" : "⬆️ Chọn / Tải clip"}
        </button>
        {clips.map((c, i) => (
          <span key={c.path} style={{ background: "#eef2ff", color: "#3730a3", borderRadius: 8, padding: "5px 9px", fontSize: 12, fontWeight: 600 }}>
            🎞 {c.name.slice(0, 34)} <a style={{ cursor: "pointer", marginLeft: 6, color: "#b91c1c" }} onClick={() => setClips(clips.filter((_, k) => k !== i))}>✕</a>
          </span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
        <div>
          <label style={label}>2. Tên video</label>
          <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: 3 cách AI dựng video thay bạn" />
          <label style={label}>Tiêu đề hook (chữ to 3 giây đầu — tuỳ chọn)</label>
          <input style={input} value={hook} onChange={(e) => setHook(e.target.value)} placeholder="VD: AI dựng video thay bạn" />
          <label style={label}>Lời kêu gọi cuối video (tuỳ chọn)</label>
          <input style={input} value={cta} onChange={(e) => setCta(e.target.value)} placeholder="VD: Nhắn tin để được tư vấn" />
        </div>
        <div>
          <label style={label}>Muốn video nói gì / nhấn mạnh gì (tuỳ chọn)</label>
          <textarea style={{ ...input, minHeight: 112 }} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="VD: Chọn đoạn nói về lợi ích tiết kiệm thời gian, nhấn các con số." />
        </div>
      </div>

      <label style={label}>3. Kiểu dựng</label>
      <Pills value={style} onChange={setStyle} options={STYLES} />
      <label style={label}>Màu chữ</label>
      <Pills value={theme} onChange={setTheme} options={THEMES} />
      <label style={label}>Nền chữ</label>
      <Pills value={bg} onChange={setBg} options={BGS} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
        <div><label style={label}>Vị trí phụ đề</label><Pills value={capPos} onChange={setCapPos} options={POSITIONS} /></div>
        <div><label style={label}>Khung hình</label><Pills value={aspect} onChange={setAspect} options={[["9:16", "Dọc 9:16"], ["1:1", "Vuông 1:1"], ["16:9", "Ngang 16:9"]]} /></div>
        <div><label style={label}>Nhạc nền</label><Pills value={music} onChange={setMusic} options={[["auto", "Có"], ["none", "Không"]]} /></div>
      </div>

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button type="button" disabled={!clips.length || busy || running}
          onClick={start}
          style={{ background: !clips.length || busy || running ? "#a5b4fc" : "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", border: 0, borderRadius: 12, padding: "12px 22px", fontWeight: 800, fontSize: 14.5, cursor: !clips.length || busy || running ? "not-allowed" : "pointer" }}>
          {running ? "⏳ Đang dựng…" : "⚡ DỰNG NGAY"}
        </button>
        {!clips.length && <span style={{ fontSize: 12.5, color: "#94a3b8" }}>Tải ít nhất 1 clip để bắt đầu.</span>}
      </div>

      {err && <div style={{ marginTop: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "8px 12px", borderRadius: 10, fontSize: 13 }}>⚠️ {err}</div>}

      {job && (
        <div style={{ marginTop: 14 }}>
          {running && (
            <div style={{ background: "#eef2ff", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#3730a3" }}>⏳ {job.step || "Đang xếp hàng…"} — thường 3–10 phút, cứ để trang mở</div>
              <ol style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: "#475569" }}>
                {lastLogs.map((l: any, i: number) => <li key={i}>{l.text}</li>)}
              </ol>
            </div>
          )}
          {job.status === "failed" && <div style={{ background: "#fef2f2", color: "#b91c1c", padding: 12, borderRadius: 12, fontSize: 13 }}>❌ {job.error || "Dựng chưa thành công"} — bấm DỰNG NGAY để thử lại.</div>}
          {job.status === "cancelled" && <div style={{ color: "#64748b", fontSize: 13 }}>Đã dừng.</div>}
          {job.asset && (
            <div style={{ border: "1px solid #a7f3d0", background: "#ecfdf5", borderRadius: 14, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <b style={{ color: "#047857", fontSize: 14 }}>🎬 VIDEO FINAL đã sẵn sàng · {job.asset.duration?.toFixed?.(1)}s · {job.asset.width}x{job.asset.height}</b>
                <a href={`/v1/media/${job.asset.id}?download=1`} download style={{ background: "#059669", color: "#fff", padding: "9px 16px", borderRadius: 10, fontWeight: 800, fontSize: 13.5, textDecoration: "none" }}>⬇ Tải Video Final (.mp4)</a>
              </div>
              <video src={`/v1/media/${job.asset.id}`} controls playsInline style={{ display: "block", margin: "10px auto 0", maxHeight: 520, borderRadius: 12, background: "#000" }} />
              {job.result?.caption && <div style={{ marginTop: 10, background: "#fff", borderRadius: 10, padding: 10, fontSize: 12.5 }}><b>Caption:</b> {job.result.caption}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
