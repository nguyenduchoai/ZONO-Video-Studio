export interface StoryStylePreset {
  id: string;
  name: string;
  category: "stick" | "2d" | "3d" | "drawing" | "realistic";
  description: string;
  characterDesign: string;
  styleInstruction: string;
  scenePrefix: string;
  negativePrompt: string;
  swatch: string;
}

export const FRAMEWEAVER_STORY_STYLES: StoryStylePreset[] = [
  {
    id: "realistic",
    name: "Điện Ảnh Thực Tế (Canon EOS R5)",
    category: "realistic",
    description: "Quay thực tế sắc nét chuẩn phim thương mại, ống kính 35mm/85mm, ánh sáng tự nhiên ấm áp.",
    characterDesign:
      "Nhân vật đại diện thương hiệu Việt Nam 26 tuổi, gương mặt rạng rỡ thân thiện, trang phục lịch sự đồng nhất xuyên suốt mọi cảnh.",
    styleInstruction:
      "Photorealistic RAW footage, shot on Canon EOS R5, 35mm and 85mm lens, natural warm commercial daylight, crisp shallow depth of field.",
    scenePrefix: "Real RAW commercial footage, shot on Canon EOS R5, warm natural daylight.",
    negativePrompt:
      "NOT 3D render, NOT CGI, NOT cartoon, NOT anime, NOT stick figure, no subtitles, no text overlay, no watermark, no morphing face.",
    swatch: "#0f172a",
  },
  {
    id: "srt_moral",
    name: "Truyện Nhân Quả & Đời Thường 2D",
    category: "2d",
    description: "Nhân vật bán hiện thực giàu cảm xúc, bối cảnh Việt Nam gần gũi, ánh sáng kể chuyện điện ảnh.",
    characterDesign:
      "Semi-realistic 2D illustrated Vietnamese characters with natural proportions, expressive drawn faces, consistent everyday Vietnamese clothing.",
    styleInstruction:
      "Cinematic 2D film illustration, intentional composition, warm atmospheric lighting, layered depth, Vietnamese everyday environment.",
    scenePrefix: "Cinematic 2D Vietnamese moral story illustration, atmospheric warm lighting, expressive acting.",
    negativePrompt:
      "No stick figures, no chibi, no photorealism, no 3D CGI, no lettering, no captions, no watermark.",
    swatch: "#af855a",
  },
  {
    id: "stickman_light",
    name: "Kể Chuyện Người Que (Stickman Nền Sáng)",
    category: "stick",
    description: "Đầu tròn trắng, tay chân nét đen tối giản trên nền sáng — cực hợp video giải thích, tài chính, tâm lý, bài học kinh doanh.",
    characterDesign:
      "Strict stick figures: large pure white circular heads, expressive dot eyes and minimal mouths, thin clean black line arms and legs, simple flat-colored vest/shirt.",
    styleInstruction:
      "Minimalist 2D stickman illustration on clean bright background (#FFFFFF), uniform clean black outlines, essential foreground props only.",
    scenePrefix: "Minimalist 2D stick figure animation on pure white background, clean uniform black outlines.",
    negativePrompt:
      "No filled realistic human limbs, no photorealism, no 3D, no cluttered background, no text overlay, no watermark.",
    swatch: "#ffffff",
  },
  {
    id: "stickman_dark",
    name: "Kể Chuyện Người Que (Stickman Nền Đen)",
    category: "stick",
    description: "Nhân vật người que nét trắng/vàng nổi bật trên nền tối — cuốn hút cho nội dung kể chuyện đêm, triết lý, phân tích sâu.",
    characterDesign:
      "Strict luminous stick figures: white circular heads, expressive minimal faces, bright white and warm gold accent line limbs on dark background.",
    styleInstruction:
      "High-contrast minimalist stickman 2D animation on pure dark background (#121216), crisp white and gold contours, essential props.",
    scenePrefix: "High-contrast 2D stick figure illustration on dark background (#121216), glowing white and gold outlines.",
    negativePrompt:
      "No realistic human anatomy, no photorealism, no 3D render, no busy background, no subtitles, no watermark.",
    swatch: "#121216",
  },
  {
    id: "srt_folk",
    name: "Truyện Dân Gian Việt Nam",
    category: "drawing",
    description: "Hoa văn dân gian, kiến trúc làng quê Bắc Bộ và trang phục truyền thống ấm áp.",
    characterDesign:
      "2D illustrated Vietnamese characters in traditional period clothing (áo tấc, áo tứ thân, khăn đóng), warm earthy pigments, coherent anatomy.",
    styleInstruction:
      "Vietnamese folk-inspired 2D illustration, Dong Ho and traditional decorative motifs, warm earthy pigments, village architecture.",
    scenePrefix: "Vietnamese folk-inspired 2D illustration, warm earthy palette, traditional cultural setting.",
    negativePrompt:
      "No modern electronics, no stick figures, no photorealism, no 3D CGI, no text overlay, no watermark.",
    swatch: "#b88d56",
  },
  {
    id: "srt_dressed",
    name: "Gia Đình & Cửa Hàng 2D Việt Nam",
    category: "2d",
    description: "Nhân vật 2D có trang phục đời thường Việt Nam nhất quán, gần gũi, dễ tạo thiện cảm.",
    characterDesign:
      "Full-body 2D cartoon Vietnamese characters with coherent hair and modern Vietnamese everyday clothing, expressive friendly faces.",
    styleInstruction:
      "Polished flat vector 2D illustration, crisp edges, warm Vietnamese neighborhood and shop setting, consistent props.",
    scenePrefix: "Polished 2D cartoon illustration, modern Vietnamese everyday setting, warm inviting colors.",
    negativePrompt:
      "No stick-line limbs, no photorealism, no 3D render, no lettering, no subtitles, no watermark.",
    swatch: "#c9a578",
  },
  {
    id: "3d_pixar",
    name: "Hoạt Hình 3D Pixar",
    category: "3d",
    description: "Nhân vật 3D tròn mềm đáng yêu, ánh sáng điện ảnh rực rỡ chuẩn phim hoạt hình Pixar.",
    characterDesign:
      "Original fully clothed 3D Pixar-style character, soft rounded proportions, expressive cartoon eyes, smooth subsurface scattering skin.",
    styleInstruction:
      "3D animated Pixar-quality rendering, global illumination, vibrant saturated colors, cinematic depth of field.",
    scenePrefix: "3D animated Pixar-style rendering, vibrant colors, cinematic global illumination.",
    negativePrompt:
      "NOT photorealistic live action, NOT flat 2D, NOT stick figure, no text overlay, no watermark.",
    swatch: "#3b82f6",
  },
  {
    id: "ghibli",
    name: "Tranh Vẽ Màu Nước Chữa Lành (Ghibli)",
    category: "drawing",
    description: "Nét vẽ tay màu nước dịu nhẹ, thiên nhiên xanh mát và cảm xúc bình yên.",
    characterDesign:
      "Hand-painted 2D animated character, gentle rounded features, cozy everyday cardigan and linen clothes, warm expressive eyes.",
    styleInstruction:
      "Studio Ghibli inspired hand-painted watercolor backgrounds, soft pastel palette, golden hour dappled sunlight, whimsical calm atmosphere.",
    scenePrefix: "Hand-painted watercolor anime style, soft pastel colors, gentle golden hour sunlight.",
    negativePrompt:
      "NOT photorealistic, NOT 3D render, NOT dark gritty, no sharp neon, no subtitles, no watermark.",
    swatch: "#10b981",
  },
  {
    id: "srt_chibi",
    name: "Chibi Đáng Yêu",
    category: "2d",
    description: "Đầu lớn, thân nhỏ, biểu cảm siêu dễ thương cho thương hiệu trẻ trung, đồ ăn, mỹ phẩm.",
    characterDesign:
      "Chibi 2D character with oversized head, compact body, big sparkling expressive eyes, cute consistent pastel outfit.",
    styleInstruction:
      "Polished 2D chibi cartoon animation, cel shading, pastel vibrant background, expressive acting.",
    scenePrefix: "Cute 2D chibi illustration, expressive oversized eyes, vibrant cel-shaded colors.",
    negativePrompt:
      "No realistic adult proportions, no stick limbs, no photorealism, no text overlay, no watermark.",
    swatch: "#ec4899",
  },
  {
    id: "claymation",
    name: "Hoạt Hình Đất Sét Thủ Công (Stop-Motion)",
    category: "3d",
    description: "Nhân vật nặn đất sét thủ công ấm áp, thế giới mô hình tí hon độc đáo.",
    characterDesign:
      "Handcrafted modeling-clay character, softly rounded sculpted anatomy, subtle fingerprint textures, cozy knitted sweater.",
    styleInstruction:
      "Stop-motion claymation aesthetic, miniature handmade practical set, warm soft studio macro lighting.",
    scenePrefix: "Handcrafted clay animation, rounded sculpted forms, miniature handmade set, warm macro lighting.",
    negativePrompt:
      "No photorealistic humans, no flat 2D lines, no glossy plastic, no subtitles, no watermark.",
    swatch: "#f59e0b",
  },
];

