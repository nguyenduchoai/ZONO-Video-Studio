import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Clapperboard, CookingPot, Footprints, Newspaper, Scissors, UserRound, Wand2, ExternalLink, Film, Globe, ImagePlus, Loader2, Mic, PersonStanding, Play, Shirt, Sparkles, Square, Store, Trash2, UtensilsCrossed } from "lucide-react";
import { api, apiUrl, useApi } from "../lib/api";
import { timeAgo } from "../lib/format";
import { Badge, Button, Card, Empty, Field, Fold, Loading, Modal, MoreToggle, PageHeader, PlatformIcon, cx, inputCls, useToast } from "../components/ui";

const TOOL_ICON: Record<string, any> = { "review-do-an-vat": UtensilsCrossed, "review-thoi-trang": Shirt, "nguoi-que-so-sanh": PersonStanding, "nhan-hieu": Mic, "koc-thoi-trang-nu": Sparkles, "review-gia-dung": CookingPot, "review-nha-hang": Store, "cooking-director": Clapperboard, cinematic: Film, "auto-video": Wand2, "news-video": Newspaper, "anim-video": Sparkles, "edit-source": Scissors, "nhan-hieu-dao-ly": Footprints, portrait: UserRound };
const ANIM_TEMPLATES = [
  ["ecommerce-promo", "E-commerce & Flash Sale (Sản phẩm, Giỏ hàng, So sánh giá)"],
  ["fnb-cartoon", "Ẩm thực & F&B (Nhà hàng, Đồ ăn vặt, Trà sữa, Cafe)"],
  ["health-beauty", "Y tế, Dược phẩm, Nha khoa, Spa & Mỹ phẩm"],
  ["education-explainer", "Giáo dục, Khóa học, AI & Kiến thức (Motion Canvas / Kurzgesagt)"],
  ["finance-realestate", "Tài chính, Bất động sản, Đầu tư & B2B SaaS"],
  ["stickman-story", "Kể chuyện Người Que (Stickman Nền Sáng / Nền Đen)"],
  ["moral-story", "Truyện Nhân Quả & Đời Thường 2D (Giàu cảm xúc)"],
  ["vietnamese-folk", "Truyện Dân Gian Việt Nam (Hoa văn & Làng quê truyền thống)"],
] as const;
const ANIM_STYLES = [
  ["2d-mascot", "Nhân vật 2D Đời Thường Việt Nam (Quần áo & bối cảnh đồng nhất)"],
  ["stickman", "Người Que Tối Giản (Stickman Nền Sáng / Nền Đen)"],
  ["moral-cinematic", "2D Điện Ảnh Truyện Nhân Quả & Dân Gian Việt Nam"],
  ["ghibli-watercolor", "Tranh Vẽ Màu Nước Chữa Lành (Ghibli) & Đất Sét (Claymation)"],
  ["kinetic-motion", "Motion Graphics & Kinetic Typography (Remotion + Motion + Satori)"],
] as const;
const PACKAGED_21_TOOLS = [
  { group: "1. Agent Skills & Đạo diễn", items: ["remotion-dev/skills", "motiondivision/ai-kit", "greensock/gsap-skills", "Vincentwei1021/video-shotcraft"] },
  { group: "2. Design & Vector", items: ["svg/svgo", "vercel/satori"] },
  { group: "3. Animation 2D & Motion", items: ["greensock/GSAP", "juliangarnier/anime", "motiondivision/motion", "rive-app/rive-wasm", "LottieFiles/dotlottie-web"] },
  { group: "4. Video Engine", items: ["remotion-dev/remotion", "motion-canvas/motion-canvas"] },
  { group: "5. Giải mã Video & Dựng Footage Quay Sẵn", items: ["FFprobe Scene-Cut Decoder", "Faster-Whisper Word-Timing", "Contact-Sheet Vision Analyzer", "Claude CLI Shot-Matcher", "FFmpeg Zoompan & Xfade"] },
  { group: "6. Âm thanh & Xuất bản", items: ["VieNeu-TTS (Bắt buộc · Bước 2)", "goldfire/howler.js", "Vanilagy/mediabunny", "FFmpeg/FFmpeg"] },
] as const;
const ALL_21_TOOL_NAMES = PACKAGED_21_TOOLS.flatMap((g) => [...g.items]);
const ANIM_SAMPLE_PRESETS: Record<string, { title: string; product: string; hookTitle: string; cta: string; brief: string }> = {
  "ecommerce-promo": {
    title: "Flash Sale Siêu Phẩm Công Nghệ ZONO",
    product: "Nền tảng Tự động hóa ZONO AI",
    hookTitle: "Tiết kiệm 80% chi phí vận hành chỉ với 1 chạm!",
    cta: "Bấm vào giỏ hàng hoặc nhắn tin nhận ưu đãi 50% ngay hôm nay!",
    brief: "Bạn đang tốn quá nhiều thời gian để làm video và chăm sóc khách hàng mỗi ngày? Nền tảng ZONO AI giúp doanh nghiệp tự động giải mã video mẫu và dựng phim thương mại từ các cảnh quay sẵn ngay trên máy tính. Tích hợp sẵn công cụ đồ họa cùng giọng đọc VieNeu-TTS 3 miền tự nhiên như người thật. Hàng ngàn chủ shop đã tăng gấp đôi doanh số mà không tốn một đồng chi phí quảng cáo dư thừa.",
  },
  "fnb-cartoon": {
    title: "Review Combo Trà Sữa Nướng Kem Trứng Khè",
    product: "Trà Sữa Nướng Kem Trứng Khè",
    hookTitle: "Tín đồ trà sữa nhất định không thể bỏ qua cực phẩm này!",
    cta: "Đặt đơn ngay trên ứng dụng để nhận ưu đãi mua 1 tặng 1!",
    brief: "Thử ngay ly trà sữa nướng thơm lừng kết hợp lớp kem trứng khè béo ngậy tan chảy ngay đầu lưỡi. Lá trà ô long thượng hạng được ủ lạnh 12 tiếng giữ trọn vị thanh mát tự nhiên. Trân châu hoàng kim dẻo mềm nấu mới mỗi hai giờ. Đặt ngay hôm nay để nhận ưu đãi mua một tặng một cực hời cùng hội bạn thân.",
  },
  "health-beauty": {
    title: "Bí Quyết Phục Hồi Làn Da Căng Bóng Chuẩn Spa",
    product: "Serum Cấp Ẩm Chuyên Sâu ZONO Derma",
    hookTitle: "3 sai lầm khiến da bạn dưỡng mãi vẫn khô sạm!",
    cta: "Nhắn tin ngay để chuyên gia soi da và tư vấn phác đồ miễn phí!",
    brief: "Làn da khô sạm và thiếu sức sống khiến bạn mất tự tin mỗi khi ra ngoài? Công thức Hyaluronic Acid đa phân tử kết hợp Vitamin B5 giúp cấp ẩm sâu gấp năm lần. Phục hồi hàng rào bảo vệ da chỉ sau bảy ngày sử dụng đều đặn. An toàn lành tính cho mọi loại da nhạy cảm nhất.",
  },
  "education-explainer": {
    title: "Giải Mã Cách AI Agent Tự Động Hóa Doanh Nghiệp 1 Người",
    product: "Khóa Học & Nền Tảng ZONO Agentic AI",
    hookTitle: "Làm sao 1 người có thể vận hành cả công ty bằng AI?",
    cta: "Đăng ký trải nghiệm miễn phí hệ thống ngay tại link bên dưới!",
    brief: "Thay vì thuê hàng chục nhân sự, doanh nghiệp một người hiện nay sử dụng hệ thống AI Agent tự hành. Bước một, AI tự động nghiên cứu thị trường và lên kịch bản nội dung. Bước hai, hệ thống tự dựng video hoạt hình và thu âm giọng đọc tiếng Việt tự nhiên. Bước ba, kiểm duyệt pháp lý tự động và đăng đa kênh hoàn toàn khép kín.",
  },
  "finance-realestate": {
    title: "Phân Tích Cơ Hội Đầu Tư & Quản Trị Dòng Tiền Thông Minh",
    product: "Giải Pháp Quản Trị Tài Chính ZONO FinTech",
    hookTitle: "Đừng để dòng tiền nhàn rỗi mất giá mỗi năm!",
    cta: "Liên hệ ngay để nhận báo cáo phân tích danh mục đầu tư chi tiết!",
    brief: "Quản trị dòng tiền thông minh là chìa khóa giúp doanh nghiệp vững vàng trước mọi biến động thị trường. Hệ thống báo cáo trực quan theo thời gian thực giúp bạn kiểm soát chi phí và tối ưu lợi nhuận. Tự động cảnh báo rủi ro và đối soát thuế hóa đơn điện tử chính xác tuyệt đối.",
  },
  "stickman-story": {
    title: "Câu Chuyện Người Que: Làm Việc Thủ Công vs Dùng AI Tự Động",
    product: "Trợ Lý AI Toàn Năng ZONO",
    hookTitle: "Tại sao bạn làm việc 14 tiếng mỗi ngày mà vẫn quá tải?",
    cta: "Chuyển sang làm việc thông minh cùng ZONO AI ngay hôm nay!",
    brief: "Anh A thức khuya dậy sớm tự cắt ghép từng đoạn video và trả lời từng tin nhắn khách hàng. Trong khi đó anh B bật hệ thống ZONO AI trên máy cá nhân để tự động sản xuất hàng loạt video hoạt hình hấp dẫn. Chỉ sau một tháng, anh B tăng gấp ba lượng khách hàng mà vẫn có thời gian nghỉ ngơi bên gia đình.",
  },
  "moral-story": {
    title: "Truyện Nhân Quả 2D: Chữ Tín Của Người Làm Nghề Chân Chính",
    product: "Thương Hiệu Tâm Huyết Gia Truyền",
    hookTitle: "Một lần giữ trọn chữ tín, vạn lần khách nhớ quay về!",
    cta: "Hãy để lại bình luận và theo dõi kênh để đón xem những câu chuyện ý nghĩa tiếp theo!",
    brief: "Giữa khu phố sầm uất, tiệm nhỏ vẫn kiên trì chọn từng nguyên liệu sạch nhất dù chi phí cao hơn. Nhiều người bảo làm vậy sao có lời nhanh, nhưng người chủ chỉ mỉm cười giữ trọn cái tâm với khách. Năm năm sau, khi các tiệm làm ẩu lần lượt đóng cửa, tiệm nhỏ ngày nào đã trở thành thương hiệu uy tín được hàng ngàn gia đình tin yêu.",
  },
  "vietnamese-folk": {
    title: "Truyện Dân Gian Việt Nam: Sự Tích Nghề Thủ Công Truyền Thống",
    product: "Tinh Hoa Quà Việt Truyền Thống",
    hookTitle: "Bí mật ngàn năm ẩn sau nét vẽ dân gian Việt Nam!",
    cta: "Khám phá ngay bộ sưu tập quà tặng văn hóa Việt tại cửa hàng!",
    brief: "Ngày xưa nơi làng quê Bắc Bộ yên bình bên gốc đa bến nước, các nghệ nhân đã gửi gắm ước vọng sum vầy vào từng đường nét thủ công tinh xảo. Qua bao thế hệ, sắc màu ấm áp của đất trời và bàn tay khéo léo ấy vẫn vẹn nguyên giá trị trong từng món quà trao tay dịp lễ Tết.",
  },
};
const STATUS: Record<string, [string, any]> = {
  queued: ["Chờ trình duyệt", "gray"], running: ["Đang sản xuất", "blue"], done: ["Xong, chờ duyệt", "green"],
  approved: ["Đã duyệt", "blue"], drafted: ["Đã lên nháp kênh", "green"],
  failed: ["Lỗi", "red"], blocked: ["Bị chặn", "amber"], cancelled: ["Đã hủy", "gray"],
};
// Order = default role for the 1st, 2nd… uploaded image. Names map onto the Tool's slots (A nhân vật, B bao bì, I bên trong, E bối cảnh).
const ROLES = ["Bao bì / sản phẩm", "Nhân vật / người review", "Bên trong sản phẩm", "Bối cảnh / góc bếp", "Nhân vật 2", "Phong cách"];
const CHANNELS = ["tiktok", "facebook", "instagram"];

/** Gửi 1 video lớn thẳng dạng luồng (không base64) kèm % tiến độ; trả về đường dẫn trên máy chủ. */
const VIDEO_FILE_RE = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;
function putVideoStream(f: File, onPct: (n: number | null) => void): Promise<{ path: string }> {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open("PUT", apiUrl(`/v1/uploads/stream?name=${encodeURIComponent(f.name)}`));
    x.setRequestHeader("content-type", "application/octet-stream");
    x.upload.onprogress = (e) => e.lengthComputable && onPct(Math.round((e.loaded / e.total) * 100));
    x.onload = () => { try { const j = JSON.parse(x.responseText); x.status < 300 ? res(j) : rej(new Error(j.message ?? `Lỗi ${x.status}`)); } catch { rej(new Error(`Lỗi ${x.status}`)); } };
    x.onerror = () => rej(new Error("Mất kết nối khi tải lên"));
    x.send(f);
  }).finally(() => onPct(null)) as Promise<{ path: string }>;
}
const EDIT_STYLE_OPTIONS = [["dynamic", "Năng động — nhịp nhanh, zoom mạnh (TikTok/Reels)"], ["smooth", "Mượt, sang — chuyển cảnh nhẹ"], ["clean", "Gọn, chuyên nghiệp"]] as const;

