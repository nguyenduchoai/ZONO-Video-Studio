// Agent catalog and defaults (spec §5 "Danh mục agent và cấu hình mặc định").
// Permissions live in agent_config rows seeded from here; code never hard-codes them.
export interface CatalogEntry {
  key: string;
  label: string;
  description: string;
  stage: number; // 1..9 of the 9-stage pipeline (0 = orchestration, above the pipeline)
  tools: string[];
  autonomy: "L0" | "L1" | "L2" | "L3";
  queue: "agent" | "ads" | "chat" | "publish" | "review";
  tier: string;
  usesJev: string[]; // which Jev judgments this agent relies on
  tokenBudgetDay: number;
}

export const STAGES = [
  { n: 1, key: "dna", label: "Nhập DNA & mục tiêu" },
  { n: 2, key: "research", label: "Nghiên cứu thị trường" },
  { n: 3, key: "strategy", label: "Chiến lược marketing" },
  { n: 4, key: "content", label: "Tạo nội dung & kịch bản" },
  { n: 5, key: "publish", label: "Đăng bài" },
  { n: 6, key: "ads", label: "Quét bài & chăm bình luận" },
  { n: 7, key: "analytics", label: "Đo lường" },
  { n: 8, key: "chat", label: "Chat & follow-up" },
  { n: 9, key: "feedback", label: "Feedback loop" },
] as const;

export const CATALOG: CatalogEntry[] = [
  { key: "assistant", label: "Ngân Nguyệt", description: "Trợ lý tổng điều phối của CEO: giao việc ngay cho các agent, xem/can thiệp mọi tác vụ, báo cáo trong 1 khung chat", stage: 0, tools: ["system.read", "agents.dispatch", "tasks.control", "approvals.decide", "ads.control", "creative.start", "chat.reply"], autonomy: "L1", queue: "agent", tier: "medium", usesJev: [], tokenBudgetDay: 2_000_000 },
  { key: "dna_intake", label: "DNA Agent", description: "Trích xuất DNA thương hiệu, đánh dấu thiếu & mâu thuẫn", stage: 1, tools: ["knowledge.read", "knowledge.write", "doc.parse"], autonomy: "L1", queue: "agent", tier: "medium", usesJev: [], tokenBudgetDay: 300_000 },
  { key: "brief", label: "Brief Agent", description: "Chuẩn hóa mục tiêu thành KPI đo được, đánh giá khả thi", stage: 1, tools: ["knowledge.read"], autonomy: "L1", queue: "agent", tier: "medium", usesJev: [], tokenBudgetDay: 300_000 },
  { key: "market_research", label: "Research Agent", description: "Nghiên cứu thị trường, đối thủ, insight khách hàng", stage: 2, tools: ["web.search", "web.fetch", "ads_library.search", "metrics.read"], autonomy: "L0", queue: "agent", tier: "large", usesJev: [], tokenBudgetDay: 600_000 },
  { key: "strategy", label: "Strategy Agent", description: "Định vị, phễu, phân bổ kênh & ngân sách, kế hoạch nội dung", stage: 3, tools: ["knowledge.read", "metrics.read", "lesson.search"], autonomy: "L1", queue: "agent", tier: "large", usesJev: [], tokenBudgetDay: 1_200_000 },
  { key: "content", label: "Content Agent", description: "Viết bài đa kênh kèm biến thể A/B", stage: 4, tools: ["knowledge.search", "exemplar.search", "cms.draft"], autonomy: "L1", queue: "agent", tier: "medium", usesJev: ["review.content"], tokenBudgetDay: 2_000_000 },
  { key: "video_script", label: "Video Agent", description: "Kịch bản video ngắn TikTok/Reels", stage: 4, tools: ["knowledge.search", "exemplar.search"], autonomy: "L1", queue: "agent", tier: "medium", usesJev: ["review.content"], tokenBudgetDay: 500_000 },
  { key: "seo_web", label: "SEO Agent", description: "Bài blog chuẩn SEO, tạo nháp CMS", stage: 4, tools: ["knowledge.search", "cms.draft"], autonomy: "L1", queue: "agent", tier: "medium", usesJev: ["review.content"], tokenBudgetDay: 500_000 },
  { key: "creative", label: "Creative Agent", description: "Sản xuất video trên Google Flow (qua Chrome), hậu kỳ, đăng nháp kênh", stage: 4, tools: ["flow.chrome", "ffmpeg", "asset.store", "publish.draft"], autonomy: "L1", queue: "agent", tier: "medium", usesJev: ["review.content"], tokenBudgetDay: 3_000_000 },
  { key: "publishing", label: "Publishing Agent", description: "Đăng bài theo lịch, xác minh sau đăng", stage: 5, tools: ["publish.schedule", "publish.post", "comment.moderate"], autonomy: "L1", queue: "publish", tier: "small", usesJev: [], tokenBudgetDay: 100_000 },
  { key: "post_scanner", label: "Post Scanner", description: "Quét bài, phân loại bình luận, chấm điểm bài", stage: 6, tools: ["posts.fetch", "metrics.read", "comment.classify"], autonomy: "L2", queue: "ads", tier: "small", usesJev: ["comments.classify", "post.fit"], tokenBudgetDay: 100_000 },
  { key: "ads", label: "Ads Agent", description: "Đề xuất ads từ bài, áp rule, đổi ngân sách trong trần", stage: 6, tools: ["ads.list", "ads.update_status", "ads.update_budget", "ads.create_from_post"], autonomy: "L1", queue: "ads", tier: "small", usesJev: [], tokenBudgetDay: 200_000 },
  { key: "analytics", label: "Analytics Agent", description: "Tổng hợp chỉ số, báo cáo sáng, cảnh báo", stage: 7, tools: ["metrics.read", "report.write", "alert.send"], autonomy: "L2", queue: "agent", tier: "small", usesJev: [], tokenBudgetDay: 200_000 },
  { key: "chat", label: "Chat Agent", description: "Trả lời khách 24/7 theo kho tri thức, chấm lead, chuyển sales", stage: 8, tools: ["kb.search", "conversation.reply", "order.draft", "handoff"], autonomy: "L2", queue: "chat", tier: "small", usesJev: ["chat.turn", "chat.guard", "rag.select"], tokenBudgetDay: 1_000_000 },
  { key: "follow_up", label: "Follow-up Agent", description: "Chăm sóc lại theo mốc, đúng chính sách kênh", stage: 8, tools: ["conversation.reply"], autonomy: "L2", queue: "chat", tier: "small", usesJev: ["chat.guard"], tokenBudgetDay: 300_000 },
  { key: "feedback", label: "Feedback Agent", description: "Rút bài học, đề xuất thay đổi có bằng chứng", stage: 9, tools: ["metrics.read", "lesson.write", "proposal.create"], autonomy: "L0", queue: "agent", tier: "large", usesJev: ["feedback.rejection"], tokenBudgetDay: 300_000 },
  { key: "review", label: "Review Agent", description: "Kiểm tất định + Jev chấm tiêu chí + escalate", stage: 9, tools: ["eval.run", "rubric.apply"], autonomy: "L2", queue: "review", tier: "small", usesJev: ["review.content"], tokenBudgetDay: 300_000 },
];
