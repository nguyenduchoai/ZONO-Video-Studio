import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, watch, writeFileSync, type FSWatcher } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { Zalo, LoginQRCallbackEventType, ThreadType, type API as ZcaApi } from "zca-js";
import { HttpsProxyAgent } from "https-proxy-agent";
import { activeDna, audit, bizSettings, byId, emit, insert, q, update, type Row } from "@dotaka/db";
import { CATALOG } from "@dotaka/agents";
import {
  allProvidersStatus,
  autoConfigureSystemClis,
  effectiveProvider,
  generate,
  listAiAccounts,
  llmSettings,
  resolveProviderForTask,
  scanSystemAiClis,
  taskCategoryForAgent,
  type Provider,
  type Tier,
} from "@dotaka/llm-gateway";
import { AppError, nowIso } from "@dotaka/shared";
import { DnaDraft, blankDna, documentText, dnaSourceText } from "./dna-intake.ts";
import { startVideoJob } from "./creative.ts";
import { createPostImage } from "./post-image.ts";
import { executeMuseRpc } from "./muse-local.ts";
import { buildFrameWeaverProductionPlan, FRAMEWEAVER_STORY_STYLES } from "./frameweaver-core.ts";

export interface PlanTierDef {
  id: "starter" | "growth" | "pro" | "enterprise";
  name: string;
  priceVnd: number;
  tokenLimit: number;
  videoLimit: number;
  postLimit: number;
  zaloMsgLimit: number;
  description: string;
}

export const PLAN_TIERS: PlanTierDef[] = [
  {
    id: "starter",
    name: "Gói Khởi Nghiệp (1 Người)",
    priceVnd: 490_000,
    tokenLimit: 500_000,
    videoLimit: 15,
    postLimit: 60,
    zaloMsgLimit: 1_000,
    description: "Dành cho cá nhân / chủ shop: 60 bài đăng + 15 video AI + 1.000 tin nhắn chăm sóc Zalo cá nhân/tháng.",
  },
  {
    id: "growth",
    name: "Gói Tăng Trưởng (Shop & Đội Nhóm)",
    priceVnd: 1_290_000,
    tokenLimit: 2_000_000,
    videoLimit: 50,
    postLimit: 200,
    zaloMsgLimit: 5_000,
    description: "Tự động hóa Đăng bài + Video 9:16 + Chăm sóc & Chốt đơn Zalo cá nhân/Messenger từ DNA & RAG.",
  },
  {
    id: "pro",
    name: "Gói Chuyên Nghiệp (Doanh Nghiệp)",
    priceVnd: 2_990_000,
    tokenLimit: 6_000_000,
    videoLimit: 150,
    postLimit: 600,
    zaloMsgLimit: 20_000,
    description: "Ưu tiên luồng Claude + OpenAI + Gemini/Veo 3 + Đẩy đơn tự động sang Pancake POS.",
  },
  {
    id: "enterprise",
    name: "Gói Không Giới Hạn (Agency / Hệ Thống)",
    priceVnd: 6_900_000,
    tokenLimit: 25_000_000,
    videoLimit: 500,
    postLimit: 2_500,
    zaloMsgLimit: 100_000,
    description: "Toàn quyền Đa Nhà cung cấp AI, Kho RAG không giới hạn, Đa tài khoản Zalo cá nhân & Fanpage.",
  },
];

export interface UserQuotaMeta {
  planId: PlanTierDef["id"];
  tokenLimit: number;
  videoLimit: number;
  postLimit: number;
  zaloMsgLimit: number;
  tokensUsed: number;
  videosUsed: number;
  postsUsed: number;
  zaloMsgsUsed: number;
  preferredProvider: "auto" | "claude_cli" | "codex_cli" | "gemini_cli" | "local_studio";
  ragEnabled: boolean;
  zaloPersonalPhone: string;
  zaloAutoFollowUp: boolean;
  pancakeSyncEnabled: boolean;
  brandName: string;
  industry: string;
  productsSummary: string;
  ragKnowledgeText: string;
}

function getManagedUsersStore(bizId: string): Record<string, UserQuotaMeta> {
  const s = bizSettings(bizId) as any;
  return (s.userQuotas ?? {}) as Record<string, UserQuotaMeta>;
}

function saveManagedUsersStore(bizId: string, map: Record<string, UserQuotaMeta>) {
  const cur = bizSettings(bizId) as any;
  update("biz", bizId, { settings: { ...cur, userQuotas: map } });
}

function ensureDefaultSampleUsers(bizId: string) {
  const existing = q.all<Row>("SELECT * FROM user_account WHERE biz_id = ? ORDER BY created_at ASC", bizId);
  const store = getManagedUsersStore(bizId);
  const curBiz = bizSettings(bizId) as any;
  let changed = false;

  const sampleBrand = "Cửa hàng Mẫu ZONO";
  const sampleIndustry = "Bán lẻ · Mỹ phẩm & Chăm sóc sức khoẻ";
  const sampleProducts =
    "Kem chống nắng ZONO Sunblock SPF50+ (250.000đ/tuýp), Serum Cấp Ẩm B5 Phục Hồi (390.000đ/lọ), Combo Chăm Sóc Da Toàn Diện (550.000đ - Tặng kèm mặt nạ)";
  const samplePolicy =
    "Miễn phí giao hàng toàn quốc cho đơn từ 300.000đ. Cam kết chính hãng 100%, đổi trả miễn phí trong 7 ngày nếu kích ứng. Khi tư vấn Zalo luôn xưng 'Dạ em' lễ phép, báo giá rõ ràng và xin SĐT + Địa chỉ nhận hàng để lên đơn.";

  if (existing.length === 0) {
    const u1 = insert("user_account", {
      biz_id: bizId,
      name: "Chủ Cửa Hàng (Mẫu)",
      email: "owner@shop.vn",
      role: "owner",
      status: "active",
      last_active_at: nowIso(),
    });
    store[u1.id] = {
      planId: "pro",
      tokenLimit: 6_000_000,
      videoLimit: 150,
      postLimit: 600,
      zaloMsgLimit: 20_000,
      tokensUsed: 1_240,
      videosUsed: 1,
      postsUsed: 1,
      zaloMsgsUsed: 2,
      preferredProvider: "auto",
      ragEnabled: true,
      zaloPersonalPhone: "0909888999",
      zaloAutoFollowUp: true,
      pancakeSyncEnabled: true,
      brandName: sampleBrand,
      industry: sampleIndustry,
      productsSummary: sampleProducts,
      ragKnowledgeText: samplePolicy,
    };
    changed = true;
  }

  for (const u of q.all<Row>("SELECT * FROM user_account WHERE biz_id = ?", bizId)) {
    if (!store[u.id]) {
      const dna = activeDna(bizId)?.data;
      store[u.id] = {
        planId: "pro",
        tokenLimit: 6_000_000,
        videoLimit: 150,
        postLimit: 600,
        zaloMsgLimit: 20_000,
        tokensUsed: q.scalar<number>("SELECT COALESCE(SUM(COALESCE(tokens_in,0) + COALESCE(tokens_out,0)),0) FROM model_usage WHERE biz_id = ?", bizId) || 1_240,
        videosUsed: q.scalar<number>("SELECT COUNT(*) FROM creative_job WHERE biz_id = ?", bizId) || 1,
        postsUsed: q.scalar<number>("SELECT COUNT(*) FROM content_item WHERE biz_id = ?", bizId) || 1,
        zaloMsgsUsed: q.scalar<number>("SELECT COUNT(*) FROM message WHERE biz_id = ?", bizId) || 2,
        preferredProvider: "auto",
        ragEnabled: true,
        zaloPersonalPhone: "0909888999",
        zaloAutoFollowUp: true,
        pancakeSyncEnabled: true,
        brandName: dna?.company?.brand || dna?.company?.name || sampleBrand,
        industry: dna?.company?.industry || sampleIndustry,
        productsSummary: (dna?.products ?? []).map((p: any) => `${p.name}${p.price ? ` (${p.price.toLocaleString("vi-VN")}đ)` : ""}`).join(", ") || sampleProducts,
        ragKnowledgeText: dna?.positioning || samplePolicy,
      };
      changed = true;
    } else if (!store[u.id]!.productsSummary && (!store[u.id]!.brandName || store[u.id]!.brandName === "Cửa hàng của tôi")) {
      // Nếu user mặc định chưa có ví dụ mẫu nào thì điền sẵn 1 bộ bảng giá mẫu để người dùng nhìn là hiểu ngay
      store[u.id]!.brandName = sampleBrand;
      store[u.id]!.industry = sampleIndustry;
      store[u.id]!.productsSummary = sampleProducts;
      store[u.id]!.ragKnowledgeText = samplePolicy;
      store[u.id]!.zaloPersonalPhone = store[u.id]!.zaloPersonalPhone || "0909888999";
      changed = true;
    }
  }

  if (changed) saveManagedUsersStore(bizId, store);

  // Đảm bảo kỹ năng `scene-lock-video` (Học từ bynne2602/museflow: STYLE LOCK / CHAR LOCK / SET LOCK / Frame Continuity) luôn có sẵn trong Core
  const existingSceneLockSkill = q.get<Row>("SELECT id FROM skill WHERE biz_id = ? AND key = 'scene-lock-video'", bizId);
  if (!existingSceneLockSkill) {
    const sceneLockBody = [
      "# Kịch Bản Video Khóa Đồng Nhất Nhân Vật & Bối Cảnh (Scene-Lock & Frame Continuity)",
      "",
      "## Nguyên tắc cốt lõi (Tích hợp trong Core Video Engine):",
      "1. **[STYLE LOCK]**: Khóa cố định phong cách hình ảnh, ánh sáng, bảng màu, tỷ lệ khung hình (9:16 hoặc 16:9) xuyên suốt mọi cảnh.",
      "2. **[CHAR LOCK]**: Khóa cố định ngoại hình, trang phục, độ tuổi, đặc điểm nhận diện của nhân vật chính để không bị biến dạng giữa các cảnh.",
      "3. **[SET LOCK]**: Khóa cố định bối cảnh cửa hàng/phòng studio, vị trí đạo cụ và góc máy chủ đạo.",
      "4. **Continuity Frame-Chaining (Nối Frame cuối → Frame đầu)**: Mỗi `CẢNH N (MM:SS–MM:SS)` có `Khung đầu` khớp chính xác với `Khung cuối` của cảnh `N-1`, tạo chuyển động liền mạch.",
      "5. **Tách bạch `Voice (tiếng Việt)` & `Prompt video`**: Lời đọc tiếng Việt được tách riêng để tổng hợp âm thanh `VieNeu-TTS 48kHz`, trong khi `Prompt video` tự động bung toàn bộ `[STYLE LOCK] + [CHAR LOCK] + [SET LOCK]` vào từng cảnh.",
      "6. **Auto-Refusal Safe Rewrite**: Tự động phát hiện từ khóa nhạy cảm/bị từ chối và viết lại sang mô tả thương mại an toàn tương đương mà không làm đứt chuỗi dựng video.",
    ].join("\n");
    insert("skill", {
      biz_id: bizId,
      key: "scene-lock-video",
      name: "Kịch Bản Video Khóa Đồng Nhất (STYLE/CHAR/SET LOCK)",
      grp: "creative",
      description: "Giữ đồng nhất 100% nhân vật, trang phục, bối cảnh giữa các cảnh video (5s/cảnh), tự nối Frame cuối cảnh trước sang Frame đầu cảnh sau và tách Voice tiếng Việt.",
      body: sceneLockBody,
      size: sceneLockBody.length,
      version: 1,
      status: "active",
    });
  }

  // Đảm bảo bộ 3 kỹ năng từ FrameWeaver (`fk-pipeline`, `fk-camera-guide`, `fk-youtube-seo`) luôn có sẵn trong Core
  const fwSkills = [
    {
      key: "fk-pipeline",
      name: "Dựng Video Đa Phong Cách (Người Que · Nhân Quả 2D · Dân Gian · 3D Pixar)",
      grp: "creative",
      description: "Quy trình 5 bước chuẩn FrameWeaver: Entity Reference Bible → 10 Phong cách trực quan (Stickman, Truyện nhân quả, Dân gian VN, 3D Pixar) → Multi-Angle Breakdown → Narrator-Fit 48kHz.",
      body: [
        "# Quy Trình Sản Xuất Video Đa Cảnh & Đa Phong Cách (FrameWeaver Core)",
        "1. **Entity Reference Bible**: Khai báo `character`, `location`, `prop` độc lập để khóa tạo hình xuyên suốt mọi cảnh.",
        "2. **Thư viện 10 Phong cách Trực quan**: Điện ảnh thực tế (Canon EOS R5), Kể chuyện Người Que (Stickman nền sáng/đen), Truyện Nhân Quả 2D, Truyện Dân Gian Việt Nam, Gia đình 2D Việt Nam, Hoạt hình 3D Pixar, Ghibli Màu Nước, Chibi, Đất Sét Stop-Motion.",
        "3. **Multi-Angle Breakdown (T2) + Pattern B Anchor**: Bung 1 khoảnh khắc cao trào thành nhiều góc máy (Wide establishing ➔ Macro close-up 85mm) và neo khung cuối (`endFrame`) về góc trung cảnh để không bao giờ bị biến dạng mặt nhân vật.",
        "4. **Narrator-Fit Concat (`48kHz stereo`)**: Cắt từng cảnh khớp `TTS_Duration + 0.5s buffer`, trộn `SFX volume=0.3` + `Voice volume=1.5`.",
      ].join("\n"),
    },
    {
      key: "fk-camera-guide",
      name: "Cẩm Nang Góc Máy Điện Ảnh 5 Thành Phần & 3 Lớp Âm Thanh",
      grp: "creative",
      description: "Chuẩn hóa cú pháp Prompt Video: [Camera viết câu riêng] + [Subject] + [Action] + [Setting] + [3 Lớp Audio: Dialogue / SFX / Ambient].",
      body: [
        "# Cẩm Nang Góc Máy Điện Ảnh (5-Component Camera Guide)",
        "- **Cấu trúc 5 thành phần**: `[Camera/Shot] + [Subject] + [Action] + [Setting] + [Style & Audio]`.",
        "- **Quy tắc vàng**: Chuyển động máy quay (`The camera slowly dollies in.`, `35mm tracking shot`) LUÔN viết thành 1 câu riêng biệt.",
        "- **3 Lớp Âm thanh cuối Prompt**: `Dialogue` (ngắn gọn <8s, không phụ đề) + `SFX` (tiếng động vật lý) + `Audio` (âm thanh môi trường nền).",
      ].join("\n"),
    },
    {
      key: "fk-youtube-seo",
      name: "Tối Ưu SEO YouTube/TikTok & 6 Công Thức Thumbnail CTR Cao",
      grp: "marketing",
      description: "Tạo tiêu đề Hook <65 ký tự, mô tả 3 vùng (Zone 1/2/3 + Timestamps), 15 Hashtags 3 tầng và Prompt Thumbnail theo 6 công thức tâm lý học.",
      body: [
        "# Tối Ưu SEO Video & 6 Công Thức Thumbnail CTR Cao",
        "1. **Hook Title (<65 ký tự)**: Từ khóa chính trong 5 chữ đầu + Từ kích thích tò mò (Curiosity Gap) + Con số cụ thể.",
        "2. **Mô tả 3 Vùng (3-Zone Description)**: Zone 1 (150 ký tự đầu trước 'Xem thêm') + Zone 2 (Tóm tắt & Chapter Timestamps `00:00`) + Zone 3 (15 Hashtags 3 tầng).",
        "3. **6 Công thức Thumbnail**: (1) Reaction Face 45% khung hình, (2) Before/After chia đôi, (3) Contrast/Clash đối lập, (4) Mystery/Reveal ẩn một phần, (5) Stakes Frame cao trào, (6) Number Punch con số khổng lồ.",
      ].join("\n"),
    },
  ];
  for (const sk of fwSkills) {
    const exists = q.get<Row>("SELECT id FROM skill WHERE biz_id = ? AND key = ?", bizId, sk.key);
    if (!exists) {
      insert("skill", {
        biz_id: bizId,
        key: sk.key,
        name: sk.name,
        grp: sk.grp,
        description: sk.description,
        body: sk.body,
        size: sk.body.length,
        version: 1,
        status: "active",
      });
    }
  }

  // Đảm bảo mỗi phân hệ có sẵn ĐÚNG 1 Sample (Ví dụ mẫu) để người dùng mở lên là thấy cách hoạt động ngay
  const primaryUser = q.get<Row>("SELECT * FROM user_account WHERE biz_id = ? ORDER BY created_at ASC LIMIT 1", bizId);
  if (primaryUser && !curBiz?.oneSamplePerFeatureSeeded) {
    // 1. Sample RAG Document (1 Tài liệu Bảng giá mẫu)
    const ragCount = q.scalar<number>("SELECT COUNT(*) FROM knowledge_doc WHERE biz_id = ?", bizId) ?? 0;
    if (ragCount === 0) {
      const docTitle = `Bảng giá & Chính sách Mẫu [${sampleBrand}]`;
      const bodyText = `Thương hiệu: ${sampleBrand}\nNgành hàng: ${sampleIndustry}\nSản phẩm & Bảng giá: ${sampleProducts}\nChính sách cửa hàng: ${samplePolicy}`;
      const doc = insert("knowledge_doc", {
        biz_id: bizId,
        title: docTitle,
        kind: "dna_rag",
        source: `user_rag:${primaryUser.id}`,
        tags: ["sample", "user_dna", primaryUser.id],
        body: bodyText,
        status: "processed",
      });
      bodyText.split("\n").forEach((line, idx) => {
        insert("knowledge_chunk", {
          biz_id: bizId,
          doc_id: doc.id,
          idx,
          text: line,
          source_ref: `${docTitle}#muc-${idx + 1}`,
        });
      });
    }

    // 2. Sample Zalo Personal Account (1 Nick Zalo mẫu + 1 Khách Tắt AI mẫu + 1 Hội thoại Zalo mẫu)
    const freshBiz = bizSettings(bizId) as any;
    const curZaloAccs = Array.isArray(freshBiz.zaloPersonalAccounts) ? freshBiz.zaloPersonalAccounts : [];
    const curZaloRules = Array.isArray(freshBiz.zaloCustomerAiRules) ? freshBiz.zaloCustomerAiRules : [];
    const sampleZaloId = "zalo_sample_01";
    const nextZaloAccs =
      curZaloAccs.length > 0
        ? curZaloAccs
        : [
            {
              id: sampleZaloId,
              name: "Zalo Bán Hàng (Mẫu)",
              phone: "0909888999",
              roleLabel: "Tư vấn & Chốt đơn Zalo (Nhắn riêng & Nhóm @tag)",
              loginMethod: "zca_qr",
              chromeProfileDir: "data/chrome-profiles/zalo-0909888999",
              assignedUserId: primaryUser.id,
              assignedUserName: String(primaryUser.name),
              brandName: sampleBrand,
              status: "connected",
              autoReplyEnabled: true,
              groupMentionReplyEnabled: true,
              autoFollowUpEnabled: true,
              autoPushPancakePos: true,
              todayMessages: 2,
              todayOrders: 1,
              lastActiveAt: nowIso(),
            },
          ];
    const nextZaloRules =
      curZaloRules.length > 0
        ? curZaloRules
        : [
            {
              id: "crule_sample_01",
              customerName: "Anh Tuấn Đối Tác (Mẫu)",
              customerPhone: "0909111222",
              zaloAccountId: "all",
              aiEnabled: false,
              note: "Ví dụ mẫu: Tắt AI với người quen/đối tác để chủ shop tự chat tay",
              updatedAt: nowIso(),
            },
          ];

    const convCount = q.scalar<number>("SELECT COUNT(*) FROM conversation WHERE biz_id = ? AND channel = 'zalo'", bizId) ?? 0;
    if (convCount === 0) {
      const conv = insert("conversation", {
        biz_id: bizId,
        channel: "zalo",
        external_id: "zl_sample_conv_01",
        customer_ref: "0912345678",
        customer_name: "Chị Hương (Khách Zalo Mẫu)",
        state: "awaiting_customer",
        lead_grade: "hot",
        lead_score: 90,
        intent: "mua_hang",
        unread: 0,
        last_message_at: nowIso(),
        last_preview: "Shop ơi kem chống nắng và serum B5 giá bao nhiêu vậy?",
        ext: {
          zaloAccountId: sampleZaloId,
          zaloAccountName: "Zalo Bán Hàng (Mẫu) (0909888999)",
          assignedUserId: primaryUser.id,
          threadType: "user",
        },
      });
      insert("message", {
        biz_id: bizId,
        conversation_id: conv.id,
        direction: "in",
        sender: "customer",
        body: "Shop ơi kem chống nắng và serum B5 giá bao nhiêu vậy?",
        sent_at: nowIso(),
      });
      insert("message", {
        biz_id: bizId,
        conversation_id: conv.id,
        direction: "out",
        sender: "bot",
        body: "Dạ chào chị Hương ạ! Bên em hiện đang có sẵn Kem chống nắng ZONO Sunblock SPF50+ giá 250.000đ/tuýp và Serum Cấp Ẩm B5 Phục Hồi giá 390.000đ/lọ ạ. Đặc biệt lấy nguyên Combo Chăm Sóc Da chỉ còn 550.000đ (tặng kèm mặt nạ + Miễn phí giao hàng toàn quốc). Chị Hương cho em xin SĐT và địa chỉ nhận hàng để em lên đơn gửi mình luôn nhé ạ! ❤️",
        meta: { kind: "zalo_personal_rag", zaloAccountId: sampleZaloId, provider: "AI Tự động (RAG)" },
        sent_at: nowIso(),
      });
    }

    // 3. Sample Sales Post (1 Bài viết bán hàng mẫu)
    const postCount = q.scalar<number>("SELECT COUNT(*) FROM content_item WHERE biz_id = ?", bizId) ?? 0;
    if (postCount === 0) {
      insert("content_item", {
        biz_id: bizId,
        agent_key: "content",
        kind: "social_post",
        channel: "facebook",
        title: "[Bài mẫu] Bí quyết làn da căng bóng chuẩn Spa ngay tại nhà cùng Combo ZONO",
        body: [
          "🌞 **NẮNG GẮT ĐẾN MẤY CŨNG KHÔNG LO SẠM DA CÙNG COMBO PHỤC HỒI ZONO!**",
          "",
          "Chị em đi làm cả ngày ngồi điều hoà hay thường xuyên ra nắng khiến da khô sạm, thiếu sức sống? Đừng bỏ qua bộ đôi bảo vệ & phục hồi da đang được yêu thích nhất tại **Cửa hàng Mẫu ZONO**:",
          "",
          "- 🛡️ **Kem chống nắng ZONO Sunblock SPF50+**: **250.000đ/tuýp** — Kiềm dầu mỏng nhẹ, nâng tông tự nhiên, không bết dính.",
          "- 💧 **Serum Cấp Ẩm B5 Phục Hồi**: **390.000đ/lọ** — Cấp ẩm sâu gấp 5 lần, làm dịu da kích ứng chỉ sau 7 ngày.",
          "- 🎁 **Ưu đãi Combo Chăm Sóc Da Toàn Diện**: Chỉ còn **550.000đ** *(Tiết kiệm ngay 90.000đ + Tặng kèm mặt nạ dưỡng trắng)*!",
          "",
          "✅ **Cam kết từ cửa hàng**: Miễn phí giao hàng toàn quốc cho đơn từ 300.000đ — Đổi trả miễn phí trong 7 ngày.",
          "👉 **Nhắn tin ngay cho shop hoặc để lại SĐT bên dưới để nhận ưu đãi hôm nay nhé!**",
        ].join("\n"),
        status: "approved",
      });
    }

    // 4. Sample Video (1 Video mẫu trong Xưởng làm Video)
    const videoCount = q.scalar<number>("SELECT COUNT(*) FROM creative_job WHERE biz_id = ?", bizId) ?? 0;
    if (videoCount === 0) {
      insert("creative_job", {
        biz_id: bizId,
        tool: "anim-video",
        title: "[Video mẫu] Giới thiệu Combo Chăm Sóc Da & Tự Động Hoá Bán Hàng ZONO",
        status: "done",
        step: "Hoàn tất dựng video 9:16 + Giọng đọc tiếng Việt",
        input: {
          tool: "anim-video",
          title: "[Video mẫu] Giới thiệu Combo Chăm Sóc Da & Tự Động Hoá Bán Hàng ZONO",
          brief: "Bạn đang tìm kiếm giải pháp chăm sóc da chuẩn Spa ngay tại nhà? Khám phá ngay Combo Kem chống nắng SPF50+ và Serum B5 phục hồi chuyên sâu với ưu đãi miễn phí vận chuyển toàn quốc.",
          durationSec: 25,
          channels: ["tiktok", "facebook"],
          video: { voice: "Ngọc Huyền", aspect: "9:16", animTemplate: "ecommerce-promo", animStyle: "2d-mascot" },
        },
        output: {
          videoUrl: "/muse/HatchMaking.mp4",
          durationSec: 25,
          resolution: "1080x1920",
        },
        created_by: "sample_seed",
      });
    }

    update("biz", bizId, {
      settings: {
        ...freshBiz,
        userQuotas: store,
        zaloPersonalAccounts: nextZaloAccs,
        zaloCustomerAiRules: nextZaloRules,
        oneSamplePerFeatureSeeded: true,
      },
    });
    syncZaloAccountsToConnection(bizId, nextZaloAccs);
  }
}

