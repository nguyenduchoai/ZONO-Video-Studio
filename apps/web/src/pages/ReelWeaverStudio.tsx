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

  // State cho Trạm Decode Video Mẫu & Dựng Phim Từ Video Quay Sẵn (Local FFmpeg + Whisper + CLI AI)
  const [selectedCli, setSelectedCli] = useState<"claude_cli" | "gemini_cli" | "codex_cli">("claude_cli");
  const [showOriginalVoice, setShowOriginalVoice] = useState<boolean>(false);
  const [captionPosition, setCaptionPosition] = useState<"top" | "center" | "bottom" | "hidden">("bottom");
  const [headlinePosition, setHeadlinePosition] = useState<"top" | "center" | "bottom" | "hidden">("top");
  const [chatInput, setChatInput] = useState<string>("");
  const [chatBusy, setChatBusy] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<
    { role: "user" | "ai"; text: string; changes?: string[]; provider?: string }[]
  >([]);
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
    const initCli =
      catalog.aiProvider?.provider && ["claude_cli", "gemini_cli", "codex_cli"].includes(catalog.aiProvider.provider)
        ? catalog.aiProvider.provider
        : "claude_cli";
    setSelectedCli(initCli);
    if (!decodedBlueprint && !decodeBusy) void handleDecodeVideo(undefined, true, initCli);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  const handleDecodeVideo = async (videoPath?: string, silent = false, cliOverride?: "claude_cli" | "gemini_cli" | "codex_cli") => {
    const activeCli = cliOverride ?? selectedCli;
    setDecodeBusy(true);
    try {
      const res = await api.post<any>("studio/decode-video", {
        videoPath,
        referenceNotes: topic,
        useWhisper: true,
        useClaude: useClaudeForDecode,
        preferredProvider: activeCli,
      });
      setDecodedBlueprint(res.blueprint);
      if (res.blueprint?.recommendedEditStyle) {
        setEditStyle(res.blueprint.recommendedEditStyle);
      }
      // Đồng bộ tức thì số cảnh của Bước 3 bên dưới theo đúng số cảnh vừa Decode ở Bước 1 (tránh lệch số cảnh trong lúc chờ AI viết lời mới)
      if (res.blueprint?.decodedShots?.length) {
        setEditableScenes(
          res.blueprint.decodedShots.map((dShot: any, idx: number) => ({
            sceneNumber: idx + 1,
            templateTiming: `${dShot.startSec.toFixed(1)}s – ${dShot.endSec.toFixed(1)}s (${dShot.durationSec.toFixed(1)}s)`,
            durationSec: dShot.durationSec,
            originalShotSummary: dShot.visualDescription,
            newVoiceover: `Đang dùng ${activeCli === "claude_cli" ? "Claude CLI" : activeCli === "gemini_cli" ? "Gemini CLI" : "Codex CLI"} viết lời Voice mới cho Cảnh ${idx + 1}...`,
            newOnScreenText: dShot.onScreenText || `ĐIỂM NHẤN #${idx + 1}`,
            selectedRawCut: {
              sourceIndex: 0,
              sourceFileName: res.blueprint.sourceFileName,
              startSec: dShot.startSec,
              endSec: dShot.endSec,
            },
            zoom: dShot.recommendedZoom || "in",
            transition: dShot.recommendedTransition || "slideleft",
          })),
        );
      }
      if (!silent) {
        toast(`Đã Decode xong bằng ${activeCli === "claude_cli" ? "Claude CLI" : activeCli === "gemini_cli" ? "Gemini CLI" : "Codex CLI"} (${res.blueprint.shotCount} cảnh) — đang tự động viết kịch bản mới & dựng MP4 bên dưới...`, "info");
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
            captionPosition,
            headlinePosition,
            renderMp4: renderRealMp4,
            useClaude: useClaudeForDecode,
            preferredProvider: activeCli,
          });
          setClonedResult(cloneRes.result);
          setEditableScenes(cloneRes.result?.scenes ?? []);
          if (!silent) {
            toast(`🎉 Đã cập nhật xong ${cloneRes.result?.scenes?.length ?? res.blueprint.shotCount} cảnh & Video MP4 mới bên dưới!`, "ok");
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

  const handleCloneFromDecoded = async (
    useEditedScenes = false,
    posOverride?: {
      captionPosition?: "top" | "center" | "bottom" | "hidden";
      headlinePosition?: "top" | "center" | "bottom" | "hidden";
    },
  ) => {
    if (!decodedBlueprint) {
      toast("Vui lòng chọn hoặc tải 1 Video Mẫu ở Bước 1 trước!", "err");
      return;
    }
    const nextCaptionPos = posOverride?.captionPosition ?? captionPosition;
    const nextHeadlinePos = posOverride?.headlinePosition ?? headlinePosition;
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
        captionPosition: nextCaptionPos,
        headlinePosition: nextHeadlinePos,
        renderMp4: renderRealMp4,
        useClaude: !useEditedScenes,
        preferredProvider: selectedCli,
        customScenes: useEditedScenes
          ? editableScenes.map((s) => ({
              sceneNumber: s.sceneNumber,
              newVoiceover: s.newVoiceover,
              newOnScreenText: s.newOnScreenText,
              zoom: s.zoom,
              transition: s.transition,
              rawSourceIndex: s.selectedRawCut?.sourceIndex,
              rawStartSec: s.selectedRawCut?.startSec,
              rawEndSec: s.selectedRawCut?.endSec,
            }))
          : undefined,
      });
      setClonedResult(res.result);
      setEditableScenes(res.result?.scenes ?? []);
      if (res.result?.captionPosition) setCaptionPosition(res.result.captionPosition);
      if (res.result?.headlinePosition) setHeadlinePosition(res.result.headlinePosition);
      toast(
        useEditedScenes
          ? "Đã kết xuất lại Video MP4 theo đúng cách cắt, lời thoại & vị trí chữ anh vừa chỉnh!"
          : "Đã học theo Video Decode và dựng xong Phim Mới từ Video Quay Sẵn!",
        "ok",
      );
    } catch (e: any) {
      toast(e?.message ?? "Lỗi khi dựng phim theo công thức Decode", "err");
    } finally {
      setCloneBusy(false);
    }
  };

  const handleChatEditVideo = async (presetText?: string) => {
    const msg = (presetText ?? chatInput).trim();
    if (!msg) {
      toast("Vui lòng nhập yêu cầu thay đổi cách cắt, lời thoại hoặc vị trí đặt chữ!", "err");
      return;
    }
    if (!decodedBlueprint) {
      toast("Đang tải Video Mẫu Decode, vui lòng thử lại sau giây lát!", "err");
      return;
    }
    if (!presetText) setChatInput("");
    setChatHistory((prev) => [...prev, { role: "user", text: msg }]);
    setChatBusy(true);
    setCloneBusy(true);
    try {
      const currentProd = clonedResult ?? {
        id: "init",
        topic,
        product: catalog?.productsSummary || topic,
        brandName: catalog?.brandName || "ZONO",
        providerUsed: selectedCli,
        blueprintId: decodedBlueprint.id,
        pacingApplied: decodedBlueprint.pacingLabel,
        editStyle,
        captionPosition,
        headlinePosition,
        hookTitle: `${topic.slice(0, 28).toUpperCase()}`,
        ctaText: "Nhắn tin ngay để nhận ưu đãi!",
        caption: topic,
        scenes: editableScenes,
        renderedVideoUrl: null,
        renderedDurationSec: decodedBlueprint.durationSec,
        renderNotes: "",
      };
      const res = await api.post<any>("studio/chat-edit-video", {
        message: msg,
        blueprint: decodedBlueprint,
        currentProduction: {
          ...currentProd,
          captionPosition,
          headlinePosition,
          editStyle,
          scenes: editableScenes.length ? editableScenes : currentProd.scenes,
        },
        rawVideoPaths: rawFootageList.map((r) => r.path),
        voiceName: voice,
        audioMode,
        aspectRatio,
        preferredProvider: selectedCli,
      });
      if (res.production) {
        setClonedResult(res.production);
        setEditableScenes(res.production.scenes ?? []);
        if (res.production.captionPosition) setCaptionPosition(res.production.captionPosition);
        if (res.production.headlinePosition) setHeadlinePosition(res.production.headlinePosition);
        if (res.production.editStyle) setEditStyle(res.production.editStyle);
      }
      setChatHistory((prev) => [
        ...prev,
        {
          role: "ai",
          text: res.reply || "Đã cập nhật kịch bản, cách cắt, vị trí chữ và kết xuất lại Video MP4 mới!",
          changes: res.changesSummary ?? [],
          provider: res.providerUsed || selectedCli,
        },
      ]);
      toast("🎉 Đã áp dụng yêu cầu Chat & dựng lại Video MP4 mới!", "ok");
    } catch (e: any) {
      toast(e?.message ?? "Lỗi khi xử lý yêu cầu Chat chỉnh sửa video", "err");
    } finally {
      setChatBusy(false);
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
            {/* Bộ chọn CLI AI trực tiếp: Claude CLI · Gemini CLI · Codex CLI */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-black/25 px-2.5 py-1.5 text-xs font-semibold backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-indigo-100">Chọn CLI AI:</span>
              {[
                { id: "claude_cli" as const, label: "Claude CLI" },
                { id: "gemini_cli" as const, label: "Gemini CLI" },
                { id: "codex_cli" as const, label: "Codex CLI" },
              ].map((cli) => {
                const statusObj = (catalog?.cliProviders ?? []).find((p: any) => p.id === cli.id);
                const isReady = statusObj ? statusObj.ready : true;
                const active = selectedCli === cli.id;
                return (
                  <button
                    key={cli.id}
                    type="button"
                    onClick={() => {
                      setSelectedCli(cli.id);
                      void handleDecodeVideo(decodedBlueprint?.sourceVideoPath, false, cli.id);
                    }}
                    className={cx(
                      "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition",
                      active
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "bg-white/10 text-white/85 hover:bg-white/20",
                    )}
                    title={statusObj?.detail || cli.label}
                  >
                    <span className={cx("h-1.5 w-1.5 rounded-full", isReady ? "bg-emerald-400" : "bg-amber-400")} />
                    {cli.label}
                  </button>
                );
              })}
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
                    Bước 1: Giải Mã Video Mẫu (Bóc Tách Phân Cảnh & AI Viết Lời Voice Mới)
                  </h2>
                  <p className="text-xs text-muted">
                    Tải lên 1 video mẫu anh thích hoặc chọn video có sẵn. Decode xong hệ thống tự động đưa sang AI viết lại kịch bản mới & dựng MP4 bên dưới.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Bộ chọn CLI AI ngay tại Bước 1 */}
                <div className="inline-flex items-center gap-1 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs">
                  <span className="font-bold text-indigo-700 dark:text-indigo-300">🤖 CLI:</span>
                  <select
                    value={selectedCli}
                    onChange={(e) => {
                      const nextCli = e.target.value as "claude_cli" | "gemini_cli" | "codex_cli";
                      setSelectedCli(nextCli);
                      void handleDecodeVideo(decodedBlueprint?.sourceVideoPath, false, nextCli);
                    }}
                    className="bg-transparent font-extrabold text-indigo-700 dark:text-indigo-200 focus:outline-none"
                  >
                    <option value="claude_cli">Claude CLI (Anthropic)</option>
                    <option value="gemini_cli">Gemini CLI (Google)</option>
                    <option value="codex_cli">Codex CLI (OpenAI)</option>
                  </select>
                </div>

                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mr-1">
                  <input
                    type="checkbox"
                    checked={useClaudeForDecode}
                    onChange={(e) => setUseClaudeForDecode(e.target.checked)}
                  />
                  Dùng CLI AI phân tích kịch bản
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
                        <div className="mb-1 text-[11px] font-bold text-muted">
                          1. Video Mẫu Gốc {audioMode === "voiceover" ? "(🔇 Đã tắt Voice cũ)" : ""}:
                        </div>
                        <video
                          key={decodedBlueprint.sourceVideoUrl}
                          src={decodedBlueprint.sourceVideoUrl}
                          muted={audioMode === "voiceover"}
                          controls
                          playsInline
                          preload="metadata"
                          className="h-36 w-full rounded-xl border border-line bg-black object-contain"
                        />
                      </div>
                    )}
                    {decodedBlueprint.contactSheetUrl && (
                      <div>
                        <div className="mb-1 text-[11px] font-bold text-muted">
                          2. Bảng Contact Sheet ({decodedBlueprint.shotCount} cảnh):
                        </div>
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
                        3. 🎬 Video MP4 Mới Đã Dựng ({audioMode === "voiceover" ? `Voice AI mới: ${voice}` : "Giữ âm thanh gốc"}):
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
                        Đang dùng {selectedCli === "claude_cli" ? "Claude CLI" : selectedCli === "gemini_cli" ? "Gemini CLI" : "Codex CLI"} viết kịch bản mới & lồng tiếng VieNeu-TTS...
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
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-amber-800 dark:text-amber-300">
                        🎯 Công thức Mở Bài (Hook 3 Giây Đầu):
                      </span>
                      {audioMode === "voiceover" && decodedBlueprint.fullTranscript && (
                        <button
                          type="button"
                          onClick={() => setShowOriginalVoice((v) => !v)}
                          className="text-[11px] font-bold text-indigo-600 hover:underline"
                        >
                          {showOriginalVoice ? "🙈 Ẩn Voice cũ của video mẫu" : "👁️ Xem Voice cũ của video mẫu"}
                        </button>
                      )}
                    </div>
                    <p className="text-ink"><b>Mở bài:</b> {decodedBlueprint.hookFormula?.first3SecHook}</p>
                    {(audioMode === "keep_audio" || showOriginalVoice) && decodedBlueprint.fullTranscript && (
                      <p className="text-muted">
                        <b>🔊 Lời gốc trong Video Mẫu:</b> "{decodedBlueprint.fullTranscript}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 rounded-2xl border border-line bg-soft/40 p-3.5 lg:col-span-7">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-indigo-600">
                      🎞️ Đồng bộ {decodedBlueprint.shotCount} Phân cảnh Decode & Kịch bản Voice Mới (AI: {clonedResult?.providerUsed || decodedBlueprint.decodedByProvider || selectedCli})
                    </span>
                    <span className="text-[11px] font-medium text-muted">
                      {audioMode === "voiceover" ? `🔇 Đã ẩn Voice cũ · Đang dùng Voice mới (${voice})` : "🔊 Đang giữ Voice gốc"}
                    </span>
                  </div>
                  {/* Hiển thị đầy đủ TẤT CẢ các cảnh dạng lưới 2 cột (không cuộn ẩn làm tưởng nhầm chỉ có 2 cảnh) */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {(decodedBlueprint.decodedShots ?? []).map((sh: any, idx: number) => {
                      const matchedClone = editableScenes[idx];
                      return (
                        <div key={sh.sceneNumber} className="rounded-xl border border-line bg-card p-2.5 text-xs space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="font-extrabold text-ink">
                              Cảnh {sh.sceneNumber} ({sh.startSec}s → {sh.endSec}s · {sh.durationSec}s)
                            </span>
                            <div className="flex items-center gap-1">
                              <Badge tone="blue">Zoom: {sh.recommendedZoom}</Badge>
                              <Badge tone="amber">{sh.recommendedTransition}</Badge>
                            </div>
                          </div>
                          <p className="text-muted">📝 <b>Ý chính Decode:</b> {sh.visualDescription}</p>
                          {audioMode === "voiceover" ? (
                            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 font-semibold text-emerald-900 dark:text-emerald-200">
                              🎙️ <b>Voice mới (AI):</b> "{matchedClone?.newVoiceover || "Đang tạo lời thoại mới..."}"
                            </div>
                          ) : (
                            sh.spokenText && (
                              <p className="rounded-lg bg-indigo-500/[0.08] px-2.5 py-1.5 font-semibold text-ink">
                                🔊 Lời gốc giữ nguyên: "{sh.spokenText}"
                              </p>
                            )
                          )}
                          {audioMode === "voiceover" && showOriginalVoice && sh.spokenText && (
                            <p className="text-[11px] italic text-muted">
                              (Voice cũ đã tắt: "{sh.spokenText}")
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 💬 KHUNG CHAT ĐẠO DIỄN AI TRỰC TIẾP: THAY ĐỔI CÁCH CẮT, LỜI THOẠI, VỊ TRÍ ĐẶT CHỮ */}
                  <div className="mt-3 rounded-2xl border-2 border-indigo-500/40 bg-indigo-500/[0.07] p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
                          💬
                        </span>
                        <div>
                          <div className="text-xs font-extrabold text-indigo-800 dark:text-indigo-200">
                            Chat Đạo Diễn AI ({selectedCli === "claude_cli" ? "Claude CLI" : selectedCli === "gemini_cli" ? "Gemini CLI" : "Codex CLI"}): Sửa Cách Cắt · Lời Thoại · Vị Trí Đặt Chữ
                          </div>
                          <div className="text-[11px] text-muted">
                            Nhắn yêu cầu bất kỳ hoặc bấm nút chọn nhanh bên dưới — AI tự động sửa và kết xuất lại Video MP4 ngay lập tức!
                          </div>
                        </div>
                      </div>

                      {/* Thanh chọn nhanh Vị trí đặt chữ Phụ đề (Caption Position) */}
                      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-indigo-500/30 bg-card px-2 py-1 text-[11px]">
                        <span className="font-bold text-muted mr-1">📍 Vị trí đặt chữ:</span>
                        {[
                          { id: "top" as const, label: "⬆️ Trên cao" },
                          { id: "center" as const, label: "🎯 Chính giữa" },
                          { id: "bottom" as const, label: "⬇️ Dưới đáy" },
                          { id: "hidden" as const, label: "🙈 Ẩn chữ" },
                        ].map((pos) => (
                          <button
                            key={pos.id}
                            type="button"
                            disabled={cloneBusy || chatBusy}
                            onClick={() => {
                              setCaptionPosition(pos.id);
                              void handleCloneFromDecoded(true, { captionPosition: pos.id });
                            }}
                            className={cx(
                              "rounded-lg px-2 py-0.5 font-bold transition",
                              captionPosition === pos.id
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-soft text-ink hover:bg-indigo-500/15",
                            )}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Các nút gợi ý Chat 1-Click theo 3 nhóm: Vị trí chữ · Cách cắt · Lời thoại */}
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {[
                        "📍 Đưa chữ phụ đề ra chính giữa màn hình",
                        "📍 Đưa chữ phụ đề lên phía trên màn hình",
                        "✂️ Đổi cách cắt sang nhịp nhanh TikTok + Zoom Punch mạnh",
                        "🎬 Đổi cách cắt sang nhịp mượt điện ảnh (Dissolve êm)",
                        "⏱️ Cắt ngắn mỗi cảnh đi cho nhịp nhanh gọn hơn",
                        "🎙️ Viết lại lời thoại tất cả các cảnh ngắn gọn, chốt đơn mạnh hơn",
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          disabled={chatBusy || cloneBusy}
                          onClick={() => void handleChatEditVideo(chip)}
                          className="rounded-lg border border-indigo-500/30 bg-card px-2.5 py-1 font-semibold text-indigo-700 dark:text-indigo-200 hover:bg-indigo-600 hover:text-white transition disabled:opacity-50"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>

                    {/* Ô nhập Chat trực tiếp */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleChatEditVideo();
                      }}
                      className="flex flex-col gap-2 sm:flex-row"
                    >
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Nhập yêu cầu cho AI: VD 'Đưa chữ lên giữa màn hình, sửa lời cảnh 1 ngắn hơn, cắt cảnh 2 nhịp nhanh Zoom Punch'..."
                        className="flex-1 rounded-xl border border-indigo-500/40 bg-card px-3.5 py-2 text-xs font-medium text-ink focus:border-indigo-600 focus:outline-none"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="primary"
                        loading={chatBusy || cloneBusy}
                        className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold shrink-0"
                      >
                        <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                        Gửi AI & Dựng Lại MP4
                      </Button>
                    </form>

                    {/* Lịch sử phản hồi của Đạo diễn AI */}
                    {chatHistory.length > 0 && (
                      <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-line bg-card p-2.5 text-xs">
                        {chatHistory.slice(-4).map((m, i) => (
                          <div
                            key={i}
                            className={cx(
                              "rounded-lg px-2.5 py-1.5",
                              m.role === "user"
                                ? "bg-indigo-500/10 font-semibold text-indigo-800 dark:text-indigo-200"
                                : "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
                            )}
                          >
                            <div>
                              <b>{m.role === "user" ? "🧑 Anh yêu cầu:" : `🤖 Đạo diễn AI (${m.provider || selectedCli}):`}</b> {m.text}
                            </div>
                            {m.changes && m.changes.length > 0 && (
                              <ul className="mt-1 list-disc pl-4 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                                {m.changes.map((c, ci) => (
                                  <li key={ci}>{c}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
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
          {(clonedResult || editableScenes.length > 0) && (
            <Card className="border-2 border-emerald-500/35 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-extrabold text-white">
                    3
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                      Bước 3: Tinh Chỉnh {editableScenes.length} Cảnh Đã Đồng Bộ Theo Decode & Tải MP4 ({clonedResult?.hookTitle || "Kịch Bản Mới"})
                    </h3>
                    <p className="text-xs text-muted">
                      {cloneBusy
                        ? `Đang dùng ${selectedCli === "claude_cli" ? "Claude CLI" : selectedCli === "gemini_cli" ? "Gemini CLI" : "Codex CLI"} viết lời Voice mới & kết xuất MP4 cho đúng ${editableScenes.length} cảnh...`
                        : clonedResult?.renderNotes}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="green">Bộ não AI: {clonedResult?.providerUsed || selectedCli}</Badge>
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
                {/* Cột trái: Bảng chỉnh sửa trực tiếp từng cảnh (Cách cắt, Lời thoại, Vị trí đặt chữ) */}
                <div className="space-y-3 lg:col-span-8">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.06] p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-indigo-800 dark:text-indigo-200">📍 Vị trí chữ Phụ đề:</span>
                        <select
                          value={captionPosition}
                          onChange={(e) => {
                            const nextPos = e.target.value as "top" | "center" | "bottom" | "hidden";
                            setCaptionPosition(nextPos);
                            void handleCloneFromDecoded(true, { captionPosition: nextPos });
                          }}
                          className="rounded-lg border border-indigo-500/40 bg-card px-2.5 py-1 text-xs font-bold text-ink"
                        >
                          <option value="top">⬆️ Đặt ở Trên cao (22%)</option>
                          <option value="center">🎯 Đặt Chính giữa (52%)</option>
                          <option value="bottom">⬇️ Đặt ở Dưới đáy (77% · Mặc định)</option>
                          <option value="hidden">🙈 Ẩn chữ Phụ đề</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-indigo-800 dark:text-indigo-200">🏷️ Vị trí Tiêu đề cảnh:</span>
                        <select
                          value={headlinePosition}
                          onChange={(e) => {
                            const nextHPos = e.target.value as "top" | "center" | "bottom" | "hidden";
                            setHeadlinePosition(nextHPos);
                            void handleCloneFromDecoded(true, { headlinePosition: nextHPos });
                          }}
                          className="rounded-lg border border-indigo-500/40 bg-card px-2.5 py-1 text-xs font-bold text-ink"
                        >
                          <option value="top">⬆️ Trên cao (27%)</option>
                          <option value="center">🎯 Chính giữa (48%)</option>
                          <option value="bottom">⬇️ Phía dưới (68%)</option>
                          <option value="hidden">🙈 Ẩn Tiêu đề cảnh</option>
                        </select>
                      </div>
                    </div>

                    <span className="text-[11px] font-semibold text-muted">
                      ✏️ Sửa trực tiếp bên dưới hoặc dùng Khung Chat Đạo Diễn AI rồi bấm "Xuất lại MP4"
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {editableScenes.map((sc: any, idx: number) => (
                      <div key={sc.sceneNumber} className="rounded-2xl border border-line bg-soft/40 p-3 text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                            Cảnh {sc.sceneNumber} ({sc.templateTiming})
                          </span>
                          <div className="flex items-center gap-1">
                            <select
                              value={sc.zoom || "in"}
                              onChange={(e) => updateEditableScene(idx, { zoom: e.target.value })}
                              className="rounded-lg border border-line bg-card px-2 py-0.5 text-[11px] font-semibold text-ink"
                              title="Hiệu ứng Zoom khung hình"
                            >
                              <option value="punch">Zoom Punch</option>
                              <option value="in">Zoom In</option>
                              <option value="out">Zoom Out</option>
                              <option value="pan_left">Pan Trái</option>
                              <option value="pan_right">Pan Phải</option>
                              <option value="none">Giữ tĩnh</option>
                            </select>
                            <select
                              value={sc.transition || "slideleft"}
                              onChange={(e) => updateEditableScene(idx, { transition: e.target.value })}
                              className="rounded-lg border border-line bg-card px-2 py-0.5 text-[11px] font-semibold text-ink"
                              title="Hiệu ứng chuyển cảnh"
                            >
                              <option value="cut">Cắt dứt khoát (Cut)</option>
                              <option value="slideleft">Trượt nhanh (Slide)</option>
                              <option value="zoomin">Phóng chuyển (ZoomIn)</option>
                              <option value="dissolve">Hòa tan mượt (Dissolve)</option>
                              <option value="fade">Mờ dần (Fade)</option>
                            </select>
                          </div>
                        </div>

                        {/* Chỉnh trực tiếp Cách cắt (Từ giây -> Đến giây) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-2.5 py-1.5 text-[11px]">
                          <span className="font-bold text-emerald-800 dark:text-emerald-300">
                            ✂️ Cách cắt ({sc.selectedRawCut?.sourceFileName || "Video gốc"}):
                          </span>
                          <div className="flex items-center gap-1 font-semibold text-ink">
                            <span>Từ</span>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={sc.selectedRawCut?.startSec ?? 0}
                              onChange={(e) =>
                                updateEditableScene(idx, {
                                  selectedRawCut: {
                                    ...sc.selectedRawCut,
                                    startSec: Math.max(0, Number(e.target.value) || 0),
                                  },
                                })
                              }
                              className="w-14 rounded border border-line bg-card px-1.5 py-0.5 text-center text-[11px] font-bold"
                            />
                            <span>s →</span>
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              value={sc.selectedRawCut?.endSec ?? 5}
                              onChange={(e) =>
                                updateEditableScene(idx, {
                                  selectedRawCut: {
                                    ...sc.selectedRawCut,
                                    endSec: Math.max(0.5, Number(e.target.value) || 5),
                                  },
                                })
                              }
                              className="w-14 rounded border border-line bg-card px-1.5 py-0.5 text-center text-[11px] font-bold"
                            />
                            <span>s</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-muted">Chữ nổi trên màn hình (Tiêu đề cảnh):</label>
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
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cột phải: Video Player + Tải về + Copy Caption */}
                <div className="space-y-3 lg:col-span-4">
                  <div className="rounded-2xl border border-line bg-card p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-ink">🎬 Video MP4 Hoàn Chỉnh:</span>
                      {clonedResult?.renderedVideoUrl && !cloneBusy && (
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

                    {cloneBusy ? (
                      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 py-12 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Đang dựng Video MP4 mới & tắt Voice cũ...</span>
                      </div>
                    ) : (
                      clonedResult?.renderedVideoUrl && (
                        <video
                          key={clonedResult.renderedVideoUrl}
                          src={clonedResult.renderedVideoUrl}
                          controls
                          playsInline
                          className="mx-auto max-h-80 w-full rounded-2xl border border-line bg-black object-contain shadow-sm"
                        />
                      )
                    )}

                    <div className="rounded-xl bg-soft p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink">Caption gợi ý đăng kênh:</span>
                        <button
                          type="button"
                          onClick={() => copyText("clone_cap", clonedResult?.caption || "")}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline"
                        >
                          {copiedKey === "clone_cap" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          Sao chép
                        </button>
                      </div>
                      <p className="text-muted leading-relaxed">{clonedResult?.caption || "Đang tạo caption mới..."}</p>
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
