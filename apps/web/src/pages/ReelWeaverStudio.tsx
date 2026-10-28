import { useEffect, useState } from "react";
import { Check, Clapperboard, Copy, ExternalLink, Film, Layers, Loader2, Mic, Palette, Play, Sparkles, Wand2 } from "lucide-react";
import { api, useApi } from "../lib/api";
import { Badge, Button, Card, cx, useToast } from "../components/ui";

export function ReelWeaverStudio() {
  const { data: catalog, reload } = useApi<any>("studio/reelweaver-catalog");
  const toast = useToast();

  const [selectedNiche, setSelectedNiche] = useState<string>("commercial-brand");
  const [selectedStyle, setSelectedStyle] = useState<string>("srt_moral");
  const [topic, setTopic] = useState<string>(
    "Câu chuyện giữ trọn chữ tín của cửa hàng thực phẩm sạch và bí quyết chọn Yến Sào Chưng Tươi chuẩn vị",
  );
  const [voice, setVoice] = useState<string>("Binh (nam miền Bắc)");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [busy, setBusy] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Tự động nạp 1 bản dựng mẫu (Sample) ngay khi mở trang để người dùng thấy kết quả trực quan ngay lập tức
  useEffect(() => {
    if (!catalog || result || busy) return;
    void handleGenerate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

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
      <div className="rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Studio Phim AI Hợp Nhất · MoonReel × FrameWeaver × 26Flow
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Xưởng Dựng Phim Đa Cảnh & Khóa Đồng Nhất Nhân Vật
            </h1>
            <p className="max-w-3xl text-sm text-indigo-100">
              Chọn <b>Ngách kênh (MoonReel)</b> ➔ Chọn <b>Phong cách vẽ (FrameWeaver: Người que, Nhân quả 2D, Dân gian VN, 3D Pixar)</b> ➔ Tự động khóa nhân vật (<b>STYLE/CHAR/SET LOCK</b>), bung đa góc máy (<b>Multi-Angle 85mm</b>), tạo <b>Thumbnail Satori</b> và xuất <b>Caption 4 nền tảng</b>.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 rounded-2xl bg-black/25 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span
                className={cx(
                  "h-2.5 w-2.5 rounded-full",
                  catalog?.gateway?.online ? "bg-emerald-400 animate-pulse" : "bg-amber-300",
                )}
              />
              <span>
                Cầu nối muse2api (Cổng 18610):{" "}
                <b>{catalog?.gateway?.online ? `Sẵn sàng (${catalog.gateway.accounts} TK)` : "Đang chạy nền (Chờ gắn Cookie)"}</b>
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