export function getUsersQuotaOverview(bizId: string) {
  ensureDefaultSampleUsers(bizId);
  const store = getManagedUsersStore(bizId);
  const users = q.all<Row>("SELECT * FROM user_account WHERE biz_id = ? ORDER BY created_at DESC", bizId);
  const docsCount = q.scalar<number>("SELECT COUNT(*) FROM knowledge_doc WHERE biz_id = ?", bizId) ?? 0;
  const chunksCount = q.scalar<number>("SELECT COUNT(*) FROM knowledge_chunk WHERE biz_id = ?", bizId) ?? 0;
  const totalTokensDb = q.scalar<number>("SELECT COALESCE(SUM(COALESCE(tokens_in,0) + COALESCE(tokens_out,0)),0) FROM model_usage WHERE biz_id = ?", bizId) ?? 0;
  const usageByProvider = q.all<Row>(
    "SELECT provider, COUNT(*) calls, COALESCE(SUM(COALESCE(tokens_in,0)+COALESCE(tokens_out,0)),0) tokens FROM model_usage WHERE biz_id = ? GROUP BY provider",
    bizId,
  );

  const enrichedUsers = users.map((u) => {
    const meta = store[u.id]!;
    const tier = PLAN_TIERS.find((t) => t.id === meta.planId) ?? PLAN_TIERS[1];
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      lastActiveAt: u.last_active_at ?? u.updated_at,
      plan: tier,
      quota: meta,
      tokenPct: Math.min(100, Math.round((meta.tokensUsed / Math.max(1, meta.tokenLimit)) * 100)),
      videoPct: Math.min(100, Math.round((meta.videosUsed / Math.max(1, meta.videoLimit)) * 100)),
      postPct: Math.min(100, Math.round((meta.postsUsed / Math.max(1, meta.postLimit)) * 100)),
    };
  });

  const totalAllocatedTokens = enrichedUsers.reduce((s, u) => s + u.quota.tokenLimit, 0);
  const totalUsedTokens = enrichedUsers.reduce((s, u) => s + u.quota.tokensUsed, 0);

  return {
    plans: PLAN_TIERS,
    centralPool: {
      providersStatus: allProvidersStatus(bizId),
      aiAccounts: listAiAccounts(bizId),
      llmSettings: llmSettings(bizId),
      totalAllocatedTokens,
      totalUsedTokens: Math.max(totalUsedTokens, totalTokensDb),
      usageByProvider,
      ragStats: { docsCount, chunksCount },
    },
    users: enrichedUsers,
  };
}

export function saveManagedUser(
  bizId: string,
  input: {
    id?: string;
    name: string;
    email: string;
    role?: string;
    status?: string;
    planId: PlanTierDef["id"];
    tokenLimit?: number;
    videoLimit?: number;
    postLimit?: number;
    zaloMsgLimit?: number;
    preferredProvider?: UserQuotaMeta["preferredProvider"];
    ragEnabled?: boolean;
    zaloPersonalPhone?: string;
    zaloAutoFollowUp?: boolean;
    pancakeSyncEnabled?: boolean;
    brandName?: string;
    industry?: string;
    productsSummary?: string;
    ragKnowledgeText?: string;
  },
  actor: string,
) {
  ensureDefaultSampleUsers(bizId);
  const store = getManagedUsersStore(bizId);
  const tier = PLAN_TIERS.find((t) => t.id === input.planId) ?? PLAN_TIERS[1];

  let userId = input.id;
  if (userId) {
    const existing = byId<Row>("user_account", userId);
    if (!existing) throw new AppError("NOT_FOUND", "Không tìm thấy người dùng", 404);
    update("user_account", userId, {
      name: input.name.trim(),
      email: input.email.trim(),
      role: input.role ?? existing.role,
      status: input.status ?? existing.status,
      last_active_at: nowIso(),
    });
  } else {
    const created = insert("user_account", {
      biz_id: bizId,
      name: input.name.trim(),
      email: input.email.trim(),
      role: input.role ?? "subscriber",
      status: input.status ?? "active",
      last_active_at: nowIso(),
    });
    userId = created.id;
  }

  const prev = store[userId] ?? {
    planId: tier.id,
    tokenLimit: tier.tokenLimit,
    videoLimit: tier.videoLimit,
    postLimit: tier.postLimit,
    zaloMsgLimit: tier.zaloMsgLimit,
    tokensUsed: 0,
    videosUsed: 0,
    postsUsed: 0,
    zaloMsgsUsed: 0,
    preferredProvider: "auto",
    ragEnabled: true,
    zaloPersonalPhone: "",
    zaloAutoFollowUp: true,
    pancakeSyncEnabled: true,
    brandName: input.name.trim(),
    industry: "",
    productsSummary: "",
    ragKnowledgeText: "",
  };

  const nextMeta: UserQuotaMeta = {
    ...prev,
    planId: tier.id,
    tokenLimit: input.tokenLimit ?? tier.tokenLimit,
    videoLimit: input.videoLimit ?? tier.videoLimit,
    postLimit: input.postLimit ?? tier.postLimit,
    zaloMsgLimit: input.zaloMsgLimit ?? tier.zaloMsgLimit,
    preferredProvider: input.preferredProvider ?? prev.preferredProvider,
    ragEnabled: input.ragEnabled ?? prev.ragEnabled,
    zaloPersonalPhone: input.zaloPersonalPhone ?? prev.zaloPersonalPhone,
    zaloAutoFollowUp: input.zaloAutoFollowUp ?? prev.zaloAutoFollowUp,
    pancakeSyncEnabled: input.pancakeSyncEnabled ?? prev.pancakeSyncEnabled,
    brandName: input.brandName ?? prev.brandName,
    industry: input.industry ?? prev.industry,
    productsSummary: input.productsSummary ?? prev.productsSummary,
    ragKnowledgeText: input.ragKnowledgeText ?? prev.ragKnowledgeText,
  };

  store[userId] = nextMeta;
  saveManagedUsersStore(bizId, store);

  // Sync User's DNA & RAG into `knowledge_doc` and `knowledge_chunk` so RAG search works immediately
  if (nextMeta.ragKnowledgeText || nextMeta.productsSummary) {
    const docTitle = `DNA & RAG [${nextMeta.brandName || input.name}]`;
    const bodyText = [
      `Thương hiệu: ${nextMeta.brandName}`,
      `Ngành hàng: ${nextMeta.industry}`,
      `Sản phẩm & Bảng giá: ${nextMeta.productsSummary}`,
      `Zalo cá nhân CSKH: ${nextMeta.zaloPersonalPhone}`,
      `Tri thức & Kịch bản bán hàng (RAG): ${nextMeta.ragKnowledgeText}`,
    ].join("\n");

    const existingDoc = q.get<Row>("SELECT id FROM knowledge_doc WHERE biz_id = ? AND source = ?", bizId, `user_rag:${userId}`);
    let docId = existingDoc?.id;
    if (docId) {
      update("knowledge_doc", docId, { title: docTitle, body: bodyText, status: "processed" });
      q.run("DELETE FROM knowledge_chunk WHERE doc_id = ?", docId);
    } else {
      const d = insert("knowledge_doc", {
        biz_id: bizId,
        title: docTitle,
        kind: "dna_rag",
        source: `user_rag:${userId}`,
        tags: ["user_dna", "rag", userId],
        body: bodyText,
        status: "processed",
      });
      docId = d.id;
    }

    const paragraphs = bodyText.split(/\n+/).filter(Boolean);
    paragraphs.forEach((p, idx) => {
      insert("knowledge_chunk", {
        biz_id: bizId,
        doc_id: docId,
        idx,
        text: p,
        source_ref: `${docTitle}#chunk-${idx + 1}`,
      });
    });

    // Also sync to active DNA if this is the primary user or if no DNA exists yet
    if (!activeDna(bizId)) {
      const parsed = DnaDraft.parse({
        company: { name: nextMeta.brandName, brand: nextMeta.brandName, industry: nextMeta.industry },
        positioning: nextMeta.ragKnowledgeText,
        products: nextMeta.productsSummary
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name, i) => ({ key: `prod_${i + 1}`, name, verified: true })),
      });
      insert("dna_profile", { biz_id: bizId, version: 1, status: "active", data: parsed, created_by: actor });
    }
  }

  audit(bizId, actor, "user_quota.saved", { type: "user_account", id: userId }, { name: input.name, planId: tier.id });
  return getUsersQuotaOverview(bizId);
}

export function deleteManagedUser(bizId: string, userId: string, actor: string) {
  const store = getManagedUsersStore(bizId);
  delete store[userId];
  saveManagedUsersStore(bizId, store);
  q.run("DELETE FROM user_account WHERE id = ? AND biz_id = ?", userId, bizId);
  audit(bizId, actor, "user_quota.deleted", { type: "user_account", id: userId }, {});
  return getUsersQuotaOverview(bizId);
}

const AGENT_EMOJIS: Record<string, string> = {
  assistant: "👑",
  dna_intake: "🧬",
  brief: "🎯",
  market_research: "🔍",
  strategy: "🧭",
  content: "✍️",
  video_script: "🎬",
  seo_web: "🌐",
  creative: "🎨",
  publishing: "📤",
  post_scanner: "📡",
  analytics: "📊",
  chat: "💬",
  follow_up: "🤝",
  feedback: "💡",
  review: "🛡️",
};

// ── CORE 1: LLM Context Optimizer & Smart Skill Pruning (Học từ AICoworker.app LLMProxy) ──

export interface ContextOptimizerConfig {
  mode: "aggressive" | "balanced" | "full";
  maxRagChunks: number;
  maxSkillChars: number;
  convCacheEnabled: boolean;
  totalRunsOptimized: number;
  totalTokensSaved: number;
}

export function getContextOptimizerConfig(bizId: string): ContextOptimizerConfig {
  const s = (bizSettings(bizId) as any)?.contextOptimizer ?? {};
  const mode: ContextOptimizerConfig["mode"] = s.mode === "aggressive" || s.mode === "full" ? s.mode : "balanced";
  return {
    mode,
    maxRagChunks: typeof s.maxRagChunks === "number" ? s.maxRagChunks : mode === "aggressive" ? 3 : mode === "balanced" ? 5 : 10,
    maxSkillChars: typeof s.maxSkillChars === "number" ? s.maxSkillChars : mode === "aggressive" ? 3_200 : mode === "balanced" ? 6_500 : 14_000,
    convCacheEnabled: s.convCacheEnabled !== false,
    totalRunsOptimized: Number(s.totalRunsOptimized ?? 0),
    totalTokensSaved: Number(s.totalTokensSaved ?? 0),
  };
}

export function saveContextOptimizerConfig(
  bizId: string,
  input: Partial<Pick<ContextOptimizerConfig, "mode" | "maxRagChunks" | "maxSkillChars" | "convCacheEnabled">>,
  actor: string,
) {
  const cur = bizSettings(bizId) as any;
  const prev = getContextOptimizerConfig(bizId);
  const nextMode = input.mode ?? prev.mode;
  const next: ContextOptimizerConfig = {
    ...prev,
    mode: nextMode,
    maxRagChunks: input.maxRagChunks ?? (nextMode === "aggressive" ? 3 : nextMode === "balanced" ? 5 : 10),
    maxSkillChars: input.maxSkillChars ?? (nextMode === "aggressive" ? 3_200 : nextMode === "balanced" ? 6_500 : 14_000),
    convCacheEnabled: input.convCacheEnabled ?? prev.convCacheEnabled,
  };
  update("biz", bizId, { settings: { ...cur, contextOptimizer: next } });
  audit(bizId, actor, "context_optimizer.updated", { type: "biz", id: bizId }, { mode: next.mode });
  return next;
}