export function detectStoryStyleFromPrompt(prompt: string): StoryStylePreset {
  const lower = (prompt || "").toLowerCase();
  if (/\b(người que nền đen|stickman dark|stickman nền đen)\b/i.test(lower)) {
    return FRAMEWEAVER_STORY_STYLES.find((s) => s.id === "stickman_dark")!;
  }
  if (/\b(người que|stickman|stick figure|vẽ que)\b/i.test(lower)) {
    return FRAMEWEAVER_STORY_STYLES.find((s) => s.id === "stickman_light")!;
  }
  if (/\b(nhân quả|đạo lý|nghiệp báo|câu chuyện cuộc sống|truyện nhân quả)\b/i.test(lower)) {
    return FRAMEWEAVER_STORY_STYLES.find((s) => s.id === "srt_moral")!;
  }
  if (/\b(dân gian|cổ tích|làng quê|đông hồ|truyền thống)\b/i.test(lower)) {
    return FRAMEWEAVER_STORY_STYLES.find((s) => s.id === "srt_folk")!;
  }
  if (/\b(3d|pixar|disney|hoạt hình 3d)\b/i.test(lower)) {
    return FRAMEWEAVER_STORY_STYLES.find((s) => s.id === "3d_pixar")!;
  }
  if (/\b(ghibli|chữa lành|màu nước|watercolor)\b/i.test(lower)) {
    return FRAMEWEAVER_STORY_STYLES.find((s) => s.id === "ghibli")!;
  }
  if (/\b(chibi|dễ thương|cute)\b/i.test(lower)) {
    return FRAMEWEAVER_STORY_STYLES.find((s) => s.id === "srt_chibi")!;
  }
  if (/\b(đất sét|claymation|stop motion|stop-motion)\b/i.test(lower)) {
    return FRAMEWEAVER_STORY_STYLES.find((s) => s.id === "claymation")!;
  }
  if (/\b(gia đình 2d|hoạt hình 2d|minh họa 2d|2d)\b/i.test(lower)) {
    return FRAMEWEAVER_STORY_STYLES.find((s) => s.id === "srt_dressed")!;
  }
  return FRAMEWEAVER_STORY_STYLES[0];
}

