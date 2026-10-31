import { useEffect, useState } from "react";
import { Check, Clapperboard, Copy, Download, ExternalLink, Film, Layers, Loader2, Mic, Palette, Play, RefreshCw, Scissors, Sparkles, Upload, Volume2, Wand2 } from "lucide-react";
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

const QUICK_TOPIC_PRESETS = [
  {
    label: "🍯 Đặc sản & Thực phẩm sạch",
    text: "Quy trình tuyển chọn Yến Sào Chưng Tươi & Mật Ong Hoa Nhãn nguyên chất giữ trọn chữ tín với khách hàng",
  },
  {
    label: "🛍️ Review Sản phẩm / Đập hộp",
    text: "Trải nghiệm thực tế 3 điểm ăn tiền nhất của sản phẩm khiến khách hàng chốt đơn ngay trong 15 giây",
  },
  {
    label: "🏪 Giới thiệu Cửa hàng / Dịch vụ",
    text: "Một ngày hậu trường chuẩn bị đơn hàng tỉ mỉ và phản hồi chân thực từ khách hàng thân thiết",
  },
  {
    label: "🤖 Giải pháp AI & Tự động hóa",
    text: "Cách dùng hệ thống ZONO AI giải mã video mẫu và tự động dựng phim thương mại từ các cảnh quay sẵn",
  },
];