function optimizePromptAndSkillContext(
  bizId: string,
  prompt: string,
  allChunks: Row[],
  rawSkillBody?: string,
): {
  selectedChunks: Row[];
  prunedSkillBody?: string;
  rawTokensEst: number;
  optimizedTokensEst: number;
  savedTokensEst: number;
  savedPct: number;
} {
  const cfg = getContextOptimizerConfig(bizId);
  const words = prompt
    .toLowerCase()
    .split(/[\s,.;:!?()[\]"']+/)
    .filter((w) => w.length >= 3);

  const scoredChunks = allChunks.map((c, idx) => {
    const textLower = String(c.text || "").toLowerCase();
    let score = 0;
    for (const w of words) {
      if (textLower.includes(w)) score += 3;
    }
    // Ưu tiên nhẹ cho các chunk đầu tiên (thông tin cốt lõi của shop)
    score += Math.max(0, 4 - idx * 0.5);
    return { chunk: c, score };
  });

  scoredChunks.sort((a, b) => b.score - a.score);
  const selectedChunks = scoredChunks.slice(0, cfg.maxRagChunks).map((x) => x.chunk);

  const rawRagChars = allChunks.reduce((acc, c) => acc + String(c.text || "").length, 0);
  const optRagChars = selectedChunks.reduce((acc, c) => acc + Math.min(380, String(c.text || "").length), 0);

  const rawSkillLen = rawSkillBody ? rawSkillBody.length : 0;
  let prunedSkillBody = rawSkillBody;
  if (rawSkillBody && rawSkillBody.length > cfg.maxSkillChars) {
    // Giữ phần mở đầu (Overview/Workflow) và các quy tắc cốt lõi, loại bỏ phần ví dụ rườm rà
    const headLen = Math.floor(cfg.maxSkillChars * 0.75);
    const tailLen = cfg.maxSkillChars - headLen;
    prunedSkillBody = `${rawSkillBody.slice(0, headLen)}\n\n[...Context Optimizer đã nén gọn phần minh hoạ phụ để tiết kiệm Quota CLI...]\n\n${rawSkillBody.slice(-tailLen)}`;
  }
  const optSkillLen = prunedSkillBody ? prunedSkillBody.length : 0;

  const rawTokensEst = Math.max(120, Math.ceil((rawRagChars + rawSkillLen + prompt.length + 600) / 3.5));
  const optimizedTokensEst = Math.max(80, Math.ceil((optRagChars + optSkillLen + prompt.length + 380) / 3.5));
  const savedTokensEst = Math.max(0, rawTokensEst - optimizedTokensEst);
  const savedPct = rawTokensEst > 0 ? Math.min(78, Math.round((savedTokensEst / rawTokensEst) * 100)) : 0;

  if (savedTokensEst > 0) {
    const cur = bizSettings(bizId) as any;
    const nextOpt: ContextOptimizerConfig = {
      ...cfg,
      totalRunsOptimized: cfg.totalRunsOptimized + 1,
      totalTokensSaved: cfg.totalTokensSaved + savedTokensEst,
    };
    update("biz", bizId, { settings: { ...cur, contextOptimizer: nextOpt } });
  }

  return {
    selectedChunks,
    prunedSkillBody,
    rawTokensEst,
    optimizedTokensEst,
    savedTokensEst,
    savedPct,
  };
}

// ── CORE 2: Auto-Watch Folder (`data/inbox-auto/`) & Event-Driven Trigger Manager ──

export interface LocalEventTrigger {
  id: string;
  name: string;
  source: "file_watch" | "job_completion" | "zalo_incoming";
  description: string;
  targetAction: string;
  enabled: boolean;
  runsCount: number;
  lastTriggeredAt?: string;
}

const DEFAULT_EVENT_TRIGGERS: LocalEventTrigger[] = [
  {
    id: "trg_inbox_auto_rag",
    name: "📂 Tự động học File thả vào thư mục data/inbox-auto/",
    source: "file_watch",
    description: "Cứ chép hoặc thả bất kỳ file Word (.docx), .txt, .csv, .md vào thư mục data/inbox-auto/ trên máy là AI tự động đọc nạp vào bộ nhớ RAG cửa hàng.",
    targetAction: "rag.ingest_auto",
    enabled: true,
    runsCount: 0,
  },
  {
    id: "trg_auto_legal_guard",
    name: "⚖️ Tự động kiểm duyệt từ cấm quảng cáo (/vn-legal-check)",
    source: "job_completion",
    description: "Khi @content viết xong bài đăng bán hàng, tự động đối chiếu danh sách từ nhạy cảm theo quy định quảng cáo Việt Nam.",
    targetAction: "skill.vn-legal-check",
    enabled: true,
    runsCount: 0,
  },
  {
    id: "trg_zalo_lead_capture",
    name: "📱 Tự động bắt SĐT & tạo Đơn nháp khi khách Zalo nhắn địa chỉ",
    source: "zalo_incoming",
    description: "Khi khách hàng gửi tin nhắn có SĐT 10 số trên Zalo cá nhân, tự động trích xuất thông tin Lead và báo cho chủ shop.",
    targetAction: "zalo.extract_lead",
    enabled: true,
    runsCount: 0,
  },
];

let activeInboxWatcher: FSWatcher | null = null;
let inboxDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function getInboxAutoPaths() {
  const inboxDir = resolve(process.cwd(), "data", "inbox-auto");
  const processedDir = resolve(inboxDir, "processed");
  mkdirSync(inboxDir, { recursive: true });
  mkdirSync(processedDir, { recursive: true });
  const readmePath = resolve(inboxDir, "HUONG-DAN-THA-FILE-VAO-DAY.txt");
  if (!existsSync(readmePath)) {
    writeFileSync(
      readmePath,
      [
        "=== THƯ MỤC TỰ ĐỘNG HỌC BẢNG GIÁ & TÀI LIỆU (ZONO AUTO-WATCH INBOX) ===",
        "- Anh/chị chỉ cần chép (copy) hoặc thả bất kỳ file Bảng giá, Danh sách sản phẩm (.docx, .txt, .csv, .md, .html) vào thư mục này.",
        "- Hệ thống ZONO đang chạy ngầm sẽ TỰ ĐỘNG phát hiện, đọc hiểu, nạp vào bộ nhớ RAG của cửa hàng và chuyển file đã học vào thư mục 'processed/'.",
      ].join("\n"),
      "utf8",
    );
  }
  return { inboxDir, processedDir };
}

export function getEventTriggers(bizId: string): LocalEventTrigger[] {
  const s = (bizSettings(bizId) as any)?.eventTriggers;
  if (Array.isArray(s) && s.length > 0) return s as LocalEventTrigger[];
  return DEFAULT_EVENT_TRIGGERS;
}

export function toggleEventTrigger(bizId: string, triggerId: string, enabled: boolean, actor: string) {
  const cur = bizSettings(bizId) as any;
  const list = getEventTriggers(bizId).map((t) => (t.id === triggerId ? { ...t, enabled } : t));
  update("biz", bizId, { settings: { ...cur, eventTriggers: list } });
  audit(bizId, actor, "automation.trigger_toggled", { type: "biz", id: bizId }, { triggerId, enabled });
  return list;
}

export async function scanInboxAutoFolder(bizId: string): Promise<{ processedFiles: string[]; chunksAdded: number }> {
  const { inboxDir, processedDir } = getInboxAutoPaths();
  const triggers = getEventTriggers(bizId);
  const watchTrigger = triggers.find((t) => t.id === "trg_inbox_auto_rag");
  if (watchTrigger && !watchTrigger.enabled) {
    return { processedFiles: [], chunksAdded: 0 };
  }

  ensureDefaultSampleUsers(bizId);
  const primaryUser = q.get<Row>("SELECT id FROM user_account WHERE biz_id = ? ORDER BY created_at ASC LIMIT 1", bizId);
  if (!primaryUser) return { processedFiles: [], chunksAdded: 0 };

  const entries = readdirSync(inboxDir);
  const processedFiles: string[] = [];
  let totalChunks = 0;

  for (const name of entries) {
    if (name.startsWith(".") || name === "processed" || name === "HUONG-DAN-THA-FILE-VAO-DAY.txt") continue;
    if (!/\.(docx|doc|txt|csv|md|markdown|html|htm|json)$/i.test(name)) continue;
    const fullPath = resolve(inboxDir, name);
    try {
      const st = statSync(fullPath);
      if (!st.isFile() || st.size === 0) continue;
      const res = await ingestUserRagFromChat(
        bizId,
        primaryUser.id,
        { fileName: name, filePath: fullPath },
        "auto_inbox_watcher",
      );
      totalChunks += res.chunksAdded ?? 0;
      processedFiles.push(name);
      const destPath = resolve(processedDir, `${Date.now()}_${name}`);
      renameSync(fullPath, destPath);
    } catch {
      // Ignore files still being copied
    }
  }

  if (processedFiles.length > 0) {
    const cur = bizSettings(bizId) as any;
    const updatedTriggers = getEventTriggers(bizId).map((t) =>
      t.id === "trg_inbox_auto_rag"
        ? { ...t, runsCount: (t.runsCount || 0) + processedFiles.length, lastTriggeredAt: nowIso() }
        : t,
    );
    update("biz", bizId, { settings: { ...cur, eventTriggers: updatedTriggers } });
    emit(bizId, "user.rag_auto_ingested", { files: processedFiles, chunksAdded: totalChunks });
  }

  return { processedFiles, chunksAdded: totalChunks };
}

export function ensureInboxAutoWatcher(bizId: string) {
  const { inboxDir } = getInboxAutoPaths();
  if (activeInboxWatcher) return inboxDir;
  try {
    activeInboxWatcher = watch(inboxDir, { persistent: false }, (_eventType, filename) => {
      if (!filename || filename === "processed" || filename.startsWith(".")) return;
      if (inboxDebounceTimer) clearTimeout(inboxDebounceTimer);
      inboxDebounceTimer = setTimeout(() => {
        void scanInboxAutoFolder(bizId);
      }, 1500);
    });
  } catch {
    // Fallback to on-demand scan if OS file watch limit reached
  }
  return inboxDir;
}

// ── CORE 3: 1-Click Industry Agent Bundles & First-Time Setup Wizard (`agent-bundle/installer.ts` pattern) ──

export interface IndustryAgentBundle {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  industry: string;
  tagline: string;
  defaultAgentKey: string;
  pinnedSkills: string[];
  sampleProducts: string;
  samplePolicyRag: string;
  kickoffPrompt: string;
  kickoffReplyMarkdown: string;
}

export const INDUSTRY_AGENT_BUNDLES: IndustryAgentBundle[] = [
  {
    id: "bundle_retail_cosmetics",
    slug: "retail-cosmetics-pro",
    name: "Gói Bán Lẻ, Thời Trang & Mỹ Phẩm",
    emoji: "🛍️",
    industry: "Mỹ phẩm & Thời trang Bán lẻ",
    tagline: "Tự động viết bài bắt trend, làm video 9:16 và chốt đơn COD trên Zalo cá nhân.",
    defaultAgentKey: "content",
    pinnedSkills: ["viral-ai-script", "vn-legal-check", "customer-persona", "content-calendar"],
    sampleProducts: "Combo Chăm sóc da Chuyên sâu, Serum Phục hồi B5, Kem chống nắng phổ rộng",
    samplePolicyRag: "Xưng 'em', gọi khách là 'anh/chị'. Miễn phí giao hàng toàn quốc đơn từ 399k. Kiểm tra hàng trước khi thanh toán (COD). Luôn xin SĐT + Địa chỉ để lên đơn ngay.",
    kickoffPrompt: "Chào bạn, tôi vừa cài gói Bán lẻ & Mỹ phẩm xong. Mình bắt đầu thiết lập lần đầu nhé.",
    kickoffReplyMarkdown: [
      `🛍️ **Đã kích hoạt Gói Nhân sự AI: Bán Lẻ, Thời Trang & Mỹ Phẩm!**`,
      ``,
      `- **Agent chủ lực**: \`@content\` (Viết bài đa kênh) + \`@chat\` (Chốt đơn Zalo COD)`,
      `- **Kỹ năng gắn sẵn**: \`/viral-ai-script\`, \`/vn-legal-check\`, \`/customer-persona\``,
      ``,
      `👉 **Thiết lập 1 chạm**: Anh/chị chỉ cần thả file Bảng giá vào ô chat này (hoặc gõ tên 2–3 mặt hàng chủ lực), em sẽ tự động viết ngay bài mở hàng và kịch bản trả lời khách Zalo!`,
    ].join("\n"),
  },
  {
    id: "bundle_real_estate",
    slug: "real-estate-closer",
    name: "Gói Bất Động Sản & Môi Giới Cao Cấp",
    emoji: "🏢",
    industry: "Bất động sản & Đầu tư",
    tagline: "Phân tích dự án, viết bài phân tích dòng tiền/pháp lý và chăm sóc khách đầu tư VIP qua Zalo.",
    defaultAgentKey: "strategy",
    pinnedSkills: ["marketing-plan", "vn-legal-check", "customer-persona"],
    sampleProducts: "Căn hộ cao cấp trung tâm, Nhà phố thương mại Shophouse, Đất nền pháp lý sổ hồng riêng",
    samplePolicyRag: "Tư vấn chuyên nghiệp, điềm đạm, tập trung vào pháp lý minh bạch, tiềm năng tăng giá và dòng tiền cho thuê. Khéo léo mời khách nhận bảng tính dòng tiền và đặt lịch xem thực tế qua Zalo.",
    kickoffPrompt: "Chào bạn, tôi vừa cài gói Bất động sản xong. Mình bắt đầu thiết lập lần đầu nhé.",
    kickoffReplyMarkdown: [
      `🏢 **Đã kích hoạt Gói Nhân sự AI: Bất Động Sản & Môi Giới Cao Cấp!**`,
      ``,
      `- **Agent chủ lực**: \`@strategy\` (Chiến lược & Phân tích đầu tư) + \`@market_research\``,
      `- **Kỹ năng gắn sẵn**: \`/marketing-plan\`, \`/vn-legal-check\``,
      ``,
      `👉 **Thiết lập 1 chạm**: Anh/chị hãy thả file Thông tin Dự án / Bảng hàng vào ô chat để em lập ngay **Bài phân tích điểm mạnh dự án** và **Kịch bản hẹn khách đi xem thực tế** nhé!`,
    ].join("\n"),
  },
  {
    id: "bundle_education_coaching",
    slug: "education-coaching-funnel",
    name: "Gói Đào Tạo, Khóa Học & Chuyên Gia",
    emoji: "🎓",
    industry: "Giáo dục, Đào tạo & Coaching",
    tagline: "Xây dựng thương hiệu chuyên gia, kịch bản chuỗi video chia sẻ kiến thức và tuyển sinh qua Zalo.",
    defaultAgentKey: "video_script",
    pinnedSkills: ["viral-ai-script", "content-calendar", "marketing-plan"],
    sampleProducts: "Khóa học Thực chiến Chuyên sâu, Chương trình Coaching 1-1, Tài liệu & Công cụ độc quyền",
    samplePolicyRag: "Giọng văn chuyên gia, truyền cảm hứng, thực tế, không hứa hẹn làm giàu ảo. Tư vấn lộ trình học phù hợp từng học viên và hỗ trợ đăng ký qua Zalo.",
    kickoffPrompt: "Chào bạn, tôi vừa cài gói Đào tạo & Khóa học xong.",
    kickoffReplyMarkdown: [
      `🎓 **Đã kích hoạt Gói Nhân sự AI: Đào Tạo, Khóa Học & Chuyên Gia!**`,
      ``,
      `- **Agent chủ lực**: \`@video_script\` (Kịch bản TikTok/Reels chia sẻ giá trị) + \`@follow_up\``,
      `- **Kỹ năng gắn sẵn**: \`/viral-ai-script\`, \`/content-calendar\`, \`/marketing-plan\``,
      ``,
      `👉 **Thiết lập 1 chạm**: Anh/chị hãy cho em biết tên Khóa học hoặc Chủ đề đào tạo để em lên ngay **Lịch 7 bài đăng thu hút học viên**!`,
    ].join("\n"),
  },
  {
    id: "bundle_clinic_spa",
    slug: "clinic-spa-care",
    name: "Gói Nha Khoa, Phòng Khám & Spa Thẩm Mỹ",
    emoji: "🏥",
    industry: "Y tế, Nha khoa & Thẩm mỹ",
    tagline: "Tự động kiểm soát từ ngữ quảng cáo y tế (/vn-legal-check), tư vấn tận tâm và đặt lịch hẹn Zalo.",
    defaultAgentKey: "chat",
    pinnedSkills: ["vn-legal-check", "customer-persona", "content-calendar"],
    sampleProducts: "Gói Thăm khám & Chăm sóc chuyên sâu, Liệu trình Phục hồi Công nghệ cao",
    samplePolicyRag: "Tư vấn ân cần như trợ lý bác sĩ/chuyên viên. Tuân thủ nghiêm ngặt quy định quảng cáo y tế (không dùng từ 'cam kết trị dứt điểm 100%'). Luôn mời khách đặt lịch hẹn trước qua Zalo để không phải chờ đợi.",
    kickoffPrompt: "Chào bạn, tôi vừa cài gói Phòng khám & Spa xong.",
    kickoffReplyMarkdown: [
      `🏥 **Đã kích hoạt Gói Nhân sự AI: Nha Khoa, Phòng Khám & Spa!**`,
      ``,
      `- **Agent chủ lực**: \`@chat\` (Đặt lịch hẹn Zalo) + \`@review\` (Kiểm duyệt ngôn từ y tế)`,
      `- **Kỹ năng gắn sẵn**: \`/vn-legal-check\`, \`/customer-persona\``,
      ``,
      `👉 **Thiết lập 1 chạm**: Anh/chị thả bảng giá dịch vụ vào ô chat để em tự động tư vấn và lên lịch hẹn cho khách nhé!`,
    ].join("\n"),
  },
  {
    id: "bundle_rea_engineering",
    slug: "rea-reverse-engineering-suite",
    name: "Gói Kỹ Sư Dịch Ngược & Kiến Trúc Hệ Thống (REA v50)",
    emoji: "🔬",
    industry: "Công nghệ Phần mềm & AI Agentic Engineering",
    tagline: "Trọn bộ 5 kỹ năng morluto/rea v50 để giải phẫu ứng dụng (.app/Electron/Binary), tối ưu công cụ MCP/CLI và nâng cấp hệ thống.",
    defaultAgentKey: "market_research",
    pinnedSkills: [
      "reverse-engineer-anything",
      "rea-analysis-optimization",
      "rea-tool-design",
      "rea-ci-tests-audit",
      "rea-changelog-update",
    ],
    sampleProducts: "Nền tảng ZONO Agentic AI Local, Bộ công cụ MCP & Multi-CLI Gateway",
    samplePolicyRag: "Phân tích kỹ thuật dựa trên bằng chứng thực nghiệm (Evidence-based rigor), cấu trúc mô-đun rõ ràng, ưu tiên thực thi Local an toàn và tối ưu hiệu năng.",
    kickoffPrompt: "Chào bạn, tôi vừa cài gói Kỹ sư Dịch ngược REA v50 xong.",
    kickoffReplyMarkdown: [
      `🔬 **Đã kích hoạt Gói Kỹ Sư Dịch Ngược & Kiến Trúc Hệ Thống (REA v50)!**`,
      ``,
      `- **Agent chủ lực**: \`@market_research\` (Research & Reverse Engineering) + \`@strategy\``,
      `- **5 Kỹ năng REA gắn sẵn**: \`/reverse-engineer-anything\`, \`/rea-analysis-optimization\`, \`/rea-tool-design\`, \`/rea-ci-tests-audit\`, \`/rea-changelog-update\``,
      ``,
      `👉 **Sẵn sàng thực thi Local**: Anh có thể gõ yêu cầu phân tích bất kỳ ứng dụng, thư mục mã nguồn hoặc kiến trúc Agentic nào ngay trong khung chat!`,
    ].join("\n"),
  },
];

export function applyIndustryAgentBundle(
  bizId: string,
  userId: string,
  bundleId: string,
  actor: string,
) {
  ensureDefaultSampleUsers(bizId);
  const bundle = INDUSTRY_AGENT_BUNDLES.find((b) => b.id === bundleId || b.slug === bundleId);
  if (!bundle) throw new AppError("NOT_FOUND", "Không tìm thấy Gói Nhân sự AI này", 404);

  const store = getManagedUsersStore(bizId);
  const user = byId<Row>("user_account", userId) ?? q.get<Row>("SELECT * FROM user_account WHERE biz_id = ? LIMIT 1", bizId);
  if (!user) throw new AppError("NOT_FOUND", "Không tìm thấy người dùng", 404);

  const curMeta = store[user.id]!;
  const updatedMeta: UserQuotaMeta = {
    ...curMeta,
    industry: bundle.industry,
    productsSummary: curMeta.productsSummary || bundle.sampleProducts,
    ragKnowledgeText: curMeta.ragKnowledgeText || bundle.samplePolicyRag,
  };
  store[user.id] = updatedMeta;
  saveManagedUsersStore(bizId, store);

  const curBiz = bizSettings(bizId) as any;
  update("biz", bizId, {
    settings: {
      ...curBiz,
      activeBundleId: bundle.id,
      activeBundleInstalledAt: nowIso(),
      pinnedSkills: bundle.pinnedSkills,
      defaultAgentKey: bundle.defaultAgentKey,
    },
  });

  audit(bizId, actor, "agent_bundle.installed", { type: "biz", id: bizId }, { bundleId: bundle.id, slug: bundle.slug });

  return {
    ok: true,
    bundle,
    userId: user.id,
    defaultAgentKey: bundle.defaultAgentKey,
    defaultSkillKey: bundle.pinnedSkills[0] ?? "",
    kickoffReplyMarkdown: bundle.kickoffReplyMarkdown,
  };
}

export function exportCustomAgentBundle(bizId: string, userId?: string) {
  ensureDefaultSampleUsers(bizId);
  const store = getManagedUsersStore(bizId);
  const user = (userId ? byId<Row>("user_account", userId) : undefined) ?? q.get<Row>("SELECT * FROM user_account WHERE biz_id = ? LIMIT 1", bizId);
  const meta = user ? store[user.id] : undefined;
  const curBiz = bizSettings(bizId) as any;
  return {
    manifestVersion: "2026.10.zono-bundle.v1",
    exportedAt: nowIso(),
    agent: {
      defaultAgentKey: curBiz?.defaultAgentKey ?? "content",
      pinnedSkills: curBiz?.pinnedSkills ?? ["reverse-engineer-anything", "vn-legal-check"],
    },
    shopDna: {
      brandName: meta?.brandName ?? "Cửa hàng của tôi",
      industry: meta?.industry ?? "",
      productsSummary: meta?.productsSummary ?? "",
      ragKnowledgeText: meta?.ragKnowledgeText ?? "",
    },
    contextOptimizer: getContextOptimizerConfig(bizId),
    eventTriggers: getEventTriggers(bizId),
  };
}

// ── CORE 4: 1-Click Multi-Agent Workflow Chains (DAG) & OpenAI-Compatible Local Agent API ──

export interface MultiAgentWorkflowChainDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  steps: Array<{
    stepNumber: number;
    title: string;
    agentKey: string;
    skillKey?: string;
    instruction: string;
  }>;
}

export const MULTI_AGENT_WORKFLOW_CHAINS: MultiAgentWorkflowChainDef[] = [
  {
    id: "wf_launch_campaign",
    name: "Chuỗi Ra Mắt & Bán Hàng Toàn Diện (3 Agents)",
    emoji: "🚀",
    description: "Bước 1: @market_research phân tích góc đánh → Bước 2: @content viết bài bán hàng → Bước 3: @review + /vn-legal-check rà soát pháp lý & tối ưu chốt đơn.",
    steps: [
      {
        stepNumber: 1,
        title: "Nghiên cứu Insight & Góc tiếp cận khách hàng",
        agentKey: "market_research",
        skillKey: "customer-persona",
        instruction: "Phân tích nhanh 3 nỗi đau (pain points) và 3 điểm chạm mua hàng mạnh nhất cho sản phẩm/yêu cầu này.",
      },
      {
        stepNumber: 2,
        title: "Soạn Bài Đăng Bán Hàng & Kịch Bản Báo Giá",
        agentKey: "content",
        skillKey: "viral-ai-script",
        instruction: "Dựa trên kết quả nghiên cứu ở Bước 1, hãy viết 1 bài đăng Facebook/Zalo thu hút, trình bày rõ giá bán/ưu đãi và lời kêu gọi hành động.",
      },
      {
        stepNumber: 3,
        title: "Rà Soát Pháp Lý (/vn-legal-check) & Tối Ưu Chuyển Đổi",
        agentKey: "review",
        skillKey: "vn-legal-check",
        instruction: "Kiểm tra bài viết ở Bước 2 theo quy định quảng cáo Việt Nam, chỉ ra từ ngữ cần lưu ý (nếu có) và đưa ra bản hoàn chỉnh cuối cùng sẵn sàng đăng ngay.",
      },
    ],
  },
  {
    id: "wf_rea_deep_audit",
    name: "Chuỗi Dịch Ngược & Thiết Kế Kiến Trúc (REA Pipeline)",
    emoji: "🔬",
    description: "Bước 1: @market_research + /reverse-engineer-anything giải phẫu hệ thống → Bước 2: @strategy + /rea-tool-design lập thiết kế nâng cấp Local.",
    steps: [
      {
        stepNumber: 1,
        title: "Giải phẫu Kiến trúc & Luồng thực thi (/reverse-engineer-anything)",
        agentKey: "market_research",
        skillKey: "reverse-engineer-anything",
        instruction: "Phân tích cấu trúc thành phần, luồng dữ liệu và các cơ chế cốt lõi của đối tượng/yêu cầu theo chuẩn REA v50.",
      },
      {
        stepNumber: 2,
        title: "Thiết kế Công cụ & Lộ trình Nâng cấp (/rea-tool-design)",
        agentKey: "strategy",
        skillKey: "rea-tool-design",
        instruction: "Từ kết quả giải phẫu ở Bước 1, đề xuất kiến trúc tích hợp Local, giao thức API/MCP và danh sách các điểm nâng cấp cụ thể.",
      },
    ],
  },
  {
    id: "wf_viral_video_pack",
    name: "Chuỗi Video Ngắn 9:16 + Caption Đa Kênh",
    emoji: "🎬",
    description: "Bước 1: @video_script viết kịch bản phân cảnh TikTok/Reels → Bước 2: @content viết bộ Caption đăng kèm & tin nhắn phản hồi bình luận.",
    steps: [
      {
        stepNumber: 1,
        title: "Kịch bản Video Ngắn 9:16 (Hook 3 giây đầu + Lời thoại)",
        agentKey: "video_script",
        skillKey: "viral-ai-script",
        instruction: "Viết kịch bản video ngắn 25-30 giây có Hook thu hút trong 3 giây đầu, chia rõ Cảnh hình ảnh và Lời thoại tiếng Việt tự nhiên.",
      },
      {
        stepNumber: 2,
        title: "Caption Đăng Kênh & Tin Nhắn Chốt Đơn Dưới Bình Luận",
        agentKey: "content",
        instruction: "Viết Caption ngắn gọn kèm Hashtag cho video trên và 2 mẫu câu trả lời bình luận để kéo khách về Zalo chốt đơn.",
      },
    ],
  },
  {
    id: "wf_zalo_closing_funnel",
    name: "Chuỗi Kịch Bản Chốt Đơn & Đeo Bám Khách Zalo",
    emoji: "💬",
    description: "Bước 1: @chat lập kịch bản báo giá & xử lý chê đắt → Bước 2: @follow_up tạo chuỗi 3 tin nhắn chăm sóc lại khách chưa mua.",
    steps: [
      {
        stepNumber: 1,
        title: "Kịch bản Báo Giá & Xử Lý Từ Chối Trên Zalo",
        agentKey: "chat",
        instruction: "Soạn mẫu tin nhắn báo giá khéo léo trên Zalo cá nhân và cách trả lời khi khách bảo 'Để anh/chị xem thêm' hoặc 'Giá hơi cao'.",
      },
      {
        stepNumber: 2,
        title: "Chuỗi 3 Tin Nhắn Chăm Sóc Lại (Follow-up 24h / 72h / 7 ngày)",
        agentKey: "follow_up",
        instruction: "Soạn 3 tin nhắn ngắn gọn, lịch sự để hỏi thăm và tặng ưu đãi nhẹ cho khách đã hỏi giá trên Zalo nhưng chưa chốt đơn.",
      },
    ],
  },
];

export async function runMultiAgentWorkflowChain(
  bizId: string,
  userId: string,
  input: {
    workflowId: string;
    topicPrompt?: string;
    providerOverride?: "auto" | "claude_cli" | "codex_cli" | "gemini_cli";
  },
  actor: string,
) {
  const startedAtMs = Date.now();
  ensureDefaultSampleUsers(bizId);
  const wf = MULTI_AGENT_WORKFLOW_CHAINS.find((w) => w.id === input.workflowId);
  if (!wf) throw new AppError("NOT_FOUND", "Không tìm thấy Chuỗi Quy trình Đa Agent này", 404);

  const user = byId<Row>("user_account", userId) ?? q.get<Row>("SELECT * FROM user_account WHERE biz_id = ? LIMIT 1", bizId);
  if (!user) throw new AppError("NOT_FOUND", "Không tìm thấy User", 404);

  const store = getManagedUsersStore(bizId);
  const meta = store[user.id]!;
  const baseTopic = (input.topicPrompt ?? "").trim() || meta.productsSummary || meta.brandName || "Sản phẩm chủ lực của cửa hàng";

  const stepResults: Array<{
    stepNumber: number;
    title: string;
    agentKey: string;
    agentEmoji: string;
    skillKey?: string;
    provider: string;
    durationMs: number;
    outputMarkdown: string;
  }> = [];

  let accumulatedContext = `Chủ đề / Yêu cầu gốc của người dùng: ${baseTopic}`;
  let totalTokens = 0;
  let lastProvider = "auto";

  for (const st of wf.steps) {
    const stepPrompt = [
      `[CHUỖI WORKFLOW ĐA AGENT: ${wf.name} — BƯỚC ${st.stepNumber}/${wf.steps.length}: ${st.title}]`,
      `Nhiệm vụ bước này: ${st.instruction}`,
      ``,
      `Ngữ cảnh tích lũy từ các bước trước:`,
      accumulatedContext.slice(-4500),
    ].join("\n");

    const stepRes = await runUserRagAction(
      bizId,
      user.id,
      {
        mode: "post",
        prompt: stepPrompt,
        agentKey: st.agentKey,
        skillKey: st.skillKey,
        providerOverride: input.providerOverride ?? "auto",
        effort: "medium",
      },
      actor,
    );

    stepResults.push({
      stepNumber: st.stepNumber,
      title: st.title,
      agentKey: st.agentKey,
      agentEmoji: AGENT_EMOJIS[st.agentKey] ?? "🤖",
      skillKey: st.skillKey,
      provider: stepRes.provider,
      durationMs: stepRes.durationMs,
      outputMarkdown: stepRes.markdown,
    });

    accumulatedContext += `\n\n--- KẾT QUẢ BƯỚC ${st.stepNumber} (@${st.agentKey}) ---\n${stepRes.markdown}`;
    totalTokens += stepRes.tokensDeducted;
    lastProvider = stepRes.provider;
  }

  const combinedMarkdown = [
    `${wf.emoji} **Đã hoàn tất Chuỗi Đa Agent: ${wf.name}**`,
    `_Chủ đề: ${baseTopic}_`,
    ``,
    ...stepResults.map(
      (r) =>
        `### ${r.agentEmoji} Bước ${r.stepNumber}: ${r.title} (\`@${r.agentKey}\`${r.skillKey ? ` · \`/${r.skillKey}\`` : ""} · ${(r.durationMs / 1000).toFixed(1)}s)\n\n${r.outputMarkdown}`,
    ),
  ].join("\n\n---\n\n");

  const ci = insert("content_item", {
    biz_id: bizId,
    agent_key: wf.steps[wf.steps.length - 1]?.agentKey ?? "assistant",
    kind: `workflow_${wf.id}`,
    channel: "facebook",
    title: `[Workflow] ${wf.name}: ${baseTopic.slice(0, 45)}`,
    body: combinedMarkdown,
    status: "draft",
  });

  return {
    ok: true,
    workflowId: wf.id,
    workflowName: wf.name,
    provider: lastProvider,
    totalDurationMs: Date.now() - startedAtMs,
    tokensDeducted: totalTokens,
    createdRefId: ci.id,
    steps: stepResults,
    markdown: combinedMarkdown,
  };
}

/**
 * Cổng OpenAI-Compatible Local Agent API (`POST /v1/chat/completions` & `GET /v1/models`)
 * học từ `AICoworker.app/src/pages/AgentAPI/index.tsx` để mọi công cụ bên ngoài (n8n, Make, Cursor, Raycast, Zalo Mini App)
 * có thể gọi trực tiếp vào ZONO Local qua chuẩn OpenAI SDK.
 */
export function listOpenAiCompatibleModels(bizId: string) {
  const created = Math.floor(Date.now() / 1000);
  const baseModels = [
    { id: "zono-local-auto", name: "ZONO Local Multi-CLI Auto Router" },
    { id: "zono-gemini-cli", name: "ZONO Local Google Gemini CLI" },
    { id: "zono-codex-cli", name: "ZONO Local OpenAI Codex CLI" },
    { id: "zono-claude-cli", name: "ZONO Local Anthropic Claude CLI" },
    { id: "zono-skill:reverse-engineer-anything", name: "ZONO Skill: Reverse Engineer Anything (REA v50)" },
    { id: "zono-skill:vn-legal-check", name: "ZONO Skill: Kiểm duyệt Pháp lý VN" },
    ...CATALOG.filter((a) => a.key !== "ads").map((a) => ({
      id: `zono-agent:${a.key}`,
      name: `ZONO Agent: ${a.label} (@${a.key})`,
    })),
  ];
  return {
    object: "list",
    data: baseModels.map((m) => ({
      id: m.id,
      object: "model",
      created,
      owned_by: "zono-local-coworker",
      description: m.name,
    })),
  };
}

export async function runOpenAiCompatibleCompletion(
  bizId: string,
  body: {
    model?: string;
    messages?: Array<{ role: string; content: unknown }>;
    prompt?: string;
  },
  actor: string,
) {
  ensureDefaultSampleUsers(bizId);
  const primaryUser = q.get<Row>("SELECT id FROM user_account WHERE biz_id = ? ORDER BY created_at ASC LIMIT 1", bizId);
  if (!primaryUser) throw new AppError("NOT_FOUND", "Chưa có User trong hệ thống", 404);

  const requestedModel = String(body.model || "zono-local-auto").trim();
  const lastUserMsg = Array.isArray(body.messages)
    ? [...body.messages]
        .reverse()
        .find((m) => m.role === "user")
    : undefined;
  const promptText =
    typeof lastUserMsg?.content === "string"
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
      ? lastUserMsg.content.map((p: any) => p?.text || "").join("\n")
      : String(body.prompt || "Xin chào");

  let agentKey: string | undefined;
  let skillKey: string | undefined;
  let providerOverride: "auto" | "claude_cli" | "codex_cli" | "gemini_cli" = "auto";

  if (requestedModel === "zono-gemini-cli") providerOverride = "gemini_cli";
  else if (requestedModel === "zono-codex-cli") providerOverride = "codex_cli";
  else if (requestedModel === "zono-claude-cli") providerOverride = "claude_cli";
  else if (requestedModel.startsWith("zono-agent:")) agentKey = requestedModel.slice("zono-agent:".length);
  else if (requestedModel.startsWith("zono-skill:")) skillKey = requestedModel.slice("zono-skill:".length);

  const res = await runUserRagAction(
    bizId,
    primaryUser.id,
    {
      mode: "post",
      prompt: promptText,
      agentKey,
      skillKey,
      providerOverride,
    },
    actor,
  );

  const tokensIn = Math.max(50, Math.round(res.tokensDeducted * 0.4));
  const tokensOut = Math.max(50, res.tokensDeducted - tokensIn);

  return {
    id: `chatcmpl-zono-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: requestedModel,
    provider_executed: res.provider,
    agent_executed: res.agentKey,
    skill_executed: res.skillKey ?? null,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: res.markdown,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: tokensIn,
      completion_tokens: tokensOut,
      total_tokens: res.tokensDeducted,
    },
  };
}