export interface MoonReelNichePreset {
  slug: string;
  icon: string;
  name: string;
  description: string;
  format: "story" | "ambient";
  thumbnailStyle: "boxed" | "impact" | "cinematic";
  thumbnailAccent: string;
  tone: string;
  visualStyle: string;
  scriptInstructions: string[];
}

export const MOONREEL_NICHES: MoonReelNichePreset[] = [
  {
    slug: "commercial-brand",
    icon: "🛍️",
    name: "Bán Hàng & Thương Hiệu Thực Chiến",
    description: "Video giới thiệu sản phẩm, cửa hàng, dịch vụ chuyển đổi đơn hàng cao.",
    format: "story",
    thumbnailStyle: "impact",
    thumbnailAccent: "#FFD23F",
    tone: "Thân thiện, thuyết phục, rõ ràng, đáng tin cậy",
    visualStyle: "clean commercial lifestyle cinematography, warm natural daylight, crisp focus",
    scriptInstructions: [
      "Mở đầu bằng nỗi đau hoặc nhu cầu thực tế trong 2 giây đầu.",
      "Mỗi cảnh 1 lợi ích cốt lõi ( <= 25 từ tiếng Việt/cảnh để khớp nhịp đọc).",
      "Cảnh cuối kêu gọi hành động (CTA) rõ ràng.",
    ],
  },
  {
    slug: "personal-finance",
    icon: "💰",
    name: "Tài Chính Cá Nhân & Kinh Doanh",
    description: "Kiến thức tiền bạc, quản trị dòng tiền thực tế cho người đi làm & chủ shop.",
    format: "story",
    thumbnailStyle: "boxed",
    thumbnailAccent: "#34D399",
    tone: "Thân thiện, rõ ràng, như người đi trước chia sẻ thực tế",
    visualStyle: "clean modern 3D animation, soft warm lighting, pastel colors",
    scriptInstructions: [
      "Mở đầu bằng một con số hoặc sai lầm phổ biến gây giật mình.",
      "Mỗi cảnh một ý duy nhất, có ví dụ bằng tiền Việt Nam cụ thể.",
      "Kết thúc kêu gọi lưu video và theo dõi kênh.",
    ],
  },
  {
    slug: "did-you-know",
    icon: "🔭",
    name: "Sự Thật Thú Vị (Bạn Có Biết?)",
    description: "Những sự thật bất ngờ về khoa học, lịch sử, ngành hàng và thế giới.",
    format: "story",
    thumbnailStyle: "impact",
    thumbnailAccent: "#FFD23F",
    tone: "Tò mò, hào hứng, cuốn hút",
    visualStyle: "vibrant stylized 3D, cinematic lighting, rich detail",
    scriptInstructions: [
      "Câu đầu tiên dạng 'Bạn có biết…?' với một sự thật khó tin.",
      "Giải thích ngắn gọn vì sao điều đó đúng bằng thông tin kiểm chứng.",
      "Cảnh cuối đặt câu hỏi kích thích bình luận.",
    ],
  },
  {
    slug: "night-stories",
    icon: "🌙",
    name: "Truyện Kể Đêm Khuya & Tâm Sự",
    description: "Truyện tâm lý, nhân quả hoặc bí ẩn nhẹ kể theo ngôi thứ nhất.",
    format: "story",
    thumbnailStyle: "cinematic",
    thumbnailAccent: "#9DB8FF",
    tone: "Trầm ấm, chậm rãi, sâu lắng",
    visualStyle: "moody cinematic, low key lighting, blue and amber tones, light atmosphere",
    scriptInstructions: [
      "Kể theo mạch: bối cảnh → điều bất ngờ → cao trào → bài học sâu sắc.",
      "Không máu me, không bạo lực chi tiết.",
      "Cảnh cuối mời người xem chia sẻ góc nhìn dưới phần bình luận.",
    ],
  },
  {
    slug: "ai-tech-tips",
    icon: "🤖",
    name: "Mẹo Công Nghệ & Tự Động Hóa AI",
    description: "Hướng dẫn nhanh công cụ AI và mẹo tăng năng suất dùng ngay được.",
    format: "story",
    thumbnailStyle: "boxed",
    thumbnailAccent: "#FFC23D",
    tone: "Năng động, tự tin, súc tích",
    visualStyle: "sleek futuristic studio, neon accent lighting, crisp render",
    scriptInstructions: [
      "Mở đầu bằng lợi ích cụ thể (tiết kiệm bao nhiêu giờ/chi phí).",
      "Các bước làm theo thứ tự rõ ràng, mỗi cảnh một bước.",
      "Kết thúc kêu gọi lưu lại áp dụng ngay.",
    ],
  },
  {
    slug: "ambient-loop",
    icon: "☕",
    name: "Ambient Loop (Nhạc Học Bài · Thư Giãn · Quán Cafe)",
    description: "Video khung cảnh tĩnh lặng lặp vô tận (xfade 2.5s + stream_loop) ghép với nhạc nền dài hàng giờ.",
    format: "ambient",
    thumbnailStyle: "cinematic",
    thumbnailAccent: "#FBBF24",
    tone: "Bình yên, thư thái, ấm cúng (Lo-fi / Study / Chill)",
    visualStyle: "cozy atmospheric environment, gentle continuous motion (steam rising, soft rain, warm lamp glow), locked-off tripod camera",
    scriptInstructions: [
      "Máy quay cố định trên chân máy (locked-off static shot, SSIM ổn định).",
      "Chỉ có chuyển động nhẹ nhàng lặp lại (khói trà bay, mưa rơi nhẹ ngoài khung cửa, ánh đèn ấm).",
      "Ghép vòng lặp không vết nối bằng xfade smoothstep 2.5s + FFmpeg -stream_loop.",
    ],
  },
];