export function ReelWeaverStudio() {
  const { data: catalog, reload } = useApi<any>("studio/reelweaver-catalog");
  const toast = useToast();

  // Chế độ hiển thị: "decode_workflow" (Mặc định tinh gọn 3 bước) | "storyboard_studio" (Lên kịch bản đa kênh nâng cao)
  const [studioTab, setStudioTab] = useState<"decode_workflow" | "storyboard_studio">("decode_workflow");

  const [selectedNiche, setSelectedNiche] = useState<string>("commercial-brand");
  const [selectedStyle, setSelectedStyle] = useState<string>("decoded_footage");
  const [topic, setTopic] = useState<string>(QUICK_TOPIC_PRESETS[0].text);
  const [voice, setVoice] = useState<string>("Ngọc Huyền");
  const [audioMode, setAudioMode] = useState<"voiceover" | "keep_audio">("voiceover");
  const [editStyle, setEditStyle] = useState<"dynamic" | "smooth" | "clean">("dynamic");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [busy, setBusy] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // State cho Trạm Decode Video Mẫu & Dựng Phim Từ Video Quay Sẵn (Local FFmpeg + Whisper + Claude AI)
  const [decodeBusy, setDecodeBusy] = useState<boolean>(false);
  const [cloneBusy, setCloneBusy] = useState<boolean>(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [useClaudeForDecode, setUseClaudeForDecode] = useState<boolean>(true);
  const [renderRealMp4, setRenderRealMp4] = useState<boolean>(true);
  const [decodedBlueprint, setDecodedBlueprint] = useState<any>(null);
  const [rawFootageList, setRawFootageList] = useState<{ path: string; name: string }[]>([]);
  const [clonedResult, setClonedResult] = useState<any>(null);
  const [editableScenes, setEditableScenes] = useState<any[]>([]);

  // Tự động nạp sẵn 1 Video Mẫu đã Decode ngay khi mở trang để người dùng thấy kết quả tức thì
  useEffect(() => {
    if (!catalog) return;
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
      if (res.blueprint?.recommendedEditStyle) {
        setEditStyle(res.blueprint.recommendedEditStyle);
      }
      if (!silent) {
        toast(`Đã Decode xong (${res.blueprint.shotCount} cảnh · nhịp ${res.blueprint.avgShotSec}s) — đang tự động dựng Video MP4 mới cho anh...`, "info");
      }
      if (res.blueprint) {
        setCloneBusy(true);
        try {
          const cloneRes = await api.post<any>("studio/clone-from-decoded", {
            blueprint: res.blueprint,
            rawVideoPaths: rawFootageList.map((r) => r.path),
            topic,
            product: catalog?.productsSummary,
            brandName: catalog?.brandName,
            voiceName: voice,
            audioMode,
            aspectRatio,
            editStyle: res.blueprint.recommendedEditStyle ?? editStyle ?? "dynamic",
            renderMp4: !silent && renderRealMp4,
            useClaude: !silent && useClaudeForDecode,
          });
          setClonedResult(cloneRes.result);
          setEditableScenes(cloneRes.result?.scenes ?? []);
          if (!silent) {
            toast("🎉 Đã Decode & dựng xong Video MP4 mới hoàn chỉnh!", "ok");
          }
        } finally {
          setCloneBusy(false);
        }
      }
    } catch (e: any) {
      if (!silent) toast(e?.message ?? "Lỗi khi giải mã video mẫu", "err");
    } finally {
      setDecodeBusy(false);
    }
  };

  const handleCloneFromDecoded = async (useEditedScenes = false) => {
    if (!decodedBlueprint) {
      toast("Vui lòng chọn hoặc tải 1 Video Mẫu ở Bước 1 trước!", "err");
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
        voiceName: voice,
        audioMode,
        aspectRatio,
        editStyle,
        renderMp4: renderRealMp4,
        useClaude: !useEditedScenes,
        customScenes: useEditedScenes
          ? editableScenes.map((s) => ({
              sceneNumber: s.sceneNumber,
              newVoiceover: s.newVoiceover,
              newOnScreenText: s.newOnScreenText,
              zoom: s.zoom,
              rawSourceIndex: s.selectedRawCut?.sourceIndex,
              rawStartSec: s.selectedRawCut?.startSec,
              rawEndSec: s.selectedRawCut?.endSec,
            }))
          : undefined,
      });
      setClonedResult(res.result);
      setEditableScenes(res.result?.scenes ?? []);
      toast(
        useEditedScenes
          ? "Đã kết xuất lại Video MP4 theo đúng lời thoại & chữ nổi anh vừa chỉnh sửa!"
          : "Đã học theo Video Decode và dựng xong Phim Mới từ Video Quay Sẵn!",
        "ok",
      );
    } catch (e: any) {
      toast(e?.message ?? "Lỗi khi dựng phim theo công thức Decode", "err");
    } finally {
      setCloneBusy(false);
    }
  };

  const updateEditableScene = (idx: number, patch: Record<string, any>) => {
    setEditableScenes((prev) => prev.map((sc, i) => (i === idx ? { ...sc, ...patch } : sc)));
  };

  const handleGenerateStoryboard = async (silent = false) => {
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
        toast("Đã dựng xong Kịch bản 5 cảnh + Thumbnail Satori + Caption 4 kênh!", "ok");
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
    <div className="space-y-5 pb-12">
      {/* Banner Header tinh gọn + Thanh chuyển chế độ 2 Tab */}
      <div className="rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              ZONO Video Studio · 100% Local FFmpeg + Faster-Whisper + Claude AI
            </div>
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
              Giải Mã Video Mẫu (Decode) & Làm Phim Từ Video Quay Sẵn
            </h1>
            <p className="max-w-3xl text-xs text-indigo-100 sm:text-sm">
              Quy trình tối giản 3 bước: <b>(1) Chọn Video Mẫu để Decode nhịp cắt & Hook 3s</b> ➔ <b>(2) Đưa Video Quay Sẵn + Chủ đề vào</b> ➔ <b>(3) Sửa câu thoại trực tiếp & Xuất MP4</b>.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 rounded-xl bg-black/25 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Bộ não: <b>{catalog?.aiProvider?.label ?? "Claude CLI (Local)"}</b></span>
              <span className="text-white/40">|</span>
              <button
                type="button"
                onClick={() => void reload()}
                className="underline hover:text-indigo-200"
              >
                Làm mới
              </button>
            </div>
            {/* 2 Tab chuyển đổi gọn gàng */}
            <div className="inline-flex rounded-xl bg-black/30 p-1 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setStudioTab("decode_workflow")}
                className={cx(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                  studioTab === "decode_workflow"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-white/85 hover:text-white",
                )}
              >
                🎬 1. Decode & Dựng Video Quay Sẵn (Chính)
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudioTab("storyboard_studio");
                  if (!result && !busy) void handleGenerateStoryboard(true);
                }}
                className={cx(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                  studioTab === "storyboard_studio"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-white/85 hover:text-white",
                )}
              >
                ✨ 2. Kịch Bản Phân Cảnh & Caption 4 Kênh
              </button>
            </div>
          </div>
        </div>
      </div>

      {studioTab === "decode_workflow" ? (
        <div className="space-y-5">
          {/* BƯỚC 1: CHỌN HOẶC TẢI VIDEO MẪU CẦN DECODE */}
          <Card className="border-2 border-blue-500/30 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-extrabold text-white">
                  1
                </span>
                <div>
                  <h2 className="text-base font-extrabold text-ink">
                    Bước 1: Giải Mã Video Mẫu (Decode Nhịp Cắt, Góc Máy & Hook 3 Giây Đầu)
                  </h2>
                  <p className="text-xs text-muted">
                    Tải lên 1 video mẫu anh thích (TikTok/Reels/Quảng cáo) hoặc chọn ngay video có sẵn trên máy. Hệ thống tự cache kết quả phân tích để chạy tức thì.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mr-2">
                  <input
                    type="checkbox"
                    checked={useClaudeForDecode}
                    onChange={(e) => setUseClaudeForDecode(e.target.checked)}
                  />
                  Dùng Claude AI phân tích sâu ảnh Contact Sheet
                </label>
                <label
                  className={cx(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition",
                    (decodeBusy || uploadPct !== null) && "pointer-events-none opacity-60",
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{uploadPct !== null ? `Đang tải ${uploadPct}%...` : "Tải Video Mẫu cần Decode (.mp4/.mov)"}</span>
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
                  onClick={() => void handleDecodeVideo(decodedBlueprint?.sourceVideoPath, false)}
                >
                  <Scissors className="mr-1 h-3.5 w-3.5" />
                  Decode lại
                </Button>
              </div>
            </div>

            {/* Thanh chọn nhanh Video có sẵn trên máy */}
            {(catalog?.localVideos ?? []).length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-muted">Kho Video trên máy:</span>
                {(catalog.localVideos as any[]).slice(0, 5).map((v) => (
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
                    🎞️ {v.name} ({v.sizeMB} MB)
                  </button>
                ))}
              </div>
            )}

            {/* KẾT QUẢ BƯỚC 1: VIDEO MẪU + CONTACT SHEET + DANH SÁCH CẢNH ĐÃ BÓC TÁCH */}
            {decodedBlueprint && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="space-y-3 rounded-2xl border border-line bg-soft/40 p-3.5 lg:col-span-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-blue-600">
                      📊 Công thức đã bóc tách: {decodedBlueprint.sourceFileName}
                    </span>
                    <Badge tone="green">
                      {decodedBlueprint.shotCount} cảnh · {decodedBlueprint.avgShotSec}s/cảnh
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {decodedBlueprint.sourceVideoUrl && (
                      <div>
                        <div className="mb-1 text-[11px] font-bold text-muted">1. Video Mẫu Gốc:</div>
                        <video
                          key={decodedBlueprint.sourceVideoUrl}
                          src={decodedBlueprint.sourceVideoUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="h-36 w-full rounded-xl border border-line bg-black object-contain"
                        />
                      </div>
                    )}
                    {decodedBlueprint.contactSheetUrl && (
                      <div>
                        <div className="mb-1 text-[11px] font-bold text-muted">2. Bảng Contact Sheet FFmpeg:</div>
                        <img
                          src={decodedBlueprint.contactSheetUrl}
                          alt="Contact Sheet"
                          className="h-36 w-full rounded-xl border border-line bg-black object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* Hiển thị ngay Video MP4 Mới Đã Tạo ngay tại Bước 1 để không phải cuộn xuống */}
                  <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
                        3. 🎬 Video MP4 Mới Đã Dựng Theo Công Thức Decode:
                      </span>
                      {clonedResult?.renderedVideoUrl && !cloneBusy && (
                        <a
                          href={clonedResult.renderedVideoUrl}
                          download={`zono-decoded-video-${Date.now()}.mp4`}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                        >
                          <Download className="h-3 w-3" />
                          Tải MP4
                        </a>
                      )}
                    </div>
                    {cloneBusy ? (
                      <div className="flex items-center gap-2 py-6 justify-center text-emerald-700 dark:text-emerald-300 font-semibold">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang lồng tiếng VieNeu-TTS & kết xuất Video MP4 mới (~5s)...
                      </div>
                    ) : (
                      clonedResult?.renderedVideoUrl && (
                        <video
                          key={clonedResult.renderedVideoUrl}
                          src={clonedResult.renderedVideoUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="h-48 w-full rounded-xl border border-emerald-500/40 bg-black object-contain shadow-sm"
                        />
                      )
                    )}
                  </div>

                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs space-y-1">
                    <div className="font-extrabold text-amber-800 dark:text-amber-300">
                      🎯 Công thức Hook 3 Giây Đầu & Nhịp Dựng:
                    </div>
                    <p className="text-ink"><b>Mở bài:</b> {decodedBlueprint.hookFormula?.first3SecHook}</p>
                    <p className="text-muted"><b>Kỹ thuật:</b> {decodedBlueprint.hookFormula?.visualHookTechnique}</p>
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-line bg-soft/40 p-3.5 lg:col-span-7">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-600">
                      🎞️ {decodedBlueprint.shotCount} Phân cảnh mẫu & Hướng dẫn chọn cảnh quay sẵn tương ứng
                    </span>
                    <span className="text-[11px] font-medium text-muted">{decodedBlueprint.pacingLabel}</span>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1 scroll-thin">
                    {(decodedBlueprint.decodedShots ?? []).map((sh: any) => (
                      <div key={sh.sceneNumber} className="rounded-xl border border-line bg-card p-2.5 text-xs space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-extrabold text-ink">
                            Cảnh {sh.sceneNumber} ({sh.startSec}s → {sh.endSec}s · dài {sh.durationSec}s)
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Badge tone="blue">Zoom: {sh.recommendedZoom}</Badge>
                            <Badge tone="amber">Chuyển: {sh.recommendedTransition}</Badge>
                          </div>
                        </div>
                        <p className="text-muted">{sh.cameraAngle} — {sh.visualDescription}</p>
                        <p className="text-emerald-700 dark:text-emerald-300 font-semibold">
                          💡 Cách chọn clip quay sẵn: {sh.howToShootOrSelect}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* BƯỚC 2: NẠP VIDEO QUAY SẴN + NHẬP CHỦ ĐỀ & CẤU HÌNH DỰNG */}
          <Card className="border-2 border-indigo-500/30 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-extrabold text-white">
                  2
                </span>
                <div>
                  <h2 className="text-base font-extrabold text-ink">
                    Bước 2: Chọn Video Quay Sẵn (Raw Footage) & Nhập Nội Dung Muốn Làm
                  </h2>
                  <p className="text-xs text-muted">
                    Đưa các clip quay sản phẩm/cửa hàng của anh vào, chọn lồng tiếng Việt tự nhiên hoặc giữ âm thanh gốc của clip.
                  </p>
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition">
                <Film className="h-3.5 w-3.5" />
                <span>+ Tải lên các Video Quay Sẵn (.mp4/.mov)</span>
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
                        setRawFootageList((prev) => [
                          ...prev,
                          { path: r.path, name: `${f.name} (${(f.size / 1048576).toFixed(1)} MB)` },
                        ]);
                      } catch (err: any) {
                        toast(err?.message ?? "Lỗi tải video quay sẵn", "err");
                      }
                    }
                  }}
                />
              </label>
            </div>

            {/* Chọn nhanh clip quay sẵn từ kho máy hoặc danh sách đã thêm */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-muted">Chọn thêm từ kho Video có sẵn trên máy:</span>
                {(catalog?.localVideos ?? []).slice(0, 5).map((v: any) => {
                  const added = rawFootageList.some((r) => r.path === v.path);
                  return (
                    <button
                      key={v.path}
                      type="button"
                      onClick={() => {
                        if (added) {
                          setRawFootageList((prev) => prev.filter((r) => r.path !== v.path));
                        } else {
                          setRawFootageList((prev) => [...prev, { path: v.path, name: v.name }]);
                        }
                      }}
                      className={cx(
                        "rounded-lg border px-2.5 py-1 font-medium transition",
                        added
                          ? "border-indigo-600 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold"
                          : "border-line bg-card text-ink hover:bg-soft",
                      )}
                    >
                      {added ? "✓ Đã chọn: " : "+ Thêm: "}
                      {v.name}
                    </button>
                  );
                })}
              </div>

              {rawFootageList.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-indigo-500/[0.06] p-2.5 text-xs">
                  <span className="font-bold text-indigo-700 dark:text-indigo-300">
                    Đang dùng {rawFootageList.length} video quay sẵn:
                  </span>
                  {rawFootageList.map((m, idx) => (
                    <span
                      key={`${m.path}_${idx}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-card px-2.5 py-1 font-semibold text-ink"
                    >
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
                  <button
                    type="button"
                    onClick={() => setRawFootageList([])}
                    className="ml-auto text-[11px] font-semibold text-rose-600 hover:underline"
                  >
                    Xóa hết
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line bg-soft/40 px-3 py-2 text-xs text-muted">
                  💡 Chưa chọn clip riêng — hệ thống sẽ tự động lấy nguồn Video Mẫu trên máy để dựng thử ngay cho anh xem trước.
                </div>
              )}
            </div>

            {/* Ô nhập Chủ đề / Sản phẩm + Cấu hình Âm thanh & Giọng đọc */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="space-y-2 lg:col-span-7">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-muted">
                  Chủ đề / Sản phẩm / Thông điệp muốn Claude AI viết theo công thức Decode:
                </label>
                <textarea
                  rows={2}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Nhập sản phẩm, điểm mạnh, ưu đãi hoặc nội dung anh muốn truyền tải..."
                  className="w-full rounded-2xl border border-line bg-card px-3.5 py-2.5 text-sm text-ink focus:border-indigo-600 focus:outline-none"
                />
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TOPIC_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setTopic(p.text)}
                      className="rounded-lg border border-line bg-soft px-2.5 py-1 text-[11px] font-semibold text-ink hover:border-indigo-400"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 lg:col-span-5">
                <div>
                  <label className="mb-1 block text-xs font-bold text-muted">Chế độ Âm thanh</label>
                  <select
                    value={audioMode}
                    onChange={(e) => setAudioMode(e.target.value as "voiceover" | "keep_audio")}
                    className="w-full rounded-xl border border-line bg-card px-3 py-2 text-xs font-semibold text-ink"
                  >
                    <option value="voiceover">🎙️ Lồng tiếng Việt AI (VieNeu-TTS)</option>
                    <option value="keep_audio">🔊 Giữ tiếng gốc của Video Quay Sẵn</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-muted">Giọng đọc (khi lồng tiếng)</label>
                  <select
                    value={voice}
                    disabled={audioMode === "keep_audio"}
                    onChange={(e) => setVoice(e.target.value)}
                    className="w-full rounded-xl border border-line bg-card px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                  >
                    <option value="Ngọc Huyền">🎙️ Ngọc Huyền (Nữ miền Bắc)</option>
                    <option value="Bình">🎙️ Bình (Nam miền Bắc)</option>
                    <option value="Vĩnh">🎙️ Vĩnh (Nam miền Nam)</option>
                    <option value="Đoan">🎙️ Đoan (Nữ miền Nam)</option>
                    <option value="Tuyên">🎙️ Tuyên (Nam truyền cảm)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-muted">Phong cách nhịp cắt</label>
                  <select
                    value={editStyle}
                    onChange={(e) => setEditStyle(e.target.value as "dynamic" | "smooth" | "clean")}
                    className="w-full rounded-xl border border-line bg-card px-3 py-2 text-xs font-semibold text-ink"
                  >
                    <option value="dynamic">⚡ Năng động (Zoom mạnh · TikTok)</option>
                    <option value="clean">✨ Gọn gàng (Thương mại · Chốt đơn)</option>
                    <option value="smooth">🎬 Mượt mà (Chuyển cảnh êm)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-muted">Khung hình xuất</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value as "9:16" | "16:9")}
                    className="w-full rounded-xl border border-line bg-card px-3 py-2 text-xs font-semibold text-ink"
                  >
                    <option value="9:16">📱 Dọc 9:16 (TikTok / Reels / Shorts)</option>
                    <option value="16:9">🖥️ Ngang 16:9 (YouTube / Web)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={renderRealMp4}
                  onChange={(e) => setRenderRealMp4(e.target.checked)}
                />
                Kết xuất luôn file Video MP4 hoàn chỉnh bằng Local FFmpeg (-14 LUFS)
              </label>

              <Button
                variant="primary"
                loading={cloneBusy}
                onClick={() => void handleCloneFromDecoded(false)}
                className="bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-2.5 text-sm font-bold shadow-md hover:from-indigo-700 hover:to-blue-700"
              >
                <Wand2 className="mr-1.5 h-4 w-4" />
                🎬 Học Theo Video Decode & Dựng Phim Mới Ngay (Claude + Local)
              </Button>
            </div>
          </Card>

          {/* BƯỚC 3: CHỈNH SỬA TRỰC TIẾP TỪNG CẢNH & XUẤT LẠI MP4 SIÊU TỐC */}
          {clonedResult && (
            <Card className="border-2 border-emerald-500/35 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-extrabold text-white">
                    3
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                      Bước 3: Tinh Chỉnh Từng Câu Thoại & Tải Phim MP4 Hoàn Chỉnh ({clonedResult.hookTitle})
                    </h3>
                    <p className="text-xs text-muted">{clonedResult.renderNotes}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="green">Bộ não: {clonedResult.providerUsed}</Badge>
                  <Button
                    size="sm"
                    variant="primary"
                    loading={cloneBusy}
                    onClick={() => void handleCloneFromDecoded(true)}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    ⚡ Xuất lại MP4 theo lời thoại vừa sửa
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                {/* Cột trái: Bảng chỉnh sửa trực tiếp từng cảnh */}
                <div className="space-y-2.5 lg:col-span-8">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-ink">
                      ✏️ Anh có thể sửa trực tiếp lời thoại hoặc chữ nổi trên màn hình của từng cảnh dưới đây rồi bấm "Xuất lại MP4":
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {editableScenes.map((sc: any, idx: number) => (
                      <div key={sc.sceneNumber} className="rounded-2xl border border-line bg-soft/40 p-3 text-xs space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                            Cảnh {sc.sceneNumber} ({sc.templateTiming})
                          </span>
                          <select
                            value={sc.zoom || "in"}
                            onChange={(e) => updateEditableScene(idx, { zoom: e.target.value })}
                            className="rounded-lg border border-line bg-card px-2 py-0.5 text-[11px] font-semibold text-ink"
                          >
                            <option value="punch">Zoom Punch</option>
                            <option value="in">Zoom In</option>
                            <option value="out">Zoom Out</option>
                            <option value="pan_left">Pan Trái</option>
                            <option value="pan_right">Pan Phải</option>
                            <option value="none">Giữ tĩnh</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-muted">Chữ nổi trên màn hình (Caption):</label>
                          <input
                            type="text"
                            value={sc.newOnScreenText || ""}
                            onChange={(e) => updateEditableScene(idx, { newOnScreenText: e.target.value })}
                            className="mt-0.5 w-full rounded-lg border border-line bg-card px-2.5 py-1 text-xs font-bold text-ink"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-muted">
                            Lời thoại {audioMode === "keep_audio" ? "(Phụ đề hiển thị)" : "(Giọng đọc VieNeu-TTS)"}:
                          </label>
                          <textarea
                            rows={2}
                            value={sc.newVoiceover || ""}
                            onChange={(e) => updateEditableScene(idx, { newVoiceover: e.target.value })}
                            className="mt-0.5 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-ink"
                          />
                        </div>

                        <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                          ✂️ <b>Nguồn ghép:</b> {sc.selectedRawCut?.sourceFileName} ({sc.selectedRawCut?.startSec}s – {sc.selectedRawCut?.endSec}s)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cột phải: Video Player + Tải về + Copy Caption */}
                <div className="space-y-3 lg:col-span-4">
                  <div className="rounded-2xl border border-line bg-card p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-ink">🎬 Video MP4 Hoàn Chỉnh:</span>
                      {clonedResult.renderedVideoUrl && (
                        <a
                          href={clonedResult.renderedVideoUrl}
                          download={`zono-video-${Date.now()}.mp4`}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Tải MP4 về máy
                        </a>
                      )}
                    </div>

                    {clonedResult.renderedVideoUrl && (
                      <video
                        key={clonedResult.renderedVideoUrl}
                        src={clonedResult.renderedVideoUrl}
                        controls
                        playsInline
                        className="mx-auto max-h-80 w-full rounded-2xl border border-line bg-black object-contain shadow-sm"
                      />
                    )}

                    <div className="rounded-xl bg-soft p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink">Caption gợi ý đăng kênh:</span>
                        <button
                          type="button"
                          onClick={() => copyText("clone_cap", clonedResult.caption || "")}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline"
                        >
                          {copiedKey === "clone_cap" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          Sao chép
                        </button>
                      </div>
                      <p className="text-muted leading-relaxed">{clonedResult.caption}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      ) : (
        /* TAB 2: BÀN DỰNG KỊCH BẢN PHÂN CẢNH ĐA GÓC MÁY & CAPTION 4 NỀN TẢNG */
        <div className="space-y-6">
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

          {/* Bước 2: Chọn Phong Cách Trực Quan */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-xs font-bold text-white">2</span>
                <h2 className="text-base font-bold text-slate-900">
                  Chọn Phong Cách Hình Ảnh & Kịch Bản
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

          {/* Bước 3: Nhập Chủ Đề & Bấm Dựng Kịch Bản Đa Kênh */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-600 text-xs font-bold text-white">3</span>
              <h2 className="text-base font-bold text-slate-900">
                Nhập Ý Tưởng & Khởi Chạy Tổ Hợp Dựng Kịch Bản Đa Góc Máy
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <textarea
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-600 focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    {
                      label: "🎬 Mẫu Phim Quay Sẵn (Học Theo Video Decode)",
                      niche: "commercial-brand",
                      style: "decoded_footage",
                      text: "Quy trình tuyển chọn nguyên liệu sạch và đóng gói tỉ mỉ tại cửa hàng mỗi sáng",
                    },
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
                <Button
                  onClick={() => void handleGenerateStoryboard(false)}
                  disabled={busy}
                  className="w-full justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-md hover:from-indigo-700 hover:to-violet-700"
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang dựng 5 phân cảnh...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Tạo Kịch Bản 5 Cảnh + Caption 4 Kênh
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>

          {plan && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-8">
                <Card className="p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-violet-600" />
                      <h3 className="text-base font-bold text-slate-900">
                        Bàn Dựng 5 Phân Cảnh Đa Góc Máy (ROOT · CONTINUATION · INSERT Close-Up 85mm)
                      </h3>
                    </div>
                    <Badge tone="green">{plan.style?.name}</Badge>
                  </div>

                  <div className="space-y-4">
                    {(plan.scenes ?? []).map((sc: any) => (
                      <div key={sc.index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <span className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-extrabold text-white">
                            {sc.code} · {sc.timeRange}
                          </span>
                          <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-900">
                            Chữ nổi: {sc.overlayText}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium italic text-slate-900">🎙️ "{sc.voiceVi}"</p>
                        <p className="mt-1 font-mono text-xs text-slate-600">🎥 {sc.cameraSentence}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div className="space-y-6 lg:col-span-4">
                <Card className="p-5">
                  <h3 className="mb-3 text-sm font-bold text-slate-900">🚀 Bộ Caption 4 Nền Tảng (Sao chép 1 chạm)</h3>
                  <div className="space-y-3">
                    {[
                      {
                        key: "yt",
                        label: "▶️ YouTube Title & Chapters",
                        content: `${plan.seoTitle}\n\n${(plan.multiPlatformCaptions?.youtube?.chapters ?? []).join("\n")}\n\n${(plan.hashtags ?? []).join(" ")}`,
                      },
                      { key: "tt", label: "🎵 TikTok Caption", content: plan.multiPlatformCaptions?.tiktok ?? "" },
                      { key: "fb", label: "📘 Facebook Reels", content: plan.multiPlatformCaptions?.facebook ?? "" },
                      { key: "ig", label: "📸 Instagram Reels", content: plan.multiPlatformCaptions?.instagram ?? "" },
                    ].map((item) => (
                      <div key={item.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{item.label}</span>
                          <button
                            type="button"
                            onClick={() => copyText(item.key, item.content)}
                            className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-indigo-600 shadow-sm"
                          >
                            {copiedKey === item.key ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            Sao chép
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
      )}
    </div>
  );
}