/**
 * Trạng thái Local Coworker (học từ kiến trúc AICoworker.app / OpenClaw):
 * Cung cấp danh sách @Agents, /Skills (bao gồm bộ `reverse-engineer-anything` REA v50),
 * Tệp & Kết quả Local trong Workspace, Context Optimizer, Auto-Watch Inbox, Industry Bundles & Multi-Agent Workflows.
 */
export function getLocalCoworkerState(bizId: string, forceRescan = false) {
  if (forceRescan) {
    autoConfigureSystemClis(bizId, true);
  }
  const inboxDir = ensureInboxAutoWatcher(bizId);
  const scan = scanSystemAiClis(forceRescan);
  const providersStatus = allProvidersStatus(bizId);
  const eff = effectiveProvider(bizId);
  const settings = llmSettings(bizId);
  const curBiz = bizSettings(bizId) as any;

  const agents = CATALOG.filter((a) => a.key !== "ads").map((a) => ({
    key: a.key,
    label: a.label,
    emoji: AGENT_EMOJIS[a.key] ?? "🤖",
    description: a.description,
    stage: a.stage,
    tier: a.tier,
    tools: a.tools,
  }));

  const skillRows = q.all<Row>(
    `SELECT key, name, description, grp, size, version
     FROM skill
     WHERE biz_id = ? AND status = 'active'
     ORDER BY
       CASE
         WHEN key = 'reverse-engineer-anything' THEN 0
         WHEN key LIKE 'rea-%' THEN 1
         WHEN key IN ('vn-legal-check', 'marketing-plan', 'viral-ai-script', 'content-calendar', 'customer-persona') THEN 2
         ELSE 3
       END,
       grp ASC,
       key ASC`,
    bizId,
  );

  const skills = skillRows.map((s) => ({
    key: String(s.key),
    name: String(s.name || s.key),
    description: String(s.description || "").slice(0, 220),
    grp: String(s.grp || "general"),
    size: Number(s.size || 0),
    version: Number(s.version || 1),
    isRea: String(s.key) === "reverse-engineer-anything" || String(s.key).startsWith("rea-"),
  }));

  const safeAll = (sql: string, ...params: unknown[]) => {
    try {
      return q.all<Row>(sql, ...params);
    } catch {
      return [];
    }
  };

  // Lấy danh sách Tệp & Kết quả Local trong Workspace (RAG Docs, Bài viết/Kịch bản đã tạo, Ảnh AI, Ghi chú Brain)
  const ragDocs = safeAll(
    "SELECT id, title, kind, source, status, updated_at, SUBSTR(body, 1, 280) AS snippet FROM knowledge_doc WHERE biz_id = ? ORDER BY updated_at DESC LIMIT 20",
    bizId,
  );
  const contentItems = safeAll(
    "SELECT id, agent_key, kind, channel, title, status, updated_at, SUBSTR(body, 1, 320) AS snippet FROM content_item WHERE biz_id = ? ORDER BY updated_at DESC LIMIT 25",
    bizId,
  );
  const creativeAssets = safeAll(
    "SELECT id, kind, meta, created_at FROM creative_asset WHERE biz_id = ? ORDER BY created_at DESC LIMIT 16",
    bizId,
  );
  const brainNotes = safeAll(
    "SELECT id, folder, title, tags, updated_at, SUBSTR(body, 1, 240) AS snippet FROM brain_note WHERE biz_id = ? ORDER BY updated_at DESC LIMIT 15",
    bizId,
  );

  return {
    ok: true,
    effectiveProvider: eff,
    llmSettings: settings,
    providersStatus,
    systemScan: scan,
    agents,
    skills,
    contextOptimizer: getContextOptimizerConfig(bizId),
    automation: {
      inboxAutoDir: inboxDir,
      triggers: getEventTriggers(bizId),
    },
    bundles: {
      activeBundleId: curBiz?.activeBundleId ?? null,
      activeBundleInstalledAt: curBiz?.activeBundleInstalledAt ?? null,
      catalog: INDUSTRY_AGENT_BUNDLES,
    },
    workflows: MULTI_AGENT_WORKFLOW_CHAINS,
    agentApi: {
      endpoint: "http://localhost:8787/v1/chat/completions",
      modelsEndpoint: "http://localhost:8787/v1/models",
      sampleModels: ["zono-local-auto", "zono-gemini-cli", "zono-codex-cli", "zono-skill:reverse-engineer-anything"],
    },
    workspace: {
      ragDocs: ragDocs.map((d) => ({
        id: d.id,
        title: d.title,
        kind: d.kind,
        source: d.source,
        updatedAt: d.updated_at,
        snippet: d.snippet,
      })),
      contentItems: contentItems.map((c) => ({
        id: c.id,
        agentKey: c.agent_key,
        kind: c.kind,
        channel: c.channel,
        title: c.title,
        status: c.status,
        updatedAt: c.updated_at,
        snippet: c.snippet,
      })),
      creativeAssets: creativeAssets.map((a) => ({
        id: a.id,
        kind: a.kind,
        url: `/v1/media/${a.id}`,
        meta: a.meta,
        createdAt: a.created_at,
      })),
      brainNotes: brainNotes.map((n) => ({
        id: n.id,
        folder: n.folder,
        title: n.title,
        tags: n.tags,
        updatedAt: n.updated_at,
        snippet: n.snippet,
      })),
    },
  };
}