export function detectNicheFromPrompt(prompt: string): MoonReelNichePreset {
  const lower = (prompt || "").toLowerCase();
  if (/\b(ambient|loop|lofi|lo-fi|nhạc học bài|nhạc ngủ|thư giãn|tiếng mưa)\b/i.test(lower)) {
    return MOONREEL_NICHES.find((n) => n.slug === "ambient-loop")!;
  }
  if (/\b(tài chính|tiền bạc|đầu tư|tiết kiệm|dòng tiền|lương)\b/i.test(lower)) {
    return MOONREEL_NICHES.find((n) => n.slug === "personal-finance")!;
  }
  if (/\b(bạn có biết|sự thật|kỳ lạ|khoa học|bí ẩn)\b/i.test(lower)) {
    return MOONREEL_NICHES.find((n) => n.slug === "did-you-know")!;
  }
  if (/\b(đêm khuya|kể chuyện đêm|tâm sự|nhân quả|câu chuyện)\b/i.test(lower)) {
    return MOONREEL_NICHES.find((n) => n.slug === "night-stories")!;
  }
  if (/\b(mẹo ai|công nghệ|tự động hóa|automation|tool ai)\b/i.test(lower)) {
    return MOONREEL_NICHES.find((n) => n.slug === "ai-tech-tips")!;
  }
  return MOONREEL_NICHES[0];
}

