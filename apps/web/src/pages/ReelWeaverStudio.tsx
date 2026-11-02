import React, { useEffect, useRef, useState } from "react";
import { api, apiUrl, currentBizId } from "../lib/api";
import { QuickEdit } from "./QuickEdit";

async function uploadMediaFile(file: File): Promise<{ path: string; name: string; url: string }> {
  const res = await fetch(apiUrl(`/v1/uploads/stream?name=${encodeURIComponent(file.name)}`), {
    method: "PUT",
    headers: {
      "content-type": "application/octet-stream", // server chỉ có parser octet-stream cho /uploads/stream
      ...(currentBizId() ? { "x-biz-id": currentBizId()! } : {}),
    },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Lỗi tải tệp (${res.status})`);
  const savedFileName = data.path ? String(data.path).split(/[\\/]/).pop() || file.name : file.name;
  return {
    path: data.path,
    name: data.name || file.name,
    url: `/v1/uploads/${encodeURIComponent(savedFileName)}`,
  };
}

type CliProvider = "claude_cli" | "gemini_cli" | "codex_cli";
type TextPosition = "top" | "center" | "bottom" | "hidden";
type TextTheme = "gold" | "yellow_full" | "emerald" | "coral" | "cyan" | "violet";
type CaptionBgStyle = "solid_dark" | "translucent" | "brand_box" | "none";

interface DecodedShot {
  sceneNumber: number;
  shotId: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  spokenText: string;
  visualDescription: string;
  cameraAngle: string;
  recommendedZoom: "in" | "out" | "punch" | "pan_left" | "pan_right" | "none";
  recommendedTransition: string;
  onScreenText: string;
  howToShootOrSelect: string;
}

interface DecodedVideoBlueprint {
  id: string;
  sourceVideoPath: string;
  sourceVideoUrl: string;
  sourceFileName: string;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  shotCount: number;
  avgShotSec: number;
  pacingLabel: string;
  recommendedEditStyle: "dynamic" | "smooth" | "clean";
  contactSheetUrl: string | null;
  fullTranscript: string;
  wordsPerMinute: number;
  decodedByProvider: string;
  hookFormula: {
    first3SecHook: string;
    visualHookTechnique: string;
    onScreenHookTitle: string;
  };
  narrativeArc: string[];
  editingRhythmNotes: string;
  decodedShots: DecodedShot[];
  reusablePromptTemplate: string;
}

interface ClonedProductionScene {
  sceneNumber: number;
  templateTiming: string;
  durationSec: number;
  originalShotSummary: string;
  newVoiceover: string;
  newOnScreenText: string;
  selectedRawCut: {
    sourceIndex: number;
    sourceFileName: string;
    startSec: number;
    endSec: number;
  };
  zoom: string;
  transition: string;
  directorNote: string;
}

interface ClonedVideoProductionResult {
  id: string;
  topic: string;
  product: string;
  brandName: string;
  providerUsed: string;
  blueprintId: string;
  pacingApplied: string;
  editStyle: "dynamic" | "smooth" | "clean";
  captionPosition: TextPosition;
  headlinePosition: TextPosition;
  textTheme?: TextTheme;
  captionBgStyle?: CaptionBgStyle;
  thumbnailTitle?: string;
  thumbnailSvgDataUrl?: string;
  hookTitle: string;
  ctaText: string;
  caption: string;
  scenes: ClonedProductionScene[];
  renderedVideoUrl: string | null;
  renderedDurationSec: number;
  renderNotes: string;
}

interface LocalVideoItem {
  path: string;
  url: string;
  name: string;
  sizeMB: number;
}

interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  changes?: string[];
  at: string;
}

const VI_VOICE_OPTIONS = [
  { id: "Binh", label: "Giọng Nam · Bình (Miền Bắc · chuẩn TikTok/Review)" },
  { id: "Tuyen", label: "Giọng Nam · Tuyên (Miền Bắc · truyền cảm)" },
  { id: "Ngoc", label: "Giọng Nữ · Ngọc (Miền Bắc · tự nhiên)" },
  { id: "Ly", label: "Giọng Nữ · Ly (Miền Bắc · trẻ trung)" },
  { id: "Vinh", label: "Giọng Nam · Vĩnh (Miền Nam · ấm áp)" },
  { id: "Doan", label: "Giọng Nữ · Đoan (Miền Nam · dịu dàng)" },
];

const TEXT_THEME_OPTIONS: { id: TextTheme; label: string; color: string }[] = [
  { id: "gold", label: "Vàng Kim", color: "#FFD43B" },
  { id: "yellow_full", label: "Vàng Rực", color: "#FACC15" },
  { id: "emerald", label: "Xanh Ngọc", color: "#10B981" },
  { id: "coral", label: "Đỏ Cam", color: "#F43F5E" },
  { id: "cyan", label: "Xanh Dương", color: "#0EA5E9" },
  { id: "violet", label: "Tím Neon", color: "#8B5CF6" },
];

const CAPTION_BG_OPTIONS: { id: CaptionBgStyle; label: string; desc: string }[] = [
  { id: "solid_dark", label: "Hộp Đen Đậm", desc: "Nền đen rõ chữ nhất" },
  { id: "translucent", label: "Hộp Mờ Trong Suốt", desc: "Mờ nhẹ hiện đại" },
  { id: "brand_box", label: "Hộp Màu Nổi", desc: "Nền màu theo chủ đề" },
  { id: "none", label: "Không Nền", desc: "Chỉ chữ + viền đen" },
];

const POSITION_OPTIONS: { id: TextPosition; label: string }[] = [
  { id: "bottom", label: "Dưới đáy" },
  { id: "center", label: "Chính giữa" },
  { id: "top", label: "Trên cao" },
  { id: "hidden", label: "Ẩn chữ" },
];

export function ReelWeaverStudio() {
  const [preferredProvider, setPreferredProvider] = useState<CliProvider>("claude_cli");
  const [localVideos, setLocalVideos] = useState<LocalVideoItem[]>([]);
  const [selectedRefVideoPath, setSelectedRefVideoPath] = useState<string>("");
  const [uploadingRef, setUploadingRef] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [blueprint, setBlueprint] = useState<DecodedVideoBlueprint | null>(null);

  // Raw footage & Nội dung kịch bản mới
  const [rawFootages, setRawFootages] = useState<LocalVideoItem[]>([]);
  const [uploadingRaw, setUploadingRaw] = useState(false);
  const [topic, setTopic] = useState("Giới thiệu sản phẩm chất lượng cao, cam kết nguyên chất và ưu đãi hôm nay");
  const [productName, setProductName] = useState("Sản phẩm chủ lực");
  const [brandName, setBrandName] = useState("ZONO");

  // Tuỳ chọn hiển thị, màu chữ, nền chữ, vị trí chữ & thumbnail
  const [audioMode, setAudioMode] = useState<"voiceover" | "keep_audio">("voiceover");
  const [voiceName, setVoiceName] = useState("Binh");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [editStyle, setEditStyle] = useState<"dynamic" | "smooth" | "clean">("dynamic");
  const [textTheme, setTextTheme] = useState<TextTheme>("gold");
  const [captionBgStyle, setCaptionBgStyle] = useState<CaptionBgStyle>("solid_dark");
  const [captionPosition, setCaptionPosition] = useState<TextPosition>("bottom");
  const [headlinePosition, setHeadlinePosition] = useState<TextPosition>("top");
  const [thumbnailTitle, setThumbnailTitle] = useState("BÍ QUYẾT THỰC CHIẾN");
  const [customThumbnailUrl, setCustomThumbnailUrl] = useState<string | null>(null);

  // Kịch bản câu thoại từng cảnh (để đổi kịch bản trực tiếp hoặc bằng AI)
  const [editableScenes, setEditableScenes] = useState<
    {
      sceneNumber: number;
      newVoiceover: string;
      newOnScreenText: string;
      zoom: string;
      transition: string;
      rawSourceIndex: number;
      rawStartSec: number;
      rawEndSec: number;
    }[]
  >([]);

  const [rewritingScript, setRewritingScript] = useState(false);
  const [buildingVideo, setBuildingVideo] = useState(false);
  const [production, setProduction] = useState<ClonedVideoProductionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showShotDetails, setShowShotDetails] = useState(false);

  // Chat Đạo Diễn AI
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);

  const refInputRef = useRef<HTMLInputElement | null>(null);
  const rawInputRef = useRef<HTMLInputElement | null>(null);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    api
      .get("/dna")
      .then((res: any) => {
        const d = res?.dna?.data;
        if (d?.company?.brand || d?.company?.name) {
          setBrandName(d.company.brand || d.company.name);
        }
        if (Array.isArray(d?.products) && d.products.length > 0 && d.products[0]?.name) {
          const p0 = d.products[0];
          setProductName(p0.name);
          setThumbnailTitle(`${p0.name.toUpperCase()} CHÍNH HÃNG`);
          setTopic(
            `${p0.name} — ${p0.summary || (Array.isArray(p0.sellingPoints) ? p0.sellingPoints.join(", ") : "Chất lượng vượt trội, ưu đãi đặc biệt")}`,
          );
        }
      })
      .catch(() => {});

    api
      .get("/studio/local-videos")
      .then((res: any) => {
        const vids: LocalVideoItem[] = res?.videos || [];
        setLocalVideos(vids);
        if (vids.length > 0) {
          setSelectedRefVideoPath(vids[0].path);
          setRawFootages([vids[0]]);
        }
      })
      .catch(() => {});
  }, []);

  const syncEditableScenesFromProduction = (prod: ClonedVideoProductionResult) => {
    setEditableScenes(
      prod.scenes.map((s) => ({
        sceneNumber: s.sceneNumber,
        newVoiceover: s.newVoiceover,
        newOnScreenText: s.newOnScreenText,
        zoom: s.zoom,
        transition: s.transition,
        rawSourceIndex: s.selectedRawCut.sourceIndex,
        rawStartSec: s.selectedRawCut.startSec,
        rawEndSec: s.selectedRawCut.endSec,
      })),
    );
    if (prod.captionPosition) setCaptionPosition(prod.captionPosition);
    if (prod.headlinePosition) setHeadlinePosition(prod.headlinePosition);
    if (prod.textTheme) setTextTheme(prod.textTheme);
    if (prod.captionBgStyle) setCaptionBgStyle(prod.captionBgStyle);
    if (prod.thumbnailTitle) setThumbnailTitle(prod.thumbnailTitle);
  };

  // 1. Decode Video Mẫu + Tự động tạo luôn Kịch Bản Mới cho các cảnh
  const runDecodeAndPrepareScript = async (pathOverride?: string) => {
    const targetPath = pathOverride ?? selectedRefVideoPath;
    setDecoding(true);
    setErrorMsg(null);
    try {
      const res: any = await api.post("studio/decode-video", {
        videoPath: targetPath || undefined,
        useWhisper: true,
        useClaude: true,
        preferredProvider,
      });
      if (res?.blueprint) {
        const bp: DecodedVideoBlueprint = res.blueprint;
        setBlueprint(bp);
        setEditStyle(bp.recommendedEditStyle || "dynamic");
        const activeRaws =
          rawFootages.length > 0
            ? rawFootages.map((r) => r.path)
            : [bp.sourceVideoPath];
        if (rawFootages.length === 0) {
          setRawFootages([
            {
              path: bp.sourceVideoPath,
              url: bp.sourceVideoUrl,
              name: bp.sourceFileName,
              sizeMB: 5,
            },
          ]);
        }

        // Gọi AI tạo luôn kịch bản câu thoại mới khớp đúng số cảnh vừa Decode (renderMp4 = false để hiện kịch bản tức thì)
        const cloneRes: any = await api.post("studio/clone-from-decoded", {
          blueprint: bp,
          rawVideoPaths: activeRaws,
          topic,
          product: productName,
          brandName,
          voiceName,
          audioMode,
          aspectRatio,
          editStyle: bp.recommendedEditStyle || "dynamic",
          captionPosition,
          headlinePosition,
          textTheme,
          captionBgStyle,
          thumbnailTitle,
          renderMp4: false,
          useClaude: true,
          preferredProvider,
        });
        if (cloneRes?.result) {
          setProduction(cloneRes.result);
          syncEditableScenesFromProduction(cloneRes.result);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể giải mã video mẫu.");
    } finally {
      setDecoding(false);
    }
  };

  // Nút "Viết / Đổi Kịch Bản Mới bằng AI" ngay ở Bước 1
  const handleRewriteScriptWithAI = async () => {
    if (!blueprint) {
      await runDecodeAndPrepareScript();
      return;
    }
    setRewritingScript(true);
    setErrorMsg(null);
    try {
      const res: any = await api.post("studio/clone-from-decoded", {
        blueprint,
        rawVideoPaths: rawFootages.length > 0 ? rawFootages.map((r) => r.path) : [blueprint.sourceVideoPath],
        topic,
        product: productName,
        brandName,
        voiceName,
        audioMode,
        aspectRatio,
        editStyle,
        captionPosition,
        headlinePosition,
        textTheme,
        captionBgStyle,
        thumbnailTitle,
        renderMp4: false,
        useClaude: true,
        preferredProvider,
      });
      if (res?.result) {
        setProduction(res.result);
        syncEditableScenesFromProduction(res.result);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi viết kịch bản mới.");
    } finally {
      setRewritingScript(false);
    }
  };

  // Nút "🎬 BUILD VIDEO MP4" ở Bước 2
  const handleBuildVideoMp4 = async () => {
    if (!blueprint) {
      setErrorMsg("Vui lòng chọn hoặc tải Video Mẫu cần Decode ở Bước 1 trước!");
      return;
    }
    setBuildingVideo(true);
    setErrorMsg(null);
    try {
      const res: any = await api.post("studio/clone-from-decoded", {
        blueprint,
        rawVideoPaths: rawFootages.length > 0 ? rawFootages.map((r) => r.path) : [blueprint.sourceVideoPath],
        topic,
        product: productName,
        brandName,
        voiceName,
        audioMode,
        aspectRatio,
        editStyle,
        captionPosition,
        headlinePosition,
        textTheme,
        captionBgStyle,
        thumbnailTitle,
        renderMp4: true,
        useClaude: editableScenes.length === 0,
        preferredProvider,
        customScenes: editableScenes.length > 0 ? editableScenes : undefined,
      });
      if (res?.result) {
        setProduction(res.result);
        syncEditableScenesFromProduction(res.result);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi dựng Video MP4.");
    } finally {
      setBuildingVideo(false);
    }
  };

  // Khung Chat Đạo Diễn AI ở Bước 3
  const handleSendChatDirector = async (presetText?: string) => {
    const msg = (presetText ?? chatInput).trim();
    if (!msg || !blueprint || !production) return;
    if (!presetText) setChatInput("");
    setChatHistory((prev) => [
      ...prev,
      { role: "user", text: msg, at: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) },
    ]);
    setChatLoading(true);
    setErrorMsg(null);
    try {
      const res: any = await api.post("studio/chat-edit-video", {
        message: msg,
        blueprint,
        currentProduction: {
          ...production,
          captionPosition,
          headlinePosition,
          textTheme,
          captionBgStyle,
          thumbnailTitle,
          scenes: production.scenes.map((sc, idx) => ({
            ...sc,
            newVoiceover: editableScenes[idx]?.newVoiceover ?? sc.newVoiceover,
            newOnScreenText: editableScenes[idx]?.newOnScreenText ?? sc.newOnScreenText,
          })),
        },
        rawVideoPaths: rawFootages.length > 0 ? rawFootages.map((r) => r.path) : [blueprint.sourceVideoPath],
        voiceName,
        audioMode,
        aspectRatio,
        preferredProvider,
      });
      if (res?.production) {
        setProduction(res.production);
        syncEditableScenesFromProduction(res.production);
        setChatHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            text: res.reply || "Đã cập nhật kịch bản, màu chữ, vị trí chữ và dựng lại Video MP4!",
            changes: res.changesSummary || [],
            at: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể thực hiện lệnh chỉnh sửa qua Chat.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleUploadReferenceVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRef(true);
    setErrorMsg(null);
    try {
      const uploaded = await uploadMediaFile(file);
      if (uploaded?.path) {
        const newItem: LocalVideoItem = {
          path: uploaded.path,
          url: uploaded.url,
          name: file.name,
          sizeMB: Math.round((file.size / 1048576) * 10) / 10,
        };
        setLocalVideos((prev) => [newItem, ...prev]);
        setSelectedRefVideoPath(newItem.path);
        if (rawFootages.length === 0) setRawFootages([newItem]);
        await runDecodeAndPrepareScript(newItem.path);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi tải video mẫu lên.");
    } finally {
      setUploadingRef(false);
      if (refInputRef.current) refInputRef.current.value = "";
    }
  };

  const handleUploadRawFootages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingRaw(true);
    setErrorMsg(null);
    try {
      const uploadedItems: LocalVideoItem[] = [];
      for (const file of files) {
        const up = await uploadMediaFile(file);
        if (up?.path) {
          uploadedItems.push({
            path: up.path,
            url: up.url,
            name: file.name,
            sizeMB: Math.round((file.size / 1048576) * 10) / 10,
          });
        }
      }
      if (uploadedItems.length) {
        setRawFootages((prev) => [...uploadedItems, ...prev]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi tải video quay sẵn.");
    } finally {
      setUploadingRaw(false);
      if (rawInputRef.current) rawInputRef.current.value = "";
    }
  };

  const handleUploadCustomThumbnail = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const up = await uploadMediaFile(file);
      if (up?.url) {
        setCustomThumbnailUrl(up.url);
      }
    } catch {
      // ignore
    } finally {
      if (thumbInputRef.current) thumbInputRef.current.value = "";
    }
  };

  const activePosterUrl = customThumbnailUrl || production?.thumbnailSvgDataUrl || undefined;

  return (
    <div style={{ maxWidth: 1220, margin: "0 auto", padding: "12px 16px 64px" }}>
      {/* HEADER GỌN GÀNG + CHỌN CLI AI */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
          borderRadius: 16,
          padding: "16px 20px",
          color: "#fff",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>
            🎬 Studio Dựng Video Nhanh (Decode → Đổi Kịch Bản → Build MP4)
          </h1>
          <div style={{ fontSize: 12.5, color: "#cbd5e1" }}>
            3 bước gọn nhẹ: <b>1. Up Video Decode & Đổi Kịch Bản</b> → <b>2. Chọn Màu Chữ, Nền Chữ, Thumbnail & Build</b> → <b>3. Chat Đạo Diễn AI sửa trực tiếp</b>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", padding: "6px 10px", borderRadius: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "#cbd5e1" }}>AI:</span>
          {(
            [
              { id: "claude_cli", label: "🟣 Claude" },
              { id: "gemini_cli", label: "🔵 Gemini" },
              { id: "codex_cli", label: "🟢 Codex" },
            ] as { id: CliProvider; label: string }[]
          ).map((cli) => {
            const active = preferredProvider === cli.id;
            return (
              <button
                key={cli.id}
                onClick={() => setPreferredProvider(cli.id)}
                style={{
                  background: active ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent",
                  color: "#fff",
                  border: active ? "1px solid #a5b4fc" : "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 8,
                  padding: "5px 10px",
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {cli.label}
              </button>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: "10px 14px",
            borderRadius: 10,
            marginBottom: 14,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Đường nhanh nhất: 1 clip → video final, không cần Video Mẫu */}
      <QuickEdit />

      {/* ==================== BƯỚC 1: UP VIDEO DECODE + ĐỔI KỊCH BẢN MỚI ==================== */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 18,
          marginBottom: 16,
          boxShadow: "0 2px 8px rgba(15,23,42,0.03)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 18 }}>
          {/* CỘT TRÁI BƯỚC 1: UP VIDEO MẪU CẦN DECODE & VIDEO QUAY SẴN */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                1
              </span>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                Up Video Mẫu để Decode & Chọn Video Để Dựng
              </div>
            </div>

            {/* Nút tải Video Mẫu cần Decode */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b" }}>
                  📹 1A. Video Mẫu cần Decode (học nhịp cắt & công thức):
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    ref={refInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    style={{ display: "none" }}
                    onChange={handleUploadReferenceVideo}
                  />
                  <button
                    onClick={() => refInputRef.current?.click()}
                    disabled={uploadingRef || decoding}
                    style={{
                      background: "#2563eb",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {uploadingRef ? "⏳ Đang tải..." : "⬆️ Up Video Mẫu"}
                  </button>
                  <button
                    onClick={() => runDecodeAndPrepareScript()}
                    disabled={decoding}
                    style={{
                      background: "#0f172a",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {decoding ? "⏳ Đang Decode..." : "🔍 Decode Ngay"}
                  </button>
                </div>
              </div>

              {/* Chọn nhanh từ kho trên máy */}
              {localVideos.length > 0 && (
                <select
                  value={selectedRefVideoPath}
                  onChange={(e) => {
                    setSelectedRefVideoPath(e.target.value);
                    runDecodeAndPrepareScript(e.target.value);
                  }}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 12,
                    background: "#fff",
                  }}
                >
                  {localVideos.map((v) => (
                    <option key={v.path} value={v.path}>
                      🎞️ {v.name} ({v.sizeMB} MB)
                    </option>
                  ))}
                </select>
              )}

              {blueprint && (
                <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                  <video
                    key={blueprint.sourceVideoUrl}
                    src={blueprint.sourceVideoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    style={{ width: 130, height: 84, borderRadius: 8, background: "#000", objectFit: "cover" }}
                  />
                  <div style={{ flex: 1, fontSize: 11.5, color: "#334155", lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>
                      ✅ Đã Decode: {blueprint.shotCount} cảnh · {blueprint.durationSec}s ({blueprint.pacingLabel})
                    </div>
                    {blueprint.fullTranscript && (
                      <div style={{ color: "#475569", marginTop: 2 }}>
                        🎙️ Lời gốc: <i>"{blueprint.fullTranscript.slice(0, 90)}..."</i>
                      </div>
                    )}
                    <button
                      onClick={() => setShowShotDetails((v) => !v)}
                      style={{
                        marginTop: 4,
                        background: "transparent",
                        border: "none",
                        color: "#2563eb",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: 0,
                        cursor: "pointer",
                      }}
                    >
                      {showShotDetails ? "▲ Thu gọn chi tiết cảnh mẫu" : "▼ Xem chi tiết cảnh mẫu đã bóc tách"}
                    </button>
                  </div>
                </div>
              )}

              {blueprint && showShotDetails && (
                <div style={{ marginTop: 8, maxHeight: 140, overflowY: "auto", fontSize: 11, background: "#fff", padding: 8, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  {blueprint.decodedShots.map((sh) => (
                    <div key={sh.shotId} style={{ padding: "4px 0", borderBottom: "1px dashed #e2e8f0" }}>
                      <b>Cảnh {sh.sceneNumber} ({sh.startSec}s–{sh.endSec}s):</b> {sh.spokenText || sh.visualDescription}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 1B. Video đã có / Video quay sẵn để dựng */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b" }}>
                  🎞️ 1B. Video Quay Sẵn dùng để dựng mới ({rawFootages.length} clip):
                </span>
                <div>
                  <input
                    ref={rawInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    multiple
                    style={{ display: "none" }}
                    onChange={handleUploadRawFootages}
                  />
                  <button
                    onClick={() => rawInputRef.current?.click()}
                    disabled={uploadingRaw}
                    style={{
                      background: "#4f46e5",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "5px 10px",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {uploadingRaw ? "⏳ Đang tải..." : "+ Up Thêm Video Quay Sẵn"}
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {rawFootages.map((rf, idx) => (
                  <span
                    key={`${rf.path}_${idx}`}
                    style={{
                      background: "#e0e7ff",
                      color: "#3730a3",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: 6,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    #{idx + 1} {rf.name.slice(0, 24)}
                    {rawFootages.length > 1 && (
                      <button
                        onClick={() => setRawFootages((prev) => prev.filter((_, i) => i !== idx))}
                        style={{ border: "none", background: "transparent", color: "#dc2626", cursor: "pointer", fontWeight: 800, padding: 0 }}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI BƯỚC 1: Ô ĐỔI KỊCH BẢN / NỘI DUNG MỚI (RÕ RÀNG NGAY TRÊN ĐẦU) */}
          <div style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: "#92400e" }}>
                ✍️ Đổi Kịch Bản & Nội Dung Mới (Theo nhịp {blueprint ? `${blueprint.shotCount} cảnh` : "Video Decode"})
              </div>
              <button
                onClick={handleRewriteScriptWithAI}
                disabled={rewritingScript || decoding}
                style={{
                  background: "linear-gradient(135deg, #d97706, #b45309)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {rewritingScript ? "⏳ AI đang viết kịch bản..." : "✨ Viết / Đổi Kịch Bản Mới bằng AI"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#78350f", display: "block", marginBottom: 3 }}>
                  Tên Sản Phẩm / Dịch Vụ:
                </label>
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  style={{ width: "100%", padding: "6px 9px", borderRadius: 8, border: "1px solid #fcd34d", fontSize: 12.5, background: "#fff" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#78350f", display: "block", marginBottom: 3 }}>
                  Tên Thương Hiệu:
                </label>
                <input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  style={{ width: "100%", padding: "6px 9px", borderRadius: 8, border: "1px solid #fcd34d", fontSize: 12.5, background: "#fff" }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#78350f", display: "block", marginBottom: 3 }}>
                Thông tin / Ý tưởng muốn đưa vào kịch bản mới:
              </label>
              <textarea
                rows={2}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Nhập điểm mạnh sản phẩm, ưu đãi, câu chuyện hoặc nội dung mới muốn thay vào..."
                style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #fcd34d", fontSize: 12.5, background: "#fff", resize: "vertical" }}
              />
            </div>

            {/* Danh sách câu thoại từng cảnh để sửa trực tiếp */}
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#92400e", marginBottom: 6 }}>
              📝 Chỉnh sửa trực tiếp câu thoại & chữ nổi từng cảnh ({editableScenes.length || blueprint?.shotCount || 0} cảnh):
            </div>
            {editableScenes.length === 0 ? (
              <div style={{ fontSize: 12, color: "#78350f", background: "rgba(255,255,255,0.7)", padding: 10, borderRadius: 8 }}>
                👉 Bấm <b>"🔍 Decode Ngay"</b> hoặc <b>"✨ Viết / Đổi Kịch Bản Mới bằng AI"</b> để hiện kịch bản từng cảnh tại đây.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6, maxHeight: 190, overflowY: "auto", paddingRight: 4 }}>
                {editableScenes.map((sc, idx) => (
                  <div
                    key={sc.sceneNumber}
                    style={{
                      background: "#fff",
                      border: "1px solid #fde68a",
                      borderRadius: 8,
                      padding: "6px 8px",
                      display: "grid",
                      gridTemplateColumns: "62px 1fr 125px",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#b45309" }}>
                      Cảnh {sc.sceneNumber}
                    </span>
                    <input
                      value={sc.newVoiceover}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditableScenes((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, newVoiceover: val } : item)),
                        );
                      }}
                      placeholder="Lời thoại cảnh này..."
                      style={{
                        width: "100%",
                        padding: "5px 8px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 12,
                      }}
                    />
                    <input
                      value={sc.newOnScreenText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditableScenes((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, newOnScreenText: val } : item)),
                        );
                      }}
                      placeholder="Chữ nổi..."
                      style={{
                        width: "100%",
                        padding: "5px 8px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 11.5,
                        fontWeight: 700,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== BƯỚC 2: CHỌN CÁCH HIỂN THỊ, MÀU CHỮ, NỀN CHỮ, THUMBNAIL & BUILD ==================== */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 18,
          marginBottom: 16,
          boxShadow: "0 2px 8px rgba(15,23,42,0.03)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: "#7c3aed",
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              2
            </span>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
              Chọn Cách Hiển Thị, Màu Chữ, Nền Chữ, Vị Trí & Thumbnail → Build Video
            </div>
          </div>

          <button
            onClick={handleBuildVideoMp4}
            disabled={buildingVideo || decoding}
            style={{
              background: "linear-gradient(135deg, #16a34a, #059669)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "11px 24px",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(22,163,74,0.28)",
            }}
          >
            {buildingVideo ? "⏳ Đang Build Video MP4..." : "🎬 BUILD VIDEO MP4 NGAY"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {/* 1. Khung hình & Nhịp cắt & Âm thanh */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
              📐 1. Khung Hiển Thị & Giọng Đọc
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {(
                [
                  { id: "9:16", label: "📱 Dọc 9:16 (TikTok/Reels)" },
                  { id: "16:9", label: "🖥️ Ngang 16:9 (YouTube)" },
                ] as const
              ).map((ar) => (
                <button
                  key={ar.id}
                  onClick={() => setAspectRatio(ar.id)}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: aspectRatio === ar.id ? "2px solid #4f46e5" : "1px solid #cbd5e1",
                    background: aspectRatio === ar.id ? "#eef2ff" : "#fff",
                    color: aspectRatio === ar.id ? "#312e81" : "#475569",
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {ar.label}
                </button>
              ))}
            </div>
            <select
              value={audioMode}
              onChange={(e) => setAudioMode(e.target.value as "voiceover" | "keep_audio")}
              style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12, marginBottom: 6, background: "#fff" }}
            >
              <option value="voiceover">🎙️ Lồng tiếng Việt mới (Tắt tiếng gốc)</option>
              <option value="keep_audio">🔊 Giữ nguyên tiếng gốc của Video</option>
            </select>
            {audioMode === "voiceover" && (
              <select
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 11.5, background: "#fff" }}
              >
                {VI_VOICE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. Màu chữ (Text Theme) */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
              🎨 2. Màu Chữ Phụ Đề & Tiêu Đề
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {TEXT_THEME_OPTIONS.map((th) => {
                const active = textTheme === th.id;
                return (
                  <button
                    key={th.id}
                    onClick={() => setTextTheme(th.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 8px",
                      borderRadius: 8,
                      border: active ? "2px solid #0f172a" : "1px solid #cbd5e1",
                      background: active ? "#0f172a" : "#fff",
                      color: active ? "#fff" : "#1e293b",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: th.color,
                        border: "1px solid rgba(0,0,0,0.2)",
                        flexShrink: 0,
                      }}
                    />
                    {th.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Kiểu nền chữ & Vị trí đặt chữ */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
              🪧 3. Kiểu Nền Chữ & Vị Trí Đặt Chữ
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 8 }}>
              {CAPTION_BG_OPTIONS.map((bg) => {
                const active = captionBgStyle === bg.id;
                return (
                  <button
                    key={bg.id}
                    onClick={() => setCaptionBgStyle(bg.id)}
                    style={{
                      padding: "5px 7px",
                      borderRadius: 7,
                      border: active ? "2px solid #4f46e5" : "1px solid #cbd5e1",
                      background: active ? "#eef2ff" : "#fff",
                      color: active ? "#312e81" : "#334155",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {bg.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {POSITION_OPTIONS.map((pos) => {
                const active = captionPosition === pos.id;
                return (
                  <button
                    key={pos.id}
                    onClick={() => setCaptionPosition(pos.id)}
                    style={{
                      flex: 1,
                      padding: "5px 4px",
                      borderRadius: 7,
                      border: active ? "2px solid #059669" : "1px solid #cbd5e1",
                      background: active ? "#ecfdf5" : "#fff",
                      color: active ? "#065f46" : "#475569",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {pos.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Thumbnail (Ảnh bìa Video) */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
              🖼️ 4. Thumbnail (Ảnh Bìa Video)
            </div>
            <input
              value={thumbnailTitle}
              onChange={(e) => setThumbnailTitle(e.target.value)}
              placeholder="Tiêu đề lớn trên Thumbnail..."
              style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12, marginBottom: 6, background: "#fff" }}
            />
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                ref={thumbInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleUploadCustomThumbnail}
              />
              <button
                onClick={() => thumbInputRef.current?.click()}
                style={{
                  background: "#fff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 7,
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                📤 Tải Ảnh Bìa Riêng
              </button>
              {customThumbnailUrl && (
                <button
                  onClick={() => setCustomThumbnailUrl(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#dc2626",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Dùng bìa AI tự tạo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== BƯỚC 3: XEM VIDEO MP4 + THUMBNAIL & KHUNG CHAT ĐẠO DIỄN AI ==================== */}
      <div
        style={{
          background: "#fff",
          border: "1.5px solid #c7d2fe",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 6px 20px rgba(79,70,229,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: "#059669",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            3
          </span>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
            Kết Quả Video MP4, Thumbnail & Khung Chat Sửa Mọi Thứ (Nội Dung · Màu Chữ · Nền Chữ · Vị Trí · Cách Cắt)
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.2fr", gap: 18, alignItems: "start" }}>
          {/* CỘT TRÁI: TRÌNH PHÁT VIDEO MP4 + ẢNH BÌA THUMBNAIL */}
          <div style={{ background: "#0f172a", borderRadius: 14, padding: 14, color: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#34d399" }}>
                🎬 Video Thành Phẩm & Thumbnail
              </span>
              {production?.renderedVideoUrl && (
                <a
                  href={production.renderedVideoUrl}
                  download={`zono_video_${production.id}.mp4`}
                  style={{
                    background: "#16a34a",
                    color: "#fff",
                    textDecoration: "none",
                    padding: "5px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  ⬇️ Tải Video MP4
                </a>
              )}
            </div>

            {production?.renderedVideoUrl ? (
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.85fr", gap: 12, alignItems: "start" }}>
                <div>
                  <video
                    key={production.renderedVideoUrl}
                    src={production.renderedVideoUrl}
                    poster={activePosterUrl}
                    controls
                    playsInline
                    style={{
                      width: "100%",
                      maxHeight: 340,
                      borderRadius: 10,
                      background: "#000",
                      border: "1px solid #334155",
                    }}
                  />
                  <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 6 }}>
                    {production.renderNotes}
                  </div>
                </div>

                {/* Khung xem trước Thumbnail */}
                <div style={{ background: "#1e293b", borderRadius: 10, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                    🖼️ Thumbnail (Ảnh Bìa)
                  </div>
                  {activePosterUrl && (
                    <img
                      src={activePosterUrl}
                      alt="Video Thumbnail"
                      style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 8, border: "1px solid #475569" }}
                    />
                  )}
                  {activePosterUrl && (
                    <a
                      href={activePosterUrl}
                      download={`thumbnail_${production.id}.svg`}
                      style={{
                        display: "inline-block",
                        marginTop: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#38bdf8",
                        textDecoration: "none",
                      }}
                    >
                      ⬇️ Tải Thumbnail
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: "48px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                👉 Hãy bấm <b>"🔍 Decode Ngay"</b> ở Bước 1 rồi bấm <b>"🎬 BUILD VIDEO MP4 NGAY"</b> ở Bước 2 để tạo Video!
              </div>
            )}
          </div>

          {/* CỘT PHẢI: KHUNG CHAT ĐẠO DIỄN AI SỬA NỘI DUNG, MÀU MÈ, NỀN CHỮ, VỊ TRÍ CHỮ, CÁCH CẮT */}
          <div style={{ background: "#f5f3ff", border: "1.5px solid #c4b5fd", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#4c1d95", marginBottom: 4 }}>
              💬 Chat Đạo Diễn AI — Gõ lệnh sửa Kịch Bản, Màu Chữ, Nền Chữ, Vị Trí Đặt Chữ & Cách Cắt
            </div>
            <div style={{ fontSize: 12, color: "#5b21b6", marginBottom: 10 }}>
              Chỉ cần gõ yêu cầu hoặc bấm nút gợi ý bên dưới, AI sẽ tự sửa và <b>Build lại Video MP4</b> ngay lập tức!
            </div>

            {/* Các nút lệnh 1 chạm */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {[
                "Đổi kịch bản ngắn gọn, súc tích và chốt đơn mạnh hơn",
                "Đổi chữ sang màu Xanh Ngọc và nền hộp mờ trong suốt",
                "Đổi chữ sang màu Đỏ Cam và bỏ nền chữ",
                "Đưa chữ phụ đề ra Chính Giữa màn hình",
                "Đưa chữ phụ đề lên Trên Cao màn hình",
                "Đổi cách cắt nhịp nhanh TikTok + hiệu ứng Zoom Punch",
                "Ẩn toàn bộ chữ phụ đề trên video",
              ].map((sug) => (
                <button
                  key={sug}
                  disabled={chatLoading || !production}
                  onClick={() => handleSendChatDirector(sug)}
                  style={{
                    background: "#fff",
                    color: "#5b21b6",
                    border: "1px solid #c4b5fd",
                    borderRadius: 999,
                    padding: "5px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: production ? "pointer" : "not-allowed",
                  }}
                >
                  ✨ {sug}
                </button>
              ))}
            </div>

            {chatHistory.length > 0 && (
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #ddd6fe",
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 10,
                  maxHeight: 165,
                  overflowY: "auto",
                  display: "grid",
                  gap: 6,
                }}
              >
                {chatHistory.map((turn, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      background: turn.role === "user" ? "#ede9fe" : "#ecfdf5",
                      color: turn.role === "user" ? "#3b0764" : "#065f46",
                    }}
                  >
                    <b>{turn.role === "user" ? "🧑 Anh" : "🎬 Đạo Diễn AI"} ({turn.at}):</b> {turn.text}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChatDirector();
                  }
                }}
                disabled={chatLoading || !production}
                placeholder="VD: Đổi kịch bản sang giới thiệu khuyến mãi 50%, chữ màu vàng rực đặt ở giữa màn hình, nền hộp mờ..."
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #a78bfa",
                  fontSize: 12.5,
                  background: "#fff",
                }}
              />
              <button
                onClick={() => handleSendChatDirector()}
                disabled={chatLoading || !chatInput.trim() || !production}
                style={{
                  background: chatLoading ? "#94a3b8" : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 16px",
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: chatLoading ? "wait" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {chatLoading ? "⏳ Đang sửa & Build..." : "🚀 Áp Dụng & Build Lại"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