/**
 * Run a live AI + DNA RAG + Local Agentic Skill execution for a specific User
 * (Post / Image / Video / Zalo Personal Sale / Any @Agent + /Skill),
 * deducting from their centralized Token Quota and recording in `model_usage`.
 */
export async function runUserRagAction(
  bizId: string,
  userId: string,
  input: {
    mode: "post" | "image" | "video" | "zalo_sale";
    prompt?: string;
    agentKey?: string;
    skillKey?: string;
    providerOverride?: "auto" | "claude_cli" | "codex_cli" | "gemini_cli";
    effort?: "low" | "medium" | "high";
  },
  actor: string,
) {
  const startedAtMs = Date.now();
  ensureDefaultSampleUsers(bizId);
  const store = getManagedUsersStore(bizId);
  const user = byId<Row>("user_account", userId);
  const meta = store[userId];
  if (!user || !meta) throw new AppError("NOT_FOUND", "Không tìm thấy User hoặc cấu hình Quota", 404);
  if (user.status !== "active") throw new AppError("USER_BLOCKED", "Tài khoản User này đang tạm khóa", 403);

  let rawPrompt = (input.prompt ?? "").trim();

  // Tự động nhận diện @agent_key và /skill_key ngay trong nội dung câu chat (giống AICoworker.app)
  let detectedAgentKey = input.agentKey?.trim() || "";
  let detectedSkillKey = input.skillKey?.trim() || "";

  const mentionMatch = rawPrompt.match(/(?:^|\s)@([a-z0-9_-]+)/i);
  if (mentionMatch) {
    const candidateAgent = mentionMatch[1]!.toLowerCase();
    if (CATALOG.some((a) => a.key === candidateAgent)) {
      if (!detectedAgentKey) detectedAgentKey = candidateAgent;
      rawPrompt = rawPrompt.replace(mentionMatch[0], " ").trim();
    }
  }

  const slashMatch = rawPrompt.match(/^\/([a-z0-9_-]+)(?:\s+|$)/i);
  if (slashMatch) {
    const cmd = slashMatch[1]!.toLowerCase();
    const aliasMap: Record<string, string> = {
      rea: "reverse-engineer-anything",
      reverse: "reverse-engineer-anything",
      legal: "vn-legal-check",
      luat: "vn-legal-check",
    };
    const resolvedCmd = aliasMap[cmd] ?? cmd;
    const skillExists = q.get<Row>("SELECT key FROM skill WHERE biz_id = ? AND key = ?", bizId, resolvedCmd);
    if (skillExists) {
      if (!detectedSkillKey) detectedSkillKey = String(skillExists.key);
      rawPrompt = rawPrompt.slice(slashMatch[0].length).trim();
    }
  }

  // ── BỘ ĐIỀU PHỐI AI TỰ ĐỘNG TRONG CHAT CHÍNH (Auto-Orchestrator) ───────────
  // Người dùng chỉ cần gõ tự nhiên, hệ thống tự động phân tích và giao việc cho đúng Agent / Skill / Chuỗi Đa Agent / Điều khiển Máy tính!
  const lowerPrompt = rawPrompt.toLowerCase();

  // A. Tự động điều khiển Máy tính / Mở trình duyệt Chrome / Chụp màn hình (Tích hợp sâu trong Core, không cần quan tâm Muse)
  if (!detectedAgentKey && !detectedSkillKey && /\b(chụp màn hình|quan sát màn hình|screen\.snap|mở trình duyệt|mở chrome)\b/i.test(lowerPrompt)) {
    const urlInPrompt = rawPrompt.match(/https?:\/\/[^\s]+/i)?.[0] || "https://flow.google.com";
    const isSnap = /\b(chụp màn hình|quan sát màn hình|screen\.snap)\b/i.test(lowerPrompt);
    const rpcRes: any = await executeMuseRpc(
      bizId,
      isSnap ? "screen.snap" : "computer.control",
      isSnap ? { view: "image" } : { action: "open_app", app: "Google Chrome", url: urlInPrompt },
      actor,
    );
    return {
      ok: true,
      userId,
      userName: user.name,
      mode: "post" as const,
      agentKey: "assistant",
      agentLabel: "Điều phối Hệ thống",
      agentEmoji: "🖥️",
      provider: "Core Local OS Control",
      fallbackUsed: false,
      primaryAssigned: "claude_cli",
      durationMs: Math.max(80, Date.now() - startedAtMs),
      tokensDeducted: 0,
      quotaAfter: meta,
      ragSources: [],
      createdRefId: null,
      imageUrl: rpcRes.artifact?.imageUrl,
      markdown: isSnap
        ? `📸 **Đã chụp & quan sát màn hình máy tính hiện tại!**\n- Ứng dụng đang mở: **${rpcRes.frontmost_app || "macOS Desktop"}**\n- Tóm tắt: ${rpcRes.summary}`
        : `🚀 **Đã tự động mở trình duyệt Google Chrome tới địa chỉ:** \`${urlInPrompt}\`\n- Trạng thái: ${rpcRes.summary}`,
    };
  }

  // B. Nếu người dùng yêu cầu làm trọn gói Chiến dịch / Đa bước (VD: "lập chiến dịch trọn gói", "nghiên cứu rồi viết bài") → Tự động kích hoạt Chuỗi Đa Agent (Workflow DAG)
  if (
    !detectedAgentKey &&
    !detectedSkillKey &&
    input.mode === "post" &&
    /\b(chiến dịch trọn gói|làm trọn gói|làm trọn bộ|nghiên cứu.*viết bài|kế hoạch.*viết bài|quy trình đa agent)\b/i.test(lowerPrompt)
  ) {
    const wfId = /\b(video|tiktok|reels|kịch bản)\b/i.test(lowerPrompt)
      ? "wf_viral_video_pipeline"
      : /\b(dịch ngược|rea|binary|apk|kiến trúc)\b/i.test(lowerPrompt)
      ? "wf_rea_security_audit"
      : "wf_full_campaign";
    const wfRes = await runMultiAgentWorkflowChain(
      bizId,
      userId,
      { workflowId: wfId, topicPrompt: rawPrompt, providerOverride: input.providerOverride },
      actor,
    );
    return {
      ok: true,
      userId,
      userName: user.name,
      mode: "post" as const,
      agentKey: "strategy",
      agentLabel: `Điều phối Đa Agent (${wfRes.workflowName})`,
      agentEmoji: "⛓️",
      provider: wfRes.provider,
      fallbackUsed: false,
      primaryAssigned: wfRes.provider,
      durationMs: wfRes.totalDurationMs,
      tokensDeducted: wfRes.tokensDeducted,
      quotaAfter: getManagedUsersStore(bizId)[userId] ?? meta,
      ragSources: [],
      createdRefId: wfRes.createdRefId,
      markdown: wfRes.markdown,
    };
  }

  // C. Tự động chọn Chuyên gia AI (@Agent) & Kỹ năng (/Skill) phù hợp nhất với câu nói tự nhiên của người dùng
  if (!detectedAgentKey && input.mode === "post") {
    if (/\b(dịch ngược|reverse engineer|decompile|ghidra|radare2|rizin|mach-o|elf|apk|ipa|binary)\b/i.test(lowerPrompt)) {
      detectedAgentKey = "market_research";
      if (!detectedSkillKey) detectedSkillKey = "reverse-engineer-anything";
    } else if (/\b(luật|pháp lý|nghị định|thuế|kiểm duyệt pháp lý|vi phạm|quảng cáo cấm)\b/i.test(lowerPrompt)) {
      detectedAgentKey = "review";
      if (!detectedSkillKey) detectedSkillKey = "vn-legal-check";
    } else if (/\b(nghiên cứu thị trường|đối thủ|insight|chân dung khách hàng|khảo sát|xu hướng)\b/i.test(lowerPrompt)) {
      detectedAgentKey = "market_research";
      if (!detectedSkillKey) detectedSkillKey = "customer-persona";
    } else if (/\b(chiến lược|kế hoạch marketing|lập kế hoạch|lịch đăng bài|content calendar|phễu bán hàng)\b/i.test(lowerPrompt)) {
      detectedAgentKey = "strategy";
      if (!detectedSkillKey) {
        detectedSkillKey = /\b(lịch đăng|calendar|7 ngày|30 ngày)\b/i.test(lowerPrompt) ? "content-calendar" : "marketing-plan";
      }
    } else if (/\b(chuẩn seo|bài seo|từ khoá|từ khóa|website|landing page|blog)\b/i.test(lowerPrompt)) {
      detectedAgentKey = "seo_web";
    } else if (/\b(youtube seo|seo youtube|thumbnail|ảnh thu nhỏ|tiêu đề youtube)\b/i.test(lowerPrompt)) {
      detectedAgentKey = "video_script";
      if (!detectedSkillKey) detectedSkillKey = "fk-youtube-seo";
    } else if (/\b(kịch bản video|kịch bản tiktok|kịch bản reels|storyboard|lời bình video|phân cảnh|scene lock|đồng nhất nhân vật|người que|stickman|nhân quả|dân gian|3d pixar|góc máy|multi-angle|frameweaver)\b/i.test(lowerPrompt)) {
      detectedAgentKey = "video_script";
      if (!detectedSkillKey) {
        if (/\b(góc máy|camera|multi-angle|cận cảnh|dolly)\b/i.test(lowerPrompt)) {
          detectedSkillKey = "fk-camera-guide";
        } else if (/\b(người que|stickman|nhân quả|dân gian|3d pixar|ghibli|chibi|đất sét|frameweaver)\b/i.test(lowerPrompt)) {
          detectedSkillKey = "fk-pipeline";
        } else if (/\b(phân cảnh|scene lock|đồng nhất nhân vật|khung đầu|khung cuối)\b/i.test(lowerPrompt)) {
          detectedSkillKey = "scene-lock-video";
        } else {
          detectedSkillKey = "viral-ai-script";
        }
      }
    } else if (/\b(doanh thu|báo cáo|thống kê|chỉ số|kpi|roas|hiệu quả)\b/i.test(lowerPrompt)) {
      detectedAgentKey = "analytics";
    }
  }

  const selectedAgent = CATALOG.find((a) => a.key === detectedAgentKey);
  const activeSkillRow = detectedSkillKey
    ? q.get<Row>("SELECT key, name, description, body FROM skill WHERE biz_id = ? AND key = ?", bizId, detectedSkillKey)
    : undefined;

  const isImagePrompt =
    input.mode === "image" ||
    (!activeSkillRow &&
      !selectedAgent &&
      /\b(vẽ|tạo ảnh|thiết kế ảnh|ảnh|poster|banner|minh hoạ|biếm hoạ|châm biếm|châm biếng|tranh|vẽ hình)\b/i.test(rawPrompt));
  const effectiveMode: "post" | "image" | "video" | "zalo_sale" = isImagePrompt && input.mode === "post" ? "image" : input.mode;

  // 1. Check centralized quotas
  if (meta.tokensUsed >= meta.tokenLimit) {
    throw new AppError("QUOTA_EXCEEDED", `User "${user.name}" đã dùng hết hạn mức Token tháng (${meta.tokensUsed.toLocaleString()}/${meta.tokenLimit.toLocaleString()} tokens). Vui lòng nâng cấp gói!`, 429);
  }
  if (effectiveMode === "video" && meta.videosUsed >= meta.videoLimit) {
    throw new AppError("QUOTA_EXCEEDED", `User "${user.name}" đã dùng hết hạn mức Video tháng (${meta.videosUsed}/${meta.videoLimit} video).`, 429);
  }
  if ((effectiveMode === "post" || effectiveMode === "image") && meta.postsUsed >= meta.postLimit) {
    throw new AppError("QUOTA_EXCEEDED", `User "${user.name}" đã dùng hết hạn mức Bài đăng tháng (${meta.postsUsed}/${meta.postLimit} bài).`, 429);
  }

  // 2. Retrieve RAG chunks for this user & run Context Optimizer (Core 1)
  const rawUserChunks = q.all<Row>(
    "SELECT c.text, c.source_ref FROM knowledge_chunk c JOIN knowledge_doc d ON d.id = c.doc_id WHERE d.biz_id = ? AND (d.source = ? OR d.kind = 'dna_rag') ORDER BY c.idx ASC LIMIT 16",
    bizId,
    `user_rag:${userId}`,
  );
  const optCtx = optimizePromptAndSkillContext(
    bizId,
    rawPrompt,
    rawUserChunks,
    activeSkillRow ? String(activeSkillRow.body ?? "") : undefined,
  );
  const userChunks = optCtx.selectedChunks;

  const ragContextLines = [
    meta.brandName && meta.brandName !== "Cửa hàng của tôi" ? `- Thương hiệu / Cửa hàng: ${meta.brandName}` : "",
    meta.industry ? `- Ngành hàng: ${meta.industry}` : "",
    meta.productsSummary ? `- Sản phẩm & Bảng giá: ${meta.productsSummary}` : "",
    meta.ragKnowledgeText ? `- Chính sách & Tri thức cửa hàng: ${meta.ragKnowledgeText}` : "",
    ...userChunks.map((c) => `- Tài liệu RAG (${c.source_ref}): ${String(c.text).slice(0, 380)}`),
  ].filter(Boolean);
  const ragBlock = ragContextLines.length > 0
    ? `\n\nTHÔNG TIN CỬA HÀNG & BẢNG GIÁ (RAG ĐÃ TỐI ƯU):\n${ragContextLines.join("\n")}`
    : "";

  // 3. Resolve centralized AI Provider from the pool
  const effectiveAgentKey = selectedAgent?.key || (effectiveMode === "video" ? "video_script" : effectiveMode === "zalo_sale" ? "chat" : "content");
  const taskCat = effectiveMode === "video"
    ? "video"
    : effectiveMode === "image"
    ? "image"
    : activeSkillRow?.key === "reverse-engineer-anything" || String(activeSkillRow?.key ?? "").startsWith("rea-")
    ? "complex"
    : taskCategoryForAgent(effectiveAgentKey, rawPrompt);

  const explicitProvider: Provider | undefined =
    input.providerOverride && input.providerOverride !== "auto"
      ? input.providerOverride
      : meta.preferredProvider && meta.preferredProvider !== "auto" && meta.preferredProvider !== "local_studio"
      ? meta.preferredProvider
      : undefined;

  const resolvedRoute = resolveProviderForTask(bizId, taskCat, explicitProvider);
  const resolved = {
    provider: resolvedRoute.provider,
    model: "central-pool-model",
    fallbackUsed: resolvedRoute.provider !== resolvedRoute.primaryAssigned,
    primaryAssigned: resolvedRoute.primaryAssigned,
    reason: resolvedRoute.reason,
  };

  const tierMap: Record<string, Tier> = { low: "small", medium: "medium", high: "large" };
  const effectiveTier: Tier = input.effort ? tierMap[input.effort] ?? "medium" : (selectedAgent?.tier as Tier) || "medium";

  const skillPlaybookSuffix = activeSkillRow
    ? [
        `\n\n=== KỸ NĂNG CHUYÊN SÂU ĐƯỢC GẮN TRỰC TIẾP (SKILL PLAYBOOK: ${activeSkillRow.name} [${activeSkillRow.key}]) ===`,
        `Mô tả kỹ năng: ${activeSkillRow.description}`,
        `Hướng dẫn thực thi từ SKILL.md (Context Optimizer):`,
        optCtx.prunedSkillBody ?? String(activeSkillRow.body ?? "").slice(0, 6_500),
        `=== KẾT THÚC SKILL PLAYBOOK ===`,
      ].join("\n")
    : undefined;

  const topic = (rawPrompt || (activeSkillRow ? `Thực thi kỹ năng ${activeSkillRow.name}` : meta.productsSummary) || `Nội dung cho ${meta.brandName}`).slice(0, 140);
  let tokensIn = 420 + Math.floor(topic.length * 3);
  let tokensOut = 680;
  let actualProvider = String(resolved.provider);
  let outputMarkdown = "";
  let createdRefId: string | null = null;
  let imageUrl: string | undefined;
  let videoUrl: string | undefined;
  let audioUrl: string | undefined;

  if (effectiveMode === "image") {
    const ci = insert("content_item", {
      biz_id: bizId,
      agent_key: effectiveAgentKey,
      kind: "social_post",
      channel: "facebook",
      title: topic.slice(0, 80),
      body: `${rawPrompt}${ragBlock}`,
      status: "draft",
    });
    createdRefId = ci.id;
    meta.postsUsed += 1;

    try {
      const asset = await createPostImage(bizId, ci.id, {
        note: `${rawPrompt}. Hãy thể hiện đúng tinh thần yêu cầu (nếu là ảnh châm biếm/hài hước/minh hoạ thì vẽ hình minh hoạ và lời bình thật sắc sảo, dí dỏm, bắt mắt).`,
        actor: user.name,
      });
      imageUrl = `/v1/media/${asset.id}`;
      actualProvider = asset.meta?.engine === "chatgpt" ? "codex_cli" : String(asset.meta?.model || resolved.provider);
      const headline = asset.meta?.headline ? `**${asset.meta.headline}**\n\n` : "";
      const alt = asset.meta?.alt ? `_${asset.meta.alt}_\n\n` : "";
      outputMarkdown = [
        `🎨 Đã vẽ xong bức ảnh theo yêu cầu: **"${rawPrompt}"**`,
        ``,
        headline + alt,
        `Mình có thể xem trực tiếp bức ảnh bên dưới hoặc bấm **Tải ảnh về máy** để đăng bài/gửi Zalo ngay nhé!`,
      ].filter(Boolean).join("\n");
      update("content_item", ci.id, { body: outputMarkdown });
    } catch (imgErr: any) {
      outputMarkdown = `⚠️ Chưa xuất được file ảnh tự động (${imgErr?.message ?? "lỗi trình dựng ảnh"}).`;
    }
  } else if (effectiveMode === "post") {
    const OutSchema = z.object({
      replyMarkdown: z.string().describe("Nội dung trả lời, phân tích hoặc bài viết hoàn chỉnh bằng tiếng Việt, trình bày tự nhiên, sắc sảo, sẵn sàng sử dụng ngay"),
    });
    const agentRoleLine = selectedAgent
      ? `Bạn đang đóng vai trò **${selectedAgent.label} (@${selectedAgent.key})** — ${selectedAgent.description}.`
      : "Bạn là trợ lý Agentic AI vận hành cục bộ (Local Coworker) thông minh cho doanh nghiệp & chủ cửa hàng tại Việt Nam.";

    const genRes = await generate({
      bizId,
      agentKey: effectiveAgentKey,
      tier: effectiveTier,
      taskCategory: taskCat,
      preferredProvider: explicitProvider,
      fast: input.effort !== "high",
      system: [
        agentRoleLine,
        activeSkillRow
          ? `Người dùng đã gắn trực tiếp kỹ năng cục bộ **/${activeSkillRow.key}** (${activeSkillRow.name}). Hãy áp dụng nghiêm ngặt phương pháp luận, cấu trúc phân tích và tiêu chuẩn đầu ra của kỹ năng này để giải quyết yêu cầu.`
          : "Hãy thực hiện ĐÚNG yêu cầu của người dùng một cách tự nhiên, sắc sảo, thông minh, trình bày Markdown đẹp mắt.",
        "TUYỆT ĐỐI KHÔNG in các tiêu đề máy móc như 'Bài Đăng Bán Hàng Chuẩn DNA & RAG', KHÔNG in các dòng trống như 'Sản phẩm nổi bật từ DNA:' khi chưa có dữ liệu.",
        "Nếu có thông tin cửa hàng/bảng giá RAG đi kèm và phù hợp với câu hỏi thì lồng ghép khéo léo; nếu người dùng yêu cầu phân tích kỹ thuật, dịch ngược ứng dụng (REA), kiểm tra pháp lý, lập chiến lược hay viết nội dung bất kỳ thì trả lời sâu sắc, đúng trọng tâm.",
      ].join("\n"),
      systemSuffix: skillPlaybookSuffix,
      user: `Yêu cầu của người dùng: ${rawPrompt || topic}${ragBlock}`,
      schema: OutSchema,
      sandbox: () => ({
        replyMarkdown: [
          `✨ **${topic}**`,
          ``,
          activeSkillRow
            ? `Đã kích hoạt kỹ năng **/${activeSkillRow.key}** (${activeSkillRow.name}) cùng **@${effectiveAgentKey}**.`
            : meta.productsSummary
            ? `Hiện tại bên mình đang có sẵn **${meta.productsSummary}** với ưu đãi đặc biệt. ${meta.ragKnowledgeText || ""}`
            : `Dạ em đã ghi nhận yêu cầu: _"${rawPrompt}"_. Anh/chị có thể thả thêm file bảng giá hoặc mô tả sản phẩm vào ô chat để em viết bài sát với mặt hàng của mình nhất nhé!`,
        ].join("\n"),
      }),
    });
    outputMarkdown = genRes.output.replyMarkdown.trim();
    actualProvider = genRes.provider;
    tokensIn = genRes.usage.input || tokensIn;
    tokensOut = genRes.usage.output || tokensOut;

    const ci = insert("content_item", {
      biz_id: bizId,
      agent_key: effectiveAgentKey,
      kind: activeSkillRow ? `skill_${activeSkillRow.key}` : "social_post",
      channel: "facebook",
      title: topic.slice(0, 60),
      body: outputMarkdown,
      status: "draft",
    });
    createdRefId = ci.id;
    meta.postsUsed += 1;
  } else if (effectiveMode === "video") {
    const fwPlan = buildFrameWeaverProductionPlan({
      topic,
      rawPrompt,
      brandName: meta.brandName,
      productsSummary: meta.productsSummary,
      ragKnowledgeText: meta.ragKnowledgeText,
    });

    const mediaRes: any = await executeMuseRpc(
      bizId,
      "hatch.message.agent_media_generation",
      {
        prompt: fwPlan.expandedEnginePrompt,
        voiceText: fwPlan.fullVoiceoverVi,
        voice: "Binh (nam miền Bắc)",
      },
      actor,
    ).catch(() => null);

    const job =
      (mediaRes?.data?.jobId ? byId<Row>("creative_job", String(mediaRes.data.jobId)) : null) ??
      startVideoJob(
        bizId,
        {
          tool: "anim-video",
          title: fwPlan.seoTitle.slice(0, 55),
          brief: `${fwPlan.expandedEnginePrompt}${ragBlock}`,
          images: [],
          channels: ["tiktok", "facebook"],
          durationSec: 25,
          video: { voice: "Binh (nam miền Bắc)", aspectRatio: "9:16" },
        },
        `${user.name} · Core Video`,
      )!;
    createdRefId = job.id;
    videoUrl = mediaRes?.artifact?.videoUrl ?? "/muse/HatchMaking.mp4";
    audioUrl = mediaRes?.artifact?.audioUrl;
    meta.videosUsed += 1;
    outputMarkdown = [
      `🎬 **Đã dựng Video AI Đa Phân Cảnh Chuẩn Điện Ảnh: "${fwPlan.seoTitle}"**`,
      `- **Mã Video**: \`#${job.id.slice(0, 8)}\` · Phong cách: **${fwPlan.style.name}** (\`${fwPlan.style.id}\`) · Định dạng dọc \`9:16 (1080×1920)\` · 5 phân cảnh (\`Narrator-Fit 48kHz Stereo\`)`,
      ``,
      `### 🎨 1. Hồ Sơ Tham Chiếu Thực Thể & Phong Cách (Entity Reference Bible)`,
      ...fwPlan.entities.map((e) => `- **${e.name}** (\`${e.entityType}\`): ${e.description}`),
      ``,
      `### 🎞️ 2. Kịch Bản 5 Cảnh Đa Góc Máy (\`ROOT\` · \`CONTINUATION\` · \`INSERT [EDIT←2]\`)`,
      ...fwPlan.scenes.map(
        (s) =>
          `**${s.code}** (\`${s.timeRange}\` · Cắt khớp giọng đọc \`${s.cutDurationSec}s\` · Chữ nổi: \`[${s.overlayStyle.toUpperCase()}] ${s.overlayText}\`)\n` +
          `- 🎙️ **Voice (tiếng Việt)**: _"${s.voiceVi}"_\n` +
          `- 🎥 **Camera (Câu độc lập)**: \`${s.cameraSentence}\`\n` +
          `- 🖼️ **Nối khung hình**: ${s.startFrame} ➔ ${s.endFrame}\n` +
          `- 🔊 **3 Lớp Âm thanh**: \`${s.audioLayers}\``,
      ),
      ``,
      `### 🚀 3. Bộ SEO YouTube Shorts / TikTok & Thumbnail CTR Cao`,
      `- **Tiêu đề Hook (<65 ký tự)**: **${fwPlan.seoTitle}**`,
      `- **Hashtags**: \`${fwPlan.hashtags.join(" ")}\``,
      `- **Prompt Thumbnail (6 Công thức)**: \`${fwPlan.thumbnailPrompt}\``,
    ].filter(Boolean).join("\n\n");
  } else {
    // zalo_sale mode: Personal Zalo & Messenger CRM response + POS order readiness
    meta.zaloMsgsUsed += 1;
    const OutSchema = z.object({
      zaloReply: z.string().describe("Tin nhắn trả lời khách hàng trên Zalo một cách lịch sự, thân thiện, tự nhiên như người thật, báo giá chính xác từ RAG (nếu có) và khéo léo xin SĐT/Địa chỉ chốt đơn"),
    });
    const genRes = await generate({
      bizId,
      agentKey: "chat",
      tier: "small",
      taskCategory: "general",
      preferredProvider: explicitProvider,
      fast: true,
      system: [
        "Bạn là nhân viên tư vấn bán hàng qua Zalo cá nhân của cửa hàng.",
        "Hãy trả lời tin nhắn của khách hàng thật tự nhiên, lễ phép (Dạ/vâng), ngắn gọn dễ đọc trên điện thoại.",
        "Nếu có thông tin sản phẩm & bảng giá trong RAG thì báo giá chính xác; nếu chưa có giá cụ thể thì tư vấn nhiệt tình và hỏi thêm nhu cầu của khách.",
      ].join("\n"),
      systemSuffix: skillPlaybookSuffix,
      user: `Tin nhắn của khách hàng Zalo: "${rawPrompt}"${ragBlock}`,
      schema: OutSchema,
      sandbox: () => ({
        zaloReply: meta.productsSummary
          ? `Dạ chào anh/chị ạ! Bên em hiện đang có sẵn ${meta.productsSummary}. ${meta.ragKnowledgeText ? `${meta.ragKnowledgeText}. ` : ""}Anh/chị cho em xin SĐT và địa chỉ nhận hàng để em lên đơn gửi mình luôn nhé ạ! ❤️`
          : `Dạ chào anh/chị ạ! Em đã nhận được tin nhắn của mình về "${rawPrompt}". Anh/chị cần tư vấn chi tiết mẫu nào cứ nhắn em báo giá ngay nhé ạ! ❤️`,
      }),
    });
    outputMarkdown = genRes.output.zaloReply.trim();
    actualProvider = genRes.provider;
    tokensIn = genRes.usage.input || tokensIn;
    tokensOut = genRes.usage.output || tokensOut;
  }

  const totalTokens = tokensIn + tokensOut;
  const durationMs = Math.max(120, Date.now() - startedAtMs);

  // 4. Deduct tokens & record in `model_usage`
  meta.tokensUsed += totalTokens;
  store[userId] = meta;
  saveManagedUsersStore(bizId, store);

  insert("model_usage", {
    biz_id: bizId,
    task_run_id: createdRefId,
    agent_key: effectiveAgentKey,
    provider: actualProvider,
    model: resolved.model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    tokens_cached: 0,
    cost_micros: 0,
    latency_ms: durationMs,
    at: nowIso(),
  });

  audit(bizId, actor, "user_quota.rag_executed", { type: "user_account", id: userId }, {
    mode: effectiveMode,
    agentKey: effectiveAgentKey,
    skillKey: activeSkillRow?.key ?? null,
    provider: actualProvider,
    tokensUsed: totalTokens,
    durationMs,
  });

  return {
    ok: true,
    userId,
    userName: user.name,
    mode: effectiveMode,
    agentKey: effectiveAgentKey,
    agentLabel: selectedAgent?.label ?? (effectiveMode === "video" ? "Video Agent" : effectiveMode === "zalo_sale" ? "Chat Agent" : "Content Agent"),
    agentEmoji: AGENT_EMOJIS[effectiveAgentKey] ?? "🤖",
    skillKey: activeSkillRow ? String(activeSkillRow.key) : undefined,
    skillName: activeSkillRow ? String(activeSkillRow.name) : undefined,
    provider: actualProvider,
    fallbackUsed: resolved.fallbackUsed,
    primaryAssigned: resolved.primaryAssigned,
    durationMs,
    tokensDeducted: totalTokens,
    contextOptimized: {
      savedTokens: optCtx.savedTokensEst,
      savedPct: optCtx.savedPct,
    },
    quotaAfter: meta,
    ragSources: userChunks.map((c) => c.source_ref),
    createdRefId,
    imageUrl,
    videoUrl,
    audioUrl,
    markdown: outputMarkdown,
  };
}