export async function checkMuse2ApiHealth(baseUrl = process.env.MUSE2API_BASE_URL || "http://127.0.0.1:18610") {
  try {
    const cleanBase = baseUrl.replace(/\/+$/, "");
    const res = await fetch(`${cleanBase}/readyz`, { signal: AbortSignal.timeout(1800) });
    if (!res.ok) return { online: false, baseUrl: cleanBase, accounts: 0, browserRunning: false };
    const data = (await res.json()) as { status?: string; accounts?: number; browser_running?: boolean };
    return {
      online: data.status === "ok" || (data.accounts ?? 0) > 0,
      baseUrl: cleanBase,
      accounts: data.accounts ?? 0,
      browserRunning: Boolean(data.browser_running),
    };
  } catch {
    return { online: false, baseUrl, accounts: 0, browserRunning: false };
  }
}

export interface FrameWeaverScenePlan {
  index: number;
  code: string;
  chainType: "ROOT" | "CONTINUATION" | "INSERT [EDIT←Parent]";
  timeRange: string;
  ttsDurationSec: number;
  cutDurationSec: number;
  voiceVi: string;
  overlayText: string;
  overlayStyle: "stat" | "cost" | "date" | "name";
  cameraSentence: string;
  visualPrompt: string;
  audioLayers: string;
  startFrame: string;
  endFrame: string;
}

