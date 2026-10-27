import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, Plug, FolderOpen, Monitor, StickyNote, Calendar, Mail, MessageSquare,
  Clapperboard, Image as ImageIcon, Volume2, Cpu, Scale, Share2, Play, ShieldCheck,
  Plus, Trash2, CheckCircle2, RefreshCw, ExternalLink, Layers, Wand2, HardDrive, Terminal, MousePointerClick, Camera,
} from "lucide-react";
import { api, useApi } from "../lib/api";
import { Badge, Button, Card, cx, inputCls, useToast } from "../components/ui";
import { LlmPanel } from "../components/LlmPanel";

const ICON_MAP: Record<string, any> = {
  folder: FolderOpen,
  monitor: Monitor,
  note: StickyNote,
  calendar: Calendar,
  mail: Mail,
  message: MessageSquare,
  video: Clapperboard,
  image: ImageIcon,
  voice: Volume2,
  cpu: Cpu,
  scale: Scale,
  share: Share2,
};

const PERM_LABELS: Record<string, { label: string; tone: "green" | "blue" | "amber" | "gray" }> = {
  read_write: { label: "Đọc & Ghi (Toàn quyền Local)", tone: "green" },
  read_only: { label: "Chỉ đọc (An toàn)", tone: "blue" },
  always_ask: { label: "Luôn hỏi trước khi chạy", tone: "amber" },
  off: { label: "Tắt truy cập", tone: "gray" },
};

const CATEGORY_TABS = [
  { id: "all", label: "Tất cả Công cụ (12)" },
  { id: "mac_local", label: "🍎 Ứng dụng trên máy Mac (6)" },
  { id: "creative_local", label: "🎬 Xưởng Sáng tạo Local (3)" },
  { id: "audit_local", label: "🔬 Dịch ngược REA & Luật VN (2)" },
  { id: "business", label: "🌐 Kênh Doanh nghiệp & MCP" },
] as const;

