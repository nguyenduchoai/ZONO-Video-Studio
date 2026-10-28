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

  // 3. YouTube Shorts / TikTok / Reels SEO + 6-Formula Thumbnail Spec
  const seoTitle = `Bí Quyết ${safeTopic.slice(0, 38)} Tại ${brandLabel} [Chuẩn Thực Tế]`.slice(0, 65);
  const hashtags = [
    `#${brandLabel.replace(/\s+/g, "")}`,
    "#XuHuong2026",
    "#ReviewChanThuc",
    "#VideoNgan",
    "#KinhDoanhThucChien",
  ];
  const thumbnailPrompt = `Formula 1 (Reaction Face + Curiosity Gap): Tight medium close-up of Main Host (45% of frame) with expressive delighted look pointing toward ${safeTopic.slice(0, 40)}, high-contrast dramatic rim lighting, vivid complementary orange and teal palette, clean upper-left safe zone for 3 bold yellow words "${safeTopic.slice(0, 18).toUpperCase()}". ${style.styleInstruction}`;

  const fullVoiceoverVi = scenes.map((s) => s.voiceVi).join(" ");
  const expandedEnginePrompt = [
    `[STYLE PRESET]: ${style.name} (${style.id}) — ${style.styleInstruction}`,
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
    style,
    entities,
    scenes,
    seoTitle,
    hashtags,
    thumbnailPrompt,
    fullVoiceoverVi,
    expandedEnginePrompt,
  };
}