export function VideoFlow() {
  const [params] = useSearchParams();
  const tools = useApi<any[]>("creative/tools");
  const settings = useApi<any>("creative/settings");
  const { data: sys } = useApi<any>("system");
  const jobs = useApi<any[]>("creative/jobs", ["creative.", "approval."]);
  const fb = useApi<any>("creative/flow-browser", ["creative."]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pickBrowser, setPickBrowser] = useState(false);
  const toast = useToast();

  const [form, setForm] = useState<any>({
    tool: "edit-source",
    title: "Phim Thương Hiệu Dựng Từ Video Quay Sẵn (Học Theo Video Decode)",
    brand: "other",
    product: ANIM_SAMPLE_PRESETS["ecommerce-promo"].product,
    brief: ANIM_SAMPLE_PRESETS["ecommerce-promo"].brief,
    durationSec: 30,
    veoModel: "Veo 3.1 - Fast",
    voice: "",
    hookTitle: ANIM_SAMPLE_PRESETS["ecommerce-promo"].hookTitle,
    cta: ANIM_SAMPLE_PRESETS["ecommerce-promo"].cta,
    channels: ["tiktok"],
    images: [] as { path: string; role: string; name: string }[],
    // ảnh theo ô (vai trò) + ảnh tham khảo khác; local engines (Decode & Dựng từ video quay sẵn / Video tự động / Motion 2D)
    video: { source: "flow", flowJobId: "", scriptReady: false, terms: "", voiceName: "Ngọc Huyền", voiceRate: 1, bgm: "random", aspect: "9:16", clipDuration: 4, driving: "d12.mp4", drivingPath: "", drivingName: "", voiceText: "", seconds: 6, animTemplate: "ecommerce-promo", animStyle: "2d-mascot", materials: [] as { path: string; name: string }[] },
  });
  const [decodeBusy, setDecodeBusy] = useState(false);
  const [decodedBlueprint, setDecodedBlueprint] = useState<any>(null);
  const [decodedVideoResult, setDecodedVideoResult] = useState<any>(null);
  const decodeReferenceVideo = async (videoPath?: string) => {
    setDecodeBusy(true);
    try {
      const res = await api.post<any>("studio/decode-video", {
        videoPath,
        referenceNotes: form.brief,
        useWhisper: true,
        useClaude: false,
      });
      setDecodedBlueprint(res.blueprint);
      setV({ style: res.blueprint.recommendedEditStyle ?? "dynamic" });
      set((f: any) => ({
        ...f,
        durationSec: Math.round(res.blueprint.durationSec || 25),
        hookTitle: res.blueprint.hookFormula?.onScreenHookTitle || f.hookTitle,
        brief: `[CÔNG THỨC HỌC TỪ VIDEO MẪU ĐÃ DECODE (${res.blueprint.shotCount} cảnh · nhịp ${res.blueprint.avgShotSec}s/cảnh)]:\n${res.blueprint.reusablePromptTemplate}\n\nChi tiết phân cảnh mẫu:\n${(res.blueprint.decodedShots ?? []).map((s: any) => `- Cảnh ${s.sceneNumber} (${s.durationSec}s · ${s.cameraAngle} · zoom=${s.recommendedZoom}): ${s.howToShootOrSelect}`).join("\n")}\n\nNội dung sản phẩm của mình: ${f.product || f.title}`,
      }));
      toast(`Đã Decode xong (${res.blueprint.shotCount} cảnh) — đang kết xuất Video MP4 mới ngay...`, "info");

      const cloneRes = await api.post<any>("studio/clone-from-decoded", {
        blueprint: res.blueprint,
        rawVideoPaths: (form.video?.materials ?? []).map((m: any) => m.path),
        topic: form.title || form.product || "Sản phẩm chủ lực",
        product: form.product || form.title,
        brandName: ownBrand,
        voiceName: form.video?.voiceName || "Ngọc Huyền",
        editStyle: res.blueprint.recommendedEditStyle ?? "dynamic",
        renderMp4: true,
        useClaude: false,
      });
      setDecodedVideoResult(cloneRes.result);
      await jobs.reload();
      toast(`🎉 Đã Decode & dựng xong Video MP4 mới (${cloneRes.result?.renderedDurationSec}s)!`, "ok");
    } catch (e: any) {
      toast(e?.message ?? "Lỗi khi giải mã và dựng video", "err");
    } finally {
      setDecodeBusy(false);
    }
  };
  const [enabled21Tools, setEnabled21Tools] = useState<string[]>(() => [...ALL_21_TOOL_NAMES]);
  const toggle21Tool = (name: string) => {
    if (name.includes("VieNeu-TTS")) return; // VieNeu-TTS is mandatory
    setEnabled21Tools((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);
  };
  const applyPreset = (tplKey: string) => {
    const preset = ANIM_SAMPLE_PRESETS[tplKey] ?? ANIM_SAMPLE_PRESETS["ecommerce-promo"];
    setForm((f: any) => ({
      ...f,
      title: preset.title,
      product: preset.product,
      hookTitle: preset.hookTitle,
      cta: preset.cta,
      brief: preset.brief,
      video: { ...f.video, animTemplate: tplKey },
    }));
    toast(`Đã nạp kịch bản mẫu cho ngành "${ANIM_TEMPLATES.find(([k]) => k === tplKey)?.[1] ?? tplKey}"`, "info");
  };
  const vai = useApi<any>("video-ai/status");
  const dnaInfo = useApi<any>("dna");
  const ownBrand = dnaInfo.data?.data?.company?.brand || dnaInfo.data?.data?.company?.name || "Thương hiệu của Sếp";
  const setV = (p: any) => setForm((f: any) => ({ ...f, video: { ...f.video, ...p } }));
  const [confirm, setConfirm] = useState(false);
  const [upPct, setUpPct] = useState<number | null>(null);
  /** Video gốc (có thể vài GB): gửi thẳng dạng luồng, có % tiến độ — không qua base64. */
  const uploadSources = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      if (!/\.(mp4|mov|m4v|webm|mkv|avi|mp3|m4a|wav)$/i.test(f.name)) { toast(`${f.name}: chỉ nhận video/âm thanh`, "err"); continue; }
      try {
        const r = await putVideoStream(f, setUpPct);
        setForm((x: any) => ({ ...x, video: { ...x.video, materials: [...x.video.materials, { path: r.path, name: `${f.name} · ${(f.size / 1048576).toFixed(0)} MB` }] } }));
      } catch (e: any) { toast(`${f.name}: ${e.message}`, "err"); }
    }
  };
  const [allJobs, setAllJobs] = useState(false); // list shows the 3 latest runs unless expanded
  const [allTools, setAllTools] = useState(false); // tool picker shows 6 (always incl. the selected one) unless expanded
  const [busy, setBusy] = useState(false);
  const set = (p: any) => setForm((f: any) => ({ ...f, ...p }));

  // Prefill from an approved video script (Nội dung → "Sản xuất trên Flow")
  useEffect(() => {
    const from = params.get("from");
    if (!from) return;
    // Kịch bản → đúng skill + lời đọc đã làm sạch (script-video.ts), không dán nguyên kịch bản sản xuất.
    api.get(`content/${from}/video-plan`).then((p) => {
      const i = p.input;
      setForm((f: any) => ({
        ...f, tool: i.tool, title: i.title, brief: i.brief, brand: "zono", sourceContentId: i.sourceContentId, product: i.product ?? "", voice: i.voice ?? "",
        hookTitle: i.hookTitle ?? "", cta: i.cta ?? "", durationSec: i.durationSec ?? f.durationSec, channels: (i.channels ?? []).filter((x: string) => CHANNELS.includes(x)),
        images: (i.images ?? []).map((m: any) => ({ ...m, name: m.path.split("/").pop() })), video: { ...f.video, ...(i.video ?? {}) },
      }));
      setSelected(i.tool);
      if (p.missing?.length) toast(`Kịch bản "${p.title}": ${p.missing.join("; ")}`, "info");
    }).catch((e) => toast(e.message, "err"));
  }, [params]);

  /** Upload images; with `role` the image fills that slot (replacing what was there), else it is an extra reference. */
  const upload = async (files: FileList | File[] | null, role?: string) => {
    if (!files) return;
    const list = Array.from(files).filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|heic)$/i.test(f.name));
    if (!list.length) { toast("Chỉ nhận ảnh png/jpg/webp/heic", "err"); return; }
    for (const f of role ? list.slice(0, 1) : list.slice(0, Math.max(0, 8 - form.images.length))) {
      const data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
      try {
        const r = await api.post("/v1/uploads", { name: f.name, data });
        const img = { path: r.path, role: role ?? "Ảnh tham khảo khác", name: f.name, preview: URL.createObjectURL(f) };
        setForm((x: any) => ({ ...x, images: role ? [...x.images.filter((i: any) => i.role !== role), img] : [...x.images, img] }));
      } catch (e: any) { toast(`${f.name}: ${e.message}`, "err"); }
    }
  };

  const uploadFiles = async (files: FileList | null, accept: RegExp) => {
    const out: { path: string; name: string }[] = [];
    for (const f of Array.from(files ?? [])) {
      if (!accept.test(f.name)) { toast(`${f.name}: định dạng không hỗ trợ`, "err"); continue; }
      const data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
      try { const r = await api.post("/v1/uploads", { name: f.name, data }); out.push({ path: r.path, name: f.name }); } catch (e: any) { toast(`${f.name}: ${e.message}`, "err"); }
    }
    return out;
  };

  const start = async () => {
    setBusy(true);
    try {
      const { images, video, ...rest } = form;
      const preset = ANIM_SAMPLE_PRESETS[video.animTemplate ?? "ecommerce-promo"] ?? ANIM_SAMPLE_PRESETS["ecommerce-promo"];
      const safeTitle = form.title.trim() || (engine === "anim" ? preset.title : tool?.label ?? "Video AI Mới");
      const v = engine === "moneyprinter"
        ? { source: video.source, flowJobId: video.source === "flow" ? video.flowJobId || undefined : undefined, materials: video.source === "local" ? video.materials.map((m: any) => m.path) : undefined, scriptReady: video.scriptReady || undefined, terms: video.terms || undefined, voiceName: video.voiceName, voiceRate: Number(video.voiceRate), bgm: video.bgm, aspect: video.aspect, clipDuration: Number(video.clipDuration) }
        : engine === "edit" ? { materials: video.materials.map((m: any) => m.path), aspect: ["9:16", "1:1", "16:9"].includes(video.aspect) ? video.aspect : "9:16", style: video.style ?? "dynamic", music: video.music === "none" ? "none" : "auto" }
        : engine === "anim" ? { animTemplate: video.animTemplate ?? "ecommerce-promo", animStyle: video.animStyle ?? "2d-mascot", voiceName: video.voiceName || "Ngọc Huyền", voiceRate: Number(video.voiceRate) || 1 }
        : engine === "news" ? { voiceName: video.voiceName || "Ngọc Huyền" }
        : engine === "liveportrait" ? { driving: video.drivingPath ? undefined : video.driving, drivingPath: video.drivingPath || undefined, voiceText: video.voiceText || undefined, voiceName: video.voiceName, seconds: Number(video.seconds) } : undefined;
      const brief = form.brief.trim().length >= 5 ? form.brief : (engine === "anim" ? preset.brief : `${safeTitle} — ${tool?.label ?? ""}`);
      const slotRoles = new Set((tool?.slots ?? []).map((x: any) => x.role));
      const used = engine === "flow" ? images : images.filter((i: any) => slotRoles.has(i.role)); // local engines use their own slots only
      const j = await api.post("creative/jobs", { ...rest, title: safeTitle, brief, video: v, durationSec: Number(form.durationSec) || undefined, images: used.map((i: any) => ({ path: i.path, role: i.role })), product: form.product || (engine === "anim" ? preset.product : undefined), voice: form.voice || undefined, hookTitle: form.hookTitle || (engine === "anim" ? preset.hookTitle : undefined), cta: form.cta || (engine === "anim" ? preset.cta : undefined), channels: form.channels.length ? form.channels : ["tiktok"] });
      toast(engine === "flow" ? "Đã đưa vào hàng đợi. Agent chạy ngầm trong Chrome Flow — Sếp sẽ nhận thông báo khi video xong." : "Đã bắt đầu sản xuất Video Local trên máy — theo dõi tiến độ trực tiếp ở khung bên phải!", "ok");
      setConfirm(false);
      setSelected(j.id);
      jobs.reload();
    } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };

  const tool = tools.data?.find((t) => t.key === form.tool);
  const engine: "flow" | "moneyprinter" | "liveportrait" | "news" | "edit" | "anim" = tool?.engine ?? "flow";
  const flowDone = (jobs.data ?? []).filter((j: any) => !["auto-video", "portrait", "news-video", "anim-video"].includes(j.tool) && ["done", "approved", "drafted"].includes(j.status));
  const hasBrowser = !!settings.data?.chromeProfileDir;
  const useChrome = settings.data?.engine === "claude-in-chrome";
  const fbAccount = fb.data?.accounts?.includes(settings.data?.chromeProfileEmail) ? settings.data.chromeProfileEmail : fb.data?.accounts?.[0];
  const showFlow = async (state: "normal" | "parked") => { try { await api.post("creative/flow-browser/window", { state }); } catch (e: any) { toast(e.message, "err"); } };
  const login = async () => { try { await api.post("creative/flow-browser/login"); toast("Đã mở Chrome Flow ở trang đăng nhập Google — Sếp đăng nhập 1 lần", "info"); fb.reload(); } catch (e: any) { toast(e.message, "err"); } };
  const cliOk = ["claude_cli", "codex_cli", "gemini_cli"].includes(sys?.llm?.provider) && sys?.llm?.loggedIn !== false && !sys?.llm?.authError;
  const ready = engine === "flow" ? hasBrowser && cliOk : engine === "moneyprinter" ? !!vai.data?.moneyprinter?.installed : (engine === "news" || engine === "anim") ? !!vai.data?.remotion?.installed : engine === "edit" ? !!vai.data : !!vai.data?.liveportrait?.installed;
  const current = selected ?? jobs.data?.[0]?.id ?? null;
  const setupLoaded = !!settings.data && !!sys;
  const setupOk = hasBrowser && cliOk;
  const toolList = tools.data ?? [];
  const localTools = toolList.filter((t) => t.engine && t.engine !== "flow");
  const flowTools = toolList.filter((t) => !t.engine || t.engine === "flow");
  const shownFlowTools = allTools || flowTools.length <= 4 ? flowTools : flowTools.slice(0, 4).some((t) => t.key === form.tool) ? flowTools.slice(0, 4) : [...flowTools.slice(0, 3), ...flowTools.filter((t) => t.key === form.tool)];

  return (
    <div className="space-y-6">
      <PageHeader title="Sản xuất video" subtitle="Google Flow (AI tạo cảnh, chạy trong Tool của skill) · AI tự edit từ video gốc Sếp tải lên · Video tự động từ cảnh có sẵn + giọng đọc Việt · Ảnh chân dung cử động — xong thì Review, gửi duyệt và đăng nháp lên kênh." />

      <Fold key={setupLoaded ? (setupOk ? "ok" : "todo") : "loading"} icon={Globe} tone={!setupLoaded ? "gray" : setupOk ? "green" : "amber"} defaultOpen={setupLoaded && !setupOk}
        title="Trình duyệt & tài khoản AI" bodyClass="space-y-3 px-4 pb-4 pt-1"
        summary={!setupLoaded ? "đang kiểm tra…" : setupOk ? `Sẵn sàng · ${settings.data?.chromeProfileName ?? "Chrome"}${settings.data?.chromeProfileEmail ? ` (${settings.data.chromeProfileEmail})` : ""} · ${useChrome ? "Claude in Chrome" : "Chrome Flow"}` : "Cần thiết lập trước khi tạo video — bấm để xem"}>
        <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3 text-sm", ready ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/10")}>
          <Globe className="h-5 w-5" />
          <span>Tài khoản Flow: {settings.data?.chromeProfileDir ? <b>{settings.data.chromeProfileName}{settings.data.chromeProfileEmail ? ` · ${settings.data.chromeProfileEmail}` : ""}</b> : <b className="text-amber-700 dark:text-amber-300">chưa chọn profile</b>}</span>
          <span>· {useChrome ? <>Claude in Chrome: {settings.data?.browserDeviceId ? <Badge tone="green">đã ghép Chrome</Badge> : <Badge tone="amber">cần ghép Chrome</Badge>}</> : <>Chrome Flow: {!fb.data ? "…" : fbAccount ? <Badge tone="green">đã đăng nhập {fbAccount}</Badge> : fb.data.running ? <Badge tone="amber">chưa đăng nhập</Badge> : <Badge>tự mở khi chạy</Badge>}</>}</span>
          <span>· CLI Agent: {["claude_cli", "codex_cli", "gemini_cli"].includes(sys?.llm?.provider) ? <Badge tone={cliOk ? "green" : "amber"}>{cliOk ? `gói ${sys?.llm?.provider === "codex_cli" ? "Codex" : sys?.llm?.provider === "gemini_cli" ? "Gemini" : "Claude"} CLI` : "chưa sẵn sàng"}</Badge> : <Badge tone="amber">cần bật kết nối CLI</Badge>}</span>
          {sys?.llm?.authError && <p className="w-full text-xs text-amber-800 dark:text-amber-300">Chưa chạy được tác vụ AI: {sys.llm.authError}</p>}
          <Button size="sm" onClick={() => setPickBrowser(true)}>{hasBrowser ? "Đổi profile Chrome" : "Chọn profile Chrome"}</Button>
          {!useChrome && fb.data?.running && (fbAccount ? <><Button size="sm" variant="ghost" onClick={() => showFlow("normal")}>Xem Chrome Flow</Button><Button size="sm" variant="ghost" onClick={() => showFlow("parked")}>Cất Chrome Flow</Button></> : <Button size="sm" variant="soft" onClick={login}>Đăng nhập Chrome Flow</Button>)}
          <span className="w-full text-xs text-muted">{useChrome ? "AI dùng tiện ích Claude trong profile Chrome đã chọn. Mở profile đó và giữ tiện ích kết nối khi chạy video." : "Chrome Flow là cửa sổ Chrome riêng mang đăng nhập của profile đã chọn; AI thao tác bên trong Tool Flow."}</span>
        </div>
        <BrowserEngineControl flat current={settings.data} onSaved={() => settings.reload()} />
      </Fold>

      <ScriptsToVideo />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card title="Tạo video mới">
          <div className="space-y-4">
            <div className="space-y-2 rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.03] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">1. Sản xuất Video Local trên máy (Không tốn credit · CLI Agent + 21 Công cụ + VieNeu-TTS)</p>
                <Badge tone="green">Chạy Local 100%</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {localTools.map((t) => {
                  const Icon = TOOL_ICON[t.key] ?? Film;
                  return (
                    <button key={t.key} onClick={() => set({ tool: t.key, durationSec: t.key === "auto-video" ? 30 : t.key === "news-video" ? 60 : t.key === "anim-video" ? 45 : 48 })} className={cx("flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition", form.tool === t.key ? "border-indigo-600 bg-indigo-500/10 ring-2 ring-indigo-500/20" : "border-line bg-surface hover:bg-soft")}>
                      <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", form.tool === t.key ? "bg-indigo-600 text-white" : "bg-indigo-500/10 text-indigo-600")}><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold leading-tight text-ink" title={t.label}>{t.label}</span>
                        <span className="block truncate text-[11px] text-muted">~{t.minutes} phút · Chạy Local trên máy (không tốn credit)</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">2. Sản xuất Video trên Google Flow (Cần trình duyệt Chrome Flow)</p>
              <div className="grid gap-2 sm:grid-cols-2 md:max-xl:grid-cols-2">
                {shownFlowTools.map((t) => {
                  const Icon = TOOL_ICON[t.key] ?? Film;
                  return (
                    <button key={t.key} onClick={() => set({ tool: t.key, durationSec: t.key === "cinematic" ? 60 : t.key === "cooking-director" ? 80 : t.key === "review-thoi-trang" ? 40 : t.key === "nhan-hieu" ? 50 : t.key === "review-gia-dung" ? 40 : t.key === "review-nha-hang" ? 32 : 48 })} className={cx("flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left", form.tool === t.key ? "border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/15" : "border-line hover:bg-soft")}>
                      <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", form.tool === t.key ? "bg-blue-600 text-white" : "bg-blue-500/10 text-blue-600")}><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold leading-tight text-ink" title={t.label}>{t.label}</span>
                        <span className="block truncate text-[11px] text-muted">~{t.minutes} phút · Google Flow · skill v{t.skillVersion ?? "?"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {flowTools.length > 4 && <div className="flex justify-center"><MoreToggle open={allTools} onClick={() => setAllTools((v) => !v)} more={`Xem tất cả ${flowTools.length} công cụ Google Flow`} /></div>}
            </div>
            {tool && (
              <div className="space-y-1 rounded-xl bg-soft p-3 text-xs text-muted">
                <p>Cần: {tool.hint}</p>
                {engine === "flow"
                  ? (tool.generator
                    ? <p>Làm thẳng trong một project Google Flow (trình tạo video thường), không cần Tool riêng.</p>
                    : <ToolLink tool={tool} onSaved={tools.reload} />)
                  : <p>{engine === "edit" ? "Claude CLI + Local FFmpeg (tách phân cảnh & dựng phim) + Faster-Whisper (bóc băng từng từ) + phụ đề tiếng Việt" : engine === "anim" ? "Skill zono-animated-video: Tổ hợp Motion Graphics & 2D (Remotion + GSAP + Motion + Lottie/Rive + Satori/SVGO + ShotCraft) + VieNeu-TTS 48kHz (bắt buộc) + Whisper + FFmpeg" : engine === "moneyprinter" ? "MoneyPrinterTurbo (MIT) + Claude CLI viết lời + VieNeu-TTS giọng Việt" : engine === "news" ? "Skill news-to-video: Claude CLI + VieNeu-TTS + whisper + Remotion (phụ đề karaoke, đồ hoạ động)" : "LivePortrait (MIT, dò mặt MediaPipe — dùng thương mại được)"} · chạy trên máy Sếp{vai.data && engine !== "edit" && !(engine === "moneyprinter" ? vai.data.moneyprinter.installed : (engine === "news" || engine === "anim") ? vai.data.remotion?.installed : vai.data.liveportrait.installed) ? " · CHƯA CÀI — chạy pnpm video-ai:install" : ""}</p>}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tên video"><input className={inputCls} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Review bánh tráng trộn Tây Ninh" /></Field>
              <Field label="Thương hiệu / kênh" hint={form.brand === "zono" ? `Áp DNA ${ownBrand} (giọng, claim cấm)` : `Kênh affiliate/khách: không dùng giọng ${ownBrand}`}>
                <select className={inputCls} value={form.brand} onChange={(e) => set({ brand: e.target.value })}><option value="other">Kênh khác / khách hàng</option><option value="zono">{ownBrand} (áp DNA)</option></select>
              </Field>
              <Field label="Sản phẩm"><input className={inputCls} value={form.product} onChange={(e) => set({ product: e.target.value })} /></Field>
              {engine !== "liveportrait" && <Field label="Thời lượng (giây)" hint={engine === "flow" ? `${Math.max(1, Math.ceil((Number(form.durationSec) || 8) / 8))} cảnh × 8 giây` : engine === "edit" ? "Độ dài video sau khi cắt" : `~${Math.round((Number(form.durationSec) || 30) * 3)} từ lời đọc`}><input type="number" className={inputCls} value={form.durationSec} onChange={(e) => set({ durationSec: e.target.value })} /></Field>}
              {engine === "flow" && <Field className="sm:col-span-2" label="Model Veo (nếu Tool cho chọn)" hint="Lite rẻ nhất · Quality đẹp nhất, tốn credit hơn">
                <select className={inputCls} value={form.veoModel} onChange={(e) => set({ veoModel: e.target.value })}>{["Veo 3.1 - Lite", "Veo 3.1 - Fast", "Veo 3.1 - Quality"].map((m) => <option key={m} value={m}>{m}</option>)}</select>
              </Field>}
            </div>
            {engine === "anim" && (
              <div className="space-y-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-ink">Cấu hình Video Motion Graphics & 2D Đa Ngành Nghề (Bắt buộc VieNeu-TTS)</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="soft" onClick={() => applyPreset(form.video.animTemplate ?? "ecommerce-promo")}>✨ Nạp kịch bản mẫu theo ngành</Button>
                    <Button size="sm" variant="primary" icon={Play} loading={busy} disabled={!ready} onClick={start}>▶ Chạy tạo Video Motion 2D ngay</Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Mẫu ngành nghề (Industry Template)" hint="Đổi ngành sẽ gợi ý cấu trúc phân cảnh ShotCraft + bảng màu + nhân vật">
                    <select className={inputCls} value={form.video.animTemplate ?? "ecommerce-promo"} onChange={(e) => applyPreset(e.target.value)}>
                      {ANIM_TEMPLATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="Phong cách Motion & 2D (Animation Stack)" hint="Tổ hợp thư viện đồ họa Remotion 2D sẽ dựng">
                    <select className={inputCls} value={form.video.animStyle ?? "2d-mascot"} onChange={(e) => setV({ animStyle: e.target.value })}>
                      {ANIM_STYLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </Field>
                  <Field className="sm:col-span-2" label="Giọng đọc VieNeu-TTS (Bắt buộc — Bước 2 Sinh Giọng Đọc AI)" hint="Giọng tiếng Việt 48kHz tự nhiên 3 miền Bắc/Trung/Nam, đồng bộ khẩu hình nhân vật & phụ đề karaoke từng từ">
                    <select className={inputCls} value={form.video.voiceName} onChange={(e) => setV({ voiceName: e.target.value })}>
                      {(vai.data?.tts?.voices ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="space-y-2 rounded-xl border border-indigo-500/20 bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                      21 Công cụ Motion 2D, Giải mã Video & Âm thanh (Đang bật {enabled21Tools.length}/21 công cụ — bấm để bật/tắt):
                    </p>
                    <button type="button" onClick={() => setEnabled21Tools([...ALL_21_TOOL_NAMES])} className="text-[11px] font-semibold text-indigo-600 hover:underline">
                      Bật tất cả 21 công cụ
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PACKAGED_21_TOOLS.map((g) => (
                      <div key={g.group} className="rounded-lg border border-line bg-soft/40 p-2 text-[11px]">
                        <p className="mb-1.5 font-semibold text-ink">{g.group}</p>
                        <div className="flex flex-wrap gap-1">
                          {g.items.map((item) => {
                            const active = enabled21Tools.includes(item);
                            return (
                              <button
                                key={item}
                                type="button"
                                onClick={() => toggle21Tool(item)}
                                className={cx(
                                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-medium transition",
                                  active
                                    ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-800 dark:text-indigo-200"
                                    : "border-line bg-surface text-muted opacity-60"
                                )}
                              >
                                <span className={cx("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-gray-400")} />
                                {item}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-indigo-600/10 px-3 py-2.5 pt-2.5">
                    <span className="text-xs font-medium text-ink">
                      Sẵn sàng chạy Local 100% trên máy ({enabled21Tools.length} công cụ + giọng <b>{form.video.voiceName}</b> VieNeu-TTS 48kHz)
                    </span>
                    <Button variant="primary" icon={Play} loading={busy} disabled={!ready} onClick={start}>
                      ▶ Bấm Chạy Tạo Video Ngay (Local)
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {engine === "news" && (
              <div className="space-y-3 rounded-xl border border-line p-3">
                <Field label="Giọng đọc VieNeu-TTS (Bắt buộc)" hint="Giọng biên tập viên 48kHz đọc bản tin & đồng bộ phụ đề karaoke">
                  <select className={inputCls} value={form.video.voiceName} onChange={(e) => setV({ voiceName: e.target.value })}>
                    {(vai.data?.tts?.voices ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                </Field>
                <div className="flex justify-end">
                  <Button variant="primary" icon={Play} loading={busy} disabled={!ready || !/https?:\/\/\S+/.test(form.brief)} onClick={start}>
                    ▶ Chạy tạo Video Tin tức ngay
                  </Button>
                </div>
              </div>
            )}
            {engine === "edit" && (
              <div className="space-y-3 rounded-xl border border-blue-500/30 bg-blue-500/[0.04] p-3.5">
                <div className="rounded-xl border border-blue-500/25 bg-card p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-extrabold text-blue-700 dark:text-blue-300">
                        🔍 Bước 1: Giải mã Video Mẫu (Video Decode · Local FFmpeg + Whisper + Claude AI)
                      </p>
                      <p className="text-[11px] text-muted">
                        Tải lên 1 video mẫu cần học hỏi (hoặc bấm giải mã video mẫu có sẵn) để AI bóc tách nhịp cắt cảnh, góc quay, Hook 3s đầu và áp vào phim mới.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className={cx("inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-500/20 dark:text-blue-300", (decodeBusy || upPct !== null) && "pointer-events-none opacity-60")}>
                        <Film className="h-3.5 w-3.5" />
                        <span>Tải Video Mẫu để Decode</span>
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            try {
                              const r = await putVideoStream(f, setUpPct);
                              await decodeReferenceVideo(r.path);
                            } catch (err: any) {
                              toast(err?.message ?? "Lỗi tải video mẫu", "err");
                            }
                          }}
                        />
                      </label>
                      <Button size="sm" variant="soft" loading={decodeBusy} onClick={() => void decodeReferenceVideo()}>
                        ⚡ Decode Thử Video Mẫu Có Sẵn
                      </Button>
                    </div>
                  </div>
                  {decodedBlueprint && (
                    <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">
                          ✅ Đã giải mã & dựng phim: {decodedBlueprint.sourceFileName} ({decodedBlueprint.durationSec}s · {decodedBlueprint.shotCount} phân cảnh · trung bình {decodedBlueprint.avgShotSec}s/cảnh)
                        </span>
                        <Badge tone="green">{decodedBlueprint.pacingLabel}</Badge>
                      </div>
                      <p className="text-[11px] text-ink">
                        <b>Hook 3s đầu:</b> {decodedBlueprint.hookFormula?.first3SecHook} ({decodedBlueprint.hookFormula?.visualHookTechnique})
                      </p>
                      <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                        {decodedBlueprint.contactSheetUrl && (
                          <div>
                            <p className="mb-1 text-[11px] font-semibold text-muted">1. Bảng phân cảnh đã Decode (Contact Sheet):</p>
                            <img src={decodedBlueprint.contactSheetUrl} alt="Decoded Contact Sheet" className="max-h-56 w-full rounded-lg border border-line object-contain bg-black" />
                          </div>
                        )}
                        {(decodedVideoResult?.renderedVideoUrl || decodedBlueprint.sourceVideoUrl) && (
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                                2. 🎬 Video MP4 Mới Đã Dựng ({decodedVideoResult?.renderedDurationSec ?? decodedBlueprint.durationSec}s):
                              </span>
                              <a
                                href={decodedVideoResult?.renderedVideoUrl || decodedBlueprint.sourceVideoUrl}
                                download={`zono-decoded-video-${Date.now()}.mp4`}
                                className="rounded-lg bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                              >
                                ⬇️ Tải MP4
                              </a>
                            </div>
                            <video
                              key={decodedVideoResult?.renderedVideoUrl || decodedBlueprint.sourceVideoUrl}
                              src={decodedVideoResult?.renderedVideoUrl || decodedBlueprint.sourceVideoUrl}
                              controls
                              playsInline
                              className="max-h-56 w-full rounded-lg border border-emerald-500/40 bg-black object-contain"
                            />
                            {decodedVideoResult?.renderNotes && (
                              <p className="mt-1 text-[11px] text-muted">{decodedVideoResult.renderNotes}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-extrabold text-ink">
                    🎬 Bước 2: Video quay sẵn của Sếp (Raw Footage) <span className="font-normal text-muted">(cảnh quay sản phẩm, cửa hàng, livestream, bài giảng… — tải nhiều file được, tối đa 4 GB/file). Claude AI sẽ chọn đoạn đẹp nhất và dựng theo đúng nhịp của Video Mẫu vừa Decode!</span>
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {form.video.materials.map((m: any, i: number) => <span key={m.path} className="flex items-center gap-1 rounded-lg border border-line bg-card px-2.5 py-1 font-medium">{m.name}<button onClick={() => setV({ materials: form.video.materials.filter((_: any, j: number) => j !== i) })}><Trash2 className="h-3 w-3 text-muted" /></button></span>)}
                    <label className={cx("flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-blue-500/50 bg-card px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-500/10 dark:text-blue-300", upPct !== null && "pointer-events-none opacity-60")}>{upPct !== null ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Đang tải {upPct}%</> : <><Film className="h-3.5 w-3.5" />+ Tải video quay sẵn lên máy</>}<input type="file" accept="video/*,audio/*" multiple className="hidden" onChange={(e) => void uploadSources(e.target.files)} /></label>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Phong cách dựng" hint="AI cắt cảnh, chuyển cảnh, zoom in/out, chữ động, phụ đề từng từ, hiệu ứng âm thanh và nhạc nền theo phong cách này">
                    <select className={inputCls} value={form.video.style ?? "dynamic"} onChange={(e) => setV({ style: e.target.value })}>{EDIT_STYLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  </Field>
                  <Field label="Khung hình" hint="Video ngang được cắt giữa khung cho dọc/vuông">
                    <select className={inputCls} value={["9:16", "1:1", "16:9"].includes(form.video.aspect) ? form.video.aspect : "9:16"} onChange={(e) => setV({ aspect: e.target.value })}><option value="9:16">Dọc 9:16 (TikTok/Reels/Shorts)</option><option value="1:1">Vuông 1:1</option><option value="16:9">Ngang 16:9</option></select>
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={form.video.music !== "none"} onChange={(e) => setV({ music: e.target.checked ? "auto" : "none" })} />Thêm nhạc nền (tự hạ nhỏ khi có giọng nói · chuẩn -14 LUFS)</label>
              </div>
            )}
            {engine === "moneyprinter" && (
              <div className="space-y-3 rounded-xl border border-line p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nguồn cảnh quay">
                    <select className={inputCls} value={form.video.source} onChange={(e) => setV({ source: e.target.value })}>
                      <option value="flow">Clip từ video Flow đã làm</option>
                      <option value="local">Clip / ảnh của Sếp (tải lên)</option>
                      <option value="pexels" disabled={!vai.data?.moneyprinter?.pexels?.length}>Kho Pexels (miễn phí){vai.data?.moneyprinter?.pexels?.length ? "" : " — cần nhập khóa"}</option>
                      <option value="pixabay" disabled={!vai.data?.moneyprinter?.pixabay?.length}>Kho Pixabay (miễn phí){vai.data?.moneyprinter?.pixabay?.length ? "" : " — cần nhập khóa"}</option>
                    </select>
                  </Field>
                  {form.video.source === "flow" && (
                    <Field label="Video Flow lấy clip">
                      <select className={inputCls} value={form.video.flowJobId} onChange={(e) => setV({ flowJobId: e.target.value })}>
                        <option value="">— chọn —</option>
                        {flowDone.map((j: any) => <option key={j.id} value={j.id}>{j.title} · {timeAgo(j.created_at)}</option>)}
                      </select>
                    </Field>
                  )}
                  <Field label="Giọng đọc">
                    <select className={inputCls} value={form.video.voiceName} onChange={(e) => setV({ voiceName: e.target.value })}>{(vai.data?.tts?.voices ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.label}</option>)}</select>
                  </Field>
                  <Field label={`Tốc độ đọc ×${form.video.voiceRate}`}><input type="range" min={0.8} max={1.3} step={0.05} value={form.video.voiceRate} onChange={(e) => setV({ voiceRate: e.target.value })} className="w-full" /></Field>
                  <Field label="Khung hình"><select className={inputCls} value={form.video.aspect} onChange={(e) => setV({ aspect: e.target.value })}><option value="9:16">Dọc 9:16 (TikTok/Reels)</option><option value="16:9">Ngang 16:9 (YouTube)</option><option value="1:1">Vuông 1:1</option></select></Field>
                  <Field label="Nhạc nền"><select className={inputCls} value={form.video.bgm} onChange={(e) => setV({ bgm: e.target.value })}><option value="random">Nhạc nền ngẫu nhiên</option><option value="none">Không nhạc</option></select></Field>
                </div>
                {form.video.source === "local" && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {form.video.materials.map((m: any, i: number) => <span key={m.path} className="flex items-center gap-1 rounded-lg border border-line px-2 py-1">{m.name}<button onClick={() => setV({ materials: form.video.materials.filter((_: any, j: number) => j !== i) })}><Trash2 className="h-3 w-3 text-muted" /></button></span>)}
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1 text-muted hover:bg-soft"><Film className="h-3.5 w-3.5" />Thêm clip/ảnh<input type="file" accept="video/*,image/*" multiple className="hidden" onChange={async (e) => { const up = await uploadFiles(e.target.files, /\.(mp4|mov|m4v|webm|png|jpe?g|webp)$/i); setV({ materials: [...form.video.materials, ...up] }); }} /></label>
                  </div>
                )}
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.video.scriptReady} onChange={(e) => setV({ scriptReady: e.target.checked })} />Ô nội dung bên dưới là <b>lời đọc có sẵn</b> (không để AI viết lại)</label>
                {form.video.scriptReady && <input className={inputCls} placeholder="Từ khóa cảnh quay tiếng Anh, cách nhau dấu phẩy (để trống = AI tự đề xuất)" value={form.video.terms} onChange={(e) => setV({ terms: e.target.value })} />}
              </div>
            )}
            {engine === "liveportrait" && (
              <div className="space-y-3 rounded-xl border border-line p-3">
                <p className="text-xs text-muted">Thêm <b>1 ảnh chân dung rõ mặt</b> ở mục ảnh bên dưới. Ảnh sẽ cử động theo biểu cảm của video mẫu.</p>
                <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                  <div className="space-y-2">
                    <Field label="Video biểu cảm mẫu">
                      <select className={inputCls} value={form.video.drivingPath ? "__own" : form.video.driving} onChange={(e) => e.target.value !== "__own" && setV({ driving: e.target.value, drivingPath: "", drivingName: "" })}>
                        {(vai.data?.liveportrait?.presets ?? []).map((d: string) => <option key={d} value={d}>Mẫu {d.replace(".mp4", "")}</option>)}
                        {form.video.drivingPath && <option value="__own">Video của Sếp: {form.video.drivingName}</option>}
                      </select>
                    </Field>
                    <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1 text-xs text-muted hover:bg-soft"><Film className="h-3.5 w-3.5" />Dùng video biểu cảm của Sếp<input type="file" accept="video/*" className="hidden" onChange={async (e) => { const [up] = await uploadFiles(e.target.files, /\.(mp4|mov|m4v|webm)$/i); if (up) setV({ drivingPath: up.path, drivingName: up.name }); }} /></label>
                    <Field label={`Độ dài clip: ${form.video.seconds} giây`} hint="M2 cần khoảng 1 phút cho mỗi giây video"><input type="range" min={3} max={15} value={form.video.seconds} onChange={(e) => setV({ seconds: e.target.value })} className="w-full" /></Field>
                  </div>
                  {!form.video.drivingPath && <video key={form.video.driving} src={`/v1/video-ai/driving/${form.video.driving}`} muted autoPlay loop playsInline className="h-full max-h-56 w-full rounded-xl bg-black object-contain" />}
                </div>
                <Field label="Lồng giọng đọc (tuỳ chọn)" hint="Giọng Edge TTS; clip kéo dài theo lời đọc"><textarea rows={2} className={inputCls} value={form.video.voiceText} onChange={(e) => setV({ voiceText: e.target.value })} placeholder="Chào cả nhà, hôm nay chị review…" /></Field>
                {form.video.voiceText && <select className={inputCls} value={form.video.voiceName} onChange={(e) => setV({ voiceName: e.target.value })}>{(vai.data?.tts?.voices ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.label}</option>)}</select>}
              </div>
            )}
            <Field label={engine === "news" ? "Link bài báo + ghi chú" : engine === "edit" ? "Yêu cầu edit" : "Thông tin sản phẩm / chủ đề / kịch bản"} hint={engine === "news" && form.brief && !/https?:\/\//.test(form.brief) ? "Cần có link bài báo (http…)" : undefined}><textarea rows={6} className={inputCls} value={form.brief} onChange={(e) => set({ brief: e.target.value })} placeholder={engine === "news" ? "https://vnexpress.net/... \nGhi chú (tuỳ chọn): giọng nữ, nhấn mạnh số liệu..." : engine === "edit" ? "Vd: Cắt 1 video 45 giây từ buổi livestream, lấy đoạn nói về 3 sai lầm khi dùng AI, mở đầu bằng câu gây tò mò nhất, bỏ đoạn đọc bình luận…" : "Giá, vị, điểm nổi bật, ưu đãi, link affiliate… hoặc chủ đề phim + thông điệp"} /></Field>
            <Fold flat title="Tuỳ chọn thêm" summary={[form.voice && "giọng", form.hookTitle && "hook", form.cta && "CTA"].filter(Boolean).join(" · ") || "giọng đọc · tiêu đề hook · CTA (không bắt buộc)"} defaultOpen={false}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Giọng"><input className={inputCls} value={form.voice} onChange={(e) => set({ voice: e.target.value })} placeholder="Nữ, miền Bắc, xưng chị" /></Field>
                <Field label="Tiêu đề hook"><input className={inputCls} value={form.hookTitle} onChange={(e) => set({ hookTitle: e.target.value })} /></Field>
                <Field label="CTA trên video"><input className={inputCls} value={form.cta} onChange={(e) => set({ cta: e.target.value })} placeholder="Bấm giỏ hàng ngay" /></Field>
              </div>
            </Fold>
            <ImageSlots slots={tool?.slots ?? []} images={form.images} onUpload={upload} onRemove={(path) => set({ images: form.images.filter((i: any) => i.path !== path) })}
              onRole={(path, role) => set({ images: form.images.map((i: any) => (i.path === path ? { ...i, role } : i)) })}
              note={engine === "flow" && form.tool === "review-do-an-vat" ? "Ô nào để trống thì AI tự tạo ảnh trên Flow. Ảnh Sếp tải lên được dùng đúng ô, giữ nguyên khuôn mặt nhân vật chính ở mọi cảnh." : form.tool === "review-nha-hang" ? "Bắt buộc ảnh THẬT mặt tiền và không gian (cảnh 1 ngoài quán, các cảnh sau trong quán) — không để AI vẽ quán không có thật. Ghi tên, địa chỉ, món/dịch vụ, giá, giờ mở cửa, ưu đãi trong phần thông tin; mỗi đoạn 8 giây." : form.tool === "review-gia-dung" ? "Bắt buộc ảnh thật của sản phẩm. Ghi đủ công dụng, thông số, giá/ưu đãi và tên thương hiệu/shop trong phần thông tin — Tool viết kịch bản chỉ từ đó. Không có ảnh KOC thì AI tự sinh người review; 5 cảnh × 8 giây." : form.tool === "koc-thoi-trang-nu" ? "Bắt buộc ảnh thật của sản phẩm (SP1) để giữ đúng màu, hoạ tiết. Thiếu ảnh KOC hoặc bối cảnh thì AI tự tạo; Tool dựng ảnh KOC mặc đồ trong bối cảnh rồi 5 góc selfie, 6 cảnh × 8 giây." : form.tool === "nhan-hieu" ? "Bắt buộc ảnh chân dung rõ mặt của chính người đứng tên nhân hiệu — AI giữ đúng gương mặt ở mọi cảnh. Giọng được khóa bằng một mẫu giọng (nam/nữ theo ô Giọng) để các cảnh nói cùng một giọng." : form.tool === "nguoi-que-so-sanh" ? "Ảnh người que quyết định nét vẽ của cả video (thiếu thì AI tự tạo người que trên Flow). Mỗi cảnh chỉ dùng 3 ảnh: người que + sản phẩm A + sản phẩm B." : form.tool === "review-thoi-trang" ? "Nên có ảnh thật của sản phẩm để AI giữ đúng màu, logo, đường may. Thiếu ảnh người mẫu thì AI tự tạo; Tool thử đồ AI rồi giữ nguyên mặt người mẫu ở mọi cảnh (mỗi cảnh 8 giây)." : engine === "flow" ? "Ảnh Sếp tải lên được dùng làm tham chiếu cho đúng vai trò; nhân vật chính giữ nguyên khuôn mặt ở mọi cảnh." : undefined}
              extras={engine === "flow"} />
            <div>
              <p className="mb-2 text-sm font-medium">Đăng nháp lên kênh (sau khi duyệt)</p>
              <div className="flex gap-2">{CHANNELS.map((c) => (
                <button key={c} onClick={() => set({ channels: form.channels.includes(c) ? form.channels.filter((x: string) => x !== c) : [...form.channels, c] })} className={cx("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", form.channels.includes(c) ? "border-blue-500 bg-blue-500/10" : "border-line")}><PlatformIcon p={c} size={14} />{c}</button>
              ))}</div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-3">
              <span className="text-xs text-muted">
                {engine === "flow"
                  ? "Chạy tự động trên Google Flow (Chrome Flow)"
                  : `Chạy Local 100% trên máy · Công cụ: ${tool?.label ?? form.tool}`}
              </span>
              <div className="flex flex-wrap gap-2">
                {engine !== "flow" && (
                  <Button
                    variant="primary"
                    icon={Play}
                    loading={busy}
                    disabled={!ready || (engine === "news" && !/https?:\/\/\S+/.test(form.brief)) || (engine === "moneyprinter" && form.video.source === "flow" && !form.video.flowJobId) || (engine === "moneyprinter" && form.video.source === "local" && !form.video.materials.length) || (engine === "edit" && (!form.video.materials.length || upPct !== null))}
                    onClick={start}
                  >
                    ▶ Chạy Tạo Video Local Ngay
                  </Button>
                )}
                <Button
                  variant={engine === "flow" ? "primary" : "soft"}
                  icon={Play}
                  disabled={!ready || (!form.title && engine !== "anim") || (engine !== "liveportrait" && engine !== "anim" && form.brief.length < 5) || (engine === "news" && !/https?:\/\/\S+/.test(form.brief)) || !form.channels.length || (tool?.slots ?? []).some((sl: any) => sl.required && !form.images.some((i: any) => i.role === sl.role)) || (engine === "moneyprinter" && form.video.source === "flow" && !form.video.flowJobId) || (engine === "moneyprinter" && form.video.source === "local" && !form.video.materials.length) || (engine === "edit" && (!form.video.materials.length || upPct !== null))}
                  onClick={() => setConfirm(true)}
                >
                  {engine === "flow" ? "Bắt đầu sản xuất (Flow)" : "Xem tóm tắt & Chạy"}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Các lần sản xuất">
            {!jobs.data ? <Loading /> : !jobs.data.length ? <Empty>Chưa có video nào.</Empty> : (
              <div className="space-y-1">
                {(allJobs ? jobs.data : jobs.data.slice(0, 3)).map((j) => (
                  <button key={j.id} onClick={() => setSelected(j.id)} className={cx("flex w-full items-center justify-between gap-2 rounded-xl p-2.5 text-left", j.id === current ? "bg-blue-500/10" : "hover:bg-soft")}>
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{j.title}</p><p className="truncate text-xs text-muted">{j.step ?? j.error ?? ""} · {timeAgo(j.created_at)}</p></div>
                    <Badge tone={STATUS[j.status]?.[1]}>{j.status === "running" && <Loader2 className="h-3 w-3 animate-spin" />}{STATUS[j.status]?.[0] ?? j.status}</Badge>
                  </button>
                ))}
                {jobs.data.length > 3 && (
                  <button onClick={() => setAllJobs((v) => !v)} className="w-full rounded-xl p-2 text-center text-xs font-medium text-blue-600 hover:bg-soft">
                    {allJobs ? "Thu gọn" : `Xem tất cả (${jobs.data.length})`}
                  </button>
                )}
              </div>
            )}
          </Card>
          {current && <JobDetail id={current} />}
        </div>
      </div>

      <VideoAiTools
        status={vai.data}
        onChanged={vai.reload}
        upload={uploadFiles}
        onPickTool={(toolKey) => {
          set({ tool: toolKey, durationSec: toolKey === "auto-video" ? 30 : toolKey === "news-video" ? 60 : toolKey === "anim-video" ? 30 : 48 });
          window.scrollTo({ top: 180, behavior: "smooth" });
          toast(`Đã chọn công cụ "${tools.data?.find((t) => t.key === toolKey)?.label ?? toolKey}" — bấm nút Chạy để bắt đầu!`, "info");
        }}
        onQuickRunAnim={() => {
          set({ tool: "anim-video" });
          void start();
        }}
        busy={busy}
      />

      <Modal open={confirm} onClose={() => setConfirm(false)} title={engine === "flow" ? "Xác nhận sản xuất video trên Flow" : "Xác nhận sản xuất video"} footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Hủy</Button><Button variant="primary" loading={busy} onClick={start}>Bắt đầu</Button></>}>
        <div className="space-y-2 text-sm">
          <p><b>{tool?.label}</b> · {form.title}</p>
          {engine !== "flow" ? (
            <ul className="list-disc space-y-1 pl-5 text-muted">
              <li>Chạy trên máy Sếp, <b>không tốn tín dụng Flow</b>, không cần bấm gì (khoảng {tool?.minutes} phút{engine === "liveportrait" ? `; ${form.video.seconds} giây clip` : ""}). Có thông báo khi xong.</li>
              {engine === "edit" ? <li>AI xem {form.video.materials.length} video thô (ảnh tổng hợp phân cảnh) và lập kế hoạch dựng; hệ thống cắt cảnh, chuyển cảnh, zoom, chữ động, phụ đề từng từ, hiệu ứng âm thanh, nhạc nền, chuẩn âm -14 LUFS, rồi tự soát lỗi 1 vòng → Review → hộp Duyệt.</li>
                : engine === "anim" ? <li>CLI Agent thiết kế kịch bản ShotCraft theo mẫu <b>{form.video.animTemplate}</b>, bắt buộc tạo giọng đọc <b>VieNeu-TTS ({form.video.voiceName})</b> ở Bước 2, đo word-timestamp bằng faster-whisper, dựng nhân vật hoạt hình & đồ họa 2D/3D ({form.video.animStyle}) bằng Remotion + GSAP + Motion + Three.js/Lottie/Rive, chuẩn âm -14 LUFS → Review → hộp Duyệt.</li>
                : engine === "news" ? <li>Claude CLI đọc bài, viết lời đọc (không bịa số liệu, ghi nguồn báo + ảnh), bắt buộc tạo giọng Việt bằng <b>VieNeu-TTS ({form.video.voiceName})</b>, phụ đề karaoke, đồ hoạ Remotion, chuẩn âm thanh -14 LUFS → Review → hộp Duyệt → đăng bản nháp lên {form.channels.join(", ")} sau khi duyệt.</li>
                : engine === "moneyprinter" ? <li>Claude CLI viết lời đọc{form.video.scriptReady ? " (giữ nguyên lời Sếp)" : ""}, MoneyPrinterTurbo ghép cảnh + giọng Việt + phụ đề → Review → hộp Duyệt → đăng bản nháp lên {form.channels.join(", ")} sau khi duyệt.</li>
                : <li>Clip cử động vào thư viện video (dùng làm đoạn mở đầu / chèn vào video khác), không tự đăng.</li>}
            </ul>
          ) : (
          <ul className="list-disc space-y-1 pl-5 text-muted">
            {tool?.generator
              ? <li>Hệ thống <b>tự chạy ngầm, không cần Sếp bấm gì</b>: AI mở Google Flow trong Chrome Flow (tài khoản {settings.data?.chromeProfileEmail ?? settings.data?.chromeProfileName ?? "đã chọn"}), dùng <b>trình tạo video thường</b> (Thành phần · 9:16 · Omni 1.1 Flash · 720p) với ảnh nhân vật của Sếp, tạo từng cảnh 8–10 giây, lưu theo đúng thứ tự rồi ghép + chèn phụ đề (khoảng {tool?.minutes ?? 35} phút). Chỉ có thông báo khi video đã xong.</li>
              : <li>Hệ thống <b>tự chạy ngầm, không cần Sếp bấm gì</b>: AI mở Tool <b>{tool?.label}</b> trong Chrome Flow (tài khoản {settings.data?.chromeProfileEmail ?? settings.data?.chromeProfileName ?? "đã chọn"}), chạy đủ các bước Cấu hình → Khung chủ → Kịch bản → Storyboard → Sản xuất, tải clip, ghép + chèn phụ đề (khoảng {tool?.minutes ?? 40} phút). Chỉ có thông báo khi video đã xong.</li>}
            <li>Mỗi lần tạo cảnh tốn tín dụng Google Flow (tối đa 3 lần làm lại mỗi cảnh).</li>
            <li>Video thành phẩm vào hộp Duyệt; chỉ sau khi duyệt mới đăng <b>bản nháp</b> lên {form.channels.join(", ")}.</li>
          </ul>
          )}
        </div>
      </Modal>
      <BrowserPicker open={pickBrowser} current={settings.data} onClose={() => setPickBrowser(false)} onSaved={() => { setPickBrowser(false); settings.reload(); }} />
    </div>
  );
}

/** Link Tool Flow dùng chung + ghi chú quyền truy cập + ô dán link bản sao của Sếp. */
function ToolLink({ tool, onSaved }: { tool: any; onSaved: () => void }) {
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [url, setUrl] = useState("");
  const custom = tool.toolUrl && tool.defaultToolUrl && tool.toolUrl !== tool.defaultToolUrl;
  const save = async (v: string) => {
    try { await api.put("creative/settings", { toolUrls: { [tool.key]: v } }); toast(v ? "Đã lưu link bản sao" : "Đã dùng lại link Tool mặc định"); setEdit(false); setUrl(""); onSaved(); } catch (e: any) { toast(e.message, "err"); }
  };
  return (
    <div className="space-y-1">
      <p className="flex flex-wrap items-center gap-x-2">Tool Flow: {tool.toolUrl
        ? <a href={tool.toolUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600">{tool.toolTitle ?? tool.label}<ExternalLink className="h-3 w-3" /></a>
        : <span>agent tự tìm "{tool.toolTitle ?? tool.label}" trong mục Tools của Flow</span>}
        {custom && <Badge tone="violet">bản sao của Sếp</Badge>}
        {tool.toolUrl && <button className="text-blue-600 underline-offset-2 hover:underline" onClick={() => setEdit((v) => !v)}>{edit ? "Đóng" : "Dùng link bản sao"}</button>}
        {custom && <button className="text-muted underline-offset-2 hover:underline" onClick={() => save("")}>Về link mặc định</button>}
      </p>
      {tool.toolUrl && <details><summary className="text-[11px]">Lưu ý quyền truy cập Tool</summary><p className="mt-1 text-[11px] leading-relaxed">Tool này nằm trong một project Google Flow dùng chung. Nếu tài khoản Google của Sếp chưa được chia sẻ, video sẽ dừng với lỗi "Tài khoản Google chưa có quyền mở Tool này" — nhờ người chia sẻ Tool, hoặc mở Tool → tạo bản sao vào project của Sếp rồi dán link bản sao vào đây.</p></details>}
      {edit && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input className={cx(inputCls, "h-8 min-w-0 flex-1 py-1 text-xs")} placeholder="https://flow.google.com/project/…/tool/…" value={url} onChange={(e) => setUrl(e.target.value.trim())} />
          <Button size="sm" disabled={!url} onClick={() => save(url)}>Lưu</Button>
        </div>
      )}
    </div>
  );
}

/** Nhật ký quyền Chrome (chỉ có khi tác vụ chạy bằng Claude in Chrome). */
function ChromeLog({ id, running }: { id: string; running: boolean }) {
  const { data } = useApi<{ entries: any[] }>(`creative/jobs/${id}/chrome-log`, running ? ["creative."] : []);
  const entries = data?.entries ?? [];
  if (!entries.length) return null;
  const denied = entries.filter((e) => e.decision !== "allow").length;
  return (
    <details>
      <summary className="cursor-pointer text-xs font-medium">Nhật ký quyền Chrome ({entries.length} lượt{denied ? `, ${denied} bị từ chối` : ""})</summary>
      <ol className="mt-2 max-h-60 space-y-1 overflow-auto font-mono text-[11px] scroll-thin">{[...entries].reverse().map((e, i) => <li key={i} className={e.decision === "allow" ? "text-muted" : "text-rose-600"}>{e.at ? new Date(e.at).toLocaleTimeString("vi-VN") : ""} · {e.tool} · {e.decision === "allow" ? "cho phép" : "TỪ CHỐI"}{e.host ? ` · ${e.host}` : ""}{e.decision !== "allow" && e.reason ? ` · ${e.reason}` : ""}</li>)}</ol>
    </details>
  );
}

function JobDetail({ id }: { id: string }) {
  const { data: j, reload } = useApi<any>(`creative/jobs/${id}`, ["creative.", "approval.", "post."]);
  const toast = useToast();
  const elapsed = useMemo(() => (j?.started_at ? Math.round(((j.ended_at ? new Date(j.ended_at).getTime() : Date.now()) - new Date(j.started_at).getTime()) / 60000) : null), [j]);
  if (!j) return <Loading />;
  const cancel = async () => { try { await api.post(`creative/jobs/${id}/cancel`); toast("Đã hủy"); reload(); } catch (e: any) { toast(e.message, "err"); } };
  return (
    <Card title={j.title} action={["queued", "running"].includes(j.status) && <Button size="sm" variant="danger" icon={Square} onClick={cancel}>Dừng</Button>}>
      <div className="space-y-3 text-sm">
        <p className="flex flex-wrap items-center gap-2"><Badge tone={STATUS[j.status]?.[1]}>{j.tool === "portrait" && j.status === "done" ? "Xong · trong thư viện video" : STATUS[j.status]?.[0]}</Badge>{elapsed != null && <span className="text-xs text-muted">{elapsed} phút</span>}{j.model && <span className="text-xs text-muted">· {j.model}</span>}</p>
        {j.error && <p className="rounded-xl bg-rose-500/10 p-3 text-rose-700 dark:text-rose-300">{j.error}</p>}
        {j.asset && <video src={`/v1/media/${j.asset.id}`} controls className="mx-auto max-h-[480px] rounded-xl bg-black" />}
        {j.asset && <p className="text-xs text-muted">{j.asset.duration?.toFixed(1)}s · {j.asset.width}x{j.asset.height} · <a className="text-blue-600" href={`/v1/media/${j.asset.id}?download=1`}>Tải MP4</a></p>}
        {j.result?.caption && <div className="rounded-xl bg-soft p-3 text-xs"><p className="mb-1 font-semibold">Caption</p><p className="whitespace-pre-wrap">{j.result.caption}</p></div>}
        {j.result?.redoneScenes?.length > 0 && <p className="text-xs text-muted">Cảnh làm lại: {j.result.redoneScenes.map((r: any) => `#${r.scene} (${r.reason})`).join("; ")}</p>}
        {j.approval?.status === "pending" && <Link to={`/approvals?id=${j.approval.id}`}><Button size="sm" variant="primary">Duyệt video →</Button></Link>}
        {j.drafts?.length > 0 && (
          <div className="space-y-1">{j.drafts.map((d: any) => <p key={d.id} className="flex items-center gap-2 text-xs"><PlatformIcon p={d.platform} size={14} />{d.name}: {d.status === "draft_uploaded" ? (d.simulated ? <Badge tone="amber">nháp mô phỏng · chưa lên kênh thật</Badge> : <a href={d.draft_url} target="_blank" rel="noreferrer" className="text-blue-600">đã lên nháp</a>) : d.status}{d.error ? ` · ${d.error}` : ""}</p>)}</div>
        )}
        <ChromeLog id={id} running={j.status === "running"} />
        {(j.log ?? []).length > 0 && (
          <details open={j.status === "running"}>
            <summary className="cursor-pointer text-xs font-medium">Nhật ký agent ({j.log.length} bước)</summary>
            <ol className="mt-2 max-h-72 space-y-1 overflow-auto text-[11px] scroll-thin">{[...j.log].reverse().slice(0, 60).map((s: any, i: number) => <li key={i} className={s.kind === "text" ? "text-ink" : "font-mono text-muted"}>{new Date(s.at).toLocaleTimeString("vi-VN")} · {s.text}</li>)}</ol>
          </details>
        )}
      </div>
    </Card>
  );
}

export function BrowserPicker({ open, current, onClose, onSaved }: { open: boolean; current: any; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<{ profiles: any[] } | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, { found: boolean; text: string }>>({});
  const useChrome = current?.engine === "claude-in-chrome";
  const load = async () => { try { setData(await api.get("creative/chrome-profiles")); } catch (e: any) { toast(e.message, "err"); } };
  useEffect(() => { if (open) void load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = (p: any) => `${p.channel}/${p.dir}`;
  const act = async (k: string, fn: () => Promise<any>) => { setBusy(k); try { return await fn(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(null); } };
  const choose = (p: any) => act(`c:${key(p)}`, async () => {
    await api.put("creative/settings", { chromeChannel: p.channel, chromeProfileDir: p.dir, chromeProfileName: p.name, chromeProfileEmail: p.email });
    if (useChrome) { toast(`Đã chọn profile "${p.name}" — bấm Ghép Chrome tại phần cơ chế trình duyệt`); onSaved(); return; }
    toast(`Đã chọn profile "${p.name}" — đang nối đăng nhập vào Chrome Flow…`, "info");
    onSaved();
    const r = await api.post("creative/chrome-profiles/verify", { channel: p.channel, dir: p.dir });
    setChecks((c) => ({ ...c, [key(p)]: { found: r.found, text: r.found ? `Chrome Flow đã đăng nhập ${r.accountEmail}` : r.error } }));
    toast(r.found ? `Chrome Flow sẵn sàng (${r.accountEmail})` : r.error, r.found ? "ok" : "err");
  });
  const openP = (p: any) => act(`flow:${key(p)}`, async () => {
    await api.post("creative/chrome-profiles/open", { channel: p.channel, dir: p.dir, target: "flow" });
    toast(`Đã mở Flow trong profile "${p.name}"`);
  });
  const list = (data?.profiles ?? []).filter((p) => !search || `${p.name} ${p.email ?? ""} ${p.googleName ?? ""} ${p.dir}`.toLowerCase().includes(search.toLowerCase()));
  const isCurrent = (p: any) => current?.chromeChannel === p.channel && current?.chromeProfileDir === p.dir;

  return (
    <Modal open={open} onClose={onClose} wide title="Chọn profile Chrome dùng cho Google Flow">
      <div className="space-y-3">
        <p className="text-sm text-muted">{useChrome ? "Chọn profile Chrome có tiện ích Claude và đang đăng nhập tài khoản cần dùng. Sau đó mở profile và bấm Ghép Chrome." : <>Chọn profile <b className="text-ink">đang đăng nhập tài khoản Google có Flow</b> để hệ thống nối đăng nhập vào Chrome Flow.</>}</p>
        <input className={inputCls} placeholder="Tìm theo tên profile hoặc email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {!data ? <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" />Đang đọc profile Chrome…</p> : list.length === 0 ? <Empty>Không thấy profile nào.</Empty> : (
          <div className="max-h-[56vh] space-y-2 overflow-y-auto pr-1 scroll-thin">
            {list.map((p) => {
              const k = key(p);
              const chk = checks[k];
              return (
                <div key={k} className={cx("rounded-xl border p-3", isCurrent(p) ? "border-blue-500 bg-blue-500/5" : "border-line")}>
                  <div className="flex items-center gap-3">
                    {p.hasAvatar
                      ? <img src={`/v1/creative/chrome-profiles/avatar?channel=${encodeURIComponent(p.channel)}&dir=${encodeURIComponent(p.dir)}`} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                      : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-soft text-sm font-bold text-muted">{p.name.slice(0, 1).toUpperCase()}</span>}
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">{p.name}{isCurrent(p) && <Badge tone="blue">Đang dùng</Badge>}{p.open && <Badge tone="green">Đang mở</Badge>}{p.claudeExtension && <Badge tone="blue">Có tiện ích Claude</Badge>}</p>
                      <p className="truncate text-xs text-muted">{p.email ?? "Chưa đăng nhập Google"} · {p.channelName} · {p.dir}</p>
                    </div>
                    {p.email ? <Badge tone="green">Đã đăng nhập Google</Badge> : <Badge tone="amber">Chưa đăng nhập Google</Badge>}
                  </div>
                  {chk && <p className={cx("mt-2 text-xs", chk.found ? "text-emerald-600" : "text-rose-600")}>{chk.text}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant={isCurrent(p) ? "secondary" : "primary"} loading={busy === `c:${k}`} disabled={useChrome && !p.claudeExtension} onClick={() => choose(p)}>{isCurrent(p) ? "Đã chọn" : "Chọn profile này"}</Button>
                    <Button size="sm" loading={busy === `flow:${k}`} onClick={() => openP(p)}>Mở Flow trong profile</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{data ? `${data.profiles.length} profile · ${data.profiles.filter((p) => p.email).length} profile đã đăng nhập Google` : ""}</span>
          <Button size="sm" variant="ghost" onClick={load}>Quét lại</Button>
        </div>
        <p className="rounded-xl bg-soft p-3 text-xs text-muted">{useChrome ? "Cho phép tiện ích Claude truy cập các trang cần dùng: flow.google.com, labs.google, accounts.google.com, facebook.com, instagram.com, tiktok.com. AI dừng khi cần mật khẩu hoặc mã xác minh." : "Nếu Google không nhận bản sao đăng nhập, đăng nhập một lần trong cửa sổ Chrome Flow."}</p>
      </div>
    </Modal>
  );
}

/** Dùng chung cho Video và Kênh đăng; lựa chọn áp dụng cho các tác vụ mới. */
export function BrowserEngineControl({ current, onSaved, flat }: { current: any; onSaved: () => void; flat?: boolean }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState<any>(null);
  const useChrome = current?.engine === "claude-in-chrome";
  const act = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); } };
  const setEngine = (engine: string) => act(async () => {
    await api.put("creative/settings", { engine, chromeAutoApprove: engine === "claude-in-chrome" });
    setConfirm(false); setScan(null); onSaved(); toast("Đã đổi cơ chế Chrome — kiểm tra lại đăng nhập ở Kênh đăng trước khi đăng bài");
  });
  return <Fold flat={flat} title="Cơ chế trình duyệt" summary={useChrome ? "Claude in Chrome — AI dùng Chrome thật của Sếp" : "Chrome Flow — cửa sổ Chrome riêng cho AI"} defaultOpen={false} bodyClass="space-y-3 px-4 pb-4 pt-1 text-sm">
    <div className="flex flex-wrap items-center gap-2"><Badge tone="blue">{useChrome ? "Claude in Chrome" : "Chrome Flow"}</Badge>
      <Button size="sm" disabled={busy} onClick={() => useChrome ? setEngine("chrome-flow") : setConfirm(true)}>{useChrome ? "Dùng Chrome Flow" : "Dùng Claude in Chrome"}</Button>
      {useChrome && <><Button size="sm" loading={busy} disabled={!current?.chromeProfileDir} onClick={() => act(async () => { const r = await api.post<any>("creative/browsers/pair"); toast(`Đã ghép ${r.label ?? "Chrome đã chọn"}`); onSaved(); })}>Ghép Chrome đã chọn</Button>
        <Button size="sm" disabled={busy} onClick={() => act(async () => { const r = await api.post<any>("creative/browsers"); setScan(r); if (r.error) toast(r.error, "err"); })}>Kiểm tra kết nối</Button></>}
    </div>
    <p className="text-xs text-muted">{useChrome ? "Giữ profile Chrome đã chọn đang mở và tiện ích Claude đang kết nối. Khi ghép, bấm Connect trong tiện ích nếu được yêu cầu. Tác vụ chỉ chạy trên Chrome của máy này." : "AI dùng cửa sổ Chrome Flow riêng. Bạn có thể chọn tiện ích Claude để dùng phiên đăng nhập ngay trong profile Chrome."}</p>
    {scan && <div className="space-y-1 text-xs">{scan.error && <p className="text-rose-600">{scan.error}</p>}{scan.accountHint && <p className="rounded-lg bg-amber-500/10 p-2 text-amber-700">{scan.accountHint}</p>}{scan.multipleHint && <p className="text-amber-700">{scan.multipleHint}</p>}{(scan.browsers ?? []).map((b: any) => <p key={b.deviceId}>{b.name ?? b.deviceId} · {b.otherMachine || b.unmatched ? "chưa khớp profile máy này" : "máy này"}{b.inUse ? " · đang kết nối" : ""}</p>)}</div>}
    <Modal open={confirm} onClose={() => setConfirm(false)} title="Dùng Claude in Chrome" footer={<><Button onClick={() => setConfirm(false)}>Hủy</Button><Button variant="primary" loading={busy} onClick={() => setEngine("claude-in-chrome")}>Cho phép và bật</Button></>}>
      <div className="space-y-2 text-sm">
        <p><b>Agent sẽ điều khiển Chrome thật của Sếp</b> (đang đăng nhập Google/Facebook) và <b>không hỏi từng bước</b>. Hệ thống tự cho phép đúng các việc sau, mọi quyết định được ghi vào nhật ký (approver.jsonl):</p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
          <li>Chỉ mở trang https của Flow (flow.google.com, labs.google), đăng nhập Google, Facebook, Instagram, TikTok — trang khác bị từ chối.</li>
          <li>Chỉ tải lên tệp nằm trong thư mục của tác vụ, data/uploads, data/creative — không bao giờ .env, cơ sở dữ liệu, thư mục cá nhân hay hồ sơ Chrome.</li>
          <li>Công cụ ngoài danh sách (kể cả công cụ mới của tiện ích) bị từ chối; có công tắc khẩn cấp (tệp data/chrome-autoapprove.off hoặc ALLOW_CHROME_AUTOAPPROVE=0).</li>
          <li>Nghiên cứu (Trinh sát) vẫn chạy trên Chrome Flow riêng, không dùng Chrome thật của Sếp.</li>
        </ul>
        <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700"><b>Khuyến nghị:</b> trong cài đặt tiện ích Claude, chỉ cho phép quyền truy cập các trang cần dùng (flow.google.com, labs.google, accounts.google.com, facebook.com, instagram.com, tiktok.com). KHÔNG chọn “On all sites / Trên tất cả các trang web”. Tiện ích phải đăng nhập đúng tài khoản Claude mà Claude Code trên máy này đang dùng. Đừng khóa màn hình hoặc thu nhỏ Chrome khi tác vụ đang chạy.</p>
      </div>
    </Modal>
  </Fold>;
}

/** Local video AI: status of each tool, stock-footage keys, voice-over test, subtitles from a video. */
function VideoAiTools({ status, onChanged, upload, onPickTool, onQuickRunAnim, busy }: { status: any; onChanged: () => void; upload: (f: FileList | null, accept: RegExp) => Promise<{ path: string; name: string }[]>; onPickTool: (toolKey: string) => void; onQuickRunAnim: () => void; busy?: boolean }) {
  const toast = useToast();
  const [keys, setKeys] = useState({ pexels: "", pixabay: "" });
  const [tts, setTts] = useState({ text: "Chào cả nhà, đây là giọng đọc thử VieNeu-TTS 48kHz của ZONO Agentic AI.", voice: "Ngọc Huyền", url: "", busy: false });
  const [stt, setStt] = useState<{ busy: boolean; text?: string; srt?: string; name?: string }>({ busy: false });
  if (!status) return null;
  const Row = ({ ok, name, desc, toolKey, runNow }: { ok: boolean; name: string; desc: string; toolKey?: string; runNow?: () => void }) => (
    <div className="flex items-start justify-between gap-2 rounded-xl bg-soft p-2.5">
      <div className="flex items-start gap-2">
        <span className={cx("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", ok ? "bg-emerald-500" : "bg-amber-500")} />
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-[11px] text-muted">{desc}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {toolKey && <Button size="sm" variant="soft" onClick={() => onPickTool(toolKey)}>Chọn ↑</Button>}
        {runNow && ok && <Button size="sm" variant="primary" icon={Play} loading={busy} onClick={runNow}>Chạy ngay</Button>}
      </div>
    </div>
  );
  const saveKeys = async () => {
    try { await api.put("video-ai/stock-keys", { ...(keys.pexels ? { pexels: keys.pexels } : {}), ...(keys.pixabay ? { pixabay: keys.pixabay } : {}) }); setKeys({ pexels: "", pixabay: "" }); toast("Đã lưu khóa kho cảnh"); onChanged(); } catch (e: any) { toast(e.message, "err"); }
  };
  const speak = async () => {
    setTts((t) => ({ ...t, busy: true }));
    try { const r = await api.post("video-ai/tts", { text: tts.text, voice: tts.voice }); setTts((t) => ({ ...t, url: `/v1/video-ai/file?path=${encodeURIComponent(r.mp3)}`, busy: false })); } catch (e: any) { toast(e.message, "err"); setTts((t) => ({ ...t, busy: false })); }
  };
  const transcribeFile = async (files: FileList | null) => {
    const [up] = await upload(files, /\.(mp4|mov|m4v|webm|mp3|wav|m4a)$/i);
    if (!up) return;
    setStt({ busy: true, name: up.name });
    try { const r = await api.post("video-ai/transcribe", { path: up.path }); setStt({ busy: false, text: r.text, srt: r.srt, name: up.name }); } catch (e: any) { toast(e.message, "err"); setStt({ busy: false }); }
  };
  return (
    <Card title="Công cụ video AI trên máy (Local Video AI & 21 Công cụ Hoạt hình)" collapsible="video.aitools" defaultOpen={true} summary="VieNeu-TTS · Remotion + 21 công cụ Hoạt hình 2D/3D · MoneyPrinterTurbo · LivePortrait">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <Row ok={status.tts.installed} name="VieNeu-TTS (Bắt buộc · 48kHz)" desc="9 giọng đọc Việt Bắc/Trung/Nam (Ngọc Huyền, Thanh Bình, Phạm Tuyên, Đoan Trang, Trúc Ly…) + Nhân bản giọng nói" runNow={speak} />
          <Row ok={!!status.remotion?.installed} name="Remotion + 21 Công cụ Hoạt hình 2D/3D" desc="Dựng video hoạt hình đa ngành (GSAP, Motion, Three.js/R3F, Lottie, Rive, Satori, SVGO, ShotCraft) & video tin tức" toolKey="anim-video" runNow={onQuickRunAnim} />
          <Row ok={status.whisper.installed} name="faster-whisper" desc="Nhận dạng lời thoại tiếng Việt từng từ, xuất phụ đề karaoke & .srt" toolKey="edit-source" />
          <Row ok={status.moneyprinter.installed} name="MoneyPrinterTurbo" desc={`Video tự động từ cảnh có sẵn · kho Pexels: ${status.moneyprinter.pexels.length ? status.moneyprinter.pexels.join(", ") : "chưa có khóa"}`} toolKey="auto-video" />
          <Row ok={status.liveportrait.installed && status.liveportrait.mediapipe} name="LivePortrait + MediaPipe" desc={`Ảnh chân dung cử động · ${status.liveportrait.presets.length} video biểu cảm mẫu · dò mặt MediaPipe`} toolKey="portrait" />
          <p className="text-[11px] text-muted">{status.fishSpeech.note}{status.freeDiskGB != null ? ` · Đĩa còn ${status.freeDiskGB} GB.` : ""}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Khóa kho cảnh quay (miễn phí)</p>
          <p className="text-[11px] text-muted">Tạo khóa tại pexels.com/api hoặc pixabay.com/api/docs rồi dán vào đây. Khóa chỉ lưu trên máy này.</p>
          <input type="password" className={inputCls} placeholder={status.moneyprinter.pexels.length ? `Pexels: ${status.moneyprinter.pexels[0]} (dán khóa mới để thay)` : "Khóa Pexels"} value={keys.pexels} onChange={(e) => setKeys({ ...keys, pexels: e.target.value })} />
          <input type="password" className={inputCls} placeholder={status.moneyprinter.pixabay.length ? `Pixabay: ${status.moneyprinter.pixabay[0]}` : "Khóa Pixabay (tuỳ chọn)"} value={keys.pixabay} onChange={(e) => setKeys({ ...keys, pixabay: e.target.value })} />
          <Button size="sm" disabled={!keys.pexels && !keys.pixabay} onClick={saveKeys}>Lưu khóa</Button>
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Thử giọng đọc</p>
            <textarea rows={2} className={inputCls} value={tts.text} onChange={(e) => setTts({ ...tts, text: e.target.value })} />
            <div className="flex gap-2"><select className={cx(inputCls, "min-w-0 flex-1")} value={tts.voice} onChange={(e) => setTts({ ...tts, voice: e.target.value })}>{status.tts.voices.map((v: any) => <option key={v.id} value={v.id}>{v.label}</option>)}</select><Button size="sm" loading={tts.busy} onClick={speak}>Đọc</Button></div>
            {tts.url && <audio src={tts.url} controls autoPlay className="w-full" />}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Tạo phụ đề từ video</p>
            <label className={cx("flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs text-muted hover:bg-soft", stt.busy && "pointer-events-none opacity-60")}>{stt.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}{stt.busy ? `Đang nghe ${stt.name}…` : "Chọn video / âm thanh"}<input type="file" accept="video/*,audio/*" className="hidden" onChange={(e) => transcribeFile(e.target.files)} /></label>
            {stt.text && <div className="rounded-xl bg-soft p-2 text-xs"><p className="line-clamp-4">{stt.text}</p><a className="text-blue-600" href={`/v1/video-ai/file?path=${encodeURIComponent(stt.srt!)}&download=1`}>Tải phụ đề .srt</a></div>}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** One upload card per role the tool needs (main character, product…) + optional extra reference images. */
function ImageSlots({ slots, images, onUpload, onRemove, onRole, note, extras }: {
  slots: { role: string; label: string; hint: string; required?: boolean }[]; images: any[]; note?: string; extras: boolean;
  onUpload: (f: FileList | File[] | null, role?: string) => void; onRemove: (path: string) => void; onRole: (path: string, role: string) => void;
}) {
  const [over, setOver] = useState<string | null>(null);
  const slotRoles = new Set(slots.map((s) => s.role));
  const others = images.filter((i) => !slotRoles.has(i.role));
  if (!slots.length && !extras) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Ảnh cho video {note && <span className="text-xs font-normal text-muted">— {note}</span>}</p>
      {slots.length > 0 && (
        <div className={cx("grid grid-cols-2 gap-3", slots.length === 1 ? "max-w-[15rem] grid-cols-1" : slots.length === 2 ? "sm:grid-cols-2" : slots.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 wide:grid-cols-4")}>
          {slots.map((sl) => {
            const img = images.find((i) => i.role === sl.role);
            return (
              <div key={sl.role}
                onDragOver={(e) => { e.preventDefault(); setOver(sl.role); }} onDragLeave={() => setOver(null)}
                onDrop={(e) => { e.preventDefault(); setOver(null); onUpload(e.dataTransfer.files, sl.role); }}
                className={cx("group relative flex flex-col overflow-hidden rounded-xl border-2 border-dashed text-center transition", "h-56", over === sl.role ? "border-blue-500 bg-blue-500/5" : img ? "border-transparent" : "border-line bg-soft/40 hover:border-blue-400 hover:bg-blue-500/5")}>
                {img ? (
                  <>
                    {img.preview ? <img src={img.preview} alt={sl.label} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 grid place-items-center bg-soft p-2 text-[11px] text-muted">{img.name}</div>}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 text-left text-white">
                      <p className="text-[11px] font-semibold">{sl.label}</p>
                      <div className="mt-1 flex gap-1.5 opacity-90">
                        <label className="cursor-pointer rounded-md bg-white/20 px-2 py-0.5 text-[10px] hover:bg-white/30">Đổi ảnh<input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files, sl.role)} /></label>
                        <button onClick={() => onRemove(img.path)} className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] hover:bg-rose-500/80">Xóa</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <label className="flex h-full cursor-pointer flex-col items-center justify-center gap-2 px-3 py-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-500/10 text-blue-600"><ImagePlus className="h-5 w-5" /></span>
                    <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-ink">{sl.label}</span>
                    {sl.required ? <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600">bắt buộc</span> : <span className="rounded-full bg-soft px-2 py-0.5 text-[10px] font-medium text-muted">tuỳ chọn</span>}
                    <span className="line-clamp-3 text-[11px] leading-snug text-muted">{sl.hint}</span>
                    <span className="mt-auto inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/5 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300">Bấm hoặc kéo ảnh vào</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files, sl.role)} />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}
      {extras && (
        <div className="flex flex-wrap items-center gap-2">
          {others.map((im) => (
            <div key={im.path} className="flex items-center gap-2 rounded-xl border border-line px-2 py-1.5 text-xs">
              {im.preview && <img src={im.preview} alt="" className="h-7 w-7 rounded object-cover" />}
              <select className="bg-transparent" value={im.role} onChange={(e) => onRole(im.path, e.target.value)}>{["Ảnh tham khảo khác", ...ROLES].map((r) => <option key={r}>{r}</option>)}</select>
              <span className="max-w-[110px] truncate text-muted">{im.name}</span>
              <button onClick={() => onRemove(im.path)}><Trash2 className="h-3.5 w-3.5 text-muted" /></button>
            </div>
          ))}
          {images.length < 8 && <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-1.5 text-xs text-muted hover:bg-soft"><ImagePlus className="h-4 w-4" />Ảnh tham khảo khác<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onUpload(e.target.files)} /></label>}
        </div>
      )}
    </div>
  );
}

/** Kịch bản đã duyệt → đúng skill tạo video (chọn tool + lời đọc sạch ở máy chủ). Flow tốn tín dụng → chỉ chạy khi Sếp bấm. */
type Footage = { files: { path: string; name: string }[]; style: string; music: boolean };
const NO_FOOTAGE: Footage = { files: [], style: "dynamic", music: true };

/** Kịch bản "minh hoạ" không làm được bằng Flow: Sếp tải video thô lên, AI dựng thành video hoàn chỉnh (thay cho kho Pexels/Pixabay). */
function FootageBox({ value, onChange, needed }: { value: Footage; onChange: (f: Footage) => void; needed: boolean }) {
  const toast = useToast();
  const [pct, setPct] = useState<number | null>(null);
  const add = async (files: FileList | null) => {
    const added: Footage["files"] = [];
    for (const f of Array.from(files ?? [])) {
      if (!VIDEO_FILE_RE.test(f.name)) { toast(`${f.name}: chỉ nhận video (mp4, mov, webm, mkv)`, "err"); continue; }
      try { const r = await putVideoStream(f, setPct); added.push({ path: r.path, name: `${f.name} · ${(f.size / 1048576).toFixed(0)} MB` }); } catch (e: any) { toast(`${f.name}: ${e.message}`, "err"); }
    }
    if (added.length) onChange({ ...value, files: [...value.files, ...added] });
  };
  return (
    <Fold flat className="mt-2" icon={Film} tone={value.files.length ? "green" : needed ? "amber" : "gray"} defaultOpen={needed && !value.files.length}
      title="Dựng từ video thô của Sếp" summary={value.files.length ? `${value.files.length} video đã tải · AI sẽ dựng (thay cho kho Pexels/Pixabay)` : "tuỳ chọn · thay cho kho Pexels/Pixabay"} bodyClass="space-y-3 px-4 pb-3 pt-0">
      <p className="text-xs text-muted">Tải video thô (cảnh quay công ty, màn hình làm việc, sản phẩm, b-roll…). AI xem và chọn đoạn đẹp khớp từng cảnh của kịch bản, rồi dựng: <b className="text-ink">cắt cảnh, chuyển cảnh, zoom in/out, chữ động, phụ đề từng từ, hiệu ứng âm thanh, nhạc nền</b>. Lời đọc giữ đúng kịch bản đã duyệt.</p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {value.files.map((m, i) => <span key={m.path} className="flex items-center gap-1 rounded-lg border border-line px-2 py-1">{m.name}<button type="button" aria-label="Bỏ video" onClick={() => onChange({ ...value, files: value.files.filter((_, j) => j !== i) })}><Trash2 className="h-3 w-3 text-muted" /></button></span>)}
        <label className={cx("flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1 text-muted hover:bg-soft", pct !== null && "pointer-events-none opacity-60")}>
          {pct !== null ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Đang tải {pct}%</> : <><Film className="h-3.5 w-3.5" />Tải video thô</>}
          <input type="file" accept="video/*" multiple className="hidden" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <select className={cx(inputCls, "h-9 py-1 text-xs")} aria-label="Phong cách dựng" value={value.style} onChange={(e) => onChange({ ...value, style: e.target.value })}>{EDIT_STYLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={value.music} onChange={(e) => onChange({ ...value, music: e.target.checked })} />Nhạc nền</label>
      </div>
    </Fold>
  );
}

function ScriptsToVideo() {
  const list = useApi<any[]>("video-scripts", ["creative.", "approval.", "task."]);
  const [ask, setAsk] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setParams] = useSearchParams();
  const toast = useToast();
  const [footage, setFootage] = useState<Record<string, Footage>>({});
  const foot = (id: string) => footage[id] ?? NO_FOOTAGE;
  const plans = (list.data ?? []).filter((p) => !p.error && !(p.job && p.job.status === "done"));
  if (!list.data || !plans.length) return null;
  // Thiếu gì trừ khoản "video thô / khóa Pexels" khi Sếp đã tải video thô (khi đó video dựng từ chính video đó)
  const blockers = (p: any): string[] => (p.missing ?? []).filter((m: string) => !(foot(p.contentId).files.length && /Pexels|Pixabay|video thô/i.test(m)));
  const run = async () => {
    if (!ask) return;
    setBusy(true);
    try {
      const f = foot(ask.contentId);
      const r = await api.post(`content/${ask.contentId}/make-video`, f.files.length && ask.tool === "auto-video" ? { materials: f.files.map((x) => x.path), style: f.style, music: f.music ? "auto" : "none" } : {});
      toast(r.already ? "Kịch bản này đang có video chạy rồi" : `Đã bắt đầu tạo video bằng ${r.tool} — xong sẽ báo và gửi Sếp duyệt`);
      setAsk(null); list.reload();
    } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  return (
    <Card title={<span className="flex items-center gap-2">Kịch bản đã duyệt → tạo video <Badge tone="blue">{plans.length}</Badge></span>}>
      <p className="-mt-1 mb-3 text-xs text-muted">Hệ thống tự chọn skill hợp với từng kịch bản và chỉ đưa lời đọc đã duyệt vào video (bỏ mốc cảnh, ghi chú nội bộ). Video xong dùng đúng Caption đã duyệt và gắn lại vào kịch bản gốc.</p>
      <div className="divide-y divide-line">
        {plans.map((p) => {
          const Icon = TOOL_ICON[p.tool] ?? Film;
          const running = p.job && ["queued", "running"].includes(p.job.status);
          return (
            <div key={p.contentId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{p.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted"><Icon className="h-3.5 w-3.5" /><b className="text-ink">{p.toolLabel}</b> · {p.scenes} cảnh · ~{p.durationSec}s{p.paidCredits ? " · tốn tín dụng Flow" : " · chạy trên máy, không tốn tín dụng"}</p>
                <p className="mt-0.5 text-xs text-muted">{p.reason}</p>
                {blockers(p).length > 0 && <ul className="mt-1 list-disc pl-4 text-xs text-amber-700 dark:text-amber-300">{blockers(p).map((m: string) => <li key={m}>{m}</li>)}</ul>}
                {p.tool === "auto-video" && <FootageBox value={foot(p.contentId)} onChange={(f) => setFootage((x) => ({ ...x, [p.contentId]: f }))} needed={(p.missing ?? []).some((m: string) => /Pexels|Pixabay|video thô/i.test(m))} />}
                {running && <p className="mt-1 text-xs"><Badge tone="blue">{STATUS[p.job.status]?.[0] ?? p.job.status}</Badge> {p.job.step}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="ghost" onClick={() => setParams({ from: p.contentId })}>Mở để chỉnh</Button>
                <Button size="sm" variant="primary" icon={Play} disabled={Boolean(running) || blockers(p).length > 0} onClick={() => setAsk(p)}>{running ? "Đang tạo" : "Tạo video"}</Button>
              </div>
            </div>
          );
        })}
      </div>
      <Modal open={Boolean(ask)} onClose={() => setAsk(null)} title="Tạo video từ kịch bản?" footer={<><Button variant="ghost" onClick={() => setAsk(null)}>Hủy</Button><Button variant="primary" loading={busy} onClick={run}>Bắt đầu</Button></>}>
        {ask && <div className="space-y-2 text-sm text-ink">
          <p><b>{ask.title}</b></p>
          {ask.tool === "auto-video" && foot(ask.contentId).files.length > 0
            ? <p>Dựng từ <b>{foot(ask.contentId).files.length} video thô của Sếp</b> · {ask.scenes} cảnh · khoảng {ask.durationSec} giây · AI chọn đoạn, cắt cảnh, chuyển cảnh, zoom, chữ động, phụ đề, hiệu ứng âm thanh · mất khoảng 10 đến 20 phút, không tốn tín dụng Flow.</p>
            : <p>Skill: <b>{ask.toolLabel}</b> · {ask.scenes} cảnh · khoảng {ask.durationSec} giây · mất khoảng {ask.minutes} phút.</p>}
          {ask.paidCredits && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">Chạy trên Google Flow bằng Chrome Flow — <b>tốn tín dụng Flow</b> của tài khoản đã chọn. Chạy 1 video/lần, video sau xếp hàng.</p>}
          <p className="text-xs text-muted">Xong sẽ có thông báo; video vào "Duyệt & Phê duyệt" để Sếp xem trước khi đăng.</p>
        </div>}
      </Modal>
    </Card>
  );
}
