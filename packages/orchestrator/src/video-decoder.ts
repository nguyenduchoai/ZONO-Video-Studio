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

export type TextPosition = "top" | "center" | "bottom" | "hidden";
export type TextTheme = "gold" | "yellow_full" | "emerald" | "coral" | "cyan" | "violet";
export type CaptionBgStyle = "solid_dark" | "translucent" | "brand_box" | "none";

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
  captionPosition: TextPosition;
  headlinePosition: TextPosition;
  textTheme: TextTheme;
  captionBgStyle: CaptionBgStyle;
  thumbnailTitle: string;
  thumbnailSvgDataUrl: string;
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

/** Tìm danh sách các file video MP4 gốc của người dùng trong data/uploads để chọn Decode hoặc làm Raw Footage */
export function listLocalAvailableVideos(): { path: string; url: string; name: string; sizeMB: number; updatedAt: string }[] {
  const userVideos: { path: string; url: string; name: string; sizeMB: number; updatedAt: string }[] = [];
  const generatedVideos: { path: string; url: string; name: string; sizeMB: number; updatedAt: string }[] = [];
  const uploadsDir = resolve("data/uploads");
  if (existsSync(uploadsDir)) {
    for (const f of readdirSync(uploadsDir)) {
      if (!/\.(mp4|mov|m4v|webm)$/i.test(f)) continue;
      if (/^(sample_|ref_)/i.test(f)) continue;
      const full = join(uploadsDir, f);
      try {
        const st = statSync(full);
        if (st.size > 10_000) {
          const isCloned = /^cloned_/i.test(f);
          const cleanLabel = f.replace(/^[0-9a-f]{12}_/i, "");
          const entry = {
            path: full,
            url: `/v1/uploads/${encodeURIComponent(f)}`,
            name: isCloned ? `Phim đã dựng · ${cleanLabel}` : cleanLabel,
            sizeMB: Math.round((st.size / 1048576) * 10) / 10,
            updatedAt: st.mtime.toISOString(),
          };
          if (isCloned) generatedVideos.push(entry);
          else userVideos.push(entry);
        }
      } catch {
        // ignore
      }
    }
  }

  userVideos.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  generatedVideos.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return [...userVideos, ...generatedVideos.slice(0, 2)].slice(0, 10);
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
  preferredProvider?: "claude_cli" | "gemini_cli" | "codex_cli";
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

  // 2. Luôn bóc lời thoại bằng Faster-Whisper Local (đã có Cache SHA1 theo file nên chạy lại mất 0ms)
  let words: Word[] = [];
  if (srcInfo.hasAudio) {
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
      ? "Nhịp Nhanh Dồn Dập (Fast-Cut TikTok/Reels)"
      : avgShotSec <= 4.8
        ? "Nhịp Vừa Chuẩn Thương Mại (Balanced Storytelling)"
        : "Nhịp Chậm Điện Ảnh (Cinematic Pacing)";

  const recommendedEditStyle: EditStyle =
    avgShotSec <= 2.8 ? "dynamic" : avgShotSec <= 4.8 ? "clean" : "smooth";

  // 3. Khớp lời thoại thực tế theo từng phân cảnh (shot) bằng tâm điểm thời gian của từng từ để không bị lặp từ ở ranh giới 2 cảnh
  const shotTranscripts = rawShots.map((sh, idx) => {
    const isLast = idx === rawShots.length - 1;
    const ws = words.filter((w) => {
      const mid = (w.s + w.e) / 2;
      return mid >= sh.start && (isLast ? mid <= sh.end + 0.5 : mid < sh.end);
    });
    if (ws.length > 0) return ws.map((w) => w.w).join(" ");
    if (idx === 0) return "Mở đầu gây chú ý trong 3 giây đầu";
    if (isLast) return "Tổng kết thông điệp & lời kêu gọi hành động";
    return `Triển khai nội dung phân cảnh ${idx + 1}`;
  });

  const zoomCycle: DecodedShot["recommendedZoom"][] = ["punch", "in", "pan_right", "out", "pan_left", "in"];
  const transCycle = ["slideleft", "zoomin", "dissolve", "wipeleft", "fade"];
  const angleCycle = [
    "Góc cận trực diện",
    "Góc rộng bối cảnh",
    "Góc cận chi tiết",
    "Góc nghiêng thực tế",
    "Góc chính diện chốt ý",
  ];

  const buildDefaultDecode = () => ({
    hookFormula: {
      first3SecHook: shotTranscripts[0] || "Mở đầu bằng tình huống thực tế đánh trúng mối quan tâm của người xem ngay 3 giây đầu",
      visualHookTechnique: `Cảnh mở đầu dài ${rawShots[0] ? (rawShots[0].end - rawShots[0].start).toFixed(1) : "3.0"}s kết hợp tiêu đề nổi bật và chuyển động thu phóng nhẹ`,
      onScreenHookTitle: "ĐIỂM NHẤN QUAN TRỌNG NHẤT",
    },
    narrativeArc: [
      `1. Mở đầu (${(rawShots[0]?.end ?? 3.5).toFixed(1)}s đầu): "${shotTranscripts[0]}"`,
      `2. Triển khai vấn đề: Đặt ra góc nhìn thực tế từ câu chuyện trong video.`,
      `3. Minh chứng & Giải pháp: Đưa dẫn chứng trực quan qua các cảnh giữa.`,
      `4. Kết bài & Tương tác: "${shotTranscripts[shotTranscripts.length - 1]}"`,
    ],
    editingRhythmNotes: `Video gồm ${shotCount} phân cảnh trên tổng thời lượng ${durationSec}s (trung bình ${avgShotSec}s/cảnh, tốc độ đọc ${wordsPerMinute} từ/phút).`,
    reusablePromptTemplate: `Viết kịch bản ${shotCount} phân cảnh (tổng ${durationSec}s, mỗi cảnh ~${avgShotSec}s) bám sát nhịp dẫn chuyện của video mẫu.`,
    shots: rawShots.map((sh, idx) => ({
      sceneNumber: idx + 1,
      visualDescription:
        idx === 0
          ? "Mở bài đặt vấn đề trực diện, thu hút sự chú ý của người xem"
          : idx === rawShots.length - 1
            ? "Tổng kết thông điệp cốt lõi và đặt câu hỏi gợi mở tương tác"
            : `Triển khai ý thứ ${idx + 1} làm rõ luận điểm của câu chuyện`,
      cameraAngle: angleCycle[idx % angleCycle.length],
      recommendedZoom: zoomCycle[idx % zoomCycle.length],
      recommendedTransition: idx === 0 ? "cut" : transCycle[idx % transCycle.length],
      onScreenText:
        idx === 0
          ? "GÓC NHÌN THỰC TẾ"
          : idx === rawShots.length - 1
            ? "BẠN NGHĨ SAO?"
            : `ĐIỂM CHÍNH #${idx}`,
      howToShootOrSelect:
        idx === 0
          ? `Chọn cảnh mở đầu rõ nét nhất dài ~${(sh.end - sh.start).toFixed(1)}s`
          : idx === rawShots.length - 1
            ? `Chọn cảnh tổng kết / thành phẩm dài ~${(sh.end - sh.start).toFixed(1)}s`
            : `Chọn cảnh minh họa thao tác hoặc sản phẩm thực tế dài ~${(sh.end - sh.start).toFixed(1)}s`,
    })),
  });

  let claudeOut = buildDefaultDecode();
  const targetProvider = opts.preferredProvider ?? effectiveProvider(opts.bizId).provider;
  let decodedByProvider = "faster_whisper_local";

  if (opts.useClaude !== false && targetProvider !== "sandbox") {
    const cacheRoot = resolve("data/creative/decoded/_cache");
    mkdirSync(cacheRoot, { recursive: true });
    const aiDecodeCacheKey = createHash("sha1")
      .update(`v2|${fileSignature(resolvedPath)}|${targetProvider}|${shotCount}|${(opts.referenceNotes ?? "").trim()}`)
      .digest("hex")
      .slice(0, 18);
    const aiDecodeCacheFile = join(cacheRoot, `ai_decode_${aiDecodeCacheKey}.json`);
    let loadedFromCache = false;
    if (existsSync(aiDecodeCacheFile)) {
      try {
        const cached = JSON.parse(readFileSync(aiDecodeCacheFile, "utf8"));
        if (cached?.output?.shots?.length === rawShots.length) {
          claudeOut = cached.output;
          decodedByProvider = cached.provider || targetProvider;
          loadedFromCache = true;
        }
      } catch {
        // recompute
      }
    }
    if (!loadedFromCache) {
      try {
        const g = await generate({
          bizId: opts.bizId,
          agentKey: "creative",
          tier: "small",
          preferredProvider: opts.preferredProvider ?? "claude_cli",
          fast: true,
          schema: ClaudeDecodeSchema,
          system: [
            "Bạn là Đạo diễn Phân tích Kịch bản Video Ngắn của ZONO Studio.",
            "Dựa trên lời thoại thực tế bóc băng (Whisper) của từng phân cảnh, hãy tóm tắt ngắn gọn ý chính của từng cảnh, công thức Hook 3s đầu và gợi ý chọn cảnh quay sẵn tương ứng.",
            "TUYỆT ĐỐI KHÔNG viết thông số ống kính máy ảnh dài dòng vào visualDescription; hãy viết ngắn gọn ý nghĩa nội dung của cảnh đó bằng tiếng Việt tự nhiên.",
          ].join("\n"),
          user: [
            `Thông số Video Mẫu: Thời lượng ${durationSec}s, ${shotCount} phân cảnh (trung bình ${avgShotSec}s/cảnh).`,
            opts.referenceNotes ? `Chủ đề người dùng muốn làm: ${opts.referenceNotes}` : "",
            fullTranscript ? `Toàn bộ lời thoại thực tế trong Video Mẫu: "${fullTranscript}"` : "",
            "Lời thoại theo từng cảnh:",
            ...rawShots.map((sh, i) => `- Cảnh ${i + 1} (${sh.start.toFixed(1)}s -> ${sh.end.toFixed(1)}s, dài ${(sh.end - sh.start).toFixed(1)}s): "${shotTranscripts[i]}"`),
            `Hãy trả về đúng ${rawShots.length} phần tử trong mảng shots.`,
          ]
            .filter(Boolean)
            .join("\n"),
          sandbox: buildDefaultDecode,
        });
        if (g.output?.shots?.length) {
          claudeOut = g.output;
          decodedByProvider = g.provider || targetProvider;
          writeFileSync(aiDecodeCacheFile, JSON.stringify({ provider: decodedByProvider, output: claudeOut }));
        }
      } catch (e) {
        logger.warn("video_decode.claude_fallback", { error: String(e).slice(0, 250) });
      }
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
function buildThumbnailSvgDataUrl(opts: {
  title: string;
  subtitle: string;
  brand: string;
  textTheme: TextTheme;
  aspectRatio: "9:16" | "16:9";
}): string {
  const w = opts.aspectRatio === "16:9" ? 960 : 540;
  const h = opts.aspectRatio === "16:9" ? 540 : 960;
  const themeMap: Record<TextTheme, { accent: string; glow: string; badgeBg: string; badgeText: string }> = {
    gold: { accent: "#FFD43B", glow: "#D97706", badgeBg: "#FFD43B", badgeText: "#111827" },
    yellow_full: { accent: "#FACC15", glow: "#CA8A04", badgeBg: "#FACC15", badgeText: "#111827" },
    emerald: { accent: "#34D399", glow: "#059669", badgeBg: "#10B981", badgeText: "#FFFFFF" },
    coral: { accent: "#FB7185", glow: "#E11D48", badgeBg: "#F43F5E", badgeText: "#FFFFFF" },
    cyan: { accent: "#38BDF8", glow: "#0284C7", badgeBg: "#0EA5E9", badgeText: "#FFFFFF" },
    violet: { accent: "#C084FC", glow: "#7C3AED", badgeBg: "#8B5CF6", badgeText: "#FFFFFF" },
  };
  const th = themeMap[opts.textTheme] ?? themeMap.gold;
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const words = (opts.title || "VIDEO MỚI").toUpperCase().split(/\s+/).filter(Boolean);
  const mid = Math.ceil(words.length / 2);
  const line1 = esc(words.slice(0, mid).join(" ").slice(0, 26));
  const line2 = esc(words.slice(mid).join(" ").slice(0, 26));
  const sub = esc((opts.subtitle || opts.brand).slice(0, 44));
  const brand = esc((opts.brand || "ZONO").toUpperCase().slice(0, 20));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="55%" stop-color="#1e1b4b"/>
        <stop offset="100%" stop-color="#090d16"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="42%" r="55%">
        <stop offset="0%" stop-color="${th.glow}" stop-opacity="0.42"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <rect width="100%" height="100%" fill="url(#glow)"/>
    <rect x="${Math.round(w * 0.08)}" y="${Math.round(h * 0.12)}" rx="14" ry="14" width="${Math.min(w * 0.5, brand.length * 16 + 44)}" height="42" fill="${th.badgeBg}"/>
    <text x="${Math.round(w * 0.08 + 22)}" y="${Math.round(h * 0.12 + 28)}" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="800" fill="${th.badgeText}">${brand}</text>
    <rect x="${Math.round(w * 0.06)}" y="${Math.round(h * 0.34)}" rx="24" ry="24" width="${Math.round(w * 0.88)}" height="${line2 ? 210 : 145}" fill="rgba(10,12,20,0.82)" stroke="${th.accent}" stroke-width="3"/>
    <text x="50%" y="${Math.round(h * 0.34 + 72)}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="40" font-weight="900" fill="${th.accent}">${line1}</text>
    ${line2 ? `<text x="50%" y="${Math.round(h * 0.34 + 132)}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="40" font-weight="900" fill="#FFFFFF">${line2}</text>` : ""}
    <text x="50%" y="${Math.round(h * 0.34 + (line2 ? 182 : 118))}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="21" font-weight="600" fill="#E2E8F0">${sub}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

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
  captionPosition?: TextPosition;
  headlinePosition?: TextPosition;
  textTheme?: TextTheme;
  captionBgStyle?: CaptionBgStyle;
  thumbnailTitle?: string;
  customHookTitle?: string;
  customCtaText?: string;
  customCaption?: string;
  renderMp4?: boolean;
  useClaude?: boolean;
  preferredProvider?: "claude_cli" | "gemini_cli" | "codex_cli";
  customScenes?: {
    sceneNumber: number;
    newVoiceover: string;
    newOnScreenText: string;
    zoom?: string;
    transition?: string;
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
      const fallbackNarratives = [
        `Bạn có biết vì sao nhiều người vẫn loay hoay với ${opts.topic.toLowerCase()} mà chưa đạt hiệu quả cao nhất?`,
        `Tại ${brand}, quy trình tuyển chọn ${product} được kiểm soát tỉ mỉ từng bước để giữ trọn giá trị nguyên bản.`,
        `Từng chi tiết thực tế đều cho thấy sự khác biệt rõ rệt về độ tinh khiết và trải nghiệm sử dụng mỗi ngày.`,
        `Không chỉ tiết kiệm thời gian, giải pháp từ ${brand} còn mang lại sự an tâm tuyệt đối cho cả gia đình bạn.`,
        `Hàng ngàn khách hàng đã trực tiếp kiểm chứng và hài lòng ngay từ lần đầu tiên trải nghiệm thực tế.`,
        `Hãy nhắn tin ngay cho ${brand} hoặc bấm vào bên dưới để nhận tư vấn và ưu đãi đặc biệt hôm nay!`,
      ];
      const defaultVoice =
        idx === targetShots.length - 1
          ? fallbackNarratives[fallbackNarratives.length - 1]
          : fallbackNarratives[idx % (fallbackNarratives.length - 1)];
      return {
        sceneNumber: idx + 1,
        newVoiceover: defaultVoice,
        newOnScreenText:
          idx === 0
            ? "BÍ QUYẾT THỰC CHIẾN"
            : idx === targetShots.length - 1
              ? "NHẬN ƯU ĐÃI NGAY"
              : `ĐIỂM ĐẮT GIÁ #${idx}`,
        rawSourceIndex: candidate.srcIndex,
        rawStartSec: Math.round(candidate.start * 10) / 10,
        rawEndSec: Math.round(Math.min(sources[candidate.srcIndex]?.duration ?? 15, candidate.start + dShot.durationSec) * 10) / 10,
        zoom: dShot.recommendedZoom,
        transition: dShot.recommendedTransition || (idx === 0 ? "cut" : "slideleft"),
        directorNote: dShot.spokenText
          ? `Học nhịp Cảnh ${idx + 1} (${dShot.durationSec}s · lời gốc: "${dShot.spokenText.slice(0, 65)}..."): ghép đoạn quay sẵn #${candidate.srcIndex + 1}.`
          : `Học theo Cảnh ${idx + 1} của Video Decode (${dShot.durationSec}s): ghép đoạn quay sẵn #${candidate.srcIndex + 1}.`,
      };
    }),
  });

  let clonePlan = buildDefaultClonePlan();
  let providerUsed = opts.customScenes?.length ? "user_edited_timeline" : "local_template_matcher";

  const prov = effectiveProvider(opts.bizId);
  const targetCloneProvider = opts.preferredProvider ?? prov.provider;
  if (!opts.customScenes?.length && opts.useClaude !== false && (opts.preferredProvider || (prov.ready && prov.provider !== "sandbox"))) {
    const cacheRoot = resolve("data/creative/decoded/_cache");
    mkdirSync(cacheRoot, { recursive: true });
    const aiCloneCacheKey = createHash("sha1")
      .update(
        `v2|${fileSignature(opts.blueprint.sourceVideoPath)}|${targetCloneProvider}|${targetShots.length}|${opts.topic.trim()}|${product}|${finalRawPaths.map(fileSignature).join(",")}`,
      )
      .digest("hex")
      .slice(0, 18);
    const aiCloneCacheFile = join(cacheRoot, `ai_clone_${aiCloneCacheKey}.json`);
    let loadedFromCache = false;
    if (existsSync(aiCloneCacheFile)) {
      try {
        const cached = JSON.parse(readFileSync(aiCloneCacheFile, "utf8"));
        if (cached?.output?.scenes?.length === targetShots.length) {
          clonePlan = cached.output;
          providerUsed = cached.provider || targetCloneProvider;
          loadedFromCache = true;
        }
      } catch {
        // recompute
      }
    }
    if (!loadedFromCache) {
      try {
        const g = await generate({
          bizId: opts.bizId,
          agentKey: "creative",
          preferredProvider: opts.preferredProvider ?? "claude_cli",
          fast: true,
          tier: "medium",
          schema: ClaudeClonePlanSchema,
          system: [
            `Bạn là Đạo diễn Kịch Bản & Dựng Phim Thực Chiến của thương hiệu ${brand}.`,
            "Nhiệm vụ: Dựa trên NỘI DUNG LỜI THOẠI GỐC & NHỊP CẮT của Video Mẫu đã Decode và DANH SÁCH VIDEO QUAY SẴN (Raw Footage) của người dùng, hãy:",
            "1. Học cách dẫn dắt câu chuyện của Video Mẫu để viết lời thoại tiếng Việt mới (`newVoiceover`) thật tự nhiên, cuốn hút, mỗi cảnh 1 ý nối tiếp nhau (TUYỆT ĐỐI KHÔNG lặp lại cùng một câu ở các cảnh và KHÔNG đọc thuật ngữ kỹ thuật góc máy) cho Chủ đề/Sản phẩm mới.",
            "2. Viết chữ nổi trên màn hình (`newOnScreenText`, ≤ 6 chữ) súc tích cho từng cảnh.",
            "3. Chọn đoạn video quay sẵn (`rawSourceIndex`, `rawStartSec`, `rawEndSec`) phù hợp nhất với từng cảnh.",
          ].join("\n"),
          user: [
            `CHỦ ĐỀ / YÊU CẦU MỚI: ${opts.topic}`,
            `SẢN PHẨM / THƯƠNG HIỆU: ${product} (${brand})`,
            `BẢN GHI LỜI THOẠI GỐC TRONG VIDEO MẪU: "${opts.blueprint.fullTranscript || "Không có lời thoại"}"`,
            `CẤU TRÚC TỪNG CẢNH CỦA VIDEO MẪU (${targetShots.length} cảnh, tổng ${opts.blueprint.durationSec}s, nhịp ${opts.blueprint.pacingLabel}):`,
            `- Mở bài 3s đầu của Video Mẫu: ${opts.blueprint.hookFormula.first3SecHook}`,
            ...targetShots.map(
              (s) =>
                `  + Cảnh ${s.sceneNumber} (${s.durationSec}s): Lời gốc trong mẫu="${s.spokenText || ""}" | Ý chính="${s.visualDescription}" | Zoom="${s.recommendedZoom}"`,
            ),
            "DANH SÁCH VIDEO QUAY SẴN CỦA NGƯỜI DÙNG:",
            ...sources.map(
              (s) =>
                `- Video nguồn #${s.index} (${basename(s.path)}, dài ${s.duration.toFixed(1)}s): Các đoạn cắt: ${s.shots.map((sh) => `[${sh.start.toFixed(1)}s-${sh.end.toFixed(1)}s]`).join(", ")}`,
            ),
            `Hãy trả về đúng ${targetShots.length} cảnh trong mảng scenes, mỗi cảnh có lời thoại (newVoiceover) riêng biệt nối tiếp nhau thành kịch bản hoàn chỉnh.`,
          ].join("\n"),
          sandbox: buildDefaultClonePlan,
        });
        if (g.output?.scenes?.length) {
          clonePlan = g.output;
          providerUsed = g.provider || opts.preferredProvider || prov.provider;
          writeFileSync(aiCloneCacheFile, JSON.stringify({ provider: providerUsed, output: clonePlan }));
        }
      } catch (e) {
        logger.warn("video_decode.clone_claude_fallback", { error: String(e).slice(0, 250) });
      }
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
      originalShotSummary: dShot.spokenText
        ? `🎙️ Lời gốc: "${dShot.spokenText}"`
        : `${dShot.visualDescription}`,
      newVoiceover: (custom?.newVoiceover ?? cScene?.newVoiceover ?? `Phân cảnh ${idx + 1} giới thiệu ${product}.`).trim(),
      newOnScreenText: (custom?.newOnScreenText ?? cScene?.newOnScreenText ?? dShot.onScreenText).slice(0, 60),
      selectedRawCut: {
        sourceIndex: srcIdx,
        sourceFileName: basename(sources[srcIdx].path),
        startSec: Math.round(startSec * 10) / 10,
        endSec: Math.round(endSec * 10) / 10,
      },
      zoom: custom?.zoom ?? cScene?.zoom ?? dShot.recommendedZoom,
      transition: custom?.transition ?? cScene?.transition ?? dShot.recommendedTransition,
      directorNote:
        cScene?.directorNote ??
        `Áp nhịp ${dShot.durationSec.toFixed(1)}s của Video Mẫu vào nguồn quay sẵn #${srcIdx + 1}.`,
    };
  });

  const finalHookTitle = (opts.customHookTitle ?? clonePlan.hookTitle).trim();
  const finalCtaText = (opts.customCtaText ?? clonePlan.ctaText).trim();
  const finalCaption = (opts.customCaption ?? clonePlan.caption).trim();

  const captionPos: TextPosition = opts.captionPosition ?? "bottom";
  const headlinePos: TextPosition = opts.headlinePosition ?? "top";
  const textTheme: TextTheme = opts.textTheme ?? "gold";
  const captionBgStyle: CaptionBgStyle = opts.captionBgStyle ?? "solid_dark";
  const thumbnailTitle = (opts.thumbnailTitle?.trim() || finalHookTitle || product).slice(0, 60);
  const thumbnailSvgDataUrl = buildThumbnailSvgDataUrl({
    title: thumbnailTitle,
    subtitle: `${product} · ${brand}`,
    brand,
    textTheme,
    aspectRatio: aspect,
  });
  const captionYMap: Record<TextPosition, number> = {
    top: 0.22,
    center: 0.52,
    bottom: 0.77,
    hidden: 0.77,
  };
  const headlineYMap: Record<TextPosition, number> = {
    top: 0.27,
    center: 0.48,
    bottom: 0.68,
    hidden: 0.27,
  };
  const captionY = captionYMap[captionPos] ?? 0.77;
  const headlineY = headlineYMap[headlinePos] ?? 0.27;
  const hideCaptions = captionPos === "hidden";
  const hideHeadlines = headlinePos === "hidden";

  // 3. Nếu renderMp4 !== false, dựng luôn file MP4 thật trên máy Local bằng pro_edit.py render + VieNeu-TTS (chạy song song & có Cache theo nội dung kịch bản)
  const voiceId = opts.voiceName && VI_VOICES.some((v) => v.id === opts.voiceName) ? opts.voiceName : VI_VOICES[0].id;
  const renderCacheSig = createHash("sha1")
    .update(
      JSON.stringify({
        v: 5,
        raw: finalRawPaths.map(fileSignature),
        voiceId,
        audioMode,
        style,
        aspect,
        captionPos,
        headlinePos,
        textTheme,
        captionBgStyle,
        hook: finalHookTitle,
        cta: finalCtaText,
        scenes: outScenes.map((s) => [s.newVoiceover, s.newOnScreenText, s.selectedRawCut, s.zoom, s.transition]),
      }),
    )
    .digest("hex")
    .slice(0, 14);
  const cachedMp4Name = `cloned_v3_${renderCacheSig}.mp4`;
  const cachedMp4Path = resolve("data/uploads", cachedMp4Name);

  let renderedVideoUrl: string | null = existsSync(cachedMp4Path)
    ? `/v1/uploads/${cachedMp4Name}`
    : opts.blueprint.sourceVideoUrl;
  let renderedDurationSec = existsSync(cachedMp4Path)
    ? Math.round((mediaDuration(cachedMp4Path) || opts.blueprint.durationSec) * 10) / 10
    : opts.blueprint.durationSec;
  const audioDescLabel =
    audioMode === "keep_audio" ? "giữ âm thanh gốc + nhạc nền nhẹ" : `lồng tiếng mới VieNeu-TTS (${voiceId}) · đã tắt tiếng gốc`;
  let renderNotes = `Đã dựng Video MP4 mới (${renderedDurationSec}s · ${aspect}) theo đúng ${outScenes.length} cảnh của Video Mẫu (${audioDescLabel}).`;

  if (opts.renderMp4 !== false && !existsSync(cachedMp4Path)) {
    try {
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
          hook: finalHookTitle.slice(0, 90),
          cta: finalCtaText.slice(0, 110),
          caption: finalCaption.slice(0, 380),
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
      writeFileSync(
        planFile,
        JSON.stringify({
          ...resolvedPlan,
          captionY,
          headlineY,
          hideCaptions,
          hideHeadlines,
          textTheme,
          captionBgStyle,
          coverBottomSubtitles: audioMode === "voiceover",
          out: finalMp4,
          workdir: join(workdir, "render"),
        }),
      );

      const rRun = await runProcess(bin, [join(TOOLS_DIR, "pro_edit.py"), "render", planFile], {
        timeoutMs: 900_000, // dựng ~80s video 9:16 mất vài phút trên máy thường — 3 phút là quá ngắn
      });
      if (!(rRun.code === 0 && existsSync(finalMp4) && statSync(finalMp4).size > 10_000)) {
        // Không được trả video mẫu gốc như thể đã dựng xong.
        renderedVideoUrl = null;
        renderNotes = `Dựng MP4 chưa thành công (mã ${rRun.code ?? "timeout"}) — bấm Build lại; video mẫu gốc KHÔNG phải kết quả.`;
        logger.warn("video_decode.render_failed", { code: rRun.code, err: String((rRun as any).stderr ?? "").slice(-300) });
      }
      if (rRun.code === 0 && existsSync(finalMp4) && statSync(finalMp4).size > 10_000) {
        copyFileSync(finalMp4, cachedMp4Path);
        renderedVideoUrl = `/v1/uploads/${cachedMp4Name}`;
        renderedDurationSec = Math.round((mediaDuration(cachedMp4Path) || resolvedPlan.total) * 10) / 10;
        renderNotes = `Đã dựng thành công Video MP4 mới (${renderedDurationSec}s · ${aspect}) từ ${finalRawPaths.length} video quay sẵn theo đúng công thức của Video Mẫu (${outScenes.length} cảnh · ${audioDescLabel} · màu chữ: ${textTheme} · nền chữ: ${captionBgStyle} · vị trí chữ: ${captionPos} · chuẩn âm -14 LUFS).`;
      }
    } catch (e) {
      logger.warn("video_decode.render_fallback", { error: String(e).slice(0, 250) });
      renderedVideoUrl = null;
      renderNotes = `Dựng MP4 lỗi: ${e instanceof Error ? e.message.slice(0, 160) : String(e)} — bấm Build lại.`;
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
    captionPosition: captionPos,
    headlinePosition: headlinePos,
    textTheme,
    captionBgStyle,
    thumbnailTitle,
    thumbnailSvgDataUrl,
    hookTitle: finalHookTitle,
    ctaText: finalCtaText,
    caption: finalCaption,
    scenes: outScenes,
    renderedVideoUrl,
    renderedDurationSec,
    renderNotes,
  };
}

const ChatEditVideoSchema = z.object({
  reply: z.string(),
  changesSummary: z.array(z.string()).min(1).max(6),
  captionPosition: z.enum(["top", "center", "bottom", "hidden"]),
  headlinePosition: z.enum(["top", "center", "bottom", "hidden"]),
  textTheme: z.enum(["gold", "yellow_full", "emerald", "coral", "cyan", "violet"]),
  captionBgStyle: z.enum(["solid_dark", "translucent", "brand_box", "none"]),
  thumbnailTitle: z.string(),
  editStyle: z.enum(["dynamic", "smooth", "clean"]),
  hookTitle: z.string(),
  ctaText: z.string(),
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
    }),
  ),
});