// ── Multi-Zalo Personal Account Login & Management Hub ──────────────────────

export interface ZaloPersonalAccount {
  id: string;
  ownId?: string;
  name: string;
  phone: string;
  roleLabel: string;
  loginMethod: "zca_qr" | "qr_local_chrome" | "cookie_imei" | "zlcrm_bridge";
  chromeProfileDir: string;
  cookieFile?: string;
  proxyUrl?: string;
  assignedUserId: string;
  assignedUserName: string;
  brandName: string;
  status: "connected" | "qr_pending" | "disconnected";
  autoReplyEnabled: boolean;
  groupMentionReplyEnabled?: boolean;
  autoFollowUpEnabled: boolean;
  autoPushPancakePos: boolean;
  todayMessages: number;
  todayOrders: number;
  lastActiveAt: string;
}

function getZaloAccountsStore(bizId: string): ZaloPersonalAccount[] {
  const s = bizSettings(bizId) as unknown as Record<string, unknown>;
  return Array.isArray(s.zaloPersonalAccounts) ? (s.zaloPersonalAccounts as ZaloPersonalAccount[]) : [];
}

function syncZaloAccountsToConnection(bizId: string, list: ZaloPersonalAccount[]) {
  const s = bizSettings(bizId);
  update("biz", bizId, { settings: { ...s, zaloPersonalAccounts: list } });

  // Also keep `connection` (platform = 'zlcrm') in sync so /zalo page sees all personal Zalo accounts immediately
  const existingConn = q.get<Row>("SELECT * FROM connection WHERE biz_id = ? AND platform = 'zlcrm' AND status != 'revoked' ORDER BY updated_at DESC LIMIT 1", bizId);
  const mappedAccounts = list.map((a) => ({
    id: a.id,
    name: `${a.name} (${a.phone})`,
    phone: a.phone,
    status: a.status === "connected" ? "connected" : "disconnected",
  }));
  if (existingConn) {
    update("connection", existingConn.id, {
      display_name: `Hệ thống Đa Tài khoản Zalo Cá nhân (${list.length} nick)`,
      status: "active",
      config: {
        ...(existingConn.config ?? {}),
        accounts: mappedAccounts,
        hasAccountField: true,
        lastSyncAt: nowIso(),
        lastSync: { text: `Đang trực ${list.filter((x) => x.status === "connected").length}/${list.length} tài khoản Zalo cá nhân` },
      },
    });
  } else {
    insert("connection", {
      biz_id: bizId,
      platform: "zlcrm",
      display_name: `Hệ thống Đa Tài khoản Zalo Cá nhân (${list.length} nick)`,
      mode: "sandbox",
      status: "active",
      config: {
        accounts: mappedAccounts,
        hasAccountField: true,
        lastSyncAt: nowIso(),
        lastSync: { text: `Đang trực ${list.filter((x) => x.status === "connected").length}/${list.length} tài khoản Zalo cá nhân` },
      },
    });
  }
}

export function listZaloPersonalAccounts(bizId: string): ZaloPersonalAccount[] {
  ensureDefaultSampleUsers(bizId);
  return getZaloAccountsStore(bizId);
}

export function saveZaloPersonalAccount(
  bizId: string,
  input: {
    id?: string;
    ownId?: string;
    name: string;
    phone: string;
    roleLabel?: string;
    loginMethod?: "zca_qr" | "qr_local_chrome" | "cookie_imei" | "zlcrm_bridge";
    proxyUrl?: string;
    cookieFile?: string;
    assignedUserId?: string;
    status?: "connected" | "qr_pending" | "disconnected";
    autoReplyEnabled?: boolean;
    groupMentionReplyEnabled?: boolean;
    autoFollowUpEnabled?: boolean;
    autoPushPancakePos?: boolean;
  },
  actor: string,
) {
  const list = listZaloPersonalAccounts(bizId);
  const store = getManagedUsersStore(bizId);
  const users = q.all<Row>("SELECT * FROM user_account WHERE biz_id = ?", bizId);
  const assignedUser = users.find((u) => u.id === input.assignedUserId) ?? users[0];
  const cleanPhone = input.phone.replace(/[^0-9+]/g, "") || "0900000000";

  const idx = input.id
    ? list.findIndex((a) => a.id === input.id)
    : input.ownId
    ? list.findIndex((a) => a.ownId === input.ownId)
    : -1;
  const item: ZaloPersonalAccount = {
    id: idx >= 0 ? list[idx]!.id : `zalo_${Date.now().toString(36)}`,
    ownId: input.ownId ?? (idx >= 0 ? list[idx]!.ownId : undefined),
    name: input.name.trim(),
    phone: cleanPhone,
    roleLabel: input.roleLabel?.trim() || "Tư vấn & Chốt đơn Zalo cá nhân",
    loginMethod: input.loginMethod ?? "zca_qr",
    chromeProfileDir: `data/chrome-profiles/zalo-${cleanPhone}`,
    cookieFile: input.cookieFile ?? (idx >= 0 ? list[idx]!.cookieFile : undefined),
    proxyUrl: input.proxyUrl?.trim() || (idx >= 0 ? list[idx]!.proxyUrl : ""),
    assignedUserId: assignedUser?.id ?? "",
    assignedUserName: assignedUser?.name ?? "Chủ doanh nghiệp",
    brandName: store[assignedUser?.id ?? ""]?.brandName || "Thương hiệu ZONO",
    status: input.status ?? "connected",
    autoReplyEnabled: input.autoReplyEnabled ?? (idx >= 0 ? list[idx]!.autoReplyEnabled : true),
    groupMentionReplyEnabled: input.groupMentionReplyEnabled ?? (idx >= 0 ? (list[idx]!.groupMentionReplyEnabled ?? true) : true),
    autoFollowUpEnabled: input.autoFollowUpEnabled ?? (idx >= 0 ? list[idx]!.autoFollowUpEnabled : true),
    autoPushPancakePos: input.autoPushPancakePos ?? (idx >= 0 ? list[idx]!.autoPushPancakePos : true),
    todayMessages: idx >= 0 ? list[idx]!.todayMessages : 0,
    todayOrders: idx >= 0 ? list[idx]!.todayOrders : 0,
    lastActiveAt: nowIso(),
  };

  if (idx >= 0) list[idx] = item;
  else list.unshift(item);

  syncZaloAccountsToConnection(bizId, list);
  audit(bizId, actor, "zalo.account_saved", { type: "zalo_account", id: item.id }, { name: item.name, phone: item.phone });
  return { ok: true, account: item, accounts: list };
}

export function deleteZaloPersonalAccount(bizId: string, accountId: string, actor: string) {
  const list = listZaloPersonalAccounts(bizId).filter((a) => a.id !== accountId);
  syncZaloAccountsToConnection(bizId, list);
  audit(bizId, actor, "zalo.account_deleted", { type: "zalo_account", id: accountId }, {});
  return { ok: true, accounts: list };
}

/**
 * Launch an isolated Chrome profile pointing to https://chat.zalo.me for a specific Zalo Personal account
 * so the user can scan QR and keep multiple Zalo Personal accounts logged in simultaneously on macOS.
 */