export function buildFrameWeaverProductionPlan(input: {
  topic: string;
  rawPrompt: string;
  brandName?: string;
  productsSummary?: string;
  ragKnowledgeText?: string;
  styleId?: string;
}) {
  const safeTopic = (input.topic || "Giải pháp nổi bật")
    .replace(/\b(máu|bạo lực|vũ khí|chữa khỏi 100%|cam kết tuyệt đối)\b/gi, "hiệu quả an toàn đã kiểm chứng")
    .trim();
  const brandLabel = input.brandName && input.brandName !== "Cửa hàng của tôi" ? input.brandName : "Thương hiệu Việt";
  const productHighlight = input.productsSummary || safeTopic;

  const style =
    (input.styleId ? FRAMEWEAVER_STORY_STYLES.find((s) => s.id === input.styleId) : undefined) ??
    detectStoryStyleFromPrompt(`${input.rawPrompt} ${input.topic}`);

  // 1. Entity Reference Bible (Characters, Locations, Props)
  const entities = [
    {
      name: "Nhân vật chính (Main Host)",
      entityType: "character",
      description: style.characterDesign,
    },
    {
      name: `Không gian ${brandLabel}`,
      entityType: "location",
      description: `${style.scenePrefix} Không gian bối cảnh chính của ${brandLabel}, ánh sáng đồng nhất, bố cục gọn gàng có chiều sâu.`,
    },
    {
      name: "Sản phẩm / Đạo cụ trung tâm",
      entityType: "prop",
      description: `${productHighlight.slice(0, 90)} được đặt nổi bật tại điểm mạnh 1/3 khung hình, chi tiết sắc nét đồng nhất.`,
    },
  ];

  // 2. 5-Scene Multi-Angle Storyboard (with T1 Chain + T2 Multi-Angle INSERT + Pattern B Anchor + 5-Component Camera Rule)
  const scenes: FrameWeaverScenePlan[] = [
    {
      index: 1,
      code: "CẢNH 1 (ROOT)",
      chainType: "ROOT",
      timeRange: "0:00–0:05",
      ttsDurationSec: 4.5,
      cutDurationSec: 5.0,
      voiceVi: `Bạn có biết vì sao nhiều người tìm kiếm ${safeTopic} nhưng vẫn chưa chọn được giải pháp thật sự ưng ý?`,
      overlayText: safeTopic.slice(0, 28).toUpperCase(),
      overlayStyle: "name",
      cameraSentence: "The camera slowly dollies in from a medium wide establishing shot at eye level.",
      visualPrompt: `${style.scenePrefix} Main Host stands in ${brandLabel} setting, holding the hero product naturally, warm inviting expression.`,
      audioLayers: `Audio: soft natural room ambience. SFX: gentle whoosh transition. Negative: subtitles, watermark, text overlay.`,
      startFrame: `Toàn cảnh trung (Medium Wide) nhân vật đứng tại không gian ${brandLabel}, ánh sáng ấm áp.`,
      endFrame: `Máy dolly-in nhẹ 15%, nhân vật nâng sản phẩm ngang ngực, mỉm cười tự tin.`,
    },
    {
      index: 2,
      code: "CẢNH 2 (CONTINUATION ← 1)",
      chainType: "CONTINUATION",
      timeRange: "0:05–0:10",
      ttsDurationSec: 4.5,
      cutDurationSec: 5.0,
      voiceVi: `Tại ${brandLabel}, bên mình mang đến ${productHighlight.slice(0, 105)} được tuyển chọn kỹ lưỡng từng chi tiết.`,
      overlayText: brandLabel.toUpperCase(),
      overlayStyle: "stat",
      cameraSentence: "The camera glides smoothly in a 35mm tracking shot around the subject.",
      visualPrompt: `${style.scenePrefix} Main Host demonstrates the hero product on the table, natural hand gestures, consistent outfit and lighting.`,
      audioLayers: `Audio: warm acoustic background ambience. SFX: crisp product placement sound. Negative: subtitles, watermark, text overlay.`,
      startFrame: `Khớp Khung cuối Cảnh 1: nhân vật đặt sản phẩm lên mặt bàn sáng màu.`,
      endFrame: `Góc trung cảnh 45 độ, ánh sáng lướt nhẹ làm nổi bật đường nét sản phẩm.`,
    },
    {
      index: 3,
      code: "CẢNH 2A (INSERT [EDIT←2] · Multi-Angle Close-Up)",
      chainType: "INSERT [EDIT←Parent]",
      timeRange: "0:10–0:15",
      ttsDurationSec: 4.4,
      cutDurationSec: 4.9,
      voiceVi: `Điểm khác biệt nằm ở chất lượng hoàn thiện sắc nét và trải nghiệm sử dụng êm ái ngay từ lần đầu tiên.`,
      overlayText: "CHẤT LƯỢNG CHUẨN",
      overlayStyle: "cost",
      cameraSentence: "Locked-off macro close-up shot with shallow depth of field and soft bokeh, then smooth transition back to medium anchor.",
      visualPrompt: `${style.scenePrefix} Extreme close-up of hands interacting with the product texture, 85mm telephoto bokeh. Pattern B Anchor: transitions smoothly back to Main Host medium shot.`,
      audioLayers: `Audio: quiet studio focus. SFX: subtle tactile click. Negative: subtitles, watermark, text overlay.`,
      startFrame: `Cận cảnh (Close-up 85mm) chi tiết bề mặt sản phẩm và bàn tay thao tác (T2 Multi-Angle Breakdown).`,
      endFrame: `Neo về khung trung cảnh của Cảnh 2 (Pattern B Anchor) để giữ 100% đồng nhất gương mặt nhân vật.`,
    },
    {
      index: 4,
      code: "CẢNH 3 (CONTINUATION ← 2)",
      chainType: "CONTINUATION",
      timeRange: "0:15–0:20",
      ttsDurationSec: 4.5,
      cutDurationSec: 5.0,
      voiceVi: `${input.ragKnowledgeText ? input.ragKnowledgeText.slice(0, 105) : "Đội ngũ luôn cam kết đồng hành, hỗ trợ tận tâm và bảo hành chu đáo tận nơi."}`,
      overlayText: "CAM KẾT UY TÍN",
      overlayStyle: "date",
      cameraSentence: "Over-the-shoulder angle transitioning to an eye-level medium shot.",
      visualPrompt: `${style.scenePrefix} Main Host carefully packages the product into a neat signature box in ${brandLabel}, nodding with satisfaction.`,
      audioLayers: `Audio: warm pleasant room tone. SFX: crisp box closing sound. Negative: subtitles, watermark, text overlay.`,
      startFrame: `Khớp Khung cuối Cảnh 2A: nhân vật đóng gói sản phẩm chỉn chu vào hộp thương hiệu.`,
      endFrame: `Hộp quà hoàn thiện đặt giữa bàn, nhân vật đặt tay lên hộp và nhìn thẳng ống kính.`,
    },
    {
      index: 5,
      code: "CẢNH 4 (CONTINUATION ← 3 · Outro CTA)",
      chainType: "CONTINUATION",
      timeRange: "0:20–0:25",
      ttsDurationSec: 4.4,
      cutDurationSec: 4.9,
      voiceVi: `Nhắn ngay cho ${brandLabel} hôm nay để nhận ưu đãi dùng thử tốt nhất dành riêng cho bạn nhé!`,
      overlayText: "NHẮN NGAY HÔM NAY",
      overlayStyle: "cost",
      cameraSentence: "The camera performs a gentle crane up while holding focus on the smiling host.",
      visualPrompt: `${style.scenePrefix} Main Host waves warmly at the camera next to the hero product display, golden hour rim lighting.`,
      audioLayers: `Audio: uplifting warm acoustic outro. SFX: gentle chime. Negative: subtitles, watermark, text overlay.`,
      startFrame: `Khớp Khung cuối Cảnh 3: góc trung cảnh ấm áp, nhân vật bên cạnh sản phẩm.`,
      endFrame: `Nhân vật mỉm cười vẫy tay chào, giữ khung hình ổn định 1.5s kết thúc mượt mà.`,
    },
  ];

  // 3. MoonReel Niche-First + 4-Platform Captions + Satori Thumbnail + Auto Shorts Cut Plan
  const niche = detectNicheFromPrompt(`${input.rawPrompt} ${input.topic}`);
  const seoTitle = `Bí Quyết ${safeTopic.slice(0, 38)} Tại ${brandLabel} [Chuẩn Thực Tế]`.slice(0, 65);
  const hashtags = [
    `#${brandLabel.replace(/\s+/g, "")}`,
    "#XuHuong2026",
    "#ReviewChanThuc",
    "#VideoNgan",
    "#KinhDoanhThucChien",
  ];
  const satoriHeadline = `BÍ QUYẾT *${safeTopic.slice(0, 18).toUpperCase()}*`;
  const thumbnailPrompt = `Formula 1 (Reaction Face + Curiosity Gap) · Style [${niche.thumbnailStyle.toUpperCase()} / Accent ${niche.thumbnailAccent}]: Tight medium close-up of Main Host (45% of frame) with expressive delighted look pointing toward ${safeTopic.slice(0, 40)}, high-contrast dramatic rim lighting, clean safe zone for Satori headline "${satoriHeadline}". ${style.styleInstruction}`;

  const multiPlatformCaptions = {
    youtube: {
      title: seoTitle,
      chapters: ["00:00 — Mở đầu & Nỗi đau thực tế", "00:05 — Giải pháp & Điểm khác biệt", "00:15 — Cam kết & Ưu đãi hôm nay"],
    },
    tiktok: `🔥 ${seoTitle} — Xem hết 25s để không bỏ lỡ ưu đãi từ ${brandLabel}! ${hashtags.join(" ")}`,
    instagram: `✨ ${safeTopic} sao cho chuẩn chỉnh nhất?\n👉 Cùng khám phá quy trình thực tế tại ${brandLabel} trong 25 giây ngắn gọn!\nBạn ấn tượng nhất ở điểm nào? Bình luận bên dưới nhé! 👇\n${hashtags.join(" ")}`,
    facebook: `Nhiều anh/chị hỏi ${brandLabel} về ${safeTopic}. Video ngắn 25 giây dưới đây tóm gọn toàn bộ trải nghiệm thực tế và cam kết chuẩn chỉnh nhất bên mình. Mời cả nhà cùng xem và nhắn ngay khi cần tư vấn nhé! ❤️`,
  };

  const fullVoiceoverVi = scenes.map((s) => s.voiceVi).join(" ");
  const expandedEnginePrompt = [
    `[NICHE CHANNEL]: ${niche.icon} ${niche.name} (${niche.slug}) — Tone: ${niche.tone}`,
    `[STYLE PRESET]: ${style.name} (${style.id}) — ${style.styleInstruction}`,
    `[KEYFRAME-FIRST CAST SHEET]: Vẽ Keyframe nhân vật trong bối cảnh trước (tối đa 3 nhân vật ghép ngang trên Cast Sheet xám), dùng Keyframe làm First-Frame cho Video.`,
    `[CHAR LOCK]: ${style.characterDesign}`,
    `[SET LOCK]: Không gian ${brandLabel} đồng nhất xuyên suốt.`,
    `[NEGATIVE]: ${style.negativePrompt}`,
    "",
    ...scenes.map(
      (s) =>
        `${s.code} (${s.timeRange}, Cut=${s.cutDurationSec}s) | Prompt: ${s.visualPrompt} ${s.cameraSentence} ${s.audioLayers} | Voice: "${s.voiceVi}"`,
    ),
  ].join("\n");

  return {
    niche,
    style,
    entities,
    scenes,
    seoTitle,
    hashtags,
    satoriHeadline,
    thumbnailPrompt,
    multiPlatformCaptions,
    fullVoiceoverVi,
    expandedEnginePrompt,
  };
}