/**
 * BƯỚC 3: KHUNG CHAT ĐẠO DIỄN AI — Thay đổi Kịch Bản/Lời Thoại, Màu Chữ, Nền Chữ, Vị Trí Đặt Chữ, Thumbnail & Cách Cắt bằng hội thoại tự nhiên
 */
export async function chatEditVideoProduction(opts: {
  bizId: string;
  message: string;
  blueprint: DecodedVideoBlueprint;
  currentProduction: ClonedVideoProductionResult;
  rawVideoPaths?: string[];
  voiceName?: string;
  audioMode?: "voiceover" | "keep_audio";
  aspectRatio?: "9:16" | "16:9";
  preferredProvider?: "claude_cli" | "gemini_cli" | "codex_cli";
}): Promise<{
  reply: string;
  changesSummary: string[];
  providerUsed: string;
  production: ClonedVideoProductionResult;
}> {
  const msg = opts.message.trim();
  const msgLower = msg.toLowerCase();
  const cur = opts.currentProduction;

  // 1. Xây dựng phương án chỉnh sửa thông minh (Deterministic Fallback + Tiền xử lý ý định của người dùng)
  const buildDeterministicEdit = () => {
    let nextCaptionPos: TextPosition = cur.captionPosition ?? "bottom";
    let nextHeadlinePos: TextPosition = cur.headlinePosition ?? "top";
    let nextTextTheme: TextTheme = cur.textTheme ?? "gold";
    let nextCaptionBgStyle: CaptionBgStyle = cur.captionBgStyle ?? "solid_dark";
    let nextThumbnailTitle: string = cur.thumbnailTitle ?? cur.hookTitle ?? cur.product;
    let nextStyle: EditStyle = cur.editStyle ?? "dynamic";
    let nextHook = cur.hookTitle;
    let nextCta = cur.ctaText;
    const changes: string[] = [];

    // Nhận diện yêu cầu đổi màu chữ
    if (/(màu xanh lá|xanh ngọc|emerald)/i.test(msgLower)) {
      nextTextTheme = "emerald";
      changes.push("Đã đổi màu chữ sang Xanh Ngọc Lục Bảo (Emerald).");
    } else if (/(màu đỏ|đỏ cam|cam đỏ|coral|hồng)/i.test(msgLower)) {
      nextTextTheme = "coral";
      changes.push("Đã đổi màu chữ sang Đỏ Cam Nổi Bật (Coral).");
    } else if (/(xanh dương|xanh biển|cyan)/i.test(msgLower)) {
      nextTextTheme = "cyan";
      changes.push("Đã đổi màu chữ sang Xanh Dương Sáng (Cyan).");
    } else if (/(màu tím|tím neon|violet)/i.test(msgLower)) {
      nextTextTheme = "violet";
      changes.push("Đã đổi màu chữ sang Tím Neon Hiện Đại (Violet).");
    } else if (/(vàng rực|full vàng|toàn bộ vàng)/i.test(msgLower)) {
      nextTextTheme = "yellow_full";
      changes.push("Đã đổi màu chữ sang Vàng Rực Toàn Bộ (Yellow Full).");
    } else if (/(màu vàng|vàng kim|gold)/i.test(msgLower)) {
      nextTextTheme = "gold";
      changes.push("Đã đổi màu chữ sang Vàng Kim Sang Trọng (Gold).");
    }

    // Nhận diện yêu cầu đổi nền chữ
    if (/(không nền|bỏ nền chữ|tắt nền chữ|chữ không nền|trong suốt hoàn toàn)/i.test(msgLower)) {
      nextCaptionBgStyle = "none";
      changes.push("Đã bỏ hộp nền chữ (chỉ giữ chữ có viền đen sắc nét).");
    } else if (/(nền mờ|nền trong suốt|hộp mờ)/i.test(msgLower)) {
      nextCaptionBgStyle = "translucent";
      changes.push("Đã đổi nền chữ sang Hộp Mờ Trong Suốt (Translucent).");
    } else if (/(nền màu|hộp màu|nền thương hiệu)/i.test(msgLower)) {
      nextCaptionBgStyle = "brand_box";
      changes.push("Đã đổi nền chữ sang Hộp Màu Thương Hiệu (Brand Box).");
    } else if (/(nền đen|hộp đen|nền đậm)/i.test(msgLower)) {
      nextCaptionBgStyle = "solid_dark";
      changes.push("Đã đổi nền chữ sang Hộp Đen Đậm Tương Phản Cao (Solid Dark).");
    }

    // Nhận diện yêu cầu đổi vị trí đặt chữ / phụ đề / tiêu đề
    if (/(ẩn chữ|tắt chữ|bỏ chữ|không hiện chữ|ẩn phụ đề|tắt phụ đề)/i.test(msgLower)) {
      nextCaptionPos = "hidden";
      if (/(tất cả chữ|cả tiêu đề|hết chữ)/i.test(msgLower)) nextHeadlinePos = "hidden";
      changes.push("Đã ẩn phụ đề trên khung hình video.");
    } else if (/(chữ.*giữa|phụ đề.*giữa|đặt chữ.*giữa|đưa chữ.*giữa|center)/i.test(msgLower)) {
      nextCaptionPos = "center";
      changes.push("Đã chuyển vị trí đặt chữ phụ đề ra chính giữa màn hình (Center · 52%).");
    } else if (/(chữ.*trên|phụ đề.*trên|đặt chữ.*trên|đưa chữ.*lên trên|lên đầu)/i.test(msgLower)) {
      nextCaptionPos = "top";
      if (nextHeadlinePos === "top") nextHeadlinePos = "center";
      changes.push("Đã đưa chữ phụ đề lên vùng phía trên màn hình (Top · 22%).");
    } else if (/(chữ.*dưới|phụ đề.*dưới|đặt chữ.*dưới|xuống dưới|mặc định)/i.test(msgLower)) {
      nextCaptionPos = "bottom";
      changes.push("Đã đặt chữ phụ đề ở vùng chuẩn phía dưới màn hình (Bottom · 77%).");
    }

    if (/(tiêu đề.*giữa)/i.test(msgLower)) {
      nextHeadlinePos = "center";
      changes.push("Đã đưa chữ nổi tiêu đề cảnh ra giữa màn hình.");
    } else if (/(tiêu đề.*dưới)/i.test(msgLower)) {
      nextHeadlinePos = "bottom";
      changes.push("Đã chuyển chữ nổi tiêu đề cảnh xuống phía dưới.");
    } else if (/(ẩn tiêu đề|bỏ tiêu đề)/i.test(msgLower)) {
      nextHeadlinePos = "hidden";
      changes.push("Đã ẩn tiêu đề cảnh trên màn hình.");
    }

    // Nhận diện yêu cầu đổi cách cắt / nhịp cắt / zoom / chuyển cảnh
    let forceZoom: "in" | "out" | "punch" | "pan_left" | "pan_right" | "none" | null = null;
    if (/(zoom punch|giật nhịp|nhịp nhanh|cắt nhanh|sôi động|tiktok)/i.test(msgLower)) {
      nextStyle = "dynamic";
      forceZoom = "punch";
      changes.push("Đã đổi cách cắt sang Nhịp Nhanh TikTok (Dynamic) + hiệu ứng Zoom Punch dứt khoát.");
    } else if (/(cắt mượt|nhịp chậm|điện ảnh|êm|smooth|dissolve|fade)/i.test(msgLower)) {
      nextStyle = "smooth";
      forceZoom = "in";
      changes.push("Đã đổi cách cắt sang Nhịp Mượt Điện Ảnh (Smooth) + chuyển cảnh Dissolve êm ái.");
    } else if (/(không zoom|tắt zoom|giữ tĩnh|clean)/i.test(msgLower)) {
      nextStyle = "clean";
      forceZoom = "none";
      changes.push("Đã tắt hiệu ứng phóng khung hình (Zoom: none) để giữ góc máy tĩnh tự nhiên.");
    }

    const updatedScenes = cur.scenes.map((sc, idx) => {
      let rawStart = sc.selectedRawCut.startSec;
      let rawEnd = sc.selectedRawCut.endSec;
      let voice = sc.newVoiceover;
      let onScreen = sc.newOnScreenText;
      let zoom = (forceZoom ?? sc.zoom) as "in" | "out" | "punch" | "pan_left" | "pan_right" | "none";
      let transition = nextStyle === "smooth" ? "dissolve" : nextStyle === "dynamic" && idx > 0 ? "zoomin" : sc.transition;

      // Nếu người dùng yêu cầu cắt ngắn hơn / nhanh hơn
      if (/(cắt ngắn|nhanh hơn|rút gọn)/i.test(msgLower)) {
        const curDur = Math.max(1.5, rawEnd - rawStart);
        rawEnd = Math.round((rawStart + Math.max(2.0, curDur * 0.78)) * 10) / 10;
      } else if (/(cắt dài hơn|chậm hơn|kéo dài)/i.test(msgLower)) {
        const curDur = Math.max(1.5, rawEnd - rawStart);
        rawEnd = Math.round((rawStart + curDur * 1.2) * 10) / 10;
      } else if (/(đổi đoạn cắt|lùi đoạn cắt|dịch đoạn cắt)/i.test(msgLower)) {
        const dur = Math.max(2.0, rawEnd - rawStart);
        rawStart = Math.round((rawStart + 1.5) * 10) / 10;
        rawEnd = Math.round((rawStart + dur) * 10) / 10;
      }

      // Nếu người dùng yêu cầu viết lại lời thoại ngắn gọn / chốt đơn mạnh hơn
      if (/(ngắn gọn|súc tích|rút gọn lời)/i.test(msgLower)) {
        const sentences = voice.split(/[.!?]+/).map((x) => x.trim()).filter(Boolean);
        if (sentences[0] && sentences[0].length > 15) {
          voice = `${sentences[0]}.`;
        }
      }

      return {
        sceneNumber: sc.sceneNumber,
        newVoiceover: voice,
        newOnScreenText: onScreen,
        rawSourceIndex: sc.selectedRawCut.sourceIndex,
        rawStartSec: rawStart,
        rawEndSec: rawEnd,
        zoom: (["in", "out", "punch", "pan_left", "pan_right", "none"].includes(zoom) ? zoom : "in") as
          | "in"
          | "out"
          | "punch"
          | "pan_left"
          | "pan_right"
          | "none",
        transition,
      };
    });

    if (/(ngắn gọn|súc tích|rút gọn lời|đổi lời|viết lại lời)/i.test(msgLower) && !changes.some((c) => c.includes("lời thoại"))) {
      changes.push("Đã tinh chỉnh lại lời thoại các phân cảnh ngắn gọn, súc tích và bám sát nhịp hình hơn.");
    }
    if (!changes.length) {
      changes.push(`Đã áp dụng yêu cầu "${msg.slice(0, 60)}" vào kịch bản cắt cảnh và kết xuất lại Video MP4.`);
    }

    return {
      reply: `Đã cập nhật theo đúng yêu cầu của anh: ${changes.join(" ")} Hệ thống đã dựng lại file Video MP4 mới ngay bên trên!`,
      changesSummary: changes,
      captionPosition: nextCaptionPos,
      headlinePosition: nextHeadlinePos,
      textTheme: nextTextTheme,
      captionBgStyle: nextCaptionBgStyle,
      thumbnailTitle: nextThumbnailTitle,
      editStyle: nextStyle,
      hookTitle: nextHook,
      ctaText: nextCta,
      scenes: updatedScenes,
    };
  };

  let editPlan = buildDeterministicEdit();
  const prov = effectiveProvider(opts.bizId);
  let providerUsed: string = opts.preferredProvider ?? prov.provider;

  if (opts.preferredProvider || (prov.ready && prov.provider !== "sandbox")) {
    try {
      const g = await generate({
        bizId: opts.bizId,
        agentKey: "creative",
        preferredProvider: opts.preferredProvider ?? "claude_cli",
        fast: true,
        tier: "medium",
        schema: ChatEditVideoSchema,
        system: [
          `Bạn là Đạo diễn Dựng Phim AI trực tiếp hỗ trợ người dùng chỉnh sửa Video ngay trong phòng dựng của ${cur.brandName || "ZONO"}.`,
          "Người dùng vừa gửi một tin nhắn yêu cầu thay đổi KỊCH BẢN / LỜI THOẠI (newVoiceover, newOnScreenText, hookTitle, ctaText), MÀU CHỮ (textTheme), NỀN CHỮ (captionBgStyle), VỊ TRÍ ĐẶT CHỮ (captionPosition, headlinePosition), THUMBNAIL (thumbnailTitle), hoặc CÁCH CẮT (rawStartSec/rawEndSec, zoom, transition, editStyle).",
          "Quy tắc bắt buộc:",
          "- `textTheme` (màu chữ): 'gold' (Vàng Kim), 'yellow_full' (Vàng Rực), 'emerald' (Xanh Ngọc), 'coral' (Đỏ Cam), 'cyan' (Xanh Dương), 'violet' (Tím Neon).",
          "- `captionBgStyle` (kiểu nền chữ): 'solid_dark' (Hộp Đen Đậm), 'translucent' (Hộp Mờ Trong Suốt), 'brand_box' (Hộp Màu Thương Hiệu), 'none' (Không Nền).",
          "- `captionPosition` (vị trí phụ đề lời thoại): chọn 'top' (trên cao 22%), 'center' (chính giữa 52%), 'bottom' (dưới đáy 77%), hoặc 'hidden' (ẩn phụ đề).",
          "- `headlinePosition` (vị trí tiêu đề cảnh): chọn 'top', 'center', 'bottom', hoặc 'hidden'.",
          "- `editStyle`: 'dynamic' (nhịp nhanh TikTok), 'smooth' (mượt điện ảnh), hoặc 'clean' (tối giản).",
          "- Giữ đúng số lượng cảnh hiện có. Nếu người dùng yêu cầu đổi kịch bản sang nội dung mới, hãy viết lại lời thoại (newVoiceover) và chữ nổi (newOnScreenText) cho tất cả các cảnh thật cuốn hút.",
          "- `reply`: Trả lời ngắn gọn, thân thiện bằng tiếng Việt cho anh chủ biết đã sửa những gì.",
        ].join("\n"),
        user: [
          `YÊU CẦU CỦA NGƯỜI DÙNG: "${msg}"`,
          `TRẠNG THÁI VIDEO HIỆN TẠI:`,
          `- Chủ đề: ${cur.topic} | Sản phẩm: ${cur.product}`,
          `- Màu chữ hiện tại (textTheme): ${cur.textTheme ?? "gold"} | Kiểu nền chữ (captionBgStyle): ${cur.captionBgStyle ?? "solid_dark"}`,
          `- Vị trí phụ đề hiện tại (captionPosition): ${cur.captionPosition ?? "bottom"} | Vị trí tiêu đề (headlinePosition): ${cur.headlinePosition ?? "top"}`,
          `- Phong cách dựng hiện tại (editStyle): ${cur.editStyle} | Thumbnail: "${cur.thumbnailTitle ?? cur.hookTitle}"`,
          `- Hook 3s đầu: "${cur.hookTitle}" | CTA cuối: "${cur.ctaText}"`,
          `- Danh sách ${cur.scenes.length} phân cảnh hiện tại:`,
          ...cur.scenes.map(
            (s) =>
              `  + Cảnh ${s.sceneNumber} (${s.durationSec}s): Cắt từ nguồn #${s.selectedRawCut.sourceIndex} [${s.selectedRawCut.startSec}s -> ${s.selectedRawCut.endSec}s] | Zoom="${s.zoom}" | Chuyển="${s.transition}" | Chữ nổi="${s.newOnScreenText}" | Lời thoại="${s.newVoiceover}"`,
          ),
        ].join("\n"),
        sandbox: buildDeterministicEdit,
      });
      if (g.output?.scenes?.length === cur.scenes.length) {
        editPlan = g.output;
        providerUsed = g.provider || providerUsed;
      }
    } catch (e) {
      logger.warn("video_decode.chat_edit_fallback", { error: String(e).slice(0, 250) });
    }
  }

  const newProduction = await produceFromDecodedBlueprint({
    bizId: opts.bizId,
    blueprint: opts.blueprint,
    rawVideoPaths: opts.rawVideoPaths,
    topic: cur.topic,
    product: cur.product,
    brandName: cur.brandName,
    voiceName: opts.voiceName,
    audioMode: opts.audioMode ?? "voiceover",
    aspectRatio: opts.aspectRatio ?? "9:16",
    editStyle: editPlan.editStyle,
    captionPosition: editPlan.captionPosition,
    headlinePosition: editPlan.headlinePosition,
    textTheme: editPlan.textTheme,
    captionBgStyle: editPlan.captionBgStyle,
    thumbnailTitle: editPlan.thumbnailTitle,
    customHookTitle: editPlan.hookTitle,
    customCtaText: editPlan.ctaText,
    renderMp4: true,
    useClaude: false,
    preferredProvider: opts.preferredProvider,
    customScenes: editPlan.scenes.map((s) => ({
      sceneNumber: s.sceneNumber,
      newVoiceover: s.newVoiceover,
      newOnScreenText: s.newOnScreenText,
      zoom: s.zoom,
      transition: s.transition,
      rawSourceIndex: s.rawSourceIndex,
      rawStartSec: s.rawStartSec,
      rawEndSec: s.rawEndSec,
    })),
  });

  return {
    reply: editPlan.reply,
    changesSummary: editPlan.changesSummary,
    providerUsed,
    production: {
      ...newProduction,
      providerUsed,
    },
  };
}