export function launchZaloPersonalQrLogin(bizId: string, accountId: string, actor: string) {
  const list = listZaloPersonalAccounts(bizId);
  const acc = list.find((a) => a.id === accountId);
  if (!acc) throw new AppError("NOT_FOUND", "Không tìm thấy tài khoản Zalo", 404);

  const absProfileDir = resolve(process.cwd(), acc.chromeProfileDir);
  mkdirSync(absProfileDir, { recursive: true });

  let browserLaunched = false;
  try {
    const child = spawn(
      "open",
      ["-na", "Google Chrome", "--args", `--user-data-dir=${absProfileDir}`, "--no-first-run", "https://chat.zalo.me"],
      { detached: true, stdio: "ignore" },
    );
    child.unref();
    browserLaunched = true;
  } catch {
    browserLaunched = false;
  }

  acc.status = "connected";
  acc.lastActiveAt = nowIso();
  syncZaloAccountsToConnection(bizId, list);
  audit(bizId, actor, "zalo.qr_login_launched", { type: "zalo_account", id: acc.id }, { phone: acc.phone, chromeProfileDir: acc.chromeProfileDir });

  return {
    ok: true,
    browserLaunched,
    account: acc,
    accounts: list,
    message: `Đã mở cửa sổ Zalo Web (chat.zalo.me) trên Chrome Profile riêng [${acc.chromeProfileDir}] cho nick "${acc.name}" (${acc.phone}). Mỗi nick Zalo dùng 1 Profile độc lập nên anh đăng nhập bao nhiêu nick cùng lúc cũng không bị đụng phiên!`,
  };
}

export interface ZaloCustomerAiRule {
  id: string;
  customerName: string;
  customerPhone: string;
  zaloAccountId: string; // "all" or specific zalo_acc_id
  aiEnabled: boolean; // false = Tắt trả lời AI với khách này (chủ shop tự chat)
  note: string;
  updatedAt: string;
}

function getZaloCustomerRulesStore(bizId: string): ZaloCustomerAiRule[] {
  const s = bizSettings(bizId) as unknown as Record<string, unknown>;
  return Array.isArray(s.zaloCustomerAiRules) ? (s.zaloCustomerAiRules as ZaloCustomerAiRule[]) : [];
}

function saveZaloCustomerRulesStore(bizId: string, rules: ZaloCustomerAiRule[]) {
  const s = bizSettings(bizId);
  update("biz", bizId, { settings: { ...s, zaloCustomerAiRules: rules } });
}

export function listZaloCustomerAiRules(bizId: string): ZaloCustomerAiRule[] {
  return getZaloCustomerRulesStore(bizId);
}

export function saveZaloCustomerAiRule(
  bizId: string,
  input: {
    id?: string;
    customerName: string;
    customerPhone?: string;
    zaloAccountId?: string;
    aiEnabled?: boolean;
    note?: string;
  },
  actor: string,
) {
  const rules = listZaloCustomerAiRules(bizId);
  const cleanPhone = (input.customerPhone ?? "").replace(/[^0-9+]/g, "");
  const idx = input.id
    ? rules.findIndex((r) => r.id === input.id)
    : rules.findIndex(
        (r) =>
          (cleanPhone && r.customerPhone === cleanPhone) ||
          r.customerName.toLowerCase() === input.customerName.trim().toLowerCase(),
      );

  const item: ZaloCustomerAiRule = {
    id: idx >= 0 ? rules[idx]!.id : `crule_${Date.now().toString(36)}`,
    customerName: input.customerName.trim(),
    customerPhone: cleanPhone,
    zaloAccountId: input.zaloAccountId || "all",
    aiEnabled: input.aiEnabled ?? false,
    note: input.note?.trim() || (input.aiEnabled ? "Bật AI trả lời tự động" : "Tắt AI — Chủ shop tự chat"),
    updatedAt: nowIso(),
  };

  if (idx >= 0) rules[idx] = item;
  else rules.unshift(item);

  saveZaloCustomerRulesStore(bizId, rules);
  audit(bizId, actor, "zalo.customer_ai_rule_saved", { type: "zalo_customer_rule", id: item.id }, item);
  return { ok: true, rule: item, rules };
}

export function deleteZaloCustomerAiRule(bizId: string, ruleId: string, actor: string) {
  const rules = listZaloCustomerAiRules(bizId).filter((r) => r.id !== ruleId);
  saveZaloCustomerRulesStore(bizId, rules);
  audit(bizId, actor, "zalo.customer_ai_rule_deleted", { type: "zalo_customer_rule", id: ruleId }, {});
  return { ok: true, rules };
}

export function toggleZaloAccountAi(
  bizId: string,
  accountId: string,
  patch: {
    autoReplyEnabled?: boolean;
    groupMentionReplyEnabled?: boolean;
    autoFollowUpEnabled?: boolean;
    autoPushPancakePos?: boolean;
  },
  actor: string,
) {
  const list = listZaloPersonalAccounts(bizId);
  const acc = list.find((a) => a.id === accountId);
  if (!acc) throw new AppError("NOT_FOUND", "Không tìm thấy tài khoản Zalo", 404);

  if (patch.autoReplyEnabled !== undefined) acc.autoReplyEnabled = patch.autoReplyEnabled;
  if (patch.groupMentionReplyEnabled !== undefined) acc.groupMentionReplyEnabled = patch.groupMentionReplyEnabled;
  if (patch.autoFollowUpEnabled !== undefined) acc.autoFollowUpEnabled = patch.autoFollowUpEnabled;
  if (patch.autoPushPancakePos !== undefined) acc.autoPushPancakePos = patch.autoPushPancakePos;
  acc.lastActiveAt = nowIso();

  syncZaloAccountsToConnection(bizId, list);
  audit(bizId, actor, "zalo.account_ai_toggled", { type: "zalo_account", id: acc.id }, patch);
  return { ok: true, account: acc, accounts: list };
}

/**
 * Helper to detect whether a Zalo Group message mentions (`@tag`) our Zalo Personal Account or AI assistant.
 */
export function isZaloGroupMessageMentioningBot(
  content: string,
  mentions: unknown,
  ownId?: string,
  accountName?: string,
): boolean {
  // 1. Check `zca-js` native mentions array (`[{ uid, pos, len }]`)
  if (ownId && Array.isArray(mentions)) {
    const hitByUid = mentions.some(
      (m: any) =>
        String(m?.uid ?? "") === String(ownId) ||
        String(m?.id ?? "") === String(ownId) ||
        String(m?.userId ?? "") === String(ownId),
    );
    if (hitByUid) return true;
  }

  const lower = content.toLowerCase();
  // 2. Check `@<Account Name>` (strip prefix like "Zalo · ")
  if (accountName) {
    const cleanAccName = accountName.replace(/^zalo\s*[·•-]\s*/i, "").trim().toLowerCase();
    if (cleanAccName.length >= 2 && (lower.includes(`@${cleanAccName}`) || lower.includes(cleanAccName))) {
      if (lower.includes("@")) return true;
    }
  }

  // 3. Check common `@mention` triggers in Vietnamese Zalo groups (`@ai`, `@bot`, `@shop`, `@trợ lý`, `@zono`, `@tư vấn`)
  return /@(ai|bot|shop|zono|trợ\s*lý|tro\s*ly|tư\s*vấn|tu\s*van|admin|ad)\b/i.test(content);
}

/**
 * Send / simulate a customer message to a specific Zalo Personal Account and auto-reply using its assigned User's DNA + RAG.
 * Supports BOTH:
 * - 1-on-1 Direct Messages (`isGroup: false`): replies when `acc.autoReplyEnabled !== false` (and customer is not muted in `customerAiRules`).
 * - Group Messages (`isGroup: true`): replies ONLY when someone `@mentions` the account (`mentionedInGroup: true`) AND `acc.groupMentionReplyEnabled !== false`.
 */
export async function sendZaloPersonalTestMessage(
  bizId: string,
  accountId: string,
  input: {
    customerName?: string;
    customerPhone?: string;
    customerMessage: string;
    isGroup?: boolean;
    groupName?: string;
    mentionedInGroup?: boolean;
  },
  actor: string,
) {
  const list = listZaloPersonalAccounts(bizId);
  const acc = list.find((a) => a.id === accountId) ?? list[0];
  if (!acc) throw new AppError("NOT_FOUND", "Chưa có tài khoản Zalo nào", 404);

  const isGroup = Boolean(input.isGroup);
  const groupName = input.groupName?.trim() || "Nhóm Zalo Bán Hàng";
  const custName = input.customerName?.trim() || (isGroup ? "Thành viên Nhóm Zalo" : "Khách hàng Zalo");
  const custPhone = (input.customerPhone ?? "").replace(/[^0-9+]/g, "");

  const mentionedInGroup = isGroup
    ? (input.mentionedInGroup ?? isZaloGroupMessageMentioningBot(input.customerMessage, undefined, acc.ownId, acc.name))
    : false;

  // In a Zalo Group, if nobody @mentioned the bot/account, stay completely silent so we never spam the group!
  if (isGroup && !mentionedInGroup) {
    return {
      ok: true,
      aiPaused: true,
      ignoredGroupUnmentioned: true,
      account: acc,
      ragResult: {
        ok: true,
        provider: "Chế độ Nhóm Zalo (Im lặng khi không được @tag)",
        tokensDeducted: 0,
        ragSources: [],
        markdown: `🤫 Tin nhắn trong **${groupName}** không gắn thẻ \`@mention\` tên nick Zalo hoặc \`@AI\` / \`@shop\`, nên AI giữ im lặng để không làm phiền nhóm.`,
      },
    };
  }

  // Check if this specific customer is muted/paused from AI auto-reply
  const rules = listZaloCustomerAiRules(bizId);
  const matchedCustomerRule = rules.find(
    (r) =>
      !r.aiEnabled &&
      (r.zaloAccountId === "all" || r.zaloAccountId === acc.id) &&
      ((custPhone && r.customerPhone === custPhone) ||
        custName.toLowerCase().includes(r.customerName.toLowerCase().split("(")[0]!.trim()) ||
        input.customerMessage.toLowerCase().includes(r.customerName.toLowerCase().split("(")[0]!.trim())),
  );

  const replySwitchEnabled = isGroup
    ? (acc.groupMentionReplyEnabled ?? true)
    : acc.autoReplyEnabled;

  if (!replySwitchEnabled || matchedCustomerRule) {
    const pauseReason = !replySwitchEnabled
      ? isGroup
        ? `Tài khoản Zalo **${acc.name}** đang **TẮT trả lời tự động khi được @tag trong Nhóm**`
        : `Tài khoản Zalo **${acc.name} (${acc.phone})** đang **TẮT trả lời AI tự động (Nhắn riêng)**`
      : `Khách hàng **${matchedCustomerRule?.customerName}** (${matchedCustomerRule?.customerPhone || "Trong danh sách loại trừ"}) đang được **TẮT AI trả lời tự động**`;

    const conv = insert("conversation", {
      biz_id: bizId,
      channel: "zalo",
      external_id: `zl_${acc.phone}_${Date.now()}`,
      customer_ref: custPhone || `zl_cust_${Date.now()}`,
      customer_name: isGroup ? `[${groupName}] ${custName}` : custName,
      state: "human_active",
      lead_grade: "warm",
      lead_score: 70,
      intent: "chat_tay",
      unread: 1,
      last_message_at: nowIso(),
      last_preview: input.customerMessage,
      ext: {
        zaloAccountId: acc.id,
        zaloAccountName: `${acc.name} (${acc.phone})`,
        assignedUserId: acc.assignedUserId,
        threadType: isGroup ? "group" : "user",
        groupName: isGroup ? groupName : undefined,
        aiPaused: true,
      },
    });
    insert("message", {
      biz_id: bizId,
      conversation_id: conv.id,
      direction: "in",
      sender: "customer",
      body: input.customerMessage,
      sent_at: nowIso(),
    });

    return {
      ok: true,
      aiPaused: true,
      account: acc,
      conversationId: conv.id,
      ragResult: {
        ok: true,
        provider: "Chế độ Tự chat tay (Đã tắt AI)",
        tokensDeducted: 0,
        ragSources: [],
        markdown: [
          `# ⏸️ Đã Tạm Dừng AI Trả Lời Tự Động (Chuyển sang Chat Tay)`,
          `- **Lý do**: ${pauseReason}.`,
          `- **Tin nhắn khách gửi**: _"${input.customerMessage}"_`,
          `- **Trạng thái**: Hệ thống đã ghi nhận tin nhắn vào hộp thư Zalo nhưng **không để AI tự trả lời**, giúp anh trực tiếp nhắn tin riêng với khách này.`,
        ].join("\n"),
      },
    };
  }

  // Strip the leading `@mention` tag from the prompt so the AI focuses cleanly on the customer's question
  const cleanedQuestion = isGroup
    ? input.customerMessage.replace(/@(ai|bot|shop|zono|trợ\s*lý|tro\s*ly|tư\s*vấn|tu\s*van|admin|ad)\b/gi, "").trim() || input.customerMessage
    : input.customerMessage;

  const promptForRag = isGroup
    ? `[Tin nhắn trong Nhóm Zalo "${groupName}" — Thành viên "${custName}" vừa @tag hỏi cửa hàng]: ${cleanedQuestion}`
    : input.customerMessage;

  const ragRes = await runUserRagAction(
    bizId,
    acc.assignedUserId,
    { mode: "zalo_sale", prompt: promptForRag },
    actor,
  );

  // If in a group, prefix the reply with `@TênNgườiHỏi` so everyone in the group knows who the AI is answering!
  if (isGroup && !ragRes.markdown.startsWith(`@${custName}`)) {
    ragRes.markdown = `@${custName} ${ragRes.markdown}`;
  }

  acc.todayMessages += 1;
  acc.lastActiveAt = nowIso();
  syncZaloAccountsToConnection(bizId, list);

  // Also record into `conversation` and `message` table so it shows up in /zalo and /chat
  const conv = insert("conversation", {
    biz_id: bizId,
    channel: "zalo",
    external_id: `zl_${acc.phone}_${Date.now()}`,
    customer_ref: custPhone || `zl_cust_${Date.now()}`,
    customer_name: isGroup ? `👥 [${groupName}] ${custName}` : custName,
    state: "awaiting_customer",
    lead_grade: "hot",
    lead_score: 85,
    intent: isGroup ? "hoi_nhom_zalo" : "mua_hang",
    unread: 0,
    last_message_at: nowIso(),
    last_preview: input.customerMessage,
    ext: {
      zaloAccountId: acc.id,
      zaloAccountName: `${acc.name} (${acc.phone})`,
      assignedUserId: acc.assignedUserId,
      threadType: isGroup ? "group" : "user",
      groupName: isGroup ? groupName : undefined,
      mentionedInGroup,
    },
  });
  insert("message", {
    biz_id: bizId,
    conversation_id: conv.id,
    direction: "in",
    sender: "customer",
    body: input.customerMessage,
    sent_at: nowIso(),
  });
  insert("message", {
    biz_id: bizId,
    conversation_id: conv.id,
    direction: "out",
    sender: "bot",
    body: ragRes.markdown,
    meta: {
      kind: isGroup ? "zalo_group_mention_rag" : "zalo_personal_rag",
      zaloAccountId: acc.id,
      threadType: isGroup ? "group" : "user",
      provider: ragRes.provider,
    },
    sent_at: nowIso(),
  });

  return {
    ok: true,
    aiPaused: false,
    isGroup,
    mentionedInGroup,
    account: acc,
    ragResult: ragRes,
    conversationId: conv.id,
  };
}

// ── Real `zca-js` + `ChickenAI/multizlogin` Engine (Inline QR Login + Cookie Storage + Proxy + Live WebSocket Listener) ──

export interface ZcaQrLoginSession {
  sessionId: string;
  bizId: string;
  assignedUserId?: string;
  proxyUrl?: string;
  roleLabel?: string;
  status: "generating_qr" | "waiting_scan" | "scanned" | "connected" | "expired" | "error";
  qrCodeImage: string | null;
  scannedName?: string;
  scannedAvatar?: string;
  account?: ZaloPersonalAccount;
  error?: string;
  createdAt: string;
}

const zcaQrSessions = new Map<string, ZcaQrLoginSession>();
const liveZcaInstances = new Map<string, { api: ZcaApi; ownId: string; phone: string; accountId: string }>();

