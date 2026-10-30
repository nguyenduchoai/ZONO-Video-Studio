import { useEffect, useState } from "react";
import { Check, Clapperboard, Copy, ExternalLink, Film, Layers, Loader2, Mic, Palette, Play, Scissors, Sparkles, Upload, Wand2 } from "lucide-react";
import { api, apiUrl, useApi } from "../lib/api";
import { Badge, Button, Card, cx, useToast } from "../components/ui";

function uploadStreamFile(f: File, onPct: (n: number | null) => void): Promise<{ path: string }> {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open("PUT", apiUrl(`/v1/uploads/stream?name=${encodeURIComponent(f.name)}`));
    x.setRequestHeader("content-type", "application/octet-stream");
    x.upload.onprogress = (e) => e.lengthComputable && onPct(Math.round((e.loaded / e.total) * 100));
    x.onload = () => {
      try {
        const j = JSON.parse(x.responseText);
        x.status < 300 ? res(j) : rej(new Error(j.message ?? `Lỗi ${x.status}`));
      } catch {
        rej(new Error(`Lỗi ${x.status}`));
      }
    };
    x.onerror = () => rej(new Error("Mất kết nối khi tải lên"));
    x.send(f);
  }).finally(() => onPct(null)) as Promise<{ path: string }>;
}

