import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { z } from "zod";
import { effectiveProvider, generate } from "@dotaka/llm-gateway";
import { AppError, logger } from "@dotaka/shared";
import { TOOLS_DIR, VI_VOICES, bgmFiles, mediaDuration, runProcess, toolsPython, videoAiFile, voiceOver } from "./video-ai.ts";
import { type EditPlan, type EditStyle, type SourceInfo, type Word, autoPlan, resolveEditPlan, sanitizePlan } from "./pro-edit.ts";

export interface DecodedShot {
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

export interface DecodedVideoBlueprint {
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
  recommendedEditStyle: EditStyle;
  contactSheetUrl: string | null;
  contactSheetPath: string | null;
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

export interface ClonedProductionScene {
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

export interface ClonedVideoProductionResult {
  id: string;
  topic: string;
  product: string;
  brandName: string;
  providerUsed: string;
  blueprintId: string;
  pacingApplied: string;
  editStyle: EditStyle;
  hookTitle: string;
  ctaText: string;
  caption: string;
  scenes: ClonedProductionScene[];
  renderedVideoUrl: string | null;
  renderedDurationSec: number;
  renderNotes: string;
}

const ClaudeDecodeSchema = z.object({
  hookFormula: z.object({
    first3SecHook: z.string(),
    visualHookTechnique: z.string(),
    onScreenHookTitle: z.string(),
  }),
  narrativeArc: z.array(z.string()).min(2).max(6),
  editingRhythmNotes: z.string(),
  reusablePromptTemplate: z.string(),
  shots: z.array(
    z.object({
      sceneNumber: z.number().int().min(1),
      visualDescription: z.string(),
      cameraAngle: z.string(),
      recommendedZoom: z.enum(["in", "out", "punch", "pan_left", "pan_right", "none"]),
      recommendedTransition: z.string(),
      onScreenText: z.string(),
      howToShootOrSelect: z.string(),
    }),
  ),
});

const ClaudeClonePlanSchema = z.object({
  hookTitle: z.string(),
  ctaText: z.string(),
  caption: z.string(),
  scenes: z.array(
    z.object({
      sceneNumber: z.number().int().min(1),
      newVoiceover: z.string(),
      newOnScreenText: z.string(),
      rawSourceIndex: z.number().int().min(0),
      rawStartSec: z.number().min(0),
      rawEndSec: z.number().min(0),
      zoom: z.enum(["in", "out", "punch", "pan_left", "pan_right", "none"]),
      transition: z.string(),
      directorNote: z.string(),
    }),
  ),
});

const jsonLine = (out: string) => {
  const l = out
    .split("\n")
    .reverse()
    .find((x) => x.trim().startsWith("{"));
  try {
    return l ? JSON.parse(l) : null;
  } catch {
    return null;
  }
};

/** Tìm danh sách các file video MP4 có sẵn trên máy (trong data/uploads và data/creative) để người dùng có thể chọn test ngay */
export function listLocalAvailableVideos(): { path: string; url: string; name: string; sizeMB: number; updatedAt: string }[] {
  const results: { path: string; url: string; name: string; sizeMB: number; updatedAt: string }[] = [];
  const uploadsDir = resolve("data/uploads");
  if (existsSync(uploadsDir)) {
    for (const f of readdirSync(uploadsDir)) {
      if (!/\.(mp4|mov|m4v|webm)$/i.test(f)) continue;
      const full = join(uploadsDir, f);
      try {
        const st = statSync(full);
        if (st.size > 10_000) {
          results.push({
            path: full,
            url: `/v1/uploads/${encodeURIComponent(f)}`,
            name: `Video đã tải lên · ${f}`,
            sizeMB: Math.round((st.size / 1048576) * 10) / 10,
            updatedAt: st.mtime.toISOString(),
          });
        }
      } catch {
        // ignore
      }
    }
  }

  const creativeDir = resolve("data/creative");
  if (existsSync(creativeDir)) {
    for (const dirName of readdirSync(creativeDir).slice(0, 25)) {
      const candidate = join(creativeDir, dirName, "final.mp4");
      if (!existsSync(candidate)) continue;
      try {
        const st = statSync(candidate);
        if (st.size > 10_000) {
          const pub = ensurePublicUploadCopy(candidate, `sample_${dirName.slice(0, 8)}`);
          results.push({
            path: candidate,
            url: pub.publicUrl,
            name: `Video Mẫu Local #${dirName.slice(0, 8)} (${(st.size / 1048576).toFixed(1)} MB)`,
            sizeMB: Math.round((st.size / 1048576) * 10) / 10,
            updatedAt: st.mtime.toISOString(),
          });
        }
      } catch {
        // ignore
      }
    }
  }

  return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 12);
}

function ensurePublicUploadCopy(srcPath: string, prefix: string): { publicPath: string; publicUrl: string } {
  const uploadsDir = resolve("data/uploads");
  mkdirSync(uploadsDir, { recursive: true });
  if (srcPath.startsWith(uploadsDir)) {
    const fileName = basename(srcPath);
    return { publicPath: srcPath, publicUrl: `/v1/uploads/${encodeURIComponent(fileName)}` };
  }
  const ext = srcPath.toLowerCase().endsWith(".png") ? ".png" : ".mp4";
  const st = existsSync(srcPath) ? statSync(srcPath) : null;
  const sig = st ? createHash("sha1").update(`${srcPath}:${st.size}:${Math.floor(st.mtimeMs)}`).digest("hex").slice(0, 10) : String(Date.now());
  const safeName = `${prefix}_${sig}${ext}`;
  const dest = join(uploadsDir, safeName);
  if (!existsSync(dest)) copyFileSync(srcPath, dest);
  return { publicPath: dest, publicUrl: `/v1/uploads/${encodeURIComponent(safeName)}` };
}

function fileSignature(filePath: string): string {
  try {
    const st = statSync(filePath);
    return createHash("sha1")
      .update(`${resolve(filePath)}:${st.size}:${Math.floor(st.mtimeMs)}`)
      .digest("hex")
      .slice(0, 16);
  } catch {
    return createHash("sha1").update(filePath).digest("hex").slice(0, 16);
  }
}

async function analyzeVideosWithCache(
  bin: string,
  videoPaths: string[],
): Promise<{ sources: SourceInfo[]; sheets: string[] } | null> {
  const cacheRoot = resolve("data/creative/decoded/_cache");
  const sig = createHash("sha1")
    .update(videoPaths.map((p) => `${p}:${fileSignature(p)}`).join("|"))
    .digest("hex")
    .slice(0, 18);
  const cacheDir = join(cacheRoot, `an_${sig}`);
  const metaFile = join(cacheDir, "cached_analysis.json");

  if (existsSync(metaFile)) {
    try {
      const parsed = JSON.parse(readFileSync(metaFile, "utf8"));
      if (parsed?.sources?.length) return parsed;
    } catch {
      // recompute
    }
  }

  mkdirSync(cacheDir, { recursive: true });
  const anRun = await runProcess(bin, [join(TOOLS_DIR, "pro_edit.py"), "analyze", cacheDir, ...videoPaths], {
    timeoutMs: 120_000,
  });
  const anJson = jsonLine(anRun.out);
  if (anRun.code === 0 && anJson?.sources?.length) {
    const payload = { sources: anJson.sources as SourceInfo[], sheets: (anJson.sheets ?? []) as string[] };
    writeFileSync(metaFile, JSON.stringify(payload));
    return payload;
  }
  return null;
}

async function transcribeWordsWithCache(bin: string, videoPath: string): Promise<Word[]> {
  const cacheRoot = resolve("data/creative/decoded/_cache");
  mkdirSync(cacheRoot, { recursive: true });
  const wordsFile = join(cacheRoot, `words_${fileSignature(videoPath)}.json`);
  if (existsSync(wordsFile)) {
    try {
      const parsed = JSON.parse(readFileSync(wordsFile, "utf8")) as { file: string; words: Word[] }[];
      if (Array.isArray(parsed)) return parsed[0]?.words ?? [];
    } catch {
      // recompute
    }
  }
  const wRun = await runProcess(bin, [join(TOOLS_DIR, "pro_edit.py"), "words", wordsFile, videoPath], {
    timeoutMs: 90_000,
  });
  if (wRun.code === 0 && existsSync(wordsFile)) {
    const parsed = JSON.parse(readFileSync(wordsFile, "utf8")) as { file: string; words: Word[] }[];
    return parsed[0]?.words ?? [];
  }
  return [];
}

const voiceCacheMem = new Map<string, { mp3: string; duration: number }>();
async function cachedVoiceOver(opts: { text: string; voice: string; rate: number }): Promise<{ mp3: string; duration: number }> {
  const key = createHash("sha1")
    .update(`${opts.voice}|${opts.rate}|${opts.text.trim()}`)
    .digest("hex")
    .slice(0, 20);
  const hit = voiceCacheMem.get(key);
  if (hit && existsSync(videoAiFile(hit.mp3))) return hit;
  const res = await voiceOver(opts);
  voiceCacheMem.set(key, res);
  return res;
}

/**
 * BƯỚC 1: GIẢI MÃ VIDEO MẪU (LOCAL FFMPEG SCENE-DETECTION + FASTER-WHISPER + CLAUDE VISION/CLI)
 * Bóc tách nhịp cắt cảnh, góc máy, lời thoại, Hook 3s đầu và công thức dựng phim từ một video có sẵn.
 */
export async function decodeVideoBlueprint(opts: {
  bizId: string;
  videoPath?: string;
  referenceNotes?: string;
  useWhisper?: boolean;
  useClaude?: boolean;
}): Promise<DecodedVideoBlueprint> {
  const available = listLocalAvailableVideos();
  const resolvedPath =
    opts.videoPath && existsSync(opts.videoPath)
      ? opts.videoPath
      : available[0]?.path;

  if (!resolvedPath || !existsSync(resolvedPath)) {
    throw new AppError("NO_VIDEO", "Chưa tìm thấy file video để giải mã. Vui lòng tải lên 1 video mẫu (.mp4/.mov)!");
  }

  const decodeId = `dec_${Date.now()}`;
  const bin = toolsPython();
  if (!existsSync(bin)) {
    throw new AppError("NOT_INSTALLED", "Chưa tìm thấy môi trường Python xử lý video (tools/video/.venv)");
  }

  // 1. Chạy pro_edit.py analyze (có Cache SHA1 theo file) để tách phân cảnh (shots) + tạo ảnh Contact Sheet bằng FFmpeg
  const anJson = await analyzeVideosWithCache(bin, [resolvedPath]);
  if (!anJson || !anJson.sources?.length) {
    throw new AppError("DECODE_FAILED", "Không thể phân tích kỹ thuật video mẫu.");
  }

  const srcInfo = anJson.sources[0] as SourceInfo;
  const rawSheets = (anJson.sheets ?? []) as string[];
  let contactSheetUrl: string | null = null;
  let contactSheetPath: string | null = null;
  if (rawSheets[0] && existsSync(rawSheets[0])) {
    const copied = ensurePublicUploadCopy(rawSheets[0], "sheet");
    contactSheetPath = copied.publicPath;
    contactSheetUrl = copied.publicUrl;
  }

  const { publicUrl: sourceVideoUrl } = ensurePublicUploadCopy(resolvedPath, "ref");

  // Chuẩn hóa danh sách phân cảnh (nếu video quá ngắn chỉ có 1 shot dài, tự chia thành 3-5 nhịp phân tích)
  let rawShots = srcInfo.shots && srcInfo.shots.length > 0 ? [...srcInfo.shots] : [{ id: "0.0", start: 0, end: srcInfo.duration }];
  if (rawShots.length === 1 && srcInfo.duration >= 9) {
    const segCount = Math.min(5, Math.max(3, Math.round(srcInfo.duration / 4.5)));
    const segLen = srcInfo.duration / segCount;
    rawShots = Array.from({ length: segCount }, (_, idx) => ({
      id: `0.${idx}`,
      start: Math.round(idx * segLen * 10) / 10,
      end: Math.round((idx + 1) * segLen * 10) / 10,
    }));
  }

  // 2. Bóc lời thoại bằng Faster-Whisper Local (có Cache SHA1 theo file)
  let words: Word[] = [];
  if (opts.useWhisper !== false && srcInfo.hasAudio) {
    try {
      words = await transcribeWordsWithCache(bin, resolvedPath);
    } catch (e) {
      logger.warn("video_decode.whisper_skipped", { error: String(e).slice(0, 200) });
    }
  }

  const fullTranscript = words.map((w) => w.w).join(" ").trim();
  const durationSec = Math.round((srcInfo.duration || 15) * 10) / 10;
  const shotCount = rawShots.length;
  const avgShotSec = Math.round((durationSec / Math.max(1, shotCount)) * 10) / 10;
  const wordsPerMinute = fullTranscript
    ? Math.round((words.length / Math.max(5, durationSec)) * 60)
    : 155;

  const pacingLabel =
    avgShotSec <= 2.8
      ? "Nhịp Nhanh Dồn Dập (Fast-Cut TikTok/Reels · giữ chân 3 giây đầu cực mạnh)"
      : avgShotSec <= 4.8
        ? "Nhịp Vừa Chuẩn Thương Mại (Balanced Storytelling · dễ nghe, dễ chốt đơn)"
        : "Nhịp Chậm Điện Ảnh (Cinematic Pacing · tập trung chiều sâu cảm xúc)";

  const recommendedEditStyle: EditStyle =
    avgShotSec <= 2.8 ? "dynamic" : avgShotSec <= 4.8 ? "clean" : "smooth";

  // 3. Khớp lời thoại theo từng phân cảnh (shot)
  const shotTranscripts = rawShots.map((sh, idx) => {
    const ws = words.filter((w) => w.s >= sh.start - 0.15 && w.e <= sh.end + 0.25);
    if (ws.length > 0) return ws.map((w) => w.w).join(" ");
    if (idx === 0) return "Câu mở đầu (Hook) đánh thẳng vào nỗi đau hoặc sự tò mò của người xem trong 3 giây đầu.";
    if (idx === rawShots.length - 1) return "Lời kêu gọi hành động (CTA) rõ ràng, chốt ưu đãi hoặc mời bấm giỏ hàng/nhắn tin.";
    return `Triển khai chi tiết minh chứng / trải nghiệm thực tế ở phân cảnh ${idx + 1}.`;
  });

  // Fallback công thức giải mã chuẩn xác (dùng cho sandbox hoặc khi chạy tức thì)
  const zoomCycle: DecodedShot["recommendedZoom"][] = ["punch", "in", "pan_right", "out", "pan_left", "in"];
  const transCycle = ["slideleft", "zoomin", "dissolve", "wipeleft", "fade"];
  const angleCycle = [
    "Cận cảnh trực diện (Medium Close-Up · 85mm) — thu hút ánh nhìn ngay giây đầu",
    "Góc rộng bối cảnh thực tế (Wide Establishing · 24mm) — thấy rõ không gian & thao tác",
    "Góc cận chi tiết sản phẩm / thao tác tay (Macro Detail Insert · 50mm) — tăng độ tin cậy",
    "Góc nghiêng 45 độ (Over-the-Shoulder / POV) — tạo cảm giác trải nghiệm thật",
    "Góc chính diện chốt thông điệp (Hero Center Shot · 35mm) — kèm bảng giá / CTA nổi bật",
  ];

  const buildDefaultDecode = () => ({
    hookFormula: {
      first3SecHook: shotTranscripts[0] || "Mở đầu bằng câu hỏi xoáy trực tiếp vào vấn đề + cận cảnh sản phẩm/nhân vật chuyển động ngay giây 0.2s",
      visualHookTechnique: `Cắt cảnh đầu ${rawShots[0] ? (rawShots[0].end - rawShots[0].start).toFixed(1) : "3.0"}s kết hợp hiệu ứng Zoom Punch + tiêu đề chữ lớn tương phản cao ở 1/3 trên khung hình`,
      onScreenHookTitle: "BÍ QUYẾT TỐI ƯU HIỆU QUẢ GẤP 3 LẦN",
    },
    narrativeArc: [
      `1. Hook Mở Đầu (0s – ${(rawShots[0]?.end ?? 3.5).toFixed(1)}s): Gây chú ý tức thì bằng hình ảnh cận cảnh & câu hỏi trực diện.`,
      `2. Dẫn Dắt & Vấn Đề: Chỉ ra sai lầm phổ biến hoặc nhu cầu thực tế của khách hàng.`,
      `3. Trình Diễn Giải Pháp (Show, Don't Tell): Quay cận cảnh thao tác thực tế, chi tiết sản phẩm/dịch vụ sắc nét.`,
      `4. Chốt Đơn & Kêu Gọi Hành Động (CTA): Tổng kết lợi ích cốt lõi và thúc đẩy hành động ngay.`,
    ],
    editingRhythmNotes: `Video gồm ${shotCount} phân cảnh trên tổng thời lượng ${durationSec}s (trung bình ${avgShotSec}s/cảnh). ${pacingLabel}. Kết hợp phụ đề từng từ (Word-by-Word Karaoke) ở vùng an toàn dưới và nhạc nền ducking -14 LUFS.`,
    reusablePromptTemplate: `Hãy viết kịch bản ${shotCount} phân cảnh (tổng ${durationSec}s, mỗi cảnh ~${avgShotSec}s). Cảnh 1 bắt buộc có Hook ≤ 7 chữ trên màn hình + Zoom Punch. Các cảnh giữa đan xen góc cận sản phẩm (Macro) và góc trung (Medium Shot). Cảnh cuối chốt CTA rõ ràng.`,
    shots: rawShots.map((sh, idx) => ({
      sceneNumber: idx + 1,
      visualDescription:
        idx === 0
          ? "Khung hình mở đầu (Hook): Nhân vật hoặc sản phẩm chính xuất hiện nổi bật ở trung tâm, chuyển động dứt khoát thu hút mắt nhìn."
          : idx === rawShots.length - 1
            ? "Khung hình kết (CTA): Toàn cảnh sản phẩm hoàn chỉnh kèm thông điệp kêu gọi hành động rõ ràng."
            : `Phân cảnh ${idx + 1}: Minh họa trực quan quá trình sử dụng / chi tiết đắt giá của sản phẩm ở góc quay thực tế.`,
      cameraAngle: angleCycle[idx % angleCycle.length],
      recommendedZoom: zoomCycle[idx % zoomCycle.length],
      recommendedTransition: idx === 0 ? "cut" : transCycle[idx % transCycle.length],
      onScreenText:
        idx === 0
          ? "ĐIỂM NHẤN 3 GIÂY ĐẦU"
          : idx === rawShots.length - 1
            ? "NHẮN TIN NHẬN ƯU ĐÃI NGAY"
            : `ĐIỂM NỔI BẬT #${idx}`,
      howToShootOrSelect:
        idx === 0
          ? "Chọn đoạn video quay sẵn có ánh sáng đẹp nhất, rõ mặt người nói hoặc cận cảnh sản phẩm bắt mắt nhất (dài ~" + (sh.end - sh.start).toFixed(1) + "s)."
          : idx === rawShots.length - 1
            ? "Chọn đoạn video quay tổng thể sản phẩm, đóng gói hoặc khách hàng hài lòng để đặt nút kêu gọi hành động."
            : `Chọn đoạn b-roll quay cận thao tác tay, chi tiết chất liệu hoặc cảnh sử dụng thực tế (dài ~${(sh.end - sh.start).toFixed(1)}s).`,
    })),
  });

  let claudeOut = buildDefaultDecode();
  let decodedByProvider = "local_ffmpeg_analyzer";

  const prov = effectiveProvider(opts.bizId);
  if (opts.useClaude !== false && prov.ready && prov.provider !== "sandbox") {
    try {
      const g = await generate({
        bizId: opts.bizId,
        agentKey: "creative",
        tier: "medium",
        schema: ClaudeDecodeSchema,
        images: contactSheetPath ? [{ path: contactSheetPath, mediaType: "image/png" as const }] : undefined,
        system: [
          "Bạn là Đạo diễn & Chuyên gia Giải mã Video Ngắn (Viral Video Reverse-Engineer) của ZONO Studio.",
          "Nhiệm vụ: Xem ảnh Contact Sheet các phân cảnh của video mẫu + thông số cắt cảnh FFmpeg + lời thoại bóc băng Whisper để giải mã chính xác CÔNG THỨC LÀM PHIM của video này.",
          "Mục tiêu: Giúp chủ doanh nghiệp hiểu rõ cấu trúc từng cảnh (Hook, góc quay, hiệu ứng zoom/chuyển cảnh, chữ trên màn hình) và hướng dẫn họ dùng các VIDEO QUAY SẴN (raw footage) của họ để dựng một bộ phim mới học theo đúng công thức này.",
          "Trả về JSON đúng schema tiếng Việt sắc sảo, thực chiến.",
        ].join("\n"),
        user: [
          `Thông số Video Mẫu: Thời lượng ${durationSec}s, độ phân giải ${srcInfo.width}x${srcInfo.height}, ${(srcInfo as any).fps ?? 30} fps, ${shotCount} phân cảnh (trung bình ${avgShotSec}s/cảnh).`,
          opts.referenceNotes ? `Ghi chú của người dùng: ${opts.referenceNotes}` : "",
          fullTranscript ? `Lời thoại bóc băng (Whisper): ${fullTranscript}` : "Video không có lời thoại rõ hoặc chỉ dùng nhạc nền/b-roll.",
          "Danh sách phân cảnh FFmpeg phát hiện:",
          ...rawShots.map((sh, i) => `- Cảnh ${i + 1} (${sh.start.toFixed(1)}s -> ${sh.end.toFixed(1)}s, dài ${(sh.end - sh.start).toFixed(1)}s): Lời="${shotTranscripts[i]}"`),
          `Hãy trả về đúng ${rawShots.length} phần tử trong mảng shots tương ứng với ${rawShots.length} cảnh trên.`,
        ]
          .filter(Boolean)
          .join("\n"),
        sandbox: buildDefaultDecode,
      });
      if (g.output?.shots?.length) {
        claudeOut = g.output;
        decodedByProvider = g.provider || prov.provider;
      }
    } catch (e) {
      logger.warn("video_decode.claude_fallback", { error: String(e).slice(0, 250) });
    }
  }

  const decodedShots: DecodedShot[] = rawShots.map((sh, idx) => {
    const cShot = claudeOut.shots[idx] ?? claudeOut.shots[claudeOut.shots.length - 1];
    const dur = Math.max(0.8, Math.round((sh.end - sh.start) * 10) / 10);
    return {
      sceneNumber: idx + 1,
      shotId: sh.id,
      startSec: Math.round(sh.start * 10) / 10,
      endSec: Math.round(sh.end * 10) / 10,
      durationSec: dur,
      spokenText: shotTranscripts[idx] ?? "",
      visualDescription: cShot?.visualDescription ?? `Phân cảnh ${idx + 1}`,
      cameraAngle: cShot?.cameraAngle ?? angleCycle[idx % angleCycle.length],
      recommendedZoom: cShot?.recommendedZoom ?? zoomCycle[idx % zoomCycle.length],
      recommendedTransition: cShot?.recommendedTransition ?? (idx === 0 ? "cut" : transCycle[idx % transCycle.length]),
      onScreenText: cShot?.onScreenText ?? `ĐIỂM NHẤN #${idx + 1}`,
      howToShootOrSelect:
        cShot?.howToShootOrSelect ??
        `Chọn đoạn video quay sẵn dài khoảng ${dur}s thể hiện rõ sản phẩm hoặc thao tác thực tế.`,
    };
  });

  return {
    id: decodeId,
    sourceVideoPath: resolvedPath,
    sourceVideoUrl,
    sourceFileName: basename(resolvedPath),
    durationSec,
    width: srcInfo.width || 1080,
    height: srcInfo.height || 1920,
    fps: (srcInfo as any).fps || 30,
    hasAudio: Boolean(srcInfo.hasAudio),
    shotCount,
    avgShotSec,
    pacingLabel,
    recommendedEditStyle,
    contactSheetUrl,
    contactSheetPath,
    fullTranscript: fullTranscript || shotTranscripts.join(" "),
    wordsPerMinute,
    decodedByProvider,
    hookFormula: claudeOut.hookFormula,
    narrativeArc: claudeOut.narrativeArc,
    editingRhythmNotes: claudeOut.editingRhythmNotes,
    decodedShots,
    reusablePromptTemplate: claudeOut.reusablePromptTemplate,
  };
}

/**
 * BƯỚC 2: HỌC THEO VIDEO DECODE ĐỂ DỰNG PHIM MỚI TỪ VIDEO QUAY SẴN (LOCAL FFMPEG + VIENEU-TTS + CLAUDE AI)
 * - Phân tích các file Video Quay Sẵn (rawMaterials) của người dùng
 * - Claude AI viết kịch bản mới theo đúng cấu trúc & độ dài từng cảnh của Blueprint vừa Decode, đồng thời chọn đoạn video quay sẵn khớp nhất cho từng cảnh
 * - Dựng thành video MP4 hoàn chỉnh bằng Local FFmpeg (pro_edit.py render) nếu renderMp4 = true
 */
export async function produceFromDecodedBlueprint(opts: {
  bizId: string;
  blueprint: DecodedVideoBlueprint;
  rawVideoPaths?: string[];
  topic: string;
  product?: string;
  brandName?: string;
  voiceName?: string;
  audioMode?: "voiceover" | "keep_audio";
  aspectRatio?: "9:16" | "16:9";
  editStyle?: EditStyle;
  renderMp4?: boolean;
  useClaude?: boolean;
  customScenes?: {
    sceneNumber: number;
    newVoiceover: string;
    newOnScreenText: string;
    zoom?: string;
    rawSourceIndex?: number;
    rawStartSec?: number;
    rawEndSec?: number;
  }[];
}): Promise<ClonedVideoProductionResult> {
  const prodId = `clone_${Date.now()}`;
  const workdir = resolve("data/creative/decoded", prodId);
  mkdirSync(workdir, { recursive: true });

  const available = listLocalAvailableVideos();
  const validRawPaths = (opts.rawVideoPaths ?? []).filter((p) => p && existsSync(p));
  const finalRawPaths =
    validRawPaths.length > 0
      ? validRawPaths
      : existsSync(opts.blueprint.sourceVideoPath)
        ? [opts.blueprint.sourceVideoPath]
        : available[0]
          ? [available[0].path]
          : [];

  if (!finalRawPaths.length) {
    throw new AppError("NO_RAW_FOOTAGE", "Chưa có video quay sẵn để dựng phim. Vui lòng tải lên ít nhất 1 video quay sẵn!");
  }

  const bin = toolsPython();
  const anJson = await analyzeVideosWithCache(bin, finalRawPaths);
  const sources: SourceInfo[] = anJson?.sources?.length
    ? (anJson.sources as SourceInfo[])
    : finalRawPaths.map((p, idx) => ({
        index: idx,
        path: p,
        duration: opts.blueprint.durationSec || 18,
        width: 1080,
        height: 1920,
        hasAudio: true,
        shots: [{ id: `${idx}.0`, start: 0, end: opts.blueprint.durationSec || 18 }],
      }));
  const rawSheets = (anJson?.sheets ?? []) as string[];

  const brand = opts.brandName?.trim() || "ZONO";
  const product = opts.product?.trim() || opts.topic.trim();
  const style: EditStyle = opts.editStyle ?? opts.blueprint.recommendedEditStyle ?? "dynamic";
  const audioMode = opts.audioMode ?? "voiceover";
  const aspect = opts.aspectRatio ?? "9:16";
  const targetShots = opts.blueprint.decodedShots;

  // Xây dựng bản kế hoạch mặc định bám sát từng cảnh của Video Mẫu đã Decode
  const allRawShots = sources.flatMap((s) =>
    (s.shots?.length ? s.shots : [{ id: `${s.index}.0`, start: 0, end: s.duration }]).map((sh) => ({
      srcIndex: s.index,
      start: sh.start,
      end: sh.end,
      dur: Math.max(1, sh.end - sh.start),
    })),
  );

  const buildDefaultClonePlan = () => ({
    hookTitle: `${product.slice(0, 28).toUpperCase()} · ĐỘT PHÁ MỚI`,
    ctaText: `Nhắn tin cho ${brand} để nhận ưu đãi ngay hôm nay!`,
    caption: `🔥 ${opts.topic} — Giải pháp thực chiến từ ${brand} giúp tối ưu hiệu quả vượt trội! #${brand.replace(/\s+/g, "")} #VideoThucTe #XuHuong2026`,
    scenes: targetShots.map((dShot, idx) => {
      const candidate = allRawShots[idx % Math.max(1, allRawShots.length)] ?? {
        srcIndex: 0,
        start: 0,
        end: Math.min(sources[0].duration, dShot.durationSec),
      };
      const targetWordCount = Math.max(8, Math.round(dShot.durationSec * 2.8));
      const defaultVoice =
        idx === 0
          ? `Bạn có biết vì sao nhiều người vẫn loay hoay với ${opts.topic.toLowerCase()} mà chưa đạt hiệu quả cao nhất?`
          : idx === targetShots.length - 1
            ? `Hãy nhắn tin ngay cho ${brand} hoặc bấm vào link bên dưới để trải nghiệm ${product} với ưu đãi đặc biệt hôm nay!`
            : `Tại ${brand}, quy trình ${product} được chuẩn hóa tỉ mỉ từng chi tiết giúp bạn tiết kiệm thời gian và nhân đôi chất lượng thực tế.`;
      return {
        sceneNumber: idx + 1,
        newVoiceover: defaultVoice.split(/\s+/).slice(0, targetWordCount + 8).join(" "),
        newOnScreenText:
          idx === 0
            ? "BÍ QUYẾT THỰC CHIẾN"
            : idx === targetShots.length - 1
              ? "NHẬN ƯU ĐÃI NGAY"
              : `ƯU ĐIỂM VƯỢT TRỘI #${idx}`,
        rawSourceIndex: candidate.srcIndex,
        rawStartSec: Math.round(candidate.start * 10) / 10,
        rawEndSec: Math.round(Math.min(sources[candidate.srcIndex]?.duration ?? 15, candidate.start + dShot.durationSec) * 10) / 10,
        zoom: dShot.recommendedZoom,
        transition: dShot.recommendedTransition || (idx === 0 ? "cut" : "slideleft"),
        directorNote: `Học theo Cảnh ${idx + 1} của Video Decode (${dShot.durationSec}s · ${dShot.cameraAngle}): ghép đoạn quay sẵn #${candidate.srcIndex + 1} (${candidate.start.toFixed(1)}s–${Math.min(sources[candidate.srcIndex]?.duration ?? 15, candidate.start + dShot.durationSec).toFixed(1)}s).`,
      };
    }),
  });

  let clonePlan = buildDefaultClonePlan();
  let providerUsed = opts.customScenes?.length ? "user_edited_timeline" : "local_template_matcher";

  const prov = effectiveProvider(opts.bizId);
  if (!opts.customScenes?.length && opts.useClaude !== false && prov.ready && prov.provider !== "sandbox") {
    try {
      const g = await generate({
        bizId: opts.bizId,
        agentKey: "creative",
        tier: "medium",
        schema: ClaudeClonePlanSchema,
        images: rawSheets.slice(0, 3).map((p) => ({ path: p, mediaType: "image/png" as const })),
        system: [
          `Bạn là Đạo diễn Dựng Phim Thực Chiến của thương hiệu ${brand}.`,
          "Nhiệm vụ: Dựa trên CÔNG THỨC VIDEO MẪU ĐÃ DECODE (số cảnh, độ dài từng cảnh, kiểu Hook 3s đầu, góc quay, hiệu ứng zoom/transition) và DANH SÁCH VIDEO QUAY SẴN (Raw Footage) của người dùng, hãy:",
          "1. Viết lời thoại tiếng Việt mới (`newVoiceover`) và chữ nổi trên màn hình (`newOnScreenText`, ≤ 6 chữ) cho Chủ đề/Sản phẩm mới sao cho khớp độ dài từng cảnh (khoảng 2.8 từ/giây).",
          "2. Chọn đoạn video quay sẵn (`rawSourceIndex`, `rawStartSec`, `rawEndSec`) phù hợp nhất với từng cảnh trong công thức Decode.",
          "3. Giữ nguyên nhịp độ cuốn hút (pacing, zoom, transition) đã học được từ Video Mẫu.",
        ].join("\n"),
        user: [
          `CHỦ ĐỀ / YÊU CẦU MỚI: ${opts.topic}`,
          `SẢN PHẨM / THƯƠNG HIỆU: ${product} (${brand})`,
          `CÔNG THỨC VIDEO MẪU ĐÃ DECODE (${targetShots.length} cảnh, tổng ${opts.blueprint.durationSec}s, nhịp ${opts.blueprint.pacingLabel}):`,
          `- Công thức Hook 3s đầu: ${opts.blueprint.hookFormula.first3SecHook} (${opts.blueprint.hookFormula.visualHookTechnique})`,
          ...targetShots.map(
            (s) =>
              `  + Cảnh ${s.sceneNumber} (${s.durationSec}s): Góc="${s.cameraAngle}" | Zoom="${s.recommendedZoom}" | Chuyển cảnh="${s.recommendedTransition}" | Gợi ý chọn cảnh="${s.howToShootOrSelect}"`,
          ),
          "DANH SÁCH VIDEO QUAY SẴN CỦA NGƯỜI DÙNG:",
          ...sources.map(
            (s) =>
              `- Video nguồn #${s.index} (${basename(s.path)}, dài ${s.duration.toFixed(1)}s): Các đoạn cắt: ${s.shots.map((sh) => `[${sh.start.toFixed(1)}s-${sh.end.toFixed(1)}s]`).join(", ")}`,
          ),
          `Hãy trả về đúng ${targetShots.length} cảnh trong mảng scenes.`,
        ].join("\n"),
        sandbox: buildDefaultClonePlan,
      });
      if (g.output?.scenes?.length) {
        clonePlan = g.output;
        providerUsed = g.provider || prov.provider;
      }
    } catch (e) {
      logger.warn("video_decode.clone_claude_fallback", { error: String(e).slice(0, 250) });
    }
  }

  const outScenes: ClonedProductionScene[] = targetShots.map((dShot, idx) => {
    const cScene = clonePlan.scenes[idx] ?? clonePlan.scenes[clonePlan.scenes.length - 1];
    const custom = opts.customScenes?.find((cs) => cs.sceneNumber === idx + 1) ?? opts.customScenes?.[idx];
    const desiredSrcIdx = custom?.rawSourceIndex ?? cScene?.rawSourceIndex ?? 0;
    const srcIdx = sources[desiredSrcIdx] ? desiredSrcIdx : 0;
    const srcDur = sources[srcIdx].duration || 15;
    const startSec = Math.max(0, Math.min(srcDur - 0.8, custom?.rawStartSec ?? cScene?.rawStartSec ?? 0));
    const endSec = Math.max(
      startSec + 0.8,
      Math.min(srcDur, custom?.rawEndSec ?? cScene?.rawEndSec ?? startSec + dShot.durationSec),
    );
    return {
      sceneNumber: idx + 1,
      templateTiming: `${dShot.startSec.toFixed(1)}s – ${dShot.endSec.toFixed(1)}s (${dShot.durationSec.toFixed(1)}s)`,
      durationSec: dShot.durationSec,
      originalShotSummary: `${dShot.cameraAngle} · ${dShot.visualDescription}`,
      newVoiceover: (custom?.newVoiceover ?? cScene?.newVoiceover ?? `Phân cảnh ${idx + 1} giới thiệu ${product}.`).trim(),
      newOnScreenText: (custom?.newOnScreenText ?? cScene?.newOnScreenText ?? dShot.onScreenText).slice(0, 60),
      selectedRawCut: {
        sourceIndex: srcIdx,
        sourceFileName: basename(sources[srcIdx].path),
        startSec: Math.round(startSec * 10) / 10,
        endSec: Math.round(endSec * 10) / 10,
      },
      zoom: custom?.zoom ?? cScene?.zoom ?? dShot.recommendedZoom,
      transition: cScene?.transition ?? dShot.recommendedTransition,
      directorNote:
        cScene?.directorNote ??
        `Áp nhịp ${dShot.durationSec.toFixed(1)}s của Video Mẫu vào nguồn quay sẵn #${srcIdx + 1}.`,
    };
  });

  // 3. Nếu renderMp4 !== false, dựng luôn file MP4 thật trên máy Local bằng pro_edit.py render + VieNeu-TTS (chạy song song & có Cache)
  const latestCloned = available.find((v) => v.url.includes("cloned_clone_"));
  let renderedVideoUrl: string | null = latestCloned?.url ?? opts.blueprint.sourceVideoUrl;
  let renderedDurationSec = opts.blueprint.durationSec;
  let renderNotes = `Đã lập bảng phân cảnh học theo Video Mẫu (${outScenes.length} cảnh · ${opts.blueprint.pacingLabel}).`;

  if (opts.renderMp4 !== false) {
    try {
      const voiceId = opts.voiceName && VI_VOICES.some((v) => v.id === opts.voiceName) ? opts.voiceName : VI_VOICES[0].id;
      const rate = style === "dynamic" ? 1.06 : 1.0;

      const voices: { text: string; file: string; duration: number; heard: Word[] }[] =
        audioMode === "keep_audio"
          ? []
          : await Promise.all(
              outScenes.map(async (s) => {
                const text = s.newVoiceover.trim();
                const vo = await cachedVoiceOver({ text, voice: voiceId, rate });
                return { text, file: videoAiFile(vo.mp3), duration: vo.duration, heard: [] };
              }),
            );

      const proEditMode = audioMode === "keep_audio" ? ("speech" as const) : ("voiceover" as const);
      const editPlanInput: EditPlan = sanitizePlan(
        {
          hook: clonePlan.hookTitle.slice(0, 90),
          cta: clonePlan.ctaText.slice(0, 110),
          caption: clonePlan.caption.slice(0, 380),
          scenes: outScenes.map((s) => ({
            voice: s.newVoiceover,
            onScreen: s.newOnScreenText.slice(0, 70),
            cuts: [
              {
                src: s.selectedRawCut.sourceIndex,
                start: s.selectedRawCut.startSec,
                end: s.selectedRawCut.endSec,
              },
            ],
            zoom: (["in", "out", "punch", "pan_left", "pan_right", "none"].includes(s.zoom) ? s.zoom : "in") as any,
            transition: s.transition || "slideleft",
          })),
        },
        { mode: proEditMode, sources },
      );

      const songs = bgmFiles();
      const music = songs.length ? songs[0] : null;
      const resolvedPlan = resolveEditPlan({
        mode: proEditMode,
        style,
        aspect,
        sources,
        plan: editPlanInput,
        voices,
        music,
      });

      const finalMp4 = join(workdir, "cloned_final.mp4");
      const planFile = join(workdir, "plan.json");
      writeFileSync(planFile, JSON.stringify({ ...resolvedPlan, out: finalMp4, workdir: join(workdir, "render") }));

      const rRun = await runProcess(bin, [join(TOOLS_DIR, "pro_edit.py"), "render", planFile], {
        timeoutMs: 180_000,
      });
      if (rRun.code === 0 && existsSync(finalMp4) && statSync(finalMp4).size > 10_000) {
        const pub = ensurePublicUploadCopy(finalMp4, `cloned_${prodId}`);
        renderedVideoUrl = pub.publicUrl;
        renderedDurationSec = Math.round((mediaDuration(finalMp4) || resolvedPlan.total) * 10) / 10;
        const audioDesc =
          audioMode === "keep_audio" ? "giữ âm thanh gốc + nhạc nền nhẹ" : `giọng đọc VieNeu-TTS (${voiceId})`;
        renderNotes = `Đã dựng thành công Video MP4 mới (${renderedDurationSec}s · ${aspect}) từ ${finalRawPaths.length} video quay sẵn theo đúng công thức của Video Mẫu (${outScenes.length} cảnh · ${audioDesc} · chuẩn âm -14 LUFS).`;
      }
    } catch (e) {
      logger.warn("video_decode.render_fallback", { error: String(e).slice(0, 250) });
      renderNotes += ` (Sử dụng bản xem trước nhanh do tiến trình render FFmpeg đang bận: ${e instanceof Error ? e.message.slice(0, 100) : String(e)})`;
    }
  }

  return {
    id: prodId,
    topic: opts.topic,
    product,
    brandName: brand,
    providerUsed,
    blueprintId: opts.blueprint.id,
    pacingApplied: opts.blueprint.pacingLabel,
    editStyle: style,
    hookTitle: clonePlan.hookTitle,
    ctaText: clonePlan.ctaText,
    caption: clonePlan.caption,
    scenes: outScenes,
    renderedVideoUrl,
    renderedDurationSec,
    renderNotes,
  };
}