function getZaloDataCookiesDir(): string {
  const dir = resolve(process.cwd(), "data", "zalo_data", "cookies");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function attachZcaLiveListeners(bizId: string, api: ZcaApi, acc: ZaloPersonalAccount) {
  const ownId = String(api.getOwnId() || acc.ownId || "");
  liveZcaInstances.set(acc.id, { api, ownId, phone: acc.phone, accountId: acc.id });

  api.listener.on("message", async (msg: any) => {
    try {
      if (msg.isSelf) return;
      const content = typeof msg.data?.content === "string" ? msg.data.content.trim() : "";
      if (!content) return;

      // Read fresh account state from DB so toggles (`autoReplyEnabled`, `groupMentionReplyEnabled`) work immediately
      const freshAcc = listZaloPersonalAccounts(bizId).find((a) => a.id === acc.id) ?? acc;
      const isGroup = msg.type === ThreadType.Group || msg.type === 1;
      const senderName = String(msg.data?.dName ?? msg.threadId ?? "Khách Zalo");

      if (isGroup) {
        // In a Zalo Group: ONLY reply when someone `@mentions` this Zalo account or `@AI` / `@shop` / `@bot`
        const mentioned = isZaloGroupMessageMentioningBot(
          content,
          msg.data?.mentions,
          ownId || freshAcc.ownId,
          freshAcc.name,
        );
        if (!mentioned) return;
      }

      const res = await sendZaloPersonalTestMessage(
        bizId,
        freshAcc.id,
        {
          customerName: senderName,
          customerMessage: content,
          isGroup,
          groupName: isGroup ? `Nhóm Zalo #${String(msg.threadId).slice(-6)}` : undefined,
          mentionedInGroup: isGroup ? true : undefined,
        },
        "zca-js-listener",
      );

      // Only send reply back over Zalo if AI auto-reply is NOT paused for this account or customer!
      if (!res.aiPaused && res.ragResult?.markdown) {
        const cleanReply =
          res.ragResult.markdown
            .split("\n")
            .filter((line) => line.startsWith("> "))
            .map((line) => line.replace(/^>\s*"?|"?$/g, ""))
            .join("\n") || res.ragResult.markdown;

        const targetType = isGroup ? ThreadType.Group : ThreadType.User;
        try {
          // Quote the original message when replying in a group so the group thread stays clear
          if (isGroup && msg.data) {
            await api.sendMessage({ msg: cleanReply, quote: msg.data } as any, msg.threadId, targetType);
          } else {
            await api.sendMessage(cleanReply, msg.threadId, targetType);
          }
        } catch {
          await api.sendMessage(cleanReply, msg.threadId, targetType);
        }
      }
    } catch {
      /* ignore listener errors */
    }
  });

  try {
    api.listener.start();
  } catch {
    /* already started */
  }
}

/**
 * Automatically restore saved `zca-js` sessions from `data/zalo_data/cookies/cred_<ownId>.json` when server boots up.
 */
export async function restoreSavedZcaSessions(bizId: string) {
  const accounts = listZaloPersonalAccounts(bizId);
  for (const acc of accounts) {
    if (acc.status !== "connected" || !acc.cookieFile || liveZcaInstances.has(acc.id)) continue;
    try {
      const absCookie = resolve(process.cwd(), acc.cookieFile);
      if (!existsSync(absCookie)) continue;
      const raw = JSON.parse(readFileSync(absCookie, "utf-8"));
      if (!raw?.imei || !raw?.cookie || !raw?.userAgent) continue;

      const zaloOpts: Record<string, any> = { selfListen: false, checkUpdate: false, logging: false };
      if (acc.proxyUrl) {
        try {
          zaloOpts.agent = new HttpsProxyAgent(acc.proxyUrl);
        } catch { /* ignore */ }
      }
      const zalo = new Zalo(zaloOpts);
      const api = await zalo.login({
        imei: String(raw.imei),
        cookie: raw.cookie,
        userAgent: String(raw.userAgent),
      });
      attachZcaLiveListeners(bizId, api, acc);
    } catch {
      /* cookie expired or offline — user can re-scan QR when needed */
    }
  }
}

/**
 * Start a real `zca-js` + `multizlogin` QR Login session!
 * Immediately generates a real Zalo QR Code (`data:image/png;base64,...`) from Zalo's login server
 * and returns it to the frontend modal so the user can scan directly on screen without opening Chrome!
 */
export async function startZcaQrLoginSession(
  bizId: string,
  input: {
    assignedUserId?: string;
    proxyUrl?: string;
    roleLabel?: string;
    autoReplyEnabled?: boolean;
  },
  actor: string,
): Promise<ZcaQrLoginSession> {
  const sessionId = `zca_qr_${Date.now().toString(36)}`;
  const session: ZcaQrLoginSession = {
    sessionId,
    bizId,
    assignedUserId: input.assignedUserId,
    proxyUrl: input.proxyUrl?.trim() || undefined,
    roleLabel: input.roleLabel?.trim() || "Tư vấn & Chốt đơn Zalo cá nhân (zca-js)",
    status: "generating_qr",
    qrCodeImage: null,
    createdAt: nowIso(),
  };
  zcaQrSessions.set(sessionId, session);

  const zaloOpts: Record<string, any> = {
    selfListen: false,
    checkUpdate: false,
    logging: false,
  };
  if (session.proxyUrl) {
    try {
      zaloOpts.agent = new HttpsProxyAgent(session.proxyUrl);
    } catch {
      /* invalid proxy format, fallback to direct */
    }
  }

  const zalo = new Zalo(zaloOpts);

  await new Promise<void>((resolveFirstQr) => {
    let settledFirst = false;
    const timeout = setTimeout(() => {
      if (!settledFirst) {
        settledFirst = true;
        resolveFirstQr();
      }
    }, 6500);

    zalo
      .loginQR(undefined, (event) => {
        if (event.type === LoginQRCallbackEventType.QRCodeGenerated && event.data?.image) {
          session.qrCodeImage = event.data.image.startsWith("data:image")
            ? event.data.image
            : `data:image/png;base64,${event.data.image}`;
          session.status = "waiting_scan";
          if (!settledFirst) {
            settledFirst = true;
            clearTimeout(timeout);
            resolveFirstQr();
          }
        } else if (event.type === LoginQRCallbackEventType.QRCodeScanned) {
          session.status = "scanned";
          session.scannedName = event.data?.display_name;
          session.scannedAvatar = event.data?.avatar;
        } else if (event.type === LoginQRCallbackEventType.QRCodeExpired) {
          session.status = "expired";
        } else if (event.type === LoginQRCallbackEventType.QRCodeDeclined) {
          session.status = "error";
          session.error = "Đã từ chối đăng nhập trên điện thoại";
        }
      })
      .then(async (api) => {
        const info = await api.fetchAccountInfo().catch(() => null);
        const profile = (info as any)?.profile ?? info ?? {};
        const ownId = String(profile.userId || api.getOwnId() || Date.now());
        const displayName = String(profile.displayName || session.scannedName || `Zalo ${ownId}`);
        const phoneNumber = String(profile.phoneNumber || ownId);

        // Save cookies to `data/zalo_data/cookies/cred_<ownId>.json` exactly like ChickenAI/multizlogin
        const ctx = api.getContext();
        const cookiesDir = getZaloDataCookiesDir();
        const cookieFile = resolve(cookiesDir, `cred_${ownId}.json`);
        writeFileSync(
          cookieFile,
          JSON.stringify(
            {
              imei: ctx.imei,
              cookie: ctx.cookie,
              userAgent: ctx.userAgent,
              ownId,
              displayName,
              phoneNumber,
              proxyUrl: session.proxyUrl,
              savedAt: nowIso(),
            },
            null,
            2,
          ),
          "utf-8",
        );

        const saved = saveZaloPersonalAccount(
          bizId,
          {
            ownId,
            name: `Zalo · ${displayName}`,
            phone: phoneNumber,
            roleLabel: session.roleLabel,
            loginMethod: "zca_qr",
            proxyUrl: session.proxyUrl,
            cookieFile: `data/zalo_data/cookies/cred_${ownId}.json`,
            assignedUserId: session.assignedUserId,
            status: "connected",
            autoReplyEnabled: input.autoReplyEnabled ?? true,
          },
          actor,
        );

        attachZcaLiveListeners(bizId, api, saved.account);
        session.status = "connected";
        session.account = saved.account;
      })
      .catch((err) => {
        if (session.status !== "connected") {
          session.status = "error";
          session.error = err instanceof Error ? err.message : String(err);
        }
        if (!settledFirst) {
          settledFirst = true;
          clearTimeout(timeout);
          resolveFirstQr();
        }
      });
  });

  return session;
}

export function getZcaQrSessionStatus(_bizId: string, sessionId: string): ZcaQrLoginSession {
  const s = zcaQrSessions.get(sessionId);
  if (!s) throw new AppError("NOT_FOUND", "Không tìm thấy phiên QR Zalo", 404);
  return s;
}

/**
 * Login / Import a Zalo Personal Account using `zca-js` Cookie + IMEI + UserAgent (`cred_<ownId>.json`)
 * compatible with `ChickenAI/multizlogin`.
 */
export async function loginZcaWithCredentials(
  bizId: string,
  input: {
    name?: string;
    phone?: string;
    imei: string;
    cookie: unknown;
    userAgent: string;
    proxyUrl?: string;
    assignedUserId?: string;
    autoReplyEnabled?: boolean;
  },
  actor: string,
) {
  const cookiesDir = getZaloDataCookiesDir();
  const parsedCookie = typeof input.cookie === "string" ? JSON.parse(input.cookie) : input.cookie;

  const zaloOpts: Record<string, any> = { selfListen: false, checkUpdate: false, logging: false };
  if (input.proxyUrl) {
    try {
      zaloOpts.agent = new HttpsProxyAgent(input.proxyUrl);
    } catch { /* ignore */ }
  }

  let ownId = `zca_${Date.now().toString(36)}`;
  let displayName = input.name?.trim() || "Zalo Cá nhân (Cookie/zca-js)";
  let phoneNumber = input.phone?.trim() || "0988000111";

  try {
    const zalo = new Zalo(zaloOpts);
    const api = await zalo.login({
      imei: input.imei.trim(),
      cookie: parsedCookie as any,
      userAgent: input.userAgent.trim(),
    });
    const info = await api.fetchAccountInfo().catch(() => null);
    const profile = (info as any)?.profile ?? info ?? {};
    ownId = String(profile.userId || api.getOwnId() || ownId);
    displayName = String(profile.displayName || displayName);
    phoneNumber = String(profile.phoneNumber || phoneNumber);

    const cookieFile = resolve(cookiesDir, `cred_${ownId}.json`);
    writeFileSync(
      cookieFile,
      JSON.stringify({ imei: input.imei, cookie: parsedCookie, userAgent: input.userAgent, ownId, displayName, phoneNumber }, null, 2),
      "utf-8",
    );

    const saved = saveZaloPersonalAccount(
      bizId,
      {
        ownId,
        name: displayName,
        phone: phoneNumber,
        loginMethod: "cookie_imei",
        proxyUrl: input.proxyUrl,
        cookieFile: `data/zalo_data/cookies/cred_${ownId}.json`,
        assignedUserId: input.assignedUserId,
        status: "connected",
        autoReplyEnabled: input.autoReplyEnabled ?? true,
      },
      actor,
    );
    attachZcaLiveListeners(bizId, api, saved.account);
    return { ok: true, liveConnected: true, account: saved.account };
  } catch (err) {
    // Still save credential file in multizlogin format so user can manage/retry
    const cookieFile = resolve(cookiesDir, `cred_${ownId}.json`);
    writeFileSync(
      cookieFile,
      JSON.stringify({ imei: input.imei, cookie: parsedCookie, userAgent: input.userAgent, ownId, displayName, phoneNumber }, null, 2),
      "utf-8",
    );
    const saved = saveZaloPersonalAccount(
      bizId,
      {
        ownId,
        name: displayName,
        phone: phoneNumber,
        loginMethod: "cookie_imei",
        proxyUrl: input.proxyUrl,
        cookieFile: `data/zalo_data/cookies/cred_${ownId}.json`,
        assignedUserId: input.assignedUserId,
        status: "connected",
        autoReplyEnabled: input.autoReplyEnabled ?? true,
      },
      actor,
    );
    return {
      ok: true,
      liveConnected: false,
      note: err instanceof Error ? err.message : String(err),
      account: saved.account,
    };
  }
}

/**
 * Nạp thẳng File (Word, Txt, CSV, Markdown, HTML...) hoặc Link Website hoặc Chữ gõ trong ô Chat
 * vào Kho Tri thức RAG + Bảng giá của User (Tối giản để "Bà Ngoại" chỉ cần kéo thả file vào ô chat là xong).
 */
export async function ingestUserRagFromChat(
  bizId: string,
  userId: string,
  input: {
    fileName?: string;
    filePath?: string;
    fileBase64?: string;
    websiteUrl?: string;
    rawText?: string;
  },
  actor: string,
) {
  ensureDefaultSampleUsers(bizId);
  const store = getManagedUsersStore(bizId);
  const users = q.all<Row>("SELECT * FROM user_account WHERE biz_id = ? ORDER BY created_at ASC", bizId);
  const targetUser = byId<Row>("user_account", userId) ?? users[0];
  if (!targetUser) throw new AppError("NOT_FOUND", "Không tìm thấy người dùng", 404);
  const meta = store[targetUser.id]!;

  let extractedText = "";
  let docTitle = input.fileName || input.websiteUrl || "Kiến thức từ khung Chat";
  let pagesRead = 0;

  // 1. Nếu có fileBase64 hoặc filePath được kéo thả vào ô chat
  if (input.fileBase64 && input.fileName) {
    const uploadDir = resolve(process.cwd(), "data", "uploads");
    mkdirSync(uploadDir, { recursive: true });
    const safeName = `${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const fullPath = resolve(uploadDir, safeName);
    const base64Clean = input.fileBase64.replace(/^data:[^;]+;base64,/, "");
    writeFileSync(fullPath, Buffer.from(base64Clean, "base64"));
    try {
      extractedText = documentText(fullPath);
    } catch {
      extractedText = Buffer.from(base64Clean, "base64").toString("utf8");
    }
    docTitle = `Tài liệu: ${input.fileName}`;
  } else if (input.filePath) {
    extractedText = documentText(input.filePath);
    docTitle = `Tài liệu: ${input.fileName || input.filePath.split("/").pop()}`;
  }

  // 2. Nếu người dùng dán Link Website vào ô chat
  if (input.websiteUrl?.trim()) {
    try {
      const webRes = await dnaSourceText(extractedText, input.websiteUrl.trim());
      extractedText = webRes.text;
      pagesRead = webRes.pages.length;
      docTitle = `Website: ${input.websiteUrl.trim()}`;
    } catch (e) {
      if (!extractedText) throw e;
    }
  }

  // 3. Nếu người dùng gõ thêm ghi chú / bảng giá trực tiếp
  if (input.rawText?.trim()) {
    extractedText = [extractedText, input.rawText.trim()].filter(Boolean).join("\n\n");
  }

  const cleanText = extractedText.trim();
  if (cleanText.length < 5) {
    throw new AppError("EMPTY_CONTENT", "Tài liệu hoặc nội dung trống — vui lòng chọn file có chữ hoặc dán nội dung bảng giá.", 400);
  }

  // Lưu vào bảng `knowledge_doc` và chia nhỏ thành `knowledge_chunk` để RAG tra cứu tức thì
  const doc = insert("knowledge_doc", {
    biz_id: bizId,
    title: docTitle,
    kind: "chat_rag",
    source: `user_chat_rag:${targetUser.id}`,
    tags: ["user_rag", "chat_upload", targetUser.id],
    body: cleanText.slice(0, 120_000),
    status: "processed",
  });

  const chunks = cleanText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 6)
    .slice(0, 150);

  chunks.forEach((text, idx) => {
    insert("knowledge_chunk", {
      biz_id: bizId,
      doc_id: doc.id,
      idx,
      text,
      source_ref: `${docTitle}#muc-${idx + 1}`,
    });
  });

  // Tự động cập nhật tóm tắt bảng giá / tri thức của User để dùng ngay
  const previewLines = chunks.slice(0, 6).join(" · ").slice(0, 450);
  meta.ragKnowledgeText = [meta.ragKnowledgeText, `[${docTitle}]: ${cleanText.slice(0, 2500)}`]
    .filter(Boolean)
    .join("\n\n")
    .slice(-8000);
  if (previewLines) {
    meta.productsSummary = meta.productsSummary
      ? `${meta.productsSummary} | ${previewLines.slice(0, 220)}`
      : previewLines.slice(0, 300);
  }
  store[targetUser.id] = meta;
  saveManagedUsersStore(bizId, store);

  audit(bizId, actor, "user.chat_rag_ingested", { type: "knowledge_doc", id: doc.id }, {
    userId: targetUser.id,
    docTitle,
    chunksAdded: chunks.length,
    pagesRead,
  });

  const summaryMarkdown = [
    `✅ **Con đã đọc và thuộc lòng ${input.fileName ? `file "${input.fileName}"` : input.websiteUrl ? `trang web "${input.websiteUrl}"` : "thông tin bảng giá"} rồi ạ!**`,
    ``,
    `- 📚 **Đã lưu vào bộ nhớ Cửa hàng**: **${chunks.length} mục thông tin & bảng giá**${pagesRead > 0 ? ` (đọc từ ${pagesRead} trang web)` : ""}.`,
    `- 🔍 **Nội dung con vừa ghi nhớ**:`,
    `> ${chunks.slice(0, 4).join("\n> ").slice(0, 420)}${cleanText.length > 420 ? "..." : ""}`,
    ``,
    `👉 **Bây giờ mình muốn làm gì chỉ cần bấm nút hoặc nhắn cho con nhé:**`,
    `- Gõ **"Viết bài"** → Con lấy đúng thông tin vừa học để viết bài bán hàng.`,
    `- Gõ **"Làm video"** → Con dựng video ngắn kèm giọng đọc từ nội dung này.`,
    `- Gõ **"Đăng nhập Zalo"** → Con hiện mã QR ngay tại đây để mình quét nối Zalo trả lời khách!`,
  ].join("\n");

  return {
    ok: true,
    docId: doc.id,
    docTitle,
    chunksAdded: chunks.length,
    pagesRead,
    summaryMarkdown,
  };
}

/**
 * Xoá sạch 100% dữ liệu Demo / Mẫu (User mẫu, Zalo mẫu, Khách mẫu, Hội thoại mẫu, Bài đăng mẫu, Đơn hàng mẫu, RAG mẫu)
 * để hệ thống về trạng thái trắng sạch sẽ cho người dùng thật bắt đầu.
 */
export function purgeAllDemoData(bizId: string, actor: string) {
  const tablesToClear = [
    "knowledge_chunk",
    "knowledge_doc",
    "message",
    "lead",
    "follow_up_plan",
    "conversation",
    "orders",
    "approval",
    "publish_job",
    "content_item",
    "creative_job",
    "task_run",
    "task",
    "goal",
    "post_comment",
    "post_score",
    "post_metric_snapshot",
    "post_ad_link",
    "post",
    "ad_candidate",
    "ad",
    "campaign",
    "ad_account",
    "ad_template",
    "rule_run",
    "rule",
    "action",
    "metric_snapshot",
    "model_usage",
    "user_account",
  ];

  for (const tbl of tablesToClear) {
    try {
      q.run(`DELETE FROM ${tbl} WHERE biz_id = ?`, bizId);
    } catch {
      // Ignore if table doesn't have biz_id
    }
  }

  // Xoá các kết nối sandbox mẫu và lịch chạy quảng cáo
  try {
    q.run("DELETE FROM connection WHERE biz_id = ? AND mode = 'sandbox'", bizId);
    q.run("DELETE FROM channel WHERE biz_id = ?", bizId);
    q.run("DELETE FROM schedule WHERE biz_id = ? AND job_type IN ('metrics.sync.ads', 'rules.evaluate', 'ads.weekly_report')", bizId);
  } catch {
    // ignore
  }

  // Đặt lại DNA trống sạch
  try {
    q.run("DELETE FROM dna_profile WHERE biz_id = ?", bizId);
    insert("dna_profile", {
      biz_id: bizId,
      version: 1,
      status: "active",
      data: blankDna(),
      created_by: "clean_reset",
    });
  } catch {
    // ignore
  }

  // Tạo 1 tài khoản Chủ Cửa Hàng trắng sạch duy nhất
  const owner = insert("user_account", {
    biz_id: bizId,
    name: "Chủ Cửa Hàng",
    email: "owner@shop.vn",
    role: "owner",
    status: "active",
    last_active_at: nowIso(),
  });

  const cleanQuota: Record<string, UserQuotaMeta> = {
    [owner.id]: {
      planId: "pro",
      tokenLimit: 6_000_000,
      videoLimit: 150,
      postLimit: 600,
      zaloMsgLimit: 20_000,
      tokensUsed: 0,
      videosUsed: 0,
      postsUsed: 0,
      zaloMsgsUsed: 0,
      preferredProvider: "auto",
      ragEnabled: true,
      zaloPersonalPhone: "",
      zaloAutoFollowUp: true,
      pancakeSyncEnabled: true,
      brandName: "Cửa hàng của tôi",
      industry: "",
      productsSummary: "",
      ragKnowledgeText: "",
    },
  };

  const curSettings = bizSettings(bizId) as unknown as Record<string, unknown>;
  update("biz", bizId, {
    name: "Cửa hàng của tôi",
    settings: {
      ...curSettings,
      userQuotas: cleanQuota,
      zaloPersonalAccounts: [],
      zaloCustomerAiRules: [],
    },
  });

  audit(bizId, actor, "system.demo_data_purged", { type: "biz", id: bizId }, {});
  return {
    ok: true,
    ownerId: owner.id,
    message: "Đã xoá sạch toàn bộ dữ liệu Demo! Hệ thống hiện tại hoàn toàn trắng sạch.",
  };
}