export function Muse() {
  const { data: muse, reload } = useApi<any>("muse", ["muse.", "creative.", "post.", "llm."]);
  const [activeTab, setActiveTab] = useState<"video_control" | "rpc_api" | "connectors" | "routing" | "spaces">("video_control");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [runningId, setRunningId] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [selectedConnector, setSelectedConnector] = useState<string>("mac_files");
  const [lastResult, setLastResult] = useState<any>(null);
  const [hatchVideo, setHatchVideo] = useState<string>("/muse/HatchIdle.mp4");

  // Direct Muse Video & Computer Control state
  const [videoPrompt, setVideoPrompt] = useState(
    "Giải pháp AI Tự động hóa Marketing & Bán hàng 24/7 cho doanh nghiệp 2026",
  );
  const [videoVoice, setVideoVoice] = useState("Binh (nam miền Bắc)");
  const [controlApp, setControlApp] = useState("Google Chrome");
  const [controlUrl, setControlUrl] = useState("https://flow.google.com");
  const [controlText, setControlText] = useState("");
  const [controlLabel, setControlLabel] = useState("");
  const [rpcMethod, setRpcMethod] = useState("environment.describe");
  const [rpcParamsText, setRpcParamsText] = useState("{}");

  // New custom connector modal state
  const [newConnName, setNewConnName] = useState("");
  const [newConnUrl, setNewConnUrl] = useState("");
  const [newConnKind, setNewConnKind] = useState<"mcp_sse" | "http_webhook" | "local_cli">("mcp_sse");
  const [newConnDesc, setNewConnDesc] = useState("");

  const toast = useToast();
  const nav = useNavigate();

  // Mount real `window.endoHatch` Native Bridge extracted from Muse.app
  useEffect(() => {
    const w = window as any;
    w.endoHatch = {
      init: () => ({ ok: true, bridge: "ZONO_ENDO_HATCH_v9.0" }),
      send: (text: string) => {
        window.dispatchEvent(new CustomEvent("nguyet:ask", { detail: text }));
        return true;
      },
      cancelChatTurn: () => true,
      invokeUiControl: (action: string, params: Record<string, any> = {}) =>
        api.post("muse/rpc", { method: "computer.control", params: { action, ...params } }),
      setCuaSettings: (cfg: any) => api.put("muse/settings", cfg),
      setLocalConnectors: (permissions: any) => api.put("muse/settings", { permissions }),
      setFileSystemAccessSettings: (cfg: any) => api.put("muse/settings", cfg),
      setSystemPermissions: (permissions: any) => api.put("muse/settings", { permissions }),
      setBlockedAppsSettings: () => true,
      setAppBehaviorSettings: (cfg: any) => api.put("muse/settings", cfg),
      setDictationSettings: () => true,
      onDictationUpdate: () => true,
      showApproval: () => true,
      hideApproval: () => true,
      ensureLiveConnection: () => api.get("muse"),
      recoverAfterNativeReconnect: () => {
        void reload();
        return true;
      },
    };
  }, [reload]);

  const connectors: any[] = muse?.connectors ?? [];
  const filteredConnectors = connectors.filter((c) => catFilter === "all" || c.category === catFilter);
  const catalog = muse?.extractedApiCatalog;

  async function changePermission(connectorId: string, perm: string) {
    try {
      await api.put("muse/settings", { permissions: { [connectorId]: perm } });
      toast(`Đã cập nhật quyền [${PERM_LABELS[perm]?.label ?? perm}] cho ${connectorId}`, "ok");
      void reload();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  async function runConnector(connectorId: string, extraInput?: Record<string, unknown>) {
    setRunningId(connectorId);
    setSelectedConnector(connectorId);
    setHatchVideo("/muse/HatchMaking.mp4");
    try {
      const payload = {
        prompt: customPrompt.trim() || undefined,
        ...extraInput,
      };
      const res = await api.post(`muse/connectors/${connectorId}/run`, payload);
      setLastResult(res);
      setHatchVideo("/muse/HatchMilestoneConfetti.mp4");
      toast(res.summary || `Đã chạy ${res.title}`, "ok");
      void reload();
      setTimeout(() => setHatchVideo("/muse/HatchIdle.mp4"), 5500);
    } catch (e: any) {
      setHatchVideo("/muse/HatchIdle.mp4");
      toast(e.message, "err");
    } finally {
      setRunningId(null);
    }
  }

  async function invokeMuseRpc(method: string, params: Record<string, any> = {}) {
    setRunningId(method);
    setHatchVideo("/muse/HatchWorking.mp4");
    try {
      const res = await api.post("muse/rpc", { method, params });
      setLastResult({
        title: `Muse RPC: ${method}`,
        summary: res.summary || `Đã thực thi ${method} (${res.observation_id || "ok"})`,
        artifact: res.artifact,
        data: res,
      });
      setHatchVideo("/muse/HatchMilestoneConfetti.mp4");
      toast(res.summary || `Đã gọi Muse API [${method}] thành công`, "ok");
      void reload();
      setTimeout(() => setHatchVideo("/muse/HatchIdle.mp4"), 5500);
    } catch (e: any) {
      setHatchVideo("/muse/HatchIdle.mp4");
      toast(e.message, "err");
    } finally {
      setRunningId(null);
    }
  }

  async function addCustomConnector() {
    if (!newConnName.trim() || !newConnUrl.trim()) {
      toast("Vui lòng nhập tên và đường dẫn/lệnh cho Connector tùy chỉnh", "err");
      return;
    }
    try {
      await api.post("muse/custom-connectors", {
        name: newConnName.trim(),
        endpointUrl: newConnUrl.trim(),
        kind: newConnKind,
        description: newConnDesc.trim(),
      });
      setNewConnName("");
      setNewConnUrl("");
      setNewConnDesc("");
      toast("Đã thêm Công cụ kết nối tùy chỉnh (Custom Connector)", "ok");
      void reload();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  async function deleteCustomConnector(id: string) {
    try {
      await api.del(`muse/custom-connectors/${id}`);
      toast("Đã xóa công cụ kết nối tùy chỉnh", "ok");
      void reload();
    } catch (e: any) {
      toast(e.message, "err");
    }
  }

  function openMuseChat(promptText?: string) {
    if (promptText) {
      window.dispatchEvent(new CustomEvent("nguyet:ask", { detail: promptText }));
    } else {
      window.dispatchEvent(new CustomEvent("nguyet:open"));
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── HERO HEADER: Muse.app (Hatch v9.0) × ZONO Local Engine ── */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-200/80 dark:border-violet-900/50 bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 text-white p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <video
                key={hatchVideo}
                src={hatchVideo}
                autoPlay
                loop
                muted
                playsInline
                className="w-20 h-20 rounded-2xl object-cover ring-2 ring-amber-400/80 shadow-lg bg-slate-800"
              />
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-white shadow">
                LOCAL
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  MUSE.APP (com.meta.endo · HATCH v9.0) REVERSE-ENGINEERED API
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  ● 28 Native RPC + 18 REST `/api/*` + `window.endoHatch` Bridge
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                  Multi-Provider AI Router (Claude · OpenAI · Gemini · Veo 3 · Local)
                </span>
              </div>
              <h1 className="text-2xl font-bold mt-2 tracking-tight">
                ZONO × Muse Studio — Tạo Video, Điều Khiển Máy Tính (`computer.control`) & Chạy Local
              </h1>
              <p className="text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Đã trích xuất toàn bộ API gốc từ file nhị phân <b>`Muse.app/Contents/MacOS/Muse`</b> và <b>`hatch/index.html`</b>:
                bao gồm <b>API Tạo Video & Media (`hatch.message.agent_media_generation`, `video.encoder`, `requests_generated_video`)</b>,
                <b>API Điều khiển Máy tính CUA (`computer.session`, `computer.observe`, `computer.control`, `screen.snap`, `environment.describe`)</b>,
                cùng 12 Local Connectors trên máy Mac.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              onClick={() => openMuseChat()}
              className="!bg-amber-400 hover:!bg-amber-300 !text-slate-950 font-semibold shadow-md"
            >
              <Sparkles className="w-4 h-4 mr-1.5" /> Mở Chat & Đàm thoại Hiền An
            </Button>
            <Button
              variant="secondary"
              onClick={() => nav("/video-flow")}
              className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20"
            >
              <Clapperboard className="w-4 h-4 mr-1.5" /> Mở Xưởng Video (/video-flow)
            </Button>
            <Button
              variant="secondary"
              onClick={() => reload()}
              className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" /> Làm mới
            </Button>
          </div>
        </div>
      </div>

      {/* ── NAVIGATION DOCK (HatchDock style) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("video_control")}
            className={cx(
              "px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition",
              activeTab === "video_control"
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200",
            )}
          >
            <Clapperboard className="w-4 h-4" /> 1. Tạo Video & Điều Khiển Máy Tính (Muse CUA & Media API)
          </button>
          <button
            onClick={() => setActiveTab("rpc_api")}
            className={cx(
              "px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition",
              activeTab === "rpc_api"
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200",
            )}
          >
            <Terminal className="w-4 h-4" /> 2. Bộ API Dịch Ngược từ Muse.app (28 RPC · 18 REST · `window.endoHatch`)
          </button>
          <button
            onClick={() => setActiveTab("connectors")}
            className={cx(
              "px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition",
              activeTab === "connectors"
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200",
            )}
          >
            <Plug className="w-4 h-4" /> 3. 12 Công cụ Kết nối Mac (`HatchConnector`)
          </button>
          <button
            onClick={() => setActiveTab("routing")}
            className={cx(
              "px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition",
              activeTab === "routing"
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200",
            )}
          >
            <Wand2 className="w-4 h-4" /> 4. Ma trận Đa Nhà cung cấp AI (Claude · OpenAI · Gemini · Veo 3)
          </button>
          <button
            onClick={() => setActiveTab("spaces")}
            className={cx(
              "px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition",
              activeTab === "spaces"
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200",
            )}
          >
            <Layers className="w-4 h-4" /> 5. Kho Video & Ảnh Đã Tạo (`HatchLibrary`)
          </button>
        </div>
      </div>

      {/* ── LIVE EXECUTION OUTPUT PANEL (Always visible whenever an API or Connector is run) ── */}
      {(runningId || lastResult) && (
        <Card className="p-5 border-2 border-emerald-500/70 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {runningId
                    ? `Đang thực thi Muse API [${runningId}] trực tiếp trên máy Mac...`
                    : `Kết quả Thực thi: ${lastResult?.title}`}
                </div>
                {lastResult?.summary && (
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    {lastResult.summary}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lastResult?.artifact?.kind === "video" && (
                <Button size="sm" onClick={() => nav("/video-flow")}>
                  <Clapperboard className="w-3.5 h-3.5 mr-1" /> Mở Xưởng Video
                </Button>
              )}
              {lastResult?.artifact?.kind === "image" && (
                <Button size="sm" onClick={() => nav("/publish")}>
                  <ImageIcon className="w-3.5 h-3.5 mr-1" /> Mở Trang Đăng Bài
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setLastResult(null)}>
                Đóng kết quả
              </Button>
            </div>
          </div>

          {runningId ? (
            <div className="py-6 text-center text-xs text-slate-600 animate-pulse">
              Đang gọi trực tiếp Muse Native Bridge & macOS System Events...
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Markdown or JSON output */}
              <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
                {lastResult?.artifact?.content ?? JSON.stringify(lastResult?.data ?? lastResult, null, 2)}
              </div>

              {/* Live media preview (Video / Image / Audio / System info) */}
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Xem trước Kết quả Trực tiếp (Video MP4 / Ảnh màn hình `screen.snap` / JSON)
                </div>

                {lastResult?.artifact?.kind === "video" && lastResult?.artifact?.videoUrl && (
                  <div className="space-y-2">
                    <video
                      src={lastResult.artifact.videoUrl}
                      controls
                      autoPlay
                      className="w-full max-h-72 rounded-lg bg-black object-contain"
                    />
                    <a
                      href={lastResult.artifact.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-violet-600 font-semibold hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Tải hoặc mở Video MP4 gốc
                    </a>
                  </div>
                )}

                {lastResult?.artifact?.kind === "image" && lastResult?.artifact?.imageUrl && (
                  <div className="space-y-2">
                    <img
                      src={lastResult.artifact.imageUrl}
                      alt={lastResult.artifact.title}
                      className="w-full max-h-72 rounded-lg object-contain border border-slate-200"
                    />
                    <a
                      href={lastResult.artifact.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-violet-600 font-semibold hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Mở ảnh gốc
                    </a>
                  </div>
                )}

                {lastResult?.data?.audioUrl && (
                  <div className="space-y-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200">
                    <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                      🔊 Nghe thử file WAV 48kHz (`VieNeu-TTS` Local):
                    </div>
                    <audio src={lastResult.data.audioUrl} controls autoPlay className="w-full h-9" />
                  </div>
                )}

                {lastResult?.data && (
                  <pre className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] overflow-x-auto max-h-60">
                    {JSON.stringify(lastResult.data, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── TAB 1: MUSE VIDEO STUDIO & COMPUTER CONTROL CONSOLE ── */}
      {activeTab === "video_control" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: MUSE VIDEO & MEDIA GENERATION STUDIO */}
          <Card className="p-5 space-y-4 border-2 border-violet-500/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge tone="violet">MUSE MEDIA GENERATION API</Badge>
                <h2 className="text-base font-bold mt-1">
                  🎬 Tạo Video MP4 & Poster bằng API Gốc của Muse (`hatch.message.agent_media_generation` · `video.encoder`)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sử dụng phương thức RPC `hatch.message.agent_media_generation`, `video.encoder`, `requests_generated_video` và `hatch.stefi.imagine_card_media` trích xuất từ `Muse.app`, kết hợp `Remotion 1080×1920` + giọng đọc `VieNeu-TTS 48kHz` + `FFmpeg -14 LUFS`.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Chủ đề / Kịch bản / URL bài viết cần dựng Video hoặc Thiết kế Ảnh:
                </label>
                <textarea
                  rows={3}
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  className={cx(inputCls, "mt-1 text-xs")}
                  placeholder="Nhập chủ đề video, lời bình hoặc dán URL bài báo..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Giọng đọc AI (`VieNeu-TTS 48kHz` · `voice.start_call`):
                  </label>
                  <select
                    value={videoVoice}
                    onChange={(e) => setVideoVoice(e.target.value)}
                    className={cx(inputCls, "mt-1 text-xs")}
                  >
                    <option value="Binh (nam miền Bắc)">Bình — Nam miền Bắc (48kHz)</option>
                    <option value="Tuyen (nam miền Bắc)">Tuyên — Nam miền Bắc (48kHz)</option>
                    <option value="Vinh (nam miền Nam)">Vĩnh — Nam miền Nam (48kHz)</option>
                    <option value="Doan (nữ miền Nam)">Đoan — Nữ miền Nam (48kHz)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    API Thực thi (`Muse.app` Method):
                  </label>
                  <div className="mt-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-violet-700 dark:text-violet-300">
                    hatch.message.agent_media_generation
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  onClick={() =>
                    invokeMuseRpc("hatch.message.agent_media_generation", {
                      mediaType: "video",
                      prompt: videoPrompt,
                      voice: videoVoice,
                    })
                  }
                  disabled={Boolean(runningId)}
                  className="!bg-violet-600 hover:!bg-violet-500 !text-white font-bold"
                >
                  <Clapperboard className="w-4 h-4 mr-1.5" />
                  ▶ Tạo Video MP4 (`hatch.message.agent_media_generation`)
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    invokeMuseRpc("hatch.stefi.imagine_card_media", {
                      prompt: videoPrompt,
                    })
                  }
                  disabled={Boolean(runningId)}
                >
                  <ImageIcon className="w-4 h-4 mr-1.5" />
                  🎨 Tạo Ảnh 4:5 (`hatch.stefi.imagine_card_media`)
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    invokeMuseRpc("voice.start_call", {
                      text: videoPrompt,
                      voice: videoVoice,
                    })
                  }
                  disabled={Boolean(runningId)}
                >
                  <Volume2 className="w-4 h-4 mr-1.5" />
                  🔊 Sinh Giọng Đọc 48kHz (`voice.start_call`)
                </Button>
              </div>
            </div>
          </Card>

          {/* RIGHT: MUSE COMPUTER CONTROL CONSOLE (CUA: computer.session, computer.observe, computer.control, screen.snap) */}
          <Card className="p-5 space-y-4 border-2 border-emerald-500/30">
            <div>
              <Badge tone="green">MUSE COMPUTER USE AGENT (CUA) API</Badge>
              <h2 className="text-base font-bold mt-1">
                🖥️ Điều Khiển Máy Tính & Trình Duyệt (`computer.control` · `computer.observe` · `screen.snap`)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bộ giao thức điều khiển máy Mac trích xuất nguyên bản từ `Muse.app/Contents/MacOS/Muse` (`NodeClient` / `CCPip`): quét ứng dụng đang mở (`environment.describe`), chụp & đọc cây Accessibility (`screen.snap` / `computer.observe`), mở ứng dụng/URL (`open_app`), click phần tử (`click_element`) và gõ phím (`type` / `key`).
              </p>
            </div>

            {/* Step 1: Observe & Snap */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => invokeMuseRpc("environment.describe", {})}
                disabled={Boolean(runningId)}
              >
                <Cpu className="w-3.5 h-3.5 mr-1.5" />
                1. Quét OS & App đang mở (`environment.describe`)
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => invokeMuseRpc("computer.session", { action: "start", task: "Điều khiển máy Mac từ ZONO × Muse" })}
                disabled={Boolean(runningId)}
              >
                ▶ Bắt đầu phiên (`computer.session`)
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => invokeMuseRpc("screen.snap", { view: "image" })}
                disabled={Boolean(runningId)}
              >
                <Camera className="w-3.5 h-3.5 mr-1.5" />
                📸 Chụp màn hình (`screen.snap`)
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => invokeMuseRpc("computer.observe", { mode: "current", view: "full" })}
                disabled={Boolean(runningId)}
              >
                🔍 Đọc cây UI (`computer.observe`)
              </Button>
            </div>

            {/* Step 2: Open App / URL */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                2. Mở Ứng dụng trên máy Mac hoặc Mở trang web trong Google Chrome (`computer.control` → `open_app` / `activate`):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  value={controlApp}
                  onChange={(e) => setControlApp(e.target.value)}
                  placeholder="Tên App (VD: Google Chrome, Finder, Notes, Safari)"
                  className={cx(inputCls, "sm:col-span-4 text-xs")}
                />
                <input
                  value={controlUrl}
                  onChange={(e) => setControlUrl(e.target.value)}
                  placeholder="URL (nếu mở bằng Google Chrome, VD: https://flow.google.com)"
                  className={cx(inputCls, "sm:col-span-5 text-xs")}
                />
                <Button
                  size="sm"
                  onClick={() =>
                    invokeMuseRpc("computer.control", {
                      action: "open_app",
                      app: controlApp,
                      url: controlUrl || undefined,
                    })
                  }
                  disabled={Boolean(runningId)}
                  className="sm:col-span-3 justify-center"
                >
                  🚀 Mở App/URL
                </Button>
              </div>
            </div>

            {/* Step 3: Click / Type / Key */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                3. Thao tác Click phần tử (`click_element`), Gõ văn bản (`type`) & Phím tắt (`key`):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  value={controlLabel}
                  onChange={(e) => setControlLabel(e.target.value)}
                  placeholder="Nhãn nút cần click (VD: Tiếp tục, Tìm kiếm...)"
                  className={cx(inputCls, "sm:col-span-4 text-xs")}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    invokeMuseRpc("computer.control", {
                      action: "click_element",
                      label: controlLabel || "OK",
                    })
                  }
                  disabled={Boolean(runningId)}
                  className="sm:col-span-2 justify-center"
                >
                  <MousePointerClick className="w-3.5 h-3.5 mr-1" /> Click
                </Button>
                <input
                  value={controlText}
                  onChange={(e) => setControlText(e.target.value)}
                  placeholder="Văn bản cần gõ tự động vào cửa sổ..."
                  className={cx(inputCls, "sm:col-span-4 text-xs")}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    invokeMuseRpc("computer.control", {
                      actions: [
                        { action: "type", element_number: 1, text: controlText || "Xin chào từ Muse CUA" },
                        { action: "key", key: "return" },
                      ],
                    })
                  }
                  disabled={Boolean(runningId)}
                  className="sm:col-span-2 justify-center"
                >
                  ⌨️ Gõ + Enter
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 2: EXTRACTED MUSE.APP RPC & REST API EXPLORER ── */}
      {activeTab === "rpc_api" && (
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">
                  🔬 Trình Thực Thi Trực Tiếp Các API Dịch Ngược Từ `Muse.app` (`POST /v1/muse/rpc`)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toàn bộ phương thức RPC, REST `/api/*` và `window.endoHatch` dưới đây được trích xuất từ binary `/Users/nguyenduchoai/Data/BIZINO/Skills_AI/Muse.app/Contents/MacOS/Muse` bằng bộ skill REA (`reverse-engineer-anything` v49). Bấm vào bất kỳ API nào để nạp tham số và chạy thử ngay!
                </p>
              </div>
              <Badge tone="green">window.endoHatch: Active</Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="lg:col-span-4">
                <label className="text-xs font-semibold">Phương thức Muse RPC (`method`):</label>
                <input
                  value={rpcMethod}
                  onChange={(e) => setRpcMethod(e.target.value)}
                  className={cx(inputCls, "mt-1 font-mono text-xs")}
                />
              </div>
              <div className="lg:col-span-6">
                <label className="text-xs font-semibold">Tham số JSON (`params`):</label>
                <input
                  value={rpcParamsText}
                  onChange={(e) => setRpcParamsText(e.target.value)}
                  className={cx(inputCls, "mt-1 font-mono text-xs")}
                />
              </div>
              <div className="lg:col-span-2">
                <Button
                  onClick={() => {
                    let parsed = {};
                    try {
                      parsed = JSON.parse(rpcParamsText || "{}");
                    } catch {
                      toast("JSON tham số không hợp lệ", "err");
                      return;
                    }
                    void invokeMuseRpc(rpcMethod, parsed);
                  }}
                  disabled={Boolean(runningId)}
                  className="w-full justify-center"
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" /> Gọi RPC
                </Button>
              </div>
            </div>

            {/* CUA & Video RPC table */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-violet-600">
                A. Nhóm API Điều khiển Máy tính (CUA) & Tạo Video/Media (`Muse.app` Core RPCs)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(catalog?.cuaAndMediaRpc ?? []).map((item: any) => (
                  <div
                    key={item.method}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-2 bg-white dark:bg-slate-950"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs font-bold text-violet-700 dark:text-violet-300">{item.method}</code>
                        <Badge tone="violet">{item.group}</Badge>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{item.desc}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <code className="text-[10px] text-slate-400 truncate">
                        {JSON.stringify(item.sampleParams)}
                      </code>
                      <Button
                        size="sm"
                        onClick={() => {
                          setRpcMethod(item.method);
                          setRpcParamsText(JSON.stringify(item.sampleParams));
                          void invokeMuseRpc(item.method, item.sampleParams);
                        }}
                      >
                        ▶ Chạy API
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Local Connectors RPC table */}
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                B. Nhóm API Connectors Nội bộ trên máy Mac (`files.*`, `notes.*`, `calendar.*`, `reminders.*`, `email.*`, `imessage.*`, `whatsapp.*`, `voice.*`)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {(catalog?.connectorRpc ?? []).map((item: any) => (
                  <div
                    key={item.method}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-2 bg-white dark:bg-slate-950"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{item.method}</code>
                        <Badge tone="green">{item.group}</Badge>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{item.desc}</p>
                    </div>
                    <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setRpcMethod(item.method);
                          setRpcParamsText(JSON.stringify(item.sampleParams));
                          void invokeMuseRpc(item.method, item.sampleParams);
                        }}
                      >
                        ▶ Chạy `{item.method}`
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* window.endoHatch & REST endpoints */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="text-xs font-bold">
                  C. 16 Phương thức Native Bridge `window.endoHatch.*` (Đã gắn vào `window.endoHatch`):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(catalog?.endoHatchBridgeMethods ?? []).map((m: string) => (
                    <span key={m} className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[11px]">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="text-xs font-bold">
                  D. 18 Đường dẫn REST `/api/*` trích xuất từ `Muse.app/Contents/MacOS/Muse`:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(catalog?.restEndpoints ?? []).map((ep: string) => (
                    <span key={ep} className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[11px]">
                      {ep}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 3: 12 MUSE CONNECTORS & LOCAL EXECUTION ── */}
      {activeTab === "connectors" && (
        <div className="space-y-6">
          {/* Category filter pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setCatFilter(t.id)}
                  className={cx(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition",
                    catFilter === t.id
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Nhập nội dung / chủ đề tùy chọn khi bấm ▶ Chạy Local..."
                className={cx(inputCls, "text-xs w-72")}
              />
            </div>
          </div>

          {/* 12 CONNECTORS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredConnectors.map((c) => {
              const Icon = ICON_MAP[c.icon] ?? Plug;
              const isBusy = runningId === c.id;
              return (
                <Card
                  key={c.id}
                  className={cx(
                    "p-4 flex flex-col justify-between gap-4 transition border",
                    selectedConnector === c.id
                      ? "border-violet-500 ring-1 ring-violet-500/30"
                      : "border-slate-200 dark:border-slate-800",
                  )}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                            {c.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">{c.subtitle}</div>
                        </div>
                      </div>
                      <Badge tone={c.permission === "off" ? "gray" : "green"}>
                        {c.permission === "off" ? "Đã tắt" : "Local Ready"}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {c.description}
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {(c.capabilities ?? []).map((cap: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300"
                        >
                          ✓ {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500 font-medium">Quyền truy cập Mac:</span>
                      <select
                        value={c.permission}
                        onChange={(e) => changePermission(c.id, e.target.value)}
                        className={cx(inputCls, "!py-1 !text-xs max-w-[200px]")}
                      >
                        <option value="read_write">Đọc & Ghi (Toàn quyền)</option>
                        <option value="read_only">Chỉ đọc (An toàn)</option>
                        <option value="always_ask">Luôn hỏi trước</option>
                        <option value="off">Tắt kết nối</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={isBusy || c.permission === "off"}
                        onClick={() => runConnector(c.id)}
                        className="flex-1 justify-center"
                      >
                        <Play className="w-3.5 h-3.5 mr-1.5" />
                        {isBusy ? "Đang chạy Local..." : c.actionLabel}
                      </Button>
                      {c.id === "mac_files" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => runConnector("mac_files", { prompt: "finder" })}
                          title="Mở thư mục dự án trong cửa sổ Finder của máy Mac"
                        >
                          Mở Finder
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* CUSTOM CONNECTORS SECTION */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-violet-600" />
                  Công cụ Kết nối Tùy chỉnh (Muse Custom Connectors · MCP SSE / Webhook / CLI Local)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tương tự mục <b>“Công cụ kết nối tùy chỉnh”</b> trong Muse.app: cho phép Sếp gắn thêm bất kỳ máy chủ MCP, Webhook nội bộ hoặc lệnh CLI riêng trên máy.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => nav("/ads/ai-gateway")}>
                Quản lý khóa MCP Server
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
              <div className="md:col-span-3">
                <label className="text-[11px] font-medium text-slate-600">Tên công cụ kết nối</label>
                <input
                  value={newConnName}
                  onChange={(e) => setNewConnName(e.target.value)}
                  placeholder="VD: ERP Nội bộ / Notion MCP..."
                  className={inputCls}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] font-medium text-slate-600">Loại giao thức</label>
                <select value={newConnKind} onChange={(e) => setNewConnKind(e.target.value as any)} className={inputCls}>
                  <option value="mcp_sse">MCP Server (SSE/HTTP)</option>
                  <option value="http_webhook">HTTP Webhook</option>
                  <option value="local_cli">Lệnh CLI trên máy Mac</option>
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="text-[11px] font-medium text-slate-600">URL hoặc Lệnh thực thi</label>
                <input
                  value={newConnUrl}
                  onChange={(e) => setNewConnUrl(e.target.value)}
                  placeholder="https://... hoặc /usr/local/bin/my-tool"
                  className={inputCls}
                />
              </div>
              <div className="md:col-span-3 flex gap-2">
                <Button onClick={addCustomConnector} className="w-full justify-center">
                  <Plus className="w-4 h-4 mr-1" /> Thêm Connector
                </Button>
              </div>
            </div>

            {(muse?.customConnectors ?? []).length > 0 && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border rounded-xl">
                {(muse.customConnectors as any[]).map((cc) => (
                  <div key={cc.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold">{cc.name}</span>{" "}
                      <Badge tone="blue">{cc.permission ?? "read_write"}</Badge>
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5">{cc.endpointUrl}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => deleteCustomConnector(cc.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── TAB 4: MULTI-PROVIDER AI TASK ROUTER ── */}
      {activeTab === "routing" && (
        <div className="space-y-4">
          <LlmPanel />
        </div>
      )}

      {/* ── TAB 5: LOCAL SPACES & ARTIFACTS (HatchSpace / HatchLibrary) ── */}
      {activeTab === "spaces" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Clapperboard className="w-4 h-4 text-violet-600" />
                Video MP4 đã dựng trên máy (`Remotion 1080×1920` + `VieNeu-TTS`)
              </h3>
              <Button size="sm" variant="secondary" onClick={() => nav("/video-flow")}>
                Mở Xưởng Video
              </Button>
            </div>
            <div className="space-y-3">
              {(muse?.recentArtifacts?.videos ?? []).map((v: any) => (
                <div
                  key={v.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{v.title}</div>
                    <div className="text-slate-500 text-[11px]">
                      Trạng thái: <b>{v.status}</b> · Mã: `{v.id.slice(0, 8)}`
                    </div>
                  </div>
                  {v.status === "done" && (
                    <a
                      href={`/v1/creative/jobs/${v.id}/video`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-500"
                    >
                      ▶ Xem MP4
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                Ảnh thiết kế 4:5 & Bài viết gần đây
              </h3>
              <Button size="sm" variant="secondary" onClick={() => nav("/publish")}>
                Mở Đăng Bài
              </Button>
            </div>
            <div className="space-y-3">
              {(muse?.recentArtifacts?.images ?? []).map((img: any) => (
                <div
                  key={img.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{img.title}</div>
                    <div className="text-slate-500 text-[11px]">
                      Kích thước: <b>{img.width}×{img.height}</b> · Engine: {img.engine}
                    </div>
                  </div>
                  {img.imageUrl && (
                    <a
                      href={img.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
                    >
                      Xem Ảnh 4:5
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