export function ReelWeaverStudio() {
  const { data: catalog, reload } = useApi<any>("studio/reelweaver-catalog");
  const toast = useToast();

  const [selectedNiche, setSelectedNiche] = useState<string>("commercial-brand");
  const [selectedStyle, setSelectedStyle] = useState<string>("decoded_footage");
  const [topic, setTopic] = useState<string>(
    "Câu chuyện giữ trọn chữ tín của cửa hàng thực phẩm sạch và bí quyết chọn Yến Sào Chưng Tươi chuẩn vị",
  );
  const [voice, setVoice] = useState<string>("Binh (nam miền Bắc)");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [busy, setBusy] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // State cho Trạm Decode Video Mẫu & Dựng Phim Từ Video Quay Sẵn (Local FFmpeg + Whisper + Claude AI)
  const [decodeBusy, setDecodeBusy] = useState<boolean>(false);
  const [cloneBusy, setCloneBusy] = useState<boolean>(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [useClaudeForDecode, setUseClaudeForDecode] = useState<boolean>(false);
  const [renderRealMp4, setRenderRealMp4] = useState<boolean>(true);
  const [decodedBlueprint, setDecodedBlueprint] = useState<any>(null);
  const [rawFootageList, setRawFootageList] = useState<{ path: string; name: string }[]>([]);
  const [clonedResult, setClonedResult] = useState<any>(null);

  // Tự động nạp 1 bản dựng mẫu (Sample) + Giải mã sẵn 1 Video Mẫu Local ngay khi mở trang
  useEffect(() => {
    if (!catalog) return;
    if (!result && !busy) void handleGenerate(true);
    if (!decodedBlueprint && !decodeBusy) void handleDecodeVideo(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  const handleDecodeVideo = async (videoPath?: string, silent = false) => {
    setDecodeBusy(true);
    try {
      const res = await api.post<any>("studio/decode-video", {
        videoPath,
        referenceNotes: topic,
        useWhisper: !silent,
        useClaude: useClaudeForDecode && !silent,
      });
      setDecodedBlueprint(res.blueprint);
      if (!silent) {
        toast(`Đã Decode xong Video Mẫu (${res.blueprint.shotCount} phân cảnh · nhịp ${res.blueprint.avgShotSec}s/cảnh)!`, "ok");
      }
      // Tự động dựng mẫu bảng đối chiếu từ blueprint vừa decode nếu là lần mở trang đầu tiên
      if (silent && res.blueprint) {
        const cloneRes = await api.post<any>("studio/clone-from-decoded", {
          blueprint: res.blueprint,
          rawVideoPaths: [],
          topic,
          product: catalog?.productsSummary,
          brandName: catalog?.brandName,
          renderMp4: false,
          useClaude: false,
        });
        setClonedResult(cloneRes.result);
      }
    } catch (e: any) {
      if (!silent) toast(e?.message ?? "Lỗi khi giải mã video mẫu", "err");
    } finally {
      setDecodeBusy(false);
    }
  };

  const handleCloneFromDecoded = async () => {
    if (!decodedBlueprint) {
      toast("Vui lòng bấm Decode 1 Video Mẫu trước!", "err");
      return;
    }
    setCloneBusy(true);
    try {
      const res = await api.post<any>("studio/clone-from-decoded", {
        blueprint: decodedBlueprint,
        rawVideoPaths: rawFootageList.map((r) => r.path),
        topic,
        product: catalog?.productsSummary,
        brandName: catalog?.brandName,
        renderMp4: renderRealMp4,
        useClaude: true,
      });
      setClonedResult(res.result);
      toast("Đã học theo Video Decode và dựng xong Phim Mới từ Video Quay Sẵn!", "ok");
    } catch (e: any) {
      toast(e?.message ?? "Lỗi khi dựng phim theo công thức Decode", "err");
    } finally {
      setCloneBusy(false);
    }
  };

  const handleGenerate = async (silent = false) => {
    if (!topic.trim()) {
      toast("Vui lòng nhập chủ đề hoặc ý tưởng video!", "err");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<any>("studio/reelweaver-plan", {
        topic: topic.trim(),
        styleId: selectedStyle,
        nicheSlug: selectedNiche,
        brandName: catalog?.brandName,
        productsSummary: catalog?.productsSummary,
        voice,
        aspectRatio,
      });
      setResult(res);
      if (!silent) {
        toast("Đã dựng xong Kịch bản 5 cảnh + Keyframe Cast Sheet + Video MP4!", "ok");
      }
    } catch (e: any) {
      if (!silent) toast(e?.message ?? "Lỗi khi dựng kịch bản Studio", "err");
    } finally {
      setBusy(false);
    }
  };

  const copyText = (key: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast("Đã sao chép vào bộ nhớ tạm!", "ok");
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const niches: any[] = catalog?.niches ?? [];
  const styles: any[] = catalog?.styles ?? [];
  const activeNicheObj = niches.find((n) => n.slug === selectedNiche) ?? niches[0];
  const activeStyleObj = styles.find((s) => s.id === selectedStyle) ?? styles[0];
  const plan = result?.plan;

  return (
    <div className="space-y-6 pb-12">
      {/* Banner Header */}
      <div className="rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Studio Làm Phim Thực Chiến · Video Decode × Raw Footage × Claude AI Local
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Giải Mã Video Mẫu (Decode) & Dựng Phim Từ Video Quay Sẵn
            </h1>
            <p className="max-w-3xl text-sm text-indigo-100">
              <b>Bước A:</b> Tải 1 <b>Video Mẫu (Viral/Reference)</b> lên để <b>Local FFmpeg + Faster-Whisper + Claude AI</b> bóc tách nhịp cắt, góc máy & công thức Hook 3s đầu ➔ <b>Bước B:</b> Đưa các <b>Video Quay Sẵn (Raw Footage)</b> của anh vào để hệ thống tự khớp cảnh, viết lời thoại mới và dựng phim MP4 hoàn chỉnh ngay trên máy.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 rounded-2xl bg-black/25 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                Bộ não hỗ trợ: <b>{catalog?.aiProvider?.label ?? "Claude CLI (Local)"} + Local FFmpeg</b>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={catalog?.gateway?.adminUrl || "http://127.0.0.1:18610/admin?key=zono-local-studio-key-2026"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm hover:bg-indigo-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Mở Quản Trị muse2api (:18610)
              </a>
              <button
                type="button"
                onClick={() => void reload()}
                className="rounded-xl bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
              >
                Làm mới
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TRẠM TRỌNG TÂM: DECODE VIDEO MẪU & DỰNG PHIM TỪ VIDEO QUAY SẴN (LOCAL + CLAUDE AI) */}
      <Card className="border-2 border-blue-500/35 bg-gradient-to-br from-blue-500/[0.04] via-indigo-500/[0.03] to-violet-500/[0.04] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-sm font-extrabold text-white shadow-xs">
              <Scissors className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-ink">
                🔍 Trạm Decode Video Mẫu & Học Theo Để Làm Phim Từ Video Quay Sẵn (Local FFmpeg + Whisper + Claude AI)
              </h2>
              <p className="text-xs text-muted">
                Chạy 100% trên máy Mac của anh: Tách phân cảnh bằng `ffprobe/scdet`, vẽ bảng Contact Sheet, bóc lời thoại từng từ bằng `faster-whisper`, và dùng `Claude CLI` chuyển hóa thành phim mới từ các clip quay sẵn.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={cx(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-blue-600 bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition",
                (decodeBusy || uploadPct !== null) && "pointer-events-none opacity-60",
              )}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>{uploadPct !== null ? `Đang tải ${uploadPct}%...` : "1. Tải Video Mẫu cần Decode (.mp4/.mov)"}</span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const up = await uploadStreamFile(f, setUploadPct);
                    await handleDecodeVideo(up.path, false);
                  } catch (err: any) {
                    toast(err?.message ?? "Lỗi tải video mẫu", "err");
                  }
                }}
              />
            </label>
            <Button
              size="sm"
              variant="secondary"
              loading={decodeBusy}
              onClick={() => void handleDecodeVideo(undefined, false)}
            >
              ⚡ Giải mã lại Video Mẫu trên máy
            </Button>
          </div>
        </div>

        {/* Chọn nhanh từ các Video có sẵn trên máy nếu chưa muốn upload */}
        {(catalog?.localVideos ?? []).length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-muted">Hoặc chọn nhanh Video có sẵn trên máy để Decode:</span>
            {(catalog.localVideos as any[]).slice(0, 4).map((v) => (
              <button
                key={v.path}
                type="button"
                onClick={() => void handleDecodeVideo(v.path, false)}
                className={cx(
                  "rounded-lg border px-2.5 py-1 font-medium transition",
                  decodedBlueprint?.sourceVideoPath === v.path
                    ? "border-blue-600 bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold"
                    : "border-line bg-card text-ink hover:bg-soft",
                )}
              >
                🎞️ {v.name}
              </button>
            ))}
            <label className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <input
                type="checkbox"
                checked={useClaudeForDecode}
                onChange={(e) => setUseClaudeForDecode(e.target.checked)}
              />
              Gọi thêm Claude CLI phân tích sâu Contact Sheet khi Decode (~15s)
            </label>
          </div>
        )}

        {/* KẾT QUẢ BƯỚC A: BẢNG GIẢI MÃ CÔNG THỨC VIDEO MẪU (DECODED BLUEPRINT) */}
        {decodedBlueprint && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Cột trái: Contact Sheet + Thông số nhịp dựng + Hook 3s đầu */}
            <div className="space-y-3 rounded-2xl border border-line bg-card p-4 lg:col-span-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600">
                  📊 Kết quả Giải mã Video Mẫu ({decodedBlueprint.sourceFileName})
                </span>
                <Badge tone="green">
                  {decodedBlueprint.shotCount} cảnh · {decodedBlueprint.avgShotSec}s/cảnh
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-soft p-2">
                  <div className="text-[11px] text-muted">Thời lượng / FPS</div>
                  <div className="font-extrabold text-ink">
                    {decodedBlueprint.durationSec}s · {decodedBlueprint.fps}fps
                  </div>
                </div>
                <div className="rounded-xl bg-soft p-2">
                  <div className="text-[11px] text-muted">Khung hình</div>
                  <div className="font-extrabold text-ink">
                    {decodedBlueprint.width}×{decodedBlueprint.height}
                  </div>
                </div>
                <div className="rounded-xl bg-soft p-2">
                  <div className="text-[11px] text-muted">Tốc độ lời</div>
                  <div className="font-extrabold text-ink">{decodedBlueprint.wordsPerMinute} từ/phút</div>
                </div>
              </div>

              {decodedBlueprint.contactSheetUrl && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-muted">
                    Ảnh tổng hợp các phân cảnh (Contact Sheet trích xuất bởi Local FFmpeg):
                  </div>
                  <img
                    src={decodedBlueprint.contactSheetUrl}
                    alt="Decoded Contact Sheet"
                    className="max-h-52 w-full rounded-xl border border-line bg-black object-contain"
                  />
                </div>
              )}

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-1">
                <div className="font-extrabold text-amber-800 dark:text-amber-300">
                  🎯 Công thức Hook 3 Giây Đầu học được:
                </div>
                <p className="text-ink">
                  <b>Cách mở bài:</b> {decodedBlueprint.hookFormula?.first3SecHook}
                </p>
                <p className="text-muted">
                  <b>Kỹ thuật hình ảnh:</b> {decodedBlueprint.hookFormula?.visualHookTechnique}
                </p>
              </div>

              <div className="space-y-1 text-xs">
                <div className="font-bold text-ink">📐 Cấu trúc Kịch bản (Narrative Arc):</div>
                <ul className="space-y-1 pl-4 list-disc text-muted">
                  {(decodedBlueprint.narrativeArc ?? []).map((step: string, i: number) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Cột phải: Bảng phân cảnh đã Decode + Khu vực nạp Video Quay Sẵn của mình để dựng phim mới */}
            <div className="space-y-4 rounded-2xl border border-line bg-card p-4 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600">
                  🎞️ Chi tiết từng phân cảnh đã Decode & Hướng dẫn quay/chọn cảnh
                </span>
                <span className="text-[11px] font-semibold text-muted">
                  Nhịp dựng: {decodedBlueprint.pacingLabel}
                </span>
              </div>

              <div className="max-h-60 space-y-2 overflow-y-auto pr-1 scroll-thin">
                {(decodedBlueprint.decodedShots ?? []).map((sh: any) => (
                  <div key={sh.sceneNumber} className="rounded-xl border border-line bg-soft/50 p-2.5 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-extrabold text-ink">
                        Cảnh {sh.sceneNumber} ({sh.startSec}s → {sh.endSec}s · dài {sh.durationSec}s)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge tone="blue">Zoom: {sh.recommendedZoom}</Badge>
                        <Badge tone="amber">Chuyển: {sh.recommendedTransition}</Badge>
                      </div>
                    </div>
                    <p className="text-ink">
                      <b>Góc máy & Hình ảnh:</b> {sh.cameraAngle} — {sh.visualDescription}
                    </p>
                    <p className="text-emerald-700 dark:text-emerald-300 font-medium">
                      💡 <b>Cách chọn Video Quay Sẵn của anh:</b> {sh.howToShootOrSelect}
                    </p>
                  </div>
                ))}
              </div>

              {/* Khu vực tải Video Quay Sẵn (Raw Footage) của mình để học theo Video Decode */}
              <div className="rounded-2xl border-2 border-indigo-500/30 bg-indigo-500/[0.05] p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-extrabold text-indigo-800 dark:text-indigo-200">
                      🎬 Bước 2: Đưa các Video Quay Sẵn (Raw Footage) của anh vào để làm phim theo công thức trên
                    </div>
                    <div className="text-[11px] text-muted">
                      Tải lên các clip quay sản phẩm, cửa hàng, thao tác thực tế... (Nếu để trống, hệ thống sẽ dùng ngay clip mẫu trên máy để dựng thử).
                    </div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-indigo-600 bg-card px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-500/10 dark:text-indigo-300">
                    <Film className="h-3.5 w-3.5" />
                    <span>+ Tải lên Video Quay Sẵn (.mp4/.mov)</span>
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files ?? []);
                        for (const f of files) {
                          try {
                            const r = await uploadStreamFile(f, setUploadPct);
                            setRawFootageList((prev) => [...prev, { path: r.path, name: `${f.name} (${(f.size / 1048576).toFixed(1)} MB)` }]);
                          } catch (err: any) {
                            toast(err?.message ?? "Lỗi tải video quay sẵn", "err");
                          }
                        }
                      }}
                    />
                  </label>
                </div>

                {rawFootageList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {rawFootageList.map((m, idx) => (
                      <span key={m.path} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-card px-2.5 py-1 font-semibold text-ink">
                        📹 {m.name}
                        <button
                          type="button"
                          onClick={() => setRawFootageList((prev) => prev.filter((_, j) => j !== idx))}
                          className="text-rose-600 hover:underline"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
                    <input
                      type="checkbox"
                      checked={renderRealMp4}
                      onChange={(e) => setRenderRealMp4(e.target.checked)}
                    />
                    Kết xuất luôn file Video MP4 hoàn chỉnh bằng Local FFmpeg + Giọng VieNeu-TTS
                  </label>
                  <Button
                    variant="primary"
                    loading={cloneBusy}
                    onClick={() => void handleCloneFromDecoded()}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    <Wand2 className="mr-1.5 h-4 w-4" />
                    🎬 Học Theo Video Decode & Dựng Phim Mới Ngay (Claude + Local)
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KẾT QUẢ BƯỚC B: BẢNG ĐỐI CHIẾU PHÂN CẢNH ĐÃ HỌC THEO VIDEO DECODE + VIDEO MP4 MỚI */}
        {clonedResult && (
          <div className="mt-4 rounded-2xl border border-emerald-500/35 bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
              <div>
                <h3 className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                  ✅ Phim Mới Đã Dựng Theo Công Thức Video Decode · {clonedResult.hookTitle}
                </h3>
                <p className="text-xs text-muted">{clonedResult.renderNotes}</p>
              </div>
              <Badge tone="green">Bộ não: {clonedResult.providerUsed}</Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="space-y-2 lg:col-span-8">
                <div className="text-xs font-bold text-ink">
                  📋 Bảng Đối Chiếu Từng Cảnh (Công Thức Gốc ↔ Cảnh Quay Sẵn Đã Ghép + Lời Thoại Mới):
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(clonedResult.scenes ?? []).map((sc: any) => (
                    <div key={sc.sceneNumber} className="rounded-xl border border-line bg-soft/40 p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                          Cảnh {sc.sceneNumber} ({sc.templateTiming})
                        </span>
                        <Badge tone="blue">{sc.newOnScreenText}</Badge>
                      </div>
                      <p className="text-[11px] text-muted">
                        <b>Gốc Decode:</b> {sc.originalShotSummary}
                      </p>
                      <p className="text-ink font-medium">
                        🎙️ <b>Lời thoại mới:</b> “{sc.newVoiceover}”
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        ✂️ <b>Ghép từ Video Quay Sẵn:</b> {sc.selectedRawCut?.sourceFileName} ({sc.selectedRawCut?.startSec}s – {sc.selectedRawCut?.endSec}s) · Zoom {sc.zoom}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 lg:col-span-4">
                <div className="text-xs font-bold text-ink">🎬 Bản Xem Trước Video MP4 Hoàn Chỉnh:</div>
                {clonedResult.renderedVideoUrl && (
                  <video
                    key={clonedResult.renderedVideoUrl}
                    src={clonedResult.renderedVideoUrl}
                    controls
                    playsInline
                    className="mx-auto max-h-72 w-full rounded-2xl border border-line bg-black object-contain shadow-sm"
                  />
                )}
                <div className="rounded-xl bg-soft p-2.5 text-xs space-y-1">
                  <div className="font-bold text-ink">Caption gợi ý đăng kênh:</div>
                  <p className="text-muted">{clonedResult.caption}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Bước 1: Chọn Ngách Kênh (MoonReel Niche-First) */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">1</span>
            <h2 className="text-base font-bold text-slate-900">Chọn Ngách Kênh Sản Xuất (MoonReel Niche-First)</h2>
          </div>
          {activeNicheObj && (
            <Badge tone="blue">
              Thumbnail: {activeNicheObj.thumbnailStyle.toUpperCase()} · Màu nhấn {activeNicheObj.thumbnailAccent}
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {niches.map((n) => {
            const active = n.slug === selectedNiche;
            return (
              <button
                key={n.slug}
                type="button"
                onClick={() => setSelectedNiche(n.slug)}
                className={cx(
                  "flex flex-col items-start rounded-2xl border p-4 text-left transition-all",
                  active
                    ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-600/20 shadow-sm"
                    : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xl">{n.icon}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase"
                    style={{ backgroundColor: `${n.thumbnailAccent}33`, color: "#0f172a" }}
                  >
                    {n.thumbnailStyle}
                  </span>
                </div>
                <div className="mt-2 font-bold text-slate-900">{n.name}</div>
                <div className="mt-1 line-clamp-2 text-xs text-slate-600">{n.description}</div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Bước 2: Chọn Phong Cách Trực Quan (FrameWeaver 10 Visual Styles) */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-xs font-bold text-white">2</span>
            <h2 className="text-base font-bold text-slate-900">
              Chọn Phong Cách Hình Ảnh & Giải Phẫu Nhân Vật (FrameWeaver 10 Styles)
            </h2>
          </div>
          {activeStyleObj && (
            <Badge tone="green">
              Đang chọn: {activeStyleObj.name} ({activeStyleObj.id})
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {styles.map((s) => {
            const active = s.id === selectedStyle;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStyle(s.id)}
                className={cx(
                  "flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all",
                  active
                    ? "border-violet-600 bg-violet-50/80 ring-2 ring-violet-600/20 shadow-sm"
                    : "border-slate-200 bg-white hover:border-violet-300 hover:bg-slate-50",
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="h-4 w-4 rounded-full border border-slate-300 shadow-inner"
                      style={{ backgroundColor: s.swatch }}
                    />
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                      {s.category}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-bold text-slate-900">{s.name}</div>
                  <div className="mt-1 line-clamp-3 text-xs text-slate-600">{s.description}</div>
                </div>
                <div className="mt-2.5 text-[11px] font-semibold text-violet-700">
                  {active ? "✓ Đang khóa Style này" : "Chọn phong cách →"}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Bước 3: Nhập Chủ Đề & Bấm Dựng Phim */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-600 text-xs font-bold text-white">3</span>
          <h2 className="text-base font-bold text-slate-900">
            Nhập Ý Tưởng & Khởi Chạy Tổ Hợp Dựng Phim (Scene-Lock + Multi-Angle + Narrator-Fit 48kHz)
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
              Chủ đề / Câu chuyện / Sản phẩm muốn dựng thành Video
            </label>
            <textarea
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ví dụ: Câu chuyện người que so sánh làm việc thủ công 14 tiếng/ngày và dùng AI tự động hóa..."
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-600 focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                {
                  label: "💡 Mẫu Truyện Nhân Quả 2D",
                  niche: "night-stories",
                  style: "srt_moral",
                  text: "Câu chuyện chữ tín của người chủ tiệm thực phẩm sạch kiên trì giữ chất lượng suốt 5 năm",
                },
                {
                  label: "🕺 Mẫu Người Que (Stickman)",
                  niche: "personal-finance",
                  style: "stickman_light",
                  text: "So sánh hai chủ shop: Người tự làm thủ công 14 tiếng mỗi ngày và người dùng hệ thống AI tự động",
                },
                {
                  label: "🏮 Mẫu Truyện Dân Gian VN",
                  niche: "did-you-know",
                  style: "srt_folk",
                  text: "Sự tích nghề làm quà Tết truyền thống và nét đẹp văn hóa làng quê Việt Nam",
                },
                {
                  label: "🧸 Mẫu Hoạt Hình 3D Pixar",
                  niche: "commercial-brand",
                  style: "3d_pixar",
                  text: "Hành trình giọt mật ong hoa nhãn nguyên chất từ rừng xanh đến bàn ăn gia đình",
                },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setSelectedNiche(preset.niche);
                    setSelectedStyle(preset.style);
                    setTopic(preset.text);
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 lg:col-span-4">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">Tỉ lệ khung hình</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as "9:16" | "16:9")}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  <option value="9:16">📱 Dọc 9:16 (TikTok / Shorts / Reels)</option>
                  <option value="16:9">🖥️ Ngang 16:9 (YouTube Full HD)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">Giọng đọc 48kHz</label>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  <option value="Binh (nam miền Bắc)">🎙️ Bình (Nam miền Bắc)</option>
                  <option value="Ngọc Huyền (nữ miền Bắc)">🎙️ Ngọc Huyền (Nữ Bắc)</option>
                  <option value="Minh Hoàng (nam miền Nam)">🎙️ Minh Hoàng (Nam Nam)</option>
                  <option value="Thảo Vy (nữ miền Nam)">🎙️ Thảo Vy (Nữ Nam)</option>
                </select>
              </div>
            </div>

            <Button
              onClick={() => void handleGenerate(false)}
              disabled={busy}
              className="w-full justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-md hover:from-indigo-700 hover:to-violet-700"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang khóa nhân vật & dựng 5 phân cảnh...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Dựng Kịch Bản Đa Góc Máy + Xuất Video MP4 Ngay
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Kết quả Bàn Dựng: Entity Bible + 5 Cảnh Đa Góc Máy + Satori Thumbnail + Video Player + 4-Platform Captions */}
      {plan && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cột Trái (8 cols): Hồ sơ Thực thể + 5 Cảnh Storyboard */}
          <div className="space-y-6 lg:col-span-8">
            <Card className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    1. Hồ Sơ Tham Chiếu Thực Thể & Khóa Đồng Nhất (Entity Reference Bible & Keyframe Cast Sheet)
                  </h3>
                </div>
                <Badge tone="blue">{plan.style?.name}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(plan.entities ?? []).map((ent: any, idx: number) => (
                  <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-indigo-700">{ent.name}</span>
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-800">
                        {ent.entityType}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{ent.description}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-violet-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    2. Bàn Dựng 5 Phân Cảnh Đa Góc Máy (ROOT · CONTINUATION · INSERT Close-Up 85mm)
                  </h3>
                </div>
                <Badge tone="green">Narrator-Fit: SFX 0.3 · Voice 1.5 · 48kHz Stereo</Badge>
              </div>

              <div className="space-y-4">
                {(plan.scenes ?? []).map((sc: any) => (
                  <div
                    key={sc.index}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-extrabold text-white">
                          {sc.code}
                        </span>
                        <span className="text-xs font-bold text-slate-600">
                          ⏱️ {sc.timeRange} (Cắt khớp TTS: {sc.cutDurationSec}s)
                        </span>
                      </div>
                      <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-900">
                        Chữ nổi [{sc.overlayStyle.toUpperCase()}]: {sc.overlayText}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-xl bg-indigo-50/60 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800">
                          <Mic className="h-3.5 w-3.5" />
                          Lời đọc tiếng Việt (VieNeu-TTS 48kHz):
                        </div>
                        <p className="mt-1 text-sm font-medium italic text-slate-900">"{sc.voiceVi}"</p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                          <Film className="h-3.5 w-3.5" />
                          Chuyển động Camera (Câu độc lập chuẩn Veo 3 / Flow):
                        </div>
                        <p className="mt-1 font-mono text-xs text-slate-800">{sc.cameraSentence}</p>
                      </div>
                    </div>

                    <div className="mt-2.5 space-y-1.5 text-xs text-slate-700">
                      <div>
                        <b className="text-slate-900">🖼️ Nối Khung (Frame Continuity):</b> {sc.startFrame}{" "}
                        <span className="font-bold text-indigo-600">➔</span> {sc.endFrame}
                      </div>
                      <div>
                        <b className="text-slate-900">🔊 3 Lớp Âm Thanh:</b>{" "}
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">{sc.audioLayers}</code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Cột Phải (4 cols): Video Player + Satori Thumbnail Preview + 4-Platform Captions */}
          <div className="space-y-6 lg:col-span-4">
            {/* Trình phát Video MP4 */}
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-slate-900">Bản Xuất Video MP4</h3>
                </div>
                <Badge tone="green">#{String(result?.jobId ?? "studio").slice(0, 8)}</Badge>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-inner">
                <video
                  key={result?.videoUrl || "/muse/HatchMaking.mp4"}
                  src={result?.videoUrl || "/muse/HatchMaking.mp4"}
                  controls
                  playsInline
                  className="mx-auto max-h-[380px] w-full object-contain"
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                <span>Định dạng: {aspectRatio} · H.264 + AAC 48kHz</span>
                <a
                  href={result?.videoUrl || "/muse/HatchMaking.mp4"}
                  download={`zono-studio-${Date.now()}.mp4`}
                  className="font-bold text-indigo-600 hover:underline"
                >
                  ⬇️ Tải MP4 về máy
                </a>
              </div>
            </Card>

            {/* Bản xem trước Thumbnail Satori (Boxed / Impact / Cinematic) */}
            <Card className="p-5">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clapperboard className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Xem Trước Thumbnail Satori ({plan.niche?.thumbnailStyle?.toUpperCase()})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => copyText("thumb", plan.thumbnailPrompt)}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                >
                  {copiedKey === "thumb" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  Copy Prompt
                </button>
              </div>
              <div
                className="relative flex min-h-[150px] flex-col justify-end overflow-hidden rounded-2xl p-4 shadow-md"
                style={{
                  background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #311042 100%)",
                }}
              >
                <div className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-white/75">
                  {plan.niche?.icon} {plan.niche?.name}
                </div>
                <div className="text-xl font-black uppercase leading-tight tracking-tight text-white">
                  {String(plan.satoriHeadline || "").split("*").map((part: string, i: number) =>
                    i % 2 === 1 ? (
                      <span
                        key={i}
                        className="rounded px-1.5 py-0.5 text-slate-950"
                        style={{ backgroundColor: plan.niche?.thumbnailAccent || "#FFD23F" }}
                      >
                        {part}
                      </span>
                    ) : (
                      <span key={i}>{part}</span>
                    ),
                  )}
                </div>
                <div className="mt-2 text-[11px] text-slate-300 line-clamp-2">{plan.seoTitle}</div>
              </div>
            </Card>

            {/* Bộ Caption 4 Nền Tảng (MoonReel Multi-Platform Captions) */}
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-bold text-slate-900">
                🚀 Bộ Caption 4 Nền Tảng (Sao chép 1 chạm)
              </h3>
              <div className="space-y-3">
                {[
                  {
                    key: "yt",
                    label: "▶️ YouTube Title & Chapters",
                    content: `${plan.seoTitle}\n\n${(plan.multiPlatformCaptions?.youtube?.chapters ?? []).join("\n")}\n\n${(plan.hashtags ?? []).join(" ")}`,
                  },
                  {
                    key: "tt",
                    label: "🎵 TikTok Caption",
                    content: plan.multiPlatformCaptions?.tiktok ?? "",
                  },
                  {
                    key: "fb",
                    label: "📘 Facebook Reels & Post",
                    content: plan.multiPlatformCaptions?.facebook ?? "",
                  },
                  {
                    key: "ig",
                    label: "📸 Instagram Reels",
                    content: plan.multiPlatformCaptions?.instagram ?? "",
                  },
                ].map((item) => (
                  <div key={item.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{item.label}</span>
                      <button
                        type="button"
                        onClick={() => copyText(item.key, item.content)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-indigo-600 shadow-sm hover:bg-indigo-50"
                      >
                        {copiedKey === item.key ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" /> Đã chép
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Sao chép
                          </>
                        )}
                      </button>
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-xs text-slate-600 line-clamp-3">{item.content}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
