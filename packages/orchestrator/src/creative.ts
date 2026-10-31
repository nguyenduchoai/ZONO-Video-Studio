import { execFile, execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { FLOW_URL, listChromeProfiles } from "./chrome-profiles.ts";
import { browserPublish, browserReady, chromeLock, draftRoute, publishChannelFor, routeReason } from "./browser-publish.ts";
import { blockNotConnected, browserFailedBeforePosting, markNeedsCheck, permanentIfFinal, publishText, requeueLater } from "./publishing.ts";
import { approvalExpiresAt } from "./runtime.ts";
import { parseVideoScript } from "./script-video.ts";
import { brandOfDna } from "./dna-intake.ts";
import { connectorForChannel } from "./connections.ts";
import { ANIM_SKILL_DIR, NEWS_SKILL_DIR, REMOTION_NEWS, VI_VOICES, ensureVideoBins, finishMaterialJob, runAutoVideo, runPortrait, videoAiStatus } from "./video-ai.ts";
import { ensureFlowBrowser, flowAccounts, flowMcpConfig, flowSource, openFlowLogin, syncFlowProfile } from "./flow-browser.ts";
import { claudeChromeEnvironment, claudeChromePreflight, flowEngine, friendlyChromeNote } from "./claude-chrome.ts";
import { basename, delimiter, dirname, join, resolve, sep } from "node:path";
import { z } from "zod";
import { activeDna, audit, bizSettings, byId, emit, insert, q, update, type Row } from "@dotaka/db";
import { ConnectorError, connector, platformForChannel } from "@dotaka/connectors";
import { aiAccountHome, cliInfo, effectiveProvider, followClaudeRun, modelFor, permissionPath, runClaudeInTerminal, selectedAiAccount } from "@dotaka/llm-gateway";
import { agentPlaybook } from "@dotaka/skills";
import { AppError, logger, nowIso } from "@dotaka/shared";
import { PermanentError, enqueue } from "./queue.ts";
import { reviewOutput } from "./review.ts";
import { runProEdit } from "./pro-edit.ts";

/**
 * Creative Agent: produces finished videos on Google Flow by running the Marketing department's Flow skills
 * — inside the skill's own Flow Tool — through headless Claude Code + Playwright MCP attached to "Chrome Flow"
 * (flow-browser.ts; reaches into the Tool's sandboxed iframe), then post-produces locally (ffmpeg +
 * zono-video-finish), registers the asset, reviews it, and after approval uploads it to channels as a DRAFT.
 * Each run consumes Flow credits and drives the user's browser, so jobs are started explicitly and run
 * one at a time (lock "flow-chrome").
 */
export const FLOW_TOOLS = {
  "review-do-an-vat": {
    skill: "flow-review-do-an-vat", label: "Review Đồ Ăn Vặt AI V6", minutes: 40,
    hint: "Ảnh bao bì sản phẩm + ảnh nhân vật review (Tool bắt buộc 2 ảnh này; thiếu thì AI tự tạo ảnh trên Flow), tên sản phẩm, giọng, ưu đãi/CTA",
    toolUrl: "https://flow.google.com/project/c726cd18-b6c2-4ca5-9a11-0a759531124d/tool/906532d8-6672-4f21-8bc4-55e5bd9cac91",
    sharedUrl: "https://flow.google.com/shared/tool/906532d8-6672-4f21-8bc4-55e5bd9cac91",
    slots: [
      { role: "Nhân vật / người review", label: "Người review (nhân vật chính)", hint: "Ô A trong Tool · ảnh rõ mặt, nửa người — thiếu thì AI tự tạo" },
      { role: "Bao bì / sản phẩm", label: "Ảnh sản phẩm / bao bì", hint: "Ô B trong Tool · ảnh thật của sản phẩm — thiếu thì AI tự tạo" },
      { role: "Bên trong sản phẩm", label: "Bên trong / miếng ăn", hint: "Ô I · tuỳ chọn" },
      { role: "Bối cảnh / góc bếp", label: "Bối cảnh", hint: "Ô E · tuỳ chọn" },
    ],
    // What the Tool (V6) actually shows — read live from the Tool on 2026-10-01; differs from the skill text on images.
    uiMap: [
      "Thanh tiến trình 5 bước: 1 CẤU HÌNH · 2 KHUNG CHỦ · 3 KỊCH BẢN · 4 STORYBOARD · 5 SẢN XUẤT (bấm số để quay lại bước).",
      "Bước 1 CẤU HÌNH: 4 ô ảnh A NHÂN VẬT (BẮT BUỘC) · B BAO BÌ (BẮT BUỘC) · I BÊN TRONG (ruột/miếng ăn, tuỳ chọn) · E BỐI CẢNH (tuỳ chọn); ô \"Tên sản phẩm *\" + nút XÁC NHẬN HỒ SƠ AI; MIỀN BẮC/MIỀN NAM; NỮ/NAM; thanh \"TỐC ĐỘ NÓI\" (slider); ô XƯNG HÔ; dòng \"Cần: …\" liệt kê thứ còn thiếu; TIẾP TỤC chỉ chạy khi đủ.",
      "Bấm một ô ảnh → Flow mở hộp \"Select media\" (NGOÀI iframe, trong trang chính) gồm Images / Uploads / \"Upload media\" / Recent. Tải ảnh mới: bấm \"Upload media\" rồi browser_file_upload đúng đường dẫn; hoặc chọn ảnh đã có trong Images.",
      "Gán ảnh đầu vào theo vai trò: \"Nhân vật\" → A; \"Bao bì\"/\"Sản phẩm\" → B; \"Bên trong\" → I; \"Bối cảnh\" → E.",
      "THỨ TỰ BẮT BUỘC ở bước 1: (1) có đủ ảnh A và B trong 2 ô (đã tải lên hoặc đã tạo trên Flow) → (2) nhập Tên sản phẩm → (3) chọn giọng → (4) MỚI bấm XÁC NHẬN HỒ SƠ AI. Banner đỏ \"Cần: Ảnh nhân vật, Ảnh bao bì…\" còn hiện nghĩa là CHƯA ĐỦ — TUYỆT ĐỐI không bấm XÁC NHẬN rồi chờ (sẽ treo vô ích). Nếu thiếu ảnh thì tạo ảnh trước, rồi quay lại Tool.",
      "Mở Tool mà thấy khung \"Trình tạo công cụ\" + nút \"Xong\": bấm \"Xong\" ĐÚNG 1 LẦN rồi chờ iframe tải (browser_wait_for 5s) — không navigate lại nhiều lần (mỗi lần reload mất ~30s).",
      "Thiếu ảnh A hoặc B: KHÔNG dừng. Về trang project (nút ← góc trên trái), tạo ẢNH bằng trình tạo gốc (chip cài đặt cạnh ô \"What do you want to create?\" → Image, 9:16, x1): A = chân dung người review Việt Nam phù hợp giới tính/miền, cầm đồ ăn, ánh sáng tự nhiên, nhìn camera; B = ảnh bao bì sản phẩm theo mô tả trong brief, nền sạch. Rồi quay lại Tool, chọn ảnh vừa tạo trong Images. Ghi vào notes là ảnh do AI tạo.",
      "\"NHẬT KÝ HỆ THỐNG (n)\" ở chân Tool: mở ra để đọc lỗi khi một bước không chạy; thu gọn lại nếu nó che nút TIẾP TỤC.",
      "Giọng: nút đang chọn có nền cam. Sau khi bấm MIỀN/GIỚI TÍNH, sang bước 3 kiểm tra dòng \"GIỌNG: …\" trên BẢNG KỊCH BẢN cho đúng.",
    ],
  },
  "review-thoi-trang": {
    skill: "flow-review-thoi-trang", label: "KOC FASHION – AI VIDEO STUDIO", modelNote: "", minutes: 45,
    hint: "Ảnh người mẫu/KOC + ảnh sản phẩm thời trang (thiếu thì AI tự tạo trên Flow), tên – chất liệu – màu, giá/ưu đãi, CTA",
    toolUrl: "https://flow.google.com/project/c726cd18-b6c2-4ca5-9a11-0a759531124d/tool/1419ed9c-053a-4e2d-bfe7-ff5738dfa90d",
    sharedUrl: "https://flow.google.com/shared/tool/160aa62c-4027-46a9-a46a-7e5edb523c05",
    slots: [
      { role: "Người mẫu / KOC", label: "Người mẫu / KOC (nhân vật chính)", hint: "Bước 1 NHÂN VẬT · rõ mặt, nửa người/toàn thân — thiếu thì AI tự tạo" },
      { role: "Sản phẩm thời trang", label: "Ảnh sản phẩm (mặt trước)", hint: "Bước 2 · ảnh thật, rõ màu/logo — ảnh tham chiếu chính" },
      { role: "Chi tiết sản phẩm", label: "Mặt sau / chi tiết vải", hint: "Bước 2 · tuỳ chọn" },
      { role: "Bối cảnh (tham khảo)", label: "Bối cảnh tham khảo", hint: "Tuỳ chọn · Tool tự tạo ảnh bối cảnh, ảnh này để AI mô tả lại" },
    ],
    // Read from the Tool's own source on 2026-10-02 (shared tool 160aa62c, added to the review-do-an-vat project).
    uiMap: [
      "Màn chào \"KOC FASHION / AI VIDEO STUDIO\" → bấm \"Bắt đầu\" (bỏ qua nút logo). Tool KHÔNG lưu phiên: tải lại trang là về màn chào, mất hết dữ liệu — tránh reload giữa chừng.",
      "Thanh bước: NHÂN VẬT · SẢN PHẨM · CẤU HÌNH · KỊCH BẢN · XUẤT VIDEO (không bấm để nhảy bước; đi bằng nút Tiếp tục).",
      "NHÂN VẬT: nút \"THÊM ẢNH\" (tối đa 3 ảnh) + ô \"MÔ TẢ ĐẶC ĐIỂM NHÂN VẬT\" (>10 ký tự) → \"Khoá nhân vật & Tiếp tục\" → \"Tiếp tục\".",
      "Bấm ô thêm ảnh → Flow mở hộp \"Select media\" (NGOÀI iframe, trong trang chính): tải ảnh mới bằng \"Upload media\" + browser_file_upload đúng đường dẫn, hoặc chọn ảnh đã có trong Images; xác nhận lựa chọn trong hộp.",
      "Gán ảnh đầu vào theo vai trò: \"Người mẫu / KOC\" → THÊM ẢNH ở bước NHÂN VẬT; \"Sản phẩm thời trang\" → ô \"Ảnh sản phẩm\" đầu tiên; \"Chi tiết sản phẩm\" → các ô ảnh sản phẩm tiếp theo; \"Bối cảnh (tham khảo)\" KHÔNG tải lên được — xem ảnh (Read) rồi chọn preset gần nhất + viết vào ô mô tả bối cảnh.",
      "SẢN PHẨM: ô ảnh \"Ảnh sản phẩm\" (+), ô \"Tên sản phẩm\", 2 ô Chất liệu (vd \"Vải Tweed\") + Màu (vd \"Be kem\"), ô \"AI Phân tích chi tiết\" (tự viết, hoặc \"⚡ Tự động phân tích\"); select bối cảnh 6 preset + ô mô tả; \"Tạo ảnh bối cảnh chuẩn\" (Nano Banana Pro) → \"Thử đồ AI\" (cần ảnh nhân vật + sản phẩm + bối cảnh) → chụp màn hình soát đúng mặt + đúng sản phẩm → \"Khoá sản phẩm\" → \"Tiếp tục cấu hình\".",
      "CẤU HÌNH: Số lượng cảnh (nút remove/add, 1–12), Tỷ lệ 9:16 / 1:1 / 16:9 (clip chỉ ra 9:16 hoặc 16:9), 3 công tắc không ảnh hưởng clip → \"Tiếp tục viết kịch bản\".",
      "KỊCH BẢN: chế độ \"AI Soạn thảo\" KHÔNG có nút viết khi chưa có cảnh → bấm \"Tự dán kịch bản\", dán mỗi dòng 1 cảnh, \"Áp dụng cho N cảnh\". Mỗi cảnh: textarea \"Lời thoại AI\", input \"Mô tả hình ảnh\" (sửa thành pose + góc máy + chuyển động vải), select \"Thời lượng\" (chọn 8 giây; bộ đếm \"x/20 từ\" xanh là vừa). KHÔNG bấm \"Viết lại toàn bộ kịch bản\" (ghi đè lời thoại). \"Tạo tất cả ảnh mẫu\" → hộp \"Bắt đầu tạo N ảnh\" → chờ ảnh khung đầu → \"Tiến hành tạo Video\".",
      "XUẤT VIDEO: \"Tạo tất cả video\" (quay lần lượt, Veo 3.1 Lite 8s/cảnh, tự kiểm tra mặt + tự quay lại ≤2 lần). Tiến độ ở thanh nổi dưới cùng \"Tiến độ hoàn tất x/N\". Nhãn \"Nhân vật chưa khớp\" → xem clip rồi \"Tạo lại cảnh\" (≤1 lần) hoặc \"Bỏ qua lỗi\". Cảnh lỗi → \"Bắt đầu quay\". Nút \"Ghép & Tải Video\": KHÔNG bấm — dùng zono-flow-save.",
    ],
  },
  "nguoi-que-so-sanh": {
    skill: "flow-nguoi-que-so-sanh", label: "Người que so sánh sản phẩm", toolTitle: "Storyboard Studio VN", modelNote: "", minutes: 40,
    hint: "Sản phẩm A vs B + tiêu chí so sánh (giá, chất lượng, tiện lợi…), ảnh 2 sản phẩm, ảnh người que mẫu (thiếu thì AI tự tạo), giọng, CTA",
    toolUrl: "https://flow.google.com/project/c726cd18-b6c2-4ca5-9a11-0a759531124d/tool/7bf9f78b-cd78-4a29-9dc6-dc1ff72d1732",
    sharedUrl: "https://flow.google.com/shared/tool/7bf9f78b-cd78-4a29-9dc6-dc1ff72d1732",
    slots: [
      { role: "Nhân vật người que", label: "Người que mẫu (nhân vật chính)", hint: "Quyết định nét vẽ cả video — thiếu thì AI tạo người que trên Flow" },
      { role: "Sản phẩm A", label: "Sản phẩm A (của mình)", hint: "Ảnh rõ sản phẩm / bao bì" },
      { role: "Sản phẩm B", label: "Sản phẩm B (đối chứng)", hint: "Tuỳ chọn" },
    ],
    // Read from the Tool's own source on 2026-10-02 (shared tool 7bf9f78b "Storyboard Studio VN", added to the review-do-an-vat project).
    uiMap: [
      "Tiêu đề trong Tool là \"STORYBOARD STUDIO VN\" (tiêu đề trang Flow là tên project). Thanh bước: 1 Đầu vào · 2 Kịch bản · 3 Storyboard · 4 Video · 5 Hoàn thiện. Nút chính nằm ở THANH DƯỚI CÙNG hoặc cuối danh sách cảnh.",
      "Tool LƯU NHÁP trong trình duyệt: nếu mở ra đã có tham chiếu/kịch bản/bước > 1 của video trước → bấm \"Làm mới\" 2 lần (lần 1 đổi chữ thành \"Xóa dữ liệu?\", lần 2 xác nhận) — chỉ xóa nháp của Tool, được phép. Công tắc \"DEBUG PROMPT\" phải TẮT (bật thì không tạo gì).",
      "Bước 1: \"1. THAM CHIẾU (n/4)\" nút \"THÊM ẢNH\" (mỗi lần 1 ảnh) → hộp \"Select media\" của Flow (NGOÀI iframe): \"Upload media\" + browser_file_upload, hoặc chọn ảnh có sẵn. Ảnh 1 tự nhận vai NHÂN VẬT, ảnh sau là SẢN PHẨM; bấm nhãn vai dưới ảnh để đổi vòng Nhân vật→Sản phẩm→Bối cảnh→Khác. Mỗi khung chỉ dùng 3 tham chiếu đầu (Nhân vật + 2 cái khác).",
      "Gán ảnh đầu vào: \"Nhân vật người que\" → ảnh 1 (NHÂN VẬT); \"Sản phẩm A\" → ảnh 2; \"Sản phẩm B\" → ảnh 3 (SẢN PHẨM). Thiếu người que: về trang project tạo 1 ảnh người que (Image, 9:16, x1) rồi chọn trong Images.",
      "Bước 1 tiếp: ô \"2. PHONG CÁCH BỔ SUNG\" (tiếng Anh), \"3. TỶ LỆ KHUNG HÌNH\" 16:9/9:16/1:1, \"4. GIỌNG AI (VOICE LOCK)\" textarea + 3 nút Nam miền Bắc / Nữ miền Bắc / Nữ miền Nam; textarea lớn \"DÁN KỊCH BẢN TIẾNG VIỆT\" → \"Phân tích kịch bản\" (cần ≥1 tham chiếu) → tự sang bước 2.",
      "Bước 2 mỗi thẻ cảnh: ô tiêu đề, nút thời lượng 4s/6s/8s/10s, textarea \"MÔ TẢ HÌNH ẢNH (EN)\", textarea \"LỜI THOẠI (VN)\" với bộ đếm \"x/y từ\" (y = 2 từ/giây; đỏ = quá), Chuyển động static/push-in/action, checkbox \"Có thoại\", chế độ voice over/on camera (chọn voice over). \"Thêm cảnh\" ở đầu, \"Gỡ cảnh\" (bấm 2 lần). Cuối trang: \"Duyệt kịch bản → Sang Storyboard\".",
      "Bước 3: thanh dưới \"Tạo Scene 1 làm neo\" → xem ảnh → \"Duyệt Neo & Tạo phần còn lại\". Mỗi thẻ: \"Tạo lại\" và nút mỏ neo (anchor = tạo lại bám tham chiếu chặt hơn). Cuối lưới: \"Chuyển sang Video\".",
      "Bước 4: thanh dưới \"Tạo tất cả video chưa có\" (Omni 1.1 Flash, 2 clip song song); tiến độ \"x / N clip video\" ở thanh dưới; cảnh lỗi có \"Thử lại\"/\"Chi tiết\". Khi đủ N/N, Ở NGAY BƯỚC 4 (lưới video theo đúng thứ tự cảnh) chạy zono-flow-save. KHÔNG sang bước 5 bấm Ghép phim / Lưu video / Tải clip gốc.",
    ],
  },
  "nhan-hieu": {
    skill: "flow-video-nhan-hieu", label: "Video nhân hiệu · BrandUp", toolTitle: "BRANDUP STUDIO", minutes: 45,
    modelNote: "VIDEO MODEL trong Tool: giữ \"Gemini Omni 1.1\" (KHÔNG chọn Google Veo 3.1). Chỉ khi Omni báo \"usage limit\" ở mọi cảnh mới thử Veo 3.1 một lần.",
    hint: "Ảnh chân dung rõ mặt của chính người xây nhân hiệu (bắt buộc) + chủ đề/quan điểm/câu chuyện thật, giọng (nam/nữ), bối cảnh, CTA",
    toolUrl: "https://flow.google.com/project/c726cd18-b6c2-4ca5-9a11-0a759531124d/tool/d9369067-8447-460c-ba83-dcdaf628ff32",
    sharedUrl: "https://flow.google.com/shared/tool/505263ff-28b6-4c01-a5df-8dc66a5da221",
    slots: [
      { role: "Chân dung nhân hiệu", label: "Chân dung người xây nhân hiệu", hint: "Rõ mặt, chính diện — bắt buộc (đúng người đứng tên nhân hiệu)", required: true },
      { role: "Ảnh khác của nhân vật", label: "Ảnh khác của cùng người", hint: "Góc khác / nửa người / trang phục muốn giữ · tuỳ chọn" },
      { role: "Ảnh nền", label: "Ảnh nền (văn phòng, studio…)", hint: "Master Background · tuỳ chọn" },
    ],
    // Read from the Tool's own source on 2026-10-03 (shared tool 505263ff "BRANDUP STUDIO", added to the review-do-an-vat project).
    uiMap: [
      "Thanh trên Flow ghi tên Tool \"Remix of BRANDUP VIDEO TOOL - ZONO\"; trong Tool là \"BRANDUP STUDIO\". 6 bước: 1 THIẾT LẬP · 2 NHÂN VẬT · 3 BỐI CẢNH · 4 TẠO MẪU · 5 KỊCH BẢN · 6 TẠO VIDEO. Đi bước bằng \"TIẾP TỤC\" / \"QUAY LẠI\" ở thanh dưới (không kiểm tra điều kiện); bước 5 là nút \"SẢN XUẤT\". Tool KHÔNG lưu phiên; nút \"RESET\" = tải lại trang, mất hết.",
      "Dropdown của Tool là nút tự vẽ (bấm nút có chữ giá trị hiện tại → bấm dòng lựa chọn), không phải <select>. Công tắc \"TỰ DO\"/\"KHÓA\" là 2 nút.",
      "Bước 1: ô \"GIỌNG AI CHUẨN (GEMINI)\" mở hộp chọn giọng — CHỈ hiển thị, KHÔNG được gửi khi tạo video. Khóa giọng thật sự = \"ÂM THANH THAM CHIẾU\" → \"CHỌN MẪU AUDIO\" → hộp chọn âm thanh của Flow (NGOÀI iframe). Hộp này KHÔNG nhận tệp .mp3 tải lên (đã thử 2026-10-03): dùng chức năng tạo GIỌNG TÙY CHỈNH trong hộp, mô tả bằng lời (vd \"giọng nam miền Bắc Việt Nam, khoảng 35 tuổi, điềm tĩnh, tự tin\"), chọn giọng vừa tạo làm âm thanh tham chiếu; ghi notes là giọng do Gemini tạo. Không cần zono-tts cho Tool này.",
      "Bước 1 tiếp: \"NGÔN NGỮ KỊCH BẢN\" = Tiếng Việt (Việt Nam); \"VIDEO MODEL\" = Gemini Omni 1.1 (giữ mặc định; Veo 3.1 cắt cảnh 10s về 8s); \"KÍCH THƯỚC VIDEO\" 9:16/16:9/1:1.",
      "Gán ảnh đầu vào: \"Chân dung nhân hiệu\" + \"Ảnh khác của nhân vật\" → bước 2 nút \"ẢNH THAM KHẢO\" (chọn nhiều, tối đa 5), rồi bấm ảnh chân dung để đặt làm ảnh chính (viền xanh + ✓); \"Ảnh nền\" → bước 3 \"Master Background\" nút \"Tải nền\". KHÔNG có ảnh chân dung thật → dừng, status \"blocked\" (không tự tạo người giả).",
      "Bước 2: Giới tính, Độ tuổi (ô số), \"Khóa gương mặt\" = KHÓA (ô mô tả mặt bị khóa), Kiểu tóc, Màu tóc; \"Mẫu trang phục\" + \"Khóa trang phục\" (KHÓA = giữ đồ trong ảnh); \"Phụ kiện\" mặc định \"Kính gọng đen\" — xóa nếu người trong ảnh không đeo kính.",
      "Bước 3: tab \"Cấu hình có sẵn\" (Địa điểm chính, Master Background, Thời điểm, Mood, Ánh sáng, Nhiệt độ màu, DoF, Thời tiết, Chuyển động môi trường) hoặc \"Cấu hình tự điền\"; khối \"Camera & Chuyển động\": Cách quay, Chuyển động NV, Cỡ cảnh, Chuyển động máy, ô \"Tính cách / Phong thái nhân vật\".",
      "Bước 4: \"TẠO MẪU MASTER REFERENCE\" (1 ảnh) → ảnh mới thành ảnh chính; chụp màn hình so mặt với ảnh gốc.",
      "Bước 5: textarea \"Dán kịch bản của bạn vào đây...\" → \"SẢN XUẤT\" (Tool tự chia cảnh theo câu, ≤30 từ/cảnh, 3 từ/giây). Bước 6 \"Bàn dựng phân cảnh\": mỗi cảnh có lời thoại, textarea \"AI Visualization Prompt\", nhãn \"x từ • ys\", nút \"TẠO VIDEO\"/\"TẠO LẠI\"; trên cùng \"SỬA KỊCH BẢN\" và \"TẠO TẤT CẢ\" (tạo lần lượt). Đủ video mọi cảnh → zono-flow-save ngay tại bước 6 (Tool không có nút ghép).",
    ],
  },
  // Skill video-nhan-hieu-google-flow: KHÔNG có Tool — dùng trình tạo video thường của Flow (Thành phần + ảnh nhân vật).
  "nhan-hieu-dao-ly": {
    skill: "video-nhan-hieu-google-flow", generator: true, label: "Video nhân hiệu · đi bộ nói đạo lý", minutes: 35,
    modelNote: "Trình tạo video THƯỜNG của Flow (không có Tool): Video · Thành phần (Ingredients) · 9:16 · Omni 1.1 Flash · 720p · 8 giây (10 giây khi lời 36–45 âm tiết) · x1. KHÔNG dùng 4K. ~12 tín dụng / cảnh 8s.",
    hint: "Ảnh chân dung nhân vật (bắt buộc) + chủ đề đạo lý (gia đình, hôn nhân, cha mẹ – con cái…) hoặc kịch bản có sẵn → nhân vật vừa đi bộ vừa nói, góc selfie, 4–5 cảnh ~30–40 giây, ghép + phụ đề",
    toolUrl: null,
    slots: [
      { role: "Nhân vật nói", label: "Ảnh nhân vật (người nói)", hint: "Rõ mặt, nửa người — bắt buộc; giữ đúng gương mặt ở mọi cảnh", required: true },
    ],
    uiMap: [
      "Trang dự án Flow: ô \"What do you want to create?\" / \"Bạn muốn tạo gì?\" ở cuối trang + chip cài đặt bên cạnh (loại nội dung, chế độ, tỉ lệ, model, độ phân giải, thời lượng, số lượng).",
      "Cài đặt cho MỌI cảnh: Video · Thành phần (Ingredients / Components) · 9:16 · Omni 1.1 Flash · 720p · 8 giây (10 giây nếu lời 36–45 âm tiết) · x1.",
      "Ảnh nhân vật: nút + / Tải nội dung lên (Upload media) → browser_file_upload đúng đường dẫn ảnh của Sếp; rồi chọn ảnh → \"Thêm vào câu lệnh\" (Add to prompt) cho từng cảnh.",
      "Gửi lần lượt các cảnh (không cần chờ cảnh trước xong). Thẻ video hiện % khi đang tạo; xong thì bấm vào thẻ để mở trình phát.",
      "Cảnh lỗi (sai lời / méo mặt): mở thẻ → \"Sử dụng lại câu lệnh\" (Reuse prompt) để tạo lại — tối đa 2 lần/cảnh.",
    ],
  },
  "koc-thoi-trang-nu": {
    skill: "flow-koc-thoi-trang-nu", label: "KOC thời trang nữ · Studio v3", toolTitle: "KOC Fashion Studio v3", minutes: 45,
    hint: "Ảnh sản phẩm thời trang nữ (bắt buộc, 1–3 món) + ảnh KOC và bối cảnh (thiếu thì AI tạo), tên – điểm nổi bật – giá/ưu đãi",
    toolUrl: "https://flow.google.com/project/c726cd18-b6c2-4ca5-9a11-0a759531124d/tool/91a76ef9-7703-42d5-a264-7031a9b6a5f6",
    sharedUrl: "https://flow.google.com/shared/tool/91a76ef9-7703-42d5-a264-7031a9b6a5f6",
    slots: [
      { role: "Sản phẩm SP1", label: "Sản phẩm chính (SP1)", hint: "Ô SP1 · ảnh thật rõ màu, hoạ tiết — bắt buộc", required: true },
      { role: "KOC nữ", label: "KOC / người mẫu nữ", hint: "Ô KOC (mặt, tóc, dáng) · thiếu thì AI tạo người mẫu" },
      { role: "Sản phẩm SP2", label: "Món phối thêm (SP2)", hint: "Ô SP2 · tuỳ chọn" },
      { role: "Bối cảnh", label: "Background (bối cảnh)", hint: "Ô Background · thiếu thì AI tạo phòng/bối cảnh" },
    ],
    // Read from the Tool's own source on 2026-10-03 (shared tool 91a76ef9 "KOC Fashion Studio v3").
    uiMap: [
      "Màn chào \"KOC FASHION / AI VIDEO STUDIO\" → \"Bắt đầu\". Tool KHÔNG lưu phiên (tải lại trang là mất hết). Cột trái: \"Model video\" (Veo 3.1 - Fast/Lite/Quality, Omni 1.1 Flash), \"Tỷ lệ khung hình (ảnh + video)\" 9:16/16:9, \"Âm thanh (áp cho tất cả cảnh)\"; các dropdown là nút tự vẽ (bấm giá trị hiện tại → bấm dòng chọn).",
      "KHÔNG bấm \"Tạo full video 1 click\" (chạy liền không dừng soát ảnh, và tự ghép thêm một video thừa vào trang) và KHÔNG bấm \"Bắt đầu lại\". Chạy từng bước bằng các nút trong vùng làm việc.",
      "Tải ảnh: 5 ô \"KOC (mặt / tóc / dáng)\", \"Sản phẩm SP1/SP2/SP3\", \"Background (bối cảnh)\" là <input type=file> TRONG iframe: browser_click ô → browser_file_upload đúng đường dẫn (không qua hộp Select media của Flow). Gán: \"Sản phẩm SP1\" → SP1, \"Sản phẩm SP2\" → SP2, \"KOC nữ\" → KOC, \"Bối cảnh\" → Background. Thiếu KOC/Background: về trang project tạo ảnh bằng trình tạo gốc của Flow (Image, 9:16, x1), khi ảnh hiện ra chạy zono-flow-save --images 4 --out <workdir>/inputs --prefix koc_ (hoặc bg_) — lưu tối đa 4 ảnh lớn đang hiện trên trang (trên → dưới, có cả ảnh trang trí) — Read từng tệp để chọn đúng ảnh vừa tạo, rồi quay lại Tool và browser_file_upload tệp đó vào ô; ghi notes là ảnh do AI tạo.",
      "Ba ô chữ: \"Tên SP…\", \"Điểm nổi bật…\", \"Giá / ưu đãi…\". Nút theo thứ tự: tạo ảnh KOC gốc (cảnh 1) → tạo 5 ảnh selfie (cảnh 2–6) → viết kịch bản → tạo tất cả video. Mỗi thẻ cảnh: nút tạo lại ảnh, nút \"Dùng ảnh có sẵn\" (ảnh 9:16), textarea \"Prompt chuyển động (tiếng Anh)...\", nút bật/tắt thoại, textarea \"Câu thoại tiếng Việt (tối đa 16 từ)...\", nút tạo/tạo lại video.",
      "Video: tối đa 2 cảnh song song, 8s/cảnh; Tool tự thử lại 5s/15s/30s → đổi model Veo dự phòng → bỏ thoại → rút gọn prompt (mỗi lần tốn tín dụng). Bảng \"Nhật ký tạo video\" cuối trang ghi model/kết quả từng lần. Đủ 6 cảnh có video → zono-flow-save NGAY (trước khi bấm \"Ghép full video\" — video ghép sẽ thành clip thừa).",
      "Tool dùng hộp thoại alert/confirm của trình duyệt: khi có dialog, đọc nội dung bằng snapshot rồi browser_handle_dialog — accept với thông báo, dismiss với \"Xoá toàn bộ…\".",
    ],
  },
  "review-gia-dung": {
    skill: "flow-review-gia-dung", label: "Review đồ gia dụng", toolTitle: "TOOL REVIEW GIA DỤNG", minutes: 35,
    hint: "Ảnh đồ gia dụng (bắt buộc, 1–3 ảnh) + công dụng, thông số, giá/ưu đãi, tên thương hiệu/shop; ảnh KOC nếu có (thiếu thì AI tự sinh)",
    toolUrl: "https://flow.google.com/project/c726cd18-b6c2-4ca5-9a11-0a759531124d/tool/c126d178-1bd0-49e8-bc27-c6b53870a42b",
    sharedUrl: "https://flow.google.com/shared/tool/c126d178-1bd0-49e8-bc27-c6b53870a42b",
    slots: [
      { role: "Sản phẩm 1", label: "Sản phẩm (ảnh tổng thể)", hint: "Ô 1 · ảnh thật rõ dáng, màu — bắt buộc", required: true },
      { role: "Sản phẩm 2", label: "Chi tiết / đang dùng", hint: "Ô 2 · tuỳ chọn" },
      { role: "Sản phẩm 3", label: "Phụ kiện / màu khác", hint: "Ô 3 · tuỳ chọn" },
      { role: "KOC mẫu", label: "KOC / người review", hint: "\"Dùng KOC Mẫu\" — thiếu thì AI tự sinh" },
    ],
    // Read from the Tool's own source on 2026-10-05 (shared tool c126d178 "TOOL REVIEW GIA DỤNG").
    uiMap: [
      "Màn chào \"TOOL REVIEW GIA DỤNG\" → \"Bắt đầu sản xuất\". Tool KHÔNG lưu phiên. Cột trái \"AI STUDIO\" từ trên xuống: 1. Hình ảnh Sản phẩm (3 ô +) · 2. Thông tin sản phẩm (textarea \"Mô tả công dụng, tính năng, ưu đãi...\") · 3. Nhân vật KOC (2 nút \"AI Tự Sinh\" / \"Dùng KOC Mẫu\", chọn Dùng KOC Mẫu mới hiện ô \"Tải ảnh KOC mẫu\") · 4. Thiết lập AI (\"Tên Thương Hiệu\" mặc định GIA DỤNG VIỆT, dropdown \"Model Video\") · nút \"TẠO SHOWROOM GỐC\" · 5. Xuất bản: \"LÊN KỊCH BẢN KOC\", \"SẢN XUẤT TOÀN BỘ CLIPS\", \"TẢI GÓI ZIP\" (không bấm).",
      "Bấm ô ảnh sản phẩm / ô KOC → Flow mở hộp \"Select media\" (NGOÀI iframe, trong trang chính): tải ảnh mới bằng \"Upload media\" + browser_file_upload, hoặc chọn ảnh có sẵn. Gán: \"Sản phẩm 1/2/3\" → ô 1/2/3; \"KOC mẫu\" → bấm \"Dùng KOC Mẫu\" rồi ô \"Tải ảnh KOC mẫu\"; không có ảnh KOC → để \"AI Tự Sinh\".",
      "LUÔN sửa \"Tên Thương Hiệu\" (tên này đi vào lời thoại): thương hiệu/shop trong brief, không có thì tên sản phẩm. Ô Thông tin sản phẩm là nguồn DUY NHẤT của kịch bản và kịch bản KHÔNG sửa tay được trong Tool: viết đủ công dụng, thông số, giá/ưu đãi có trong brief, không thêm số liệu không có.",
      "\"TẠO SHOWROOM GỐC\" (1 ảnh 9:16) — cả 5 clip dùng ảnh này làm khung đầu. Chụp màn hình soát CÓ NGƯỜI REVIEW (bị chặn chính sách thì Tool tự tạo ảnh chỉ có sản phẩm mà vẫn báo xong) và đúng sản phẩm; hộp đỏ \"Lỗi Policy\" → bỏ từ nhạy cảm khỏi ô thông tin rồi tạo lại.",
      "\"LÊN KỊCH BẢN KOC\" → đọc 5 dòng \"Kịch bản:\" dưới 5 ô clip (sai thương hiệu/giá/số liệu → bấm lại, ≤ 2 lần). \"SẢN XUẤT TOÀN BỘ CLIPS\" chạy 5 clip cùng lúc; Tool KHÔNG tự thử lại — ô nào hết vòng tiến độ mà vẫn trống (nút \"TẠO CLIP\") là lỗi → bấm \"TẠO CLIP\" ở ô đó; clip sai → \"LÀM LẠI\". Đủ 5 clip → zono-flow-save (5 clip theo thứ tự ô 01→05).",
    ],
  },
  "review-nha-hang": {
    skill: "flow-review-nha-hang-shop", label: "Review nhà hàng · quán · shop", toolTitle: "TOOL TẠO VIDEO REVIEW NHÀ HÀNG - QUÁN XÁ", minutes: 40,
    hint: "Ảnh thật mặt tiền + không gian (bắt buộc), tên, địa chỉ, loại hình, món/dịch vụ nổi bật, giá, giờ mở cửa, ưu đãi; ảnh người review nếu có (không có thì AI tạo nhân vật ảo)",
    toolUrl: "https://flow.google.com/project/c726cd18-b6c2-4ca5-9a11-0a759531124d/tool/159cfd94-4f1a-481a-bd77-9e297bd1ae24",
    sharedUrl: "https://flow.google.com/shared/tool/159cfd94-4f1a-481a-bd77-9e297bd1ae24",
    slots: [
      { role: "Mặt tiền", label: "Mặt tiền (ngoài quán)", hint: "Ô MẶT TIỀN · cảnh 1 · ảnh thật thấy biển hiệu — bắt buộc", required: true },
      { role: "Không gian", label: "Không gian bên trong", hint: "Ô KHÔNG GIAN · cảnh 2 trở đi · ảnh thật — bắt buộc", required: true },
      { role: "Người review", label: "Người review (KOC)", hint: "Ô ẢNH NHÂN VẬT THAM CHIẾU — thiếu thì tạo nhân vật ảo" },
    ],
    // Read from the Tool's own source on 2026-10-05 (shared tool 159cfd94 "TOOL TẠO VIDEO REVIEW NHÀ HÀNG - QUÁN XÁ").
    uiMap: [
      "3 cột: trái \"Thiết lập Review\" · giữa 3 tab \"Kịch bản\" / \"Ảnh (9:16)\" / \"Video (9:16)\" · phải \"Quy trình Sản xuất\" với 3 nút theo thứ tự \"Tạo kịch bản\" → \"Tạo N ảnh (…)\" → \"Tạo N clip (…)\". Tool KHÔNG lưu phiên. Dropdown là nút tự vẽ (bấm giá trị hiện tại → bấm dòng chọn).",
      "Cột trái: \"Tên cửa hàng/quán\", \"Địa chỉ cụ thể\", \"Ý tưởng kịch bản\" (BẮT BUỘC — trống thì alert; là ô duy nhất mang nội dung vào kịch bản: viết món/dịch vụ, giá, giờ, ưu đãi có trong brief, không thêm gì), \"Tổng thời lượng\" 8s…64s (số đoạn = ÷8; theo thời lượng job, làm tròn bội 8), \"Khung hình\", \"Model Ảnh\", \"Model Video\" (Omni Flash / Veo 3.1 Lite / Fast / Quality), 3 ô ảnh, \"Loại hình kinh doanh\", \"Giọng văn / Phong cách\", thanh \"Mức độ đánh giá\" (chỉ hiển thị).",
      "Ô ảnh mở hộp \"Select media\" của Flow (NGOÀI iframe): \"Upload media\" + browser_file_upload, hoặc chọn ảnh có sẵn. Gán: \"Mặt tiền\" → ô MẶT TIỀN (cảnh 1), \"Không gian\" → ô KHÔNG GIAN (cảnh 2+), \"Người review\" → ô ẢNH NHÂN VẬT THAM CHIẾU; không có ảnh người review → nút \"Tạo Nhân vật ảo (FREE)\". Thiếu ảnh mặt tiền/không gian THẬT → dừng, status \"blocked\" (không để AI vẽ quán không có thật).",
      "Tab Kịch bản: thẻ \"Đoạn n (8s)\", nút bút (sửa) mở textarea; sửa mỗi đoạn thành câu nói 16–22 từ, bỏ mô tả cảnh/chú thích. KHÔNG bấm nút micro (ghi âm từ micro máy). Tab Ảnh: nhãn NGOÀI QUÁN / TRONG QUÁN, nút tạo lại từng ảnh. Tab Video: nút \"Thử lại\" khi lỗi, nút refresh để làm lại; zono-flow-save CHỈ khi đang mở tab Video (tab khác không có thẻ video). Hộp thoại alert (\"Vui lòng nhập ý tưởng…\", \"Vui lòng sản xuất ảnh mẫu trước!\") → browser_handle_dialog accept rồi bổ sung bước thiếu.",
    ],
  },
  "cooking-director": {
    skill: "flow-cooking-director-video", label: "Flow Cooking Director v2 · Đạo Diễn AI", toolTitle: "Director AI: Character consistent", minutes: 45, hint: "3 ảnh (chân dung người dẫn, món ăn, bao bì/góc bếp) + tên, giá, điểm nổi bật",
    toolUrl: "https://flow.google.com/project/c726cd18-b6c2-4ca5-9a11-0a759531124d/tool/1f7438cf-cab7-4449-9311-196bfc399c6d",
    sharedUrl: "https://flow.google.com/shared/tool/5a0891a5-c3d0-4252-ab1d-a06ae4181fb7",
    uiMap: [
      "Tiêu đề trong Tool là \"ĐẠO DIỄN AI (VIETNAMESE)\". Chọn Phong cách hình ảnh (Điện ảnh chân thực), Model AI Video (Omni Flash), Tỷ lệ khung hình (TikTok 9:16).",
      "Tải ảnh nhân vật (Portrait) và mẫu giọng (Voice Clone) ở phần Character Bible, nhập ý tưởng kịch bản rồi bấm \"Tạo kịch bản mới\" → tạo ảnh và render video từng cảnh.",
    ],
    slots: [
      { role: "Nhân vật / người dẫn", label: "Người dẫn (nhân vật chính)", hint: "Chân dung rõ mặt" },
      { role: "Sản phẩm / món ăn", label: "Món ăn / sản phẩm", hint: "Ảnh thật của món / sản phẩm" },
      { role: "Bao bì / góc bếp", label: "Bao bì / góc bếp", hint: "Tuỳ chọn" },
    ],
  },
  "cinematic": {
    skill: "flow-cinematic-short-film", label: "Cinematic Short Film Studio · Đạo Diễn AI", toolTitle: "Director AI: Character consistent", minutes: 50, hint: "Ảnh nhân vật/bối cảnh/đạo cụ + chủ đề, thông điệp, thời lượng 30/60/90s",
    toolUrl: "https://flow.google.com/project/c726cd18-b6c2-4ca5-9a11-0a759531124d/tool/1f7438cf-cab7-4449-9311-196bfc399c6d",
    sharedUrl: "https://flow.google.com/shared/tool/5a0891a5-c3d0-4252-ab1d-a06ae4181fb7",
    uiMap: [
      "Tiêu đề trong Tool là \"ĐẠO DIỄN AI (VIETNAMESE)\". Chọn Phong cách hình ảnh (Điện ảnh chân thực), Model AI Video (Omni Flash), Tỷ lệ khung hình (TikTok 9:16).",
      "Tải ảnh nhân vật (Portrait) ở phần Character Bible, nhập ý tưởng kịch bản phim ngắn rồi bấm \"Tạo kịch bản mới\" → tạo ảnh và render video từng cảnh.",
    ],
    slots: [
      { role: "Nhân vật chính", label: "Nhân vật chính", hint: "Người / nhân vật xuất hiện xuyên suốt phim" },
      { role: "Sản phẩm / đạo cụ", label: "Sản phẩm / đạo cụ", hint: "Tuỳ chọn" },
      { role: "Bối cảnh", label: "Bối cảnh", hint: "Tuỳ chọn" },
    ],
  },
  // Local video AI (services/video-ai) — no Flow credits, no browser
  // Claude CLI + ffmpeg + whisper on this Mac: Decode reference video + edit the CEO's own raw footage → finished film (no Flow credits).
  "edit-source": {
    engine: "edit", skill: "", label: "Decode Video Mẫu & Dựng Phim từ Video Quay Sẵn (Claude + Local)", minutes: 10,
    hint: "Tải lên Video Mẫu để giải mã nhịp cắt/góc máy + tải các Video Quay Sẵn (cảnh quay sản phẩm, cửa hàng, livestream, b-roll…) → Claude AI + Local FFmpeg/Whisper học theo công thức Video Decode để chọn đoạn đẹp nhất, ghép cảnh, zoom, phụ đề từng từ & nhạc nền -14 LUFS",
    toolUrl: null, uiMap: [],
  },
  "auto-video": { engine: "moneyprinter", skill: "", label: "Video tự động · cảnh quay sẵn + giọng đọc", minutes: 4, hint: "Chủ đề hoặc kịch bản có sẵn → Claude CLI viết lời đọc, ghép cảnh từ kho clip quay sẵn hoặc Pexels/Pixabay, giọng Việt VieNeu-TTS, phụ đề tự động", toolUrl: null, uiMap: [] },
  // Claude CLI + Remotion on this Mac (skill news-to-video): article link → voice, word timing, karaoke subtitles, motion graphics.
  "news-video": {
    engine: "news", skill: "news-to-video", label: "Video tin tức từ link bài báo", minutes: 15,
    hint: "Dán link bài báo (kèm ghi chú nếu cần: giọng nam/nữ, nhấn mạnh ý nào) → Claude CLI đọc bài, viết lời đọc, giọng Việt, phụ đề karaoke, đồ hoạ Remotion, chuẩn âm thanh -14 LUFS",
    toolUrl: null, uiMap: [],
  },
  // Animated Video Studio (Remotion + GSAP + Motion + Lottie/Rive + ShotCraft): industry templates → animated 2D & motion graphics video.
  "anim-video": {
    engine: "anim", skill: "zono-animated-video", label: "Video Motion Graphics & 2D Đa Ngành · Remotion Studio", minutes: 15,
    hint: "Chọn mẫu ngành nghề (E-commerce, Ẩm thực F&B, Y tế/Mỹ phẩm, Giáo dục, Tài chính/BĐS, Người que kể chuyện) + nhập nội dung/sản phẩm → CLI tự dựng Motion Graphics & 2D bằng Remotion + GSAP + Motion + Lottie/SVG, lồng tiếng Việt, phụ đề karaoke, xuất MP4 9:16 chuẩn -14 LUFS",
    toolUrl: null, uiMap: [],
  },
  "portrait": {
    engine: "liveportrait", skill: "", label: "Ảnh chân dung cử động", minutes: 5, hint: "1 ảnh chân dung rõ mặt + video biểu cảm mẫu (có sẵn hoặc tải lên) → LivePortrait làm ảnh cử động; có thể lồng giọng đọc", toolUrl: null, uiMap: [],
    slots: [{ role: "Nhân vật", label: "Ảnh chân dung", hint: "Chính diện, rõ mặt, 1 người", required: true }],
  },
} as { [k: string]: { engine?: "flow" | "moneyprinter" | "liveportrait" | "news" | "anim" | "edit"; /** Flow không có Tool: dùng trình tạo video thường trên trang dự án. */ generator?: boolean; skill: string; label: string; /** Name the Tool itself shows, when the card label differs. */ toolTitle?: string; /** Replaces the "use Veo model X" line when the skill fixes the model ("" = no line). */ modelNote?: string; minutes: number; hint: string; toolUrl: string | null; sharedUrl?: string | null; uiMap: string[]; slots?: { role: string; label: string; hint: string; required?: boolean }[] } };
export type FlowToolKey = "review-do-an-vat" | "review-thoi-trang" | "nguoi-que-so-sanh" | "nhan-hieu" | "koc-thoi-trang-nu" | "review-gia-dung" | "review-nha-hang" | "cooking-director" | "cinematic" | "auto-video" | "news-video" | "anim-video" | "edit-source" | "portrait" | "nhan-hieu-dao-ly";
export const engineOf = (tool: string) => FLOW_TOOLS[tool]?.engine ?? "flow";

export const CreativeInput = z.object({
  tool: z.enum(Object.keys(FLOW_TOOLS) as [FlowToolKey, ...FlowToolKey[]]),
  title: z.string().min(2).max(120),
  brief: z.string().min(5).max(6000), // product info / topic / script
  product: z.string().max(200).optional(),
  durationSec: z.number().int().min(15).max(120).optional(),
  voice: z.string().max(200).optional(),
  hookTitle: z.string().max(120).optional(),
  cta: z.string().max(160).optional(),
  images: z.array(z.object({ path: z.string(), role: z.string() })).max(8).default([]),
  channels: z.array(z.string()).min(1).default(["tiktok"]),
  brand: z.enum(["zono", "other"]).default("other"), // "zono" = the installing business's own brand (its DNA applies); "other" = affiliate/client channel, DNA NOT applied
  sourceContentId: z.string().optional(),
  /** Kịch bản đã duyệt (từ Nội dung → Tạo video): lời đọc + hình ảnh gợi ý + chữ màn hình từng cảnh, cho bộ dựng từ video thô. */
  script: z.object({
    scenes: z.array(z.object({ from: z.number(), to: z.number(), voice: z.string().max(600), visual: z.string().max(600).default(""), onScreen: z.string().max(120).default("") })).min(1).max(24),
  }).optional(),
  /** Veo model, used only if the Tool offers a model choice (the Tool otherwise decides). */
  veoModel: z.enum(["Veo 3.1 - Lite", "Veo 3.1 - Fast", "Veo 3.1 - Quality"]).default("Veo 3.1 - Fast"),
  /** Options for the local engines (auto-video / portrait). */
  video: z.object({
    source: z.enum(["pexels", "pixabay", "local", "flow"]).optional(), materials: z.array(z.string()).max(30).optional(), flowJobId: z.string().optional(),
    /** Dựng từ video thô: style = phong cách dựng; music "none" = không nhạc nền. */ style: z.enum(["dynamic", "smooth", "clean"]).optional(), music: z.enum(["auto", "none"]).optional(),
    scriptReady: z.boolean().optional(), terms: z.string().max(400).optional(), aspect: z.enum(["9:16", "16:9", "1:1"]).optional(), clipDuration: z.number().int().min(2).max(10).optional(),
    voiceName: z.string().max(60).optional(), voiceRate: z.number().min(0.6).max(1.6).optional(), bgm: z.enum(["random", "none"]).optional(),
    driving: z.string().max(60).optional(), drivingPath: z.string().optional(), voiceText: z.string().max(2000).optional(), seconds: z.number().int().min(3).max(20).optional(),
    animTemplate: z.enum(["ecommerce-promo", "fnb-cartoon", "health-beauty", "education-explainer", "finance-realestate", "stickman-story", "moral-story", "vietnamese-folk"]).optional(),
    animStyle: z.enum(["2d-mascot", "stickman", "moral-cinematic", "ghibli-watercolor", "kinetic-motion"]).optional(),
  }).optional(),
});
export type CreativeInput = z.infer<typeof CreativeInput>;

export const FlowResult = z.object({
  status: z.enum(["done", "blocked", "failed"]),
  finalPath: z.string(),
  durationSec: z.number(),
  scenes: z.number(),
  redoneScenes: z.array(z.object({ scene: z.number(), reason: z.string() })),
  script: z.array(z.object({ canh: z.number(), loi_thoai: z.string() })),
  caption: z.string(),
  notes: z.string(),
});

export const DATA_DIR = resolve(process.cwd(), "data");
/** Fixed, pre-trusted working folder for unattended Claude browser runs (job files live in per-job workdirs). */
const RUN_DIR = join(DATA_DIR, "creative");

/** macOS notification centre (the only interruption the CEO gets: when a video is finished or failed). */
export function notifyDesktop(title: string, message: string) {
  if (process.platform !== "darwin") return;
  const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/"/g, '\\"').slice(0, 220);
  try { execFileSync("osascript", ["-e", `display notification "${esc(message)}" with title "ZONO Agentic AI" subtitle "${esc(title)}" sound name "Glass"`], { timeout: 5000 }); } catch { /* notifications are best-effort */ }
}
export const UPLOAD_DIR = join(DATA_DIR, "uploads");

// ---------------- Hệ thống tự ghép (không phụ thuộc agent) ----------------
const VIDEO_TOOLS = resolve(process.cwd(), "tools/video");
const FINISH_PY = join(VIDEO_TOOLS, "finish.py");
/** Python của tools/video/.venv (cùng đường dẫn với `py()` trong video-ai.ts: Scripts/python.exe trên Windows, bin/python nơi khác). */
const VENV_PY = join(VIDEO_TOOLS, ".venv", process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python");
const execFileAsync = promisify(execFile);

/** Clip đã lưu trong <workdir>/clips (scene_01.mp4, scene_02.mp4… — sắp theo số thứ tự cảnh). */
export function savedClips(workdir: string): string[] {
  const dir = join(workdir, "clips");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.mp4$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => join(dir, f))
    .filter((p) => statSync(p).size > 0);
}

/**
 * Hệ thống TỰ GHÉP các clip đã có trong clips/ thành final.mp4 (chuẩn hoá 9:16 → nối → phụ đề + tiêu đề hook + CTA) bằng
 * tools/video/finish.py — dùng khi agent đã lấy được clip nhưng không tự ghép xong (lỗi, hết giờ, trả sai định dạng, mất phiên).
 * Chạy bất đồng bộ (ghép + soát lời mất vài phút) để không treo máy chủ. Lời thoại: theo kết quả agent, không có thì đọc
 * script.json agent đã ghi, không có nữa thì để trống (vẫn ghép được, chỉ thiếu phụ đề).
 */
export async function autoFinishVideo(workdir: string, opts: { script?: { canh: number; loi_thoai: string }[]; title?: string; cta?: string } = {}): Promise<{ path: string; clips: number } | null> {
  const clips = savedClips(workdir);
  if (!clips.length) return null;
  if (!existsSync(VENV_PY) || !existsSync(FINISH_PY)) throw new AppError("FINISH_MISSING", "Chưa cài công cụ hậu kỳ video (Python) — chạy lại: pnpm bootstrap");
  let script = opts.script?.length ? opts.script : [];
  const agentScript = join(workdir, "script.json");
  if (!script.length && existsSync(agentScript)) { try { script = JSON.parse(readFileSync(agentScript, "utf8")); } catch { script = []; } }
  const scriptPath = join(workdir, "script.auto.json");
  writeFileSync(scriptPath, JSON.stringify(script));
  const out = join(workdir, "final.mp4");
  await execFileAsync(VENV_PY, [FINISH_PY, "--clips", ...clips, "--script", scriptPath, "--out", out,
    ...(opts.title ? ["--title", opts.title] : []), ...(opts.cta ? ["--cta", opts.cta] : [])],
    // Windows: stdout mặc định là cp1252 — ép UTF-8 như các lệnh zono-video-* (ensureVideoBins).
    { timeout: 20 * 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" } });
  return existsSync(out) && statSync(out).size > 0 ? { path: out, clips: clips.length } : null;
}

/** Lỗi khi tài khoản Google đang dùng không mở được Tool dùng chung. */
export const NO_TOOL_ACCESS_MSG = "Tài khoản Google chưa có quyền mở Tool này — nhờ người chia sẻ Tool hoặc dùng bản sao (dán link bản sao ở trang Sản xuất video)";
/** Đổi lý do dừng của agent Flow thành câu dễ hiểu cho Sếp (nhận ra lỗi không có quyền mở Tool). */
export function friendlyFlowError(notes: string): string {
  const t = notes ?? "";
  // Dấu NO_TOOL_ACCESS do agent ghi (theo hướng dẫn), hoặc chữ Flow/Google hiện khi tài khoản không được chia sẻ.
  if (/NO_TOOL_ACCESS|chưa có quyền (mở|truy cập)|không có quyền truy cập|yêu cầu quyền truy cập|request access|you need (permission|access)|(don'?t|do not) have (permission|access) to (this|the) tool/i.test(t)) return NO_TOOL_ACCESS_MSG;
  return t;
}

/** Ảnh/clip đầu vào chỉ được nằm trong data/uploads (tải lên qua web) hoặc thư mục job video (data/creative/…):
 *  agent chạy trong Chrome có quyền tải tệp lên web, nên không cho trỏ tới tệp tùy ý trên máy. */
export function assertMediaInputPath(path: string): string {
  const roots = [UPLOAD_DIR, join(DATA_DIR, "creative")].map((r) => resolve(r));
  const real = (p: string) => { try { return realpathSync(p); } catch { return resolve(p); } };
  const norm = (p: string) => (process.platform === "win32" ? p.toLowerCase() : p);
  const abs = norm(real(resolve(path)));
  const ok = roots.some((r) => { const root = norm(existsSync(r) ? real(r) : r); return abs.startsWith(root.endsWith(sep) ? root : root + sep); });
  if (!ok) throw new AppError("PATH_NOT_ALLOWED", `Tệp ${basename(path)} nằm ngoài thư mục tải lên — hãy tải ảnh/clip lên qua trang Sản xuất video (data/uploads)`);
  return resolve(path);
}

export function flowSettings(bizId: string) {
  return {
    engine: "chrome-flow" as "chrome-flow" | "claude-in-chrome", chromeAutoApprove: false,
    browserDeviceId: null as string | null, browserLabel: null as string | null, timeoutMin: 75,
    // Chrome profile chosen by the CEO (the one logged into Flow). Preferred over a bare deviceId.
    chromeChannel: null as string | null, chromeProfileDir: null as string | null, chromeProfileName: null as string | null, chromeProfileEmail: null as string | null,
    /** Per-tool Flow Tool link override (defaults to the link in FLOW_TOOLS / the skill). */
    toolUrls: {} as Record<string, string>,
    ...((bizSettings(bizId) as any).flow ?? {}),
  };
}

export const toolUrlFor = (fs: ReturnType<typeof flowSettings>, key: string) => fs.toolUrls?.[key] || FLOW_TOOLS[key]?.toolUrl || FLOW_TOOLS[key]?.sharedUrl || null;
/** Link Tool Flow hợp lệ (Sếp dán link bản sao trong project của mình hoặc link chia sẻ /shared/tool/...). */
export const FLOW_TOOL_URL_RE = /^https:\/\/(flow\.google\.com|labs\.google)\/(\S*\/tool\/|shared\/tool\/)[\w-]+/;

/** How this machine runs the skill: Playwright tools on Chrome Flow, local folders, no human in the loop. */
export function environmentInstructions(o: { toolLabel: string; toolUrl: string | null; sharedUrl?: string | null; /** Link mặc định của Tool (FLOW_TOOLS) — khác toolUrl nghĩa là Sếp đang dùng bản sao (Remix) của mình. */ defaultToolUrl?: string | null; uiMap: string[]; email: string | null; workdir: string; rawDir: string; generator?: boolean }) {
  const isCopy = !!o.toolUrl && !!o.defaultToolUrl && o.toolUrl !== o.defaultToolUrl;
  const fallbackShare = o.sharedUrl || (o.toolUrl?.includes("/shared/tool/") ? o.toolUrl : null);
  return [
    "# MÔI TRƯỜNG CHẠY (máy Mac của doanh nghiệp, chạy tự động, KHÔNG có người theo dõi) — áp cho skill ở trên",
    `- Trình duyệt = các tool mcp__flow__browser_* (Playwright) đã gắn sẵn vào "Chrome Flow"${o.email ? `, đăng nhập Google ${o.email}` : ""}. Đây là thay thế cho Claude in Chrome trong skill: bỏ qua bước đọc skill chrome-browser / ToolSearch / tabs_context_mcp.`,
    "- Playwright nhìn thấy và thao tác được BÊN TRONG iframe của Tool. Cách làm chuẩn: browser_snapshot → lấy ref của nút/ô theo chữ → browser_click / browser_type / browser_select_option / browser_file_upload theo ref → snapshot lại để xác nhận.",
    "- TỐC ĐỘ (quan trọng — mỗi lượt gọi tool là 1 lượt AI đọc lại toàn bộ ngữ cảnh): CHỜ Flow tạo ảnh/khung/video thì dùng ĐÚNG 1 lệnh Bash `zono-flow-wait` (chờ tối đa 8 phút/lần, tự dừng khi xong hoặc khi trang báo lỗi/hết tín dụng), đặt timeout 600000 cho lệnh Bash: `zono-flow-wait --videos <N>` (đủ N video trên trang), `--images <N>`, `--text \"4 / 4\"`, `--gone \"Đang tạo\"`. Chưa xong (done:false) thì gọi lại. KHÔNG lặp browser_wait_for(time) + snapshot / take_screenshot / evaluate / find để theo dõi tiến độ.",
    "- Snapshot dài: chỉ đọc phần cần. browser_take_screenshot CHỈ khi cần NHÌN ảnh/khung hình để chấm (khung chủ, storyboard) — không chụp để xem tiến độ (mỗi ảnh làm ngữ cảnh phình to, các lượt sau chậm dần). Gộp nhiều thao tác chắc chắn vào ít lượt; không dùng TaskCreate/TaskUpdate/TodoWrite.",
    "- Dùng 1 tab duy nhất (browser_tabs: đóng tab thừa). Không tắt trình duyệt.",
    "- Giao diện Flow (ngoài Tool) có thể là tiếng Anh hoặc tiếng Việt tuỳ tài khoản: nhận nút theo nghĩa (vd \"Select media\" = hộp chọn nội dung nghe nhìn, \"Upload media\" = Tải lên, \"Open\" = Mở, \"Done\" = Xong, Images = Hình ảnh).",
    // 08/10: showroom bị "LỖI POLICY" 3 lần với kịch bản có "mẹ bỉm lau mặt cho con" — bỏ "test"/"siêu" không đủ; cùng ảnh + ô thông tin
    // không nhắc trẻ em thì tạo được. Ô thông tin sản phẩm là nguồn của ảnh + kịch bản trong Tool → giữ nó ngắn, chỉ người lớn.
    "- Ô thông tin / mô tả gửi vào Tool: viết NGẮN (tên, công dụng, giá, ưu đãi có trong brief), chỉ người lớn sử dụng. KHÔNG đưa vào: trẻ em/em bé/con nhỏ/mẹ bỉm/học sinh, "
      + "cơ thể/da/mặt/vệ sinh cá nhân, y tế/sức khoẻ/chữa/an toàn cho bé, so sánh/chê đối thủ, cam kết tuyệt đối — dù kịch bản có các cảnh đó (đổi thành người lớn dùng ở nhà/văn phòng).",
    "- Lỗi chính sách nội dung của Flow (policy / \"vi phạm chính sách\"): lần 1 → bỏ mọi yếu tố ở dòng trên + từ phóng đại (\"siêu\", \"test\", \"nhất\", \"100%\") rồi tạo lại; "
      + "vẫn lỗi → rút ô thông tin còn TỐI GIẢN đúng 1 câu \"<tên sản phẩm> — <công dụng chính cho người lớn>. Giá <giá>. <ưu đãi>.\" rồi tạo lại; vẫn lỗi → dừng, ghi result.json status \"blocked\", "
      + "ghi rõ bước + nguyên văn ô thông tin đã thử. Chưa tạo clip thì chưa tốn tín dụng clip — không thử quá 3 lần.",
    ...(o.generator ? [
      `- KHÔNG có Tool: làm trên trình tạo video thường của Flow. browser_navigate ${FLOW_URL} → tạo dự án mới (New project / Dự án mới) đặt tên theo tên video. KHÔNG mở mục Tools.`,
      ...(o.uiMap.length ? ["- Bản đồ giao diện (ưu tiên hơn mô tả trong skill nếu khác):", ...o.uiMap.map((l) => `  • ${l}`)] : []),
      "- Bước 1 kịch bản (KHÔNG có người chọn): brief đã có kịch bản → dùng NGUYÊN VĂN; chỉ có chủ đề → tự viết 3 kịch bản đúng công thức của skill, chọn bản mạnh nhất, ghi 2 bản còn lại vào notes.",
      "- Bước 2–3: chia cảnh + câu lệnh đúng mẫu của skill (giữ nguyên mẫu, chỉ thay lời thoại).",
      "- Chưa đăng nhập / hết tín dụng → dừng ngay, ghi result.json status \"blocked\" kèm lý do. KHÔNG đăng nhập hộ, KHÔNG nhập mật khẩu, KHÔNG đổi cài đặt tài khoản, KHÔNG xóa gì, KHÔNG mua thêm tín dụng.",
      "- KHÔNG có người để hỏi: bỏ qua AskUserQuestion / SendUserMessage / SendUserFile và mọi bước \"gửi cho người dùng chọn / chờ duyệt\"; thiếu thông tin thì tự giả định hợp lý và ghi vào notes.",
      "- Đây KHÔNG phải cloud: bỏ qua device_request_folder_access / device_stage_files / device_commit_files / /mnt/user-data.",
      `- LẤY CLIP (thay bước \"Tải về\" của skill — KHÔNG bấm Tải xuống): xong cảnh k thì bấm vào thẻ cảnh k để mở trình phát rồi chạy: zono-flow-save --one ${join(o.workdir, "clips")}/scene_0k.mp4 (k = 1, 2, 3… đúng THỨ TỰ LỜI THOẠI, không theo thứ tự trên lưới). Đóng trình phát, làm tiếp cảnh sau. Đủ file cho mọi cảnh mới hậu kỳ.`,
    ] : [
    o.toolUrl
        ? (o.toolUrl.includes("/shared/tool/")
          ? `- Mở link chia sẻ Tool: browser_navigate ${o.toolUrl} → bấm "Dùng thử trong một dự án" (Try in a project) → chọn dự án đầu tiên trong danh sách → bấm "Mở" (Open) để vào Tool trong dự án của Sếp.`
          : isCopy
            // Link bản sao (Remix) của Sếp: có thể đã ĐỔI TÊN Tool — không đòi đúng tiêu đề gốc, không vào chế độ Edit.
            ? `- Mở THẲNG Tool: browser_navigate ${o.toolUrl} (KHÔNG thêm ?mode=EDIT — chế độ Edit mở trình soạn Tool). Đây là BẢN SAO (Remix) Tool "${o.toolLabel}" trong project của chính Sếp, có thể ĐÃ ĐỔI TÊN: tiêu đề khác "${o.toolLabel}" vẫn ĐÚNG Tool — nhận theo giao diện (bản đồ giao diện dưới đây), không coi là sai Tool. Đang ở chế độ Edit / thấy "Tool Builder" → bấm "Tool" (hoặc "Done" / "Xong") để về chế độ chạy. Công cụ đang ở bước cũ → bấm bước 1 trên thanh tiến trình để làm sản phẩm mới.`
            : `- Mở THẲNG Tool "${o.toolLabel}": browser_navigate ${o.toolUrl} — nhận theo giao diện Tool (bản đồ giao diện dưới đây). Đang ở chế độ Edit / thấy "Trình tạo công cụ" → bấm "Xong" (hoặc "Done") để về chế độ chạy. Công cụ đang ở bước cũ → bấm bước 1 trên thanh tiến trình để làm sản phẩm mới.`)
        : `- Mở Tool "${o.toolLabel}" theo đúng skill (sidebar Tools / "Công cụ của tôi" / "Công cụ được chia sẻ với tôi").`,
      ...(o.toolUrl ? [
        fallbackShare
          ? `- Nếu mở ${o.toolUrl} báo không tìm thấy dự án/404 hoặc thuộc tài khoản Google khác: mở ngay link chia sẻ ${fallbackShare} → bấm "Dùng thử trong một dự án" (Try in a project) → chọn dự án đầu tiên → bấm "Mở" (Open) rồi chạy Tool bình thường.`
          : `- KHÔNG MỞ ĐƯỢC TOOL vì quyền (trang báo "You need access" / "Request access" / "Bạn cần quyền truy cập" / "Yêu cầu quyền truy cập", không tìm thấy project/Tool, hoặc bị đẩy về trang chủ Flow): KHÔNG bấm "Request access", KHÔNG thử đường khác. Dừng ngay, ghi result.json status "blocked", notes bắt đầu bằng "NO_TOOL_ACCESS:" kèm chữ trang hiển thị.`,
      ] : []),
      `- BẮT BUỘC chạy hết các bước BÊN TRONG Tool "${o.toolLabel}" (không tự viết prompt Veo ngoài Tool, không dùng công cụ khác).`,
      ...(o.uiMap.length ? ["- Bản đồ giao diện Tool (đọc trực tiếp từ Tool, ưu tiên hơn mô tả trong skill nếu khác):", ...o.uiMap.map((l) => `  • ${l}`)] : []),
      "- Chưa đăng nhập / hết tín dụng / không mở được Tool → dừng ngay, ghi result.json status \"blocked\" kèm lý do. KHÔNG đăng nhập hộ, KHÔNG nhập mật khẩu, KHÔNG đổi cài đặt tài khoản, KHÔNG xóa gì, KHÔNG mua thêm tín dụng.",
      "- KHÔNG có người để hỏi: bỏ qua AskUserQuestion / SendUserMessage / SendUserFile và mọi bước \"chờ người dùng duyệt\"; thiếu thông tin thì tự giả định hợp lý theo mặc định trong skill và ghi vào notes.",
      "- Đây KHÔNG phải cloud: bỏ qua device_request_folder_access / device_stage_files / device_commit_files / /mnt/user-data.",
      `- LẤY CLIP: nút TẢI VỀ / TẢI TẤT CẢ CLIP trong Tool bị Chrome chặn (iframe sandbox không cho tải) — ĐỪNG bấm. Khi bước SẢN XUẤT đã có video ở MỌI cảnh, chạy: zono-flow-save --out ${join(o.workdir, "clips")} → lưu thẳng từ trang thành scene_01.mp4, scene_02.mp4… đúng thứ tự cảnh, in JSON số clip. Số clip phải bằng số cảnh; thiếu thì chờ cảnh đó xong / LÀM LẠI CLIP rồi chạy lại.`,
    ]),
    "- Kiểm tra clip bằng ffprobe; soát lời thoại bằng: zono-video-stt <file1> <file2>… (JSON ngôn ngữ + văn bản).",
    `- HẬU KỲ (thay mục 7.2–7.3 của skill): ffmpeg máy này KHÔNG có libass/drawtext nên KHÔNG dùng filter ass/subtitles/drawtext. Ghi lời thoại cuối vào ${join(o.workdir, "script.json")} dạng [{"canh":1,"loi_thoai":"..."}] rồi chạy:`,
    `  zono-video-finish --clips <scene_01.mp4 …> --script ${join(o.workdir, "script.json")} --title "<tiêu đề hook>" --cta "<CTA>" --out ${join(o.workdir, "final.mp4")}`,
    "  (ghép đúng thứ tự + phụ đề + hook + CTA, in JSON thời lượng/độ phân giải/âm thanh). Rồi trích 2–3 khung hình bằng ffmpeg -ss <t> -frames:v 1 và Read để xem chữ không che mặt/sản phẩm (mục 7.4).",
    `- Cảnh lỗi: làm lại ${o.generator ? "bằng \"Sử dụng lại câu lệnh\"" : "trong Tool"} tối đa 2 lần/cảnh (tốn tín dụng). CHỈ làm lại khi đã xác minh lỗi thật bằng zono-video-stt / xem khung hình trên đúng file clips/scene_NN.mp4 vừa lưu bằng zono-flow-save (không so với file nào khác). Không sửa kịch bản/vai trò/thời lượng chỉ để \"phá cache\".`,
    o.generator
      ? "- Không tự giải mã base64 / tự ghi file video từ trang: chỉ dùng zono-flow-save --one. Làm lại cảnh k xong thì mở thẻ bản MỚI của cảnh k và chạy lại zono-flow-save --one cho đúng file scene_0k.mp4."
      : "- Không tự giải mã base64 / tự ghi file video từ trang: chỉ dùng zono-flow-save. Sau khi làm lại 1 cảnh thì chạy lại zono-flow-save (ghi đè cả bộ theo thứ tự).",
  ];
}

// ---------------- Start ----------------
export function startVideoJob(bizId: string, raw: unknown, actor: string) {
  const input = CreativeInput.parse(raw);
  const engine = engineOf(input.tool);
  // Agent Flow tải ảnh lên web từ trình duyệt → ảnh phải nằm trong data/uploads | data/creative. Engine chạy tại máy (LivePortrait…)
  // không đưa ảnh ra ngoài nên vẫn nhận ảnh từ Agentic Brain như MCP "anh_cu_dong" mô tả.
  for (const img of input.images) {
    if (engine === "flow") img.path = assertMediaInputPath(img.path);
    if (!existsSync(img.path)) throw new AppError("NO_FILE", `Không thấy ảnh ${img.path}`);
  }
  const cfg = q.get<Row>("SELECT enabled FROM agent_config WHERE biz_id = ? AND agent_key = 'creative'", bizId);
  if (!cfg?.enabled) throw new AppError("AGENT_DISABLED", "Creative Agent đang tắt (Agent & Tác vụ)");
  if (input.video) {
    if (input.video.materials) input.video.materials = input.video.materials.map((p) => assertMediaInputPath(p));
    if (input.video.drivingPath) input.video.drivingPath = assertMediaInputPath(input.video.drivingPath);
  }
  for (const p of [...(input.video?.materials ?? []), input.video?.drivingPath].filter(Boolean) as string[]) if (!existsSync(p)) throw new AppError("NO_FILE", `Không thấy tệp ${p}`);
  if (engine === "liveportrait" && !input.images.length) throw new AppError("NO_IMAGE", "Cần 1 ảnh chân dung rõ mặt");
  if (engine === "news" && !/https?:\/\/\S+/.test(input.brief)) throw new AppError("NO_URL", "Cần dán link bài báo (http…) vào ô nội dung");
  if (engine === "edit" && !(input.video?.materials ?? []).some((m) => /\.(mp4|mov|m4v|webm|mkv|avi|mp3|m4a|wav)$/i.test(m))) throw new AppError("NO_MATERIALS", "Cần tải lên ít nhất 1 video gốc (mp4/mov/webm…)");
  if (engine === "flow") {
    const missing = (FLOW_TOOLS[input.tool].slots ?? []).filter((s) => s.required && !input.images.some((i) => i.role === s.role));
    if (missing.length) throw new AppError("NO_IMAGE", `Cần ảnh: ${missing.map((s) => s.label).join(", ")} (tải ở trang Sản xuất video)`);
  }
  const job = insert("creative_job", { biz_id: bizId, tool: input.tool, title: input.title, input, status: "queued", step: engine === "flow" ? "Chờ trình duyệt rảnh" : "Chờ máy rảnh", log: [], source_content_id: input.sourceContentId ?? null });
  const workdir = join(DATA_DIR, "creative", job.id);
  mkdirSync(join(workdir, "clips"), { recursive: true });
  update("creative_job", job.id, { workdir });
  // One job per resource at a time: Flow shares the CEO's Chrome + credits; local video AI shares 8 GB of RAM.
  if (engine === "flow") enqueue("agent", "creative.flow", { jobId: job.id }, { bizId, idempotencyKey: `flow:${job.id}`, lockKey: "flow-chrome", maxAttempts: 1 });
  else enqueue("agent", "creative.local", { jobId: job.id }, { bizId, idempotencyKey: `flow:${job.id}`, lockKey: "video-ai", maxAttempts: 1 });
  audit(bizId, actor, "creative.job_started", { type: "creative_job", id: job.id }, { tool: input.tool, title: input.title });
  emit(bizId, "creative.updated", { jobId: job.id, status: "queued" });
  return byId("creative_job", job.id);
}

// ---------------- Run (queue worker) ----------------
/** Persist the live agent log at most every 2s, with a trailing write so a burst of steps is never left unsaved. */
function logFlusher(bizId: string, jobId: string, log: Row[]) {
  let last = 0;
  let timer: NodeJS.Timeout | null = null;
  const write = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    last = Date.now();
    if (byId<Row>("creative_job", jobId)?.status !== "running") return;
    update("creative_job", jobId, { log: log.slice(-150), step: log.at(-1)?.text ?? null });
    emit(bizId, "creative.updated", { jobId, status: "running" });
  };
  return (force = false) => {
    if (force || Date.now() - last >= 2000) write();
    else timer ??= setTimeout(write, 2000 - (Date.now() - last));
  };
}

const running = new Map<string, AbortController>();
export function cancelVideoJob(bizId: string, jobId: string, actor: string) {
  const job = byId<Row>("creative_job", jobId);
  if (!job || job.biz_id !== bizId) throw new AppError("NOT_FOUND", "Không thấy job", 404);
  running.get(jobId)?.abort();
  if (["queued", "running"].includes(job.status)) update("creative_job", jobId, { status: "cancelled", step: "Đã hủy", ended_at: nowIso() });
  q.run("UPDATE job SET status = 'dead', last_error = 'cancelled' WHERE idempotency_key = ? AND status = 'queued'", `flow:${jobId}`);
  audit(bizId, actor, "creative.job_cancelled", { type: "creative_job", id: jobId });
  emit(bizId, "creative.updated", { jobId, status: "cancelled" });
}

/** Local engines (MoneyPrinterTurbo / LivePortrait): same job life-cycle as Flow — log, cancel, notify, review & approval. */
export async function runLocalVideoJob(jobId: string) {
  const job = byId<Row>("creative_job", jobId);
  if (!job || job.status !== "queued") return;
  const bizId = job.biz_id as string;
  const log: Row[] = [];
  const flush = logFlusher(bizId, jobId, log);
  const ctrl = new AbortController();
  running.set(jobId, ctrl);
  update("creative_job", jobId, { status: "running", started_at: nowIso(), step: "Khởi động" });
  emit(bizId, "creative.updated", { jobId, status: "running" });
  const say = (text: string, kind: "text" | "tool" = "text") => { log.push({ at: nowIso(), kind, text }); flush(); };
  try {
    if (engineOf(job.tool) === "edit") {
      const res = await runProEdit({ job, log: say, signal: ctrl.signal });
      flush(true);
      update("creative_job", jobId, { model: modelFor(bizId, "creative", "medium") });
      await completeVideoJob(jobId, res);
    } else if (engineOf(job.tool) === "news") {
      const res = await runNewsVideo({ job, log: say, signal: ctrl.signal });
      flush(true);
      update("creative_job", jobId, { model: modelFor(bizId, "creative", "medium") });
      await completeVideoJob(jobId, res);
    } else if (engineOf(job.tool) === "anim") {
      const res = await runAnimatedVideo({ job, log: say, signal: ctrl.signal });
      flush(true);
      update("creative_job", jobId, { model: modelFor(bizId, "creative", "medium") });
      await completeVideoJob(jobId, res);
    } else if (engineOf(job.tool) === "liveportrait") {
      const res = await runPortrait({ job, log: say, signal: ctrl.signal });
      flush(true);
      finishMaterialJob(jobId, res);
      notifyDesktop(`Ảnh cử động "${job.title}" đã xong`, `Clip ${Math.round(res.durationSec)} giây đã vào thư viện video.`);
    } else {
      const res = await runAutoVideo({ job, log: say, signal: ctrl.signal });
      flush(true);
      update("creative_job", jobId, { model: "moneyprinter+claude-cli" });
      await completeVideoJob(jobId, res);
    }
  } catch (e) {
    flush(true);
    if (byId<Row>("creative_job", jobId)?.status === "cancelled") return;
    const error = e instanceof Error ? e.message : String(e);
    update("creative_job", jobId, { status: /NO_STOCK_KEY|NOT_INSTALLED|NO_IMAGE|NO_MATERIALS|NO_CLIPS|NO_SKILL|NEED_CLI|NO_URL/.test((e as any)?.code ?? "") ? "blocked" : "failed", error, step: null, ended_at: nowIso() });
    emit(bizId, "creative.updated", { jobId, status: "failed" });
    notifyDesktop(`Video "${job.title}" chưa tạo được`, error);
  } finally {
    running.delete(jobId);
  }
}

/**
 * News-to-video (skill news-to-video, Remotion): headless Claude CLI on this Mac — no browser, no Flow credits.
 * The agent fetches the article, writes the voice-over, makes the voice (Edge TTS / Vbee), measures word timing with
 * whisper, builds karaoke captions + motion graphics in the shared Remotion project, renders and masters to -14 LUFS.
 */
async function runNewsVideo({ job, log, signal }: { job: Row; log: (text: string, kind?: "text" | "tool") => void; signal: AbortSignal }) {
  const bizId = job.biz_id as string;
  const input = job.input as CreativeInput;
  const tool = FLOW_TOOLS[input.tool];
  const eff = effectiveProvider(bizId);
  if (!videoAiStatus().remotion.installed) throw new AppError("NOT_INSTALLED", "Remotion chưa cài (pnpm video-ai:install)");
  const skill = q.get<Row>("SELECT body, version FROM skill WHERE biz_id = ? AND key = ? AND status = 'active'", bizId, tool.skill);
  const workdir = job.workdir as string;
  const short = String(job.id).replace(/-/g, "").slice(-8);
  const slug = `news${short}`, comp = `News${short}`;
  const P = REMOTION_NEWS;
  const resultFile = join(workdir, "result.json");
  const chosenVoice = input.video?.voiceName ?? VI_VOICES[0].id;
  const claudeBlocked = eff.provider === "claude_cli" && Boolean(cliInfo().authError);
  if (eff.provider === "sandbox" || eff.ready === false || claudeBlocked || !skill) {
    return runDirectAnimatedStudio({
      job, input, workdir, slug, comp,
      chosenVoice, animTemplate: "education-explainer", animStyle: "kinetic-motion",
      log, signal,
    });
  }
  const system = [
    `# SKILL ĐANG CHẠY: ${tool.skill} (v${skill.version})`,
    skill.body,
    "",
    "# MÔI TRƯỜNG CHẠY (máy Mac của doanh nghiệp, chạy tự động, KHÔNG có người theo dõi) — áp cho skill ở trên, ưu tiên hơn phần 'YÊU CẦU MÔI TRƯỜNG' của skill",
    "- Mọi công cụ đã cài sẵn: KHÔNG pip install, KHÔNG npm install, KHÔNG npx create-video.",
    "- Lệnh Bash được phép chỉ là các lệnh nêu dưới đây (+ cd, ls, mkdir, cp, mv, file, grep, head, wc, cat). Gõ thẳng đường dẫn tuyệt đối trong ngoặc kép; KHÔNG gán biến shell (JOB=…), KHÔNG python3/node/heredoc — sẽ bị chặn. Tạo/sửa file bằng Write/Edit.",
    `- Thư mục làm việc của job: ${workdir} (bài viết, script, voice, words.json, ảnh kiểm tra, kết quả). Thư mục skill (script, template): ${NEWS_SKILL_DIR}.`,
    `- Bước 1 fetch: CHẠY zono-news-fetch "<URL>" ${workdir} --images-dir ${join(P, "public", slug)} → ${join(workdir, "article.json")} (title, site, paragraphs theo thứ tự, images[{file,caption,width,height}] đã tải + đổi webp→jpg, ogImage, colors = hex lặp nhiều trong CSS của site, textColor, logos, fonts). Read article.json rồi Read TỪNG ảnh trước khi gán vào cảnh (ảnh cuối "(ảnh bìa og:image)" là ảnh bìa). Thiếu đoạn văn / sai vùng bài → WebFetch URL ("liệt kê TOÀN BỘ đoạn văn theo thứ tự, không tóm tắt") hoặc Grep trong article.html. KHÔNG có python3/node để tự bóc HTML — dùng các lệnh này. Ảnh thêm (logo…) tải bằng curl -o.`,
    `- Bước 4 giọng (BẮT BUỘC dùng VieNeu-TTS): zono-vieneu-tts --voice "${chosenVoice}" --rate=+4% --file ${join(workdir, "script.txt")} --write-media ${join(workdir, "voice.mp3")} (các giọng VieNeu-TTS có sẵn: ${VI_VOICES.map((v) => v.id).join(", ")}).`,
    `- Bước 5: zono-news-transcribe ${join(workdir, "voice.mp3")} ${join(workdir, "words.json")}`,
    `- Bước 6: ghi danh sách câu [[start, end, "TEXT ĐÃ SỬA"], …] vào ${join(workdir, "sents.json")} rồi chạy: zono-news-chunks ${join(workdir, "sents.json")} ${slug}Chunks ${join(P, "src", slug, `${slug}Chunks.ts`)}`,
    `- Bước 7 Remotion: project DÙNG CHUNG đã có sẵn tại ${P} (React 19, @remotion/media, @remotion/google-fonts). Copy voice.mp3 vào ${join(P, "public", slug, "voice.mp3")} và dùng staticFile("${slug}/voice.mp3"), ảnh = staticFile("${slug}/<tên>"). Code của video này CHỈ nằm trong ${join(P, "src", slug)}/ (Chunks.ts, Graphics.tsx, Main.tsx, Captions.tsx chép từ template). Đăng ký thêm đúng 1 <Composition id="${comp}" …/> (1080x1920, 30fps) trong ${join(P, "src", "Root.tsx")} — GIỮ NGUYÊN các composition đã có. Không sửa file nào khác của project.`,
    `- Kiểm tra: cd "${P}" && npx tsc --noEmit ; cd "${P}" && npx remotion still ${comp} --scale=0.3 --frame=<N> ${join(workdir, "check_<N>.png")} (4–5 khung, Read từng ảnh).`,
    `- Bước 8: cd "${P}" && npx remotion render ${comp} ${join(workdir, "render.mp4")} --codec=h264 ; đo + master loudness bằng ffmpeg như skill → file cuối ${join(workdir, "final.mp4")}. Trích 3–5 khung từ final.mp4 bằng ffmpeg -ss <t> -frames:v 1 rồi Read để QC.`,
    "- KHÔNG có người để hỏi: bỏ qua AskUserQuestion; thiếu thông tin thì tự quyết theo skill và ghi vào notes. Link không mở được / bài bị chặn / không đủ nội dung → ghi result.json status \"blocked\" kèm lý do.",
    "- Nguồn bài và ảnh phải ghi đúng (chip ảnh + credit cuối video), không bịa số liệu — như quy tắc bất biến của skill.",
    `- KẾT THÚC: dùng Write ghi ${resultFile} đúng schema: ${JSON.stringify(Object.fromEntries(Object.entries(z.toJSONSchema(FlowResult, { target: "draft-7" }) as Row).filter(([k]) => k !== "$schema")))}`,
    `  finalPath = ${join(workdir, "final.mp4")}; scenes = số cảnh; script = lời đọc theo từng câu/cảnh [{canh, loi_thoai}]; caption = caption đăng kênh (≤ 300 ký tự, có "Nguồn: <tên báo>", 3–5 hashtag); notes = tên báo, hệ phong cách đã chọn, giọng VieNeu-TTS, thời lượng, LUFS đo được. Lỗi giữa chừng cũng PHẢI ghi result.json với status "failed"/"blocked".`,
  ].join("\n");
  const prompt = [
    `Video tin tức: ${input.title}`,
    `Link + ghi chú:\n${input.brief}`,
    input.durationSec ? `Thời lượng mong muốn: khoảng ${input.durationSec} giây (skill: 50–95 giây).` : "",
    input.video?.voiceName ? `Giọng VieNeu-TTS đã chọn: ${input.video.voiceName}` : input.voice ? `Giọng: ${input.voice}` : "",
    input.hookTitle ? `Gợi ý câu hook: ${input.hookTitle}` : "",
    input.cta ? `Câu kết / CTA: ${input.cta}` : "",
    `Kênh sẽ đăng: ${input.channels.join(", ")} (dọc 9:16).`,
    `Chạy đủ 8 bước của skill news-to-video (bắt buộc dùng zono-vieneu-tts ở bước tạo giọng) đến khi có ${join(workdir, "final.mp4")} đã master âm thanh, rồi ghi result.json.`,
  ].filter(Boolean).join("\n\n");
  log(`${eff.provider === "gemini_cli" ? "Gemini CLI" : eff.provider === "codex_cli" ? "Codex CLI" : "Claude CLI"} dựng video tin tức (Remotion + VieNeu-TTS, composition ${comp})`);
  const codexHome = eff.provider === "codex_cli" && selectedAiAccount(bizId) ? aiAccountHome(bizId, selectedAiAccount(bizId)!.id) : undefined;
  try {
    const structured = await runClaudeInTerminal({
      title: `Video tin tức: ${job.title}`, prompt, system, model: modelFor(bizId, "creative", "medium"), cwd: RUN_DIR, signal, resultFile,
      provider: eff.provider, codexHome,
      timeoutMs: 45 * 60_000,
      mcpConfig: { mcpServers: {} }, // headless `claude -p`, no browser tools
      env: { PATH: `${ensureVideoBins()}${delimiter}${process.env.PATH ?? ""}` },
      allowedTools: [
        "Read", "Write", "Edit", "Glob", "Grep", "WebFetch",
        "Bash(zono-news-fetch:*)", "Bash(curl:*)", "Bash(ffmpeg:*)", "Bash(ffprobe:*)", "Bash(zono-vieneu-tts:*)", "Bash(zono-tts:*)", "Bash(zono-vbee-tts:*)", "Bash(zono-news-transcribe:*)", "Bash(zono-news-chunks:*)",
        "Bash(grep:*)", "Bash(head:*)", "Bash(wc:*)", "Bash(cat:*)",
        "Bash(npx tsc:*)", "Bash(npx remotion:*)", "Bash(cd:*)", "Bash(ls:*)", "Bash(mkdir:*)", "Bash(cp:*)", "Bash(mv:*)", "Bash(file:*)",
      ],
      addDirs: [workdir, P, NEWS_SKILL_DIR],
      onStep: (st) => log(st.text, st.kind),
    });
    const out = FlowResult.safeParse(structured);
    if (out.success) return out.data;
  } catch (err) {
    log(`CLI gặp giới hạn (${err instanceof Error ? err.message : String(err)}) — chuyển sang Engine Remotion + VieNeu-TTS Local trực tiếp...`, "text");
  }
  return runDirectAnimatedStudio({
    job, input, workdir, slug, comp,
    chosenVoice, animTemplate: "education-explainer", animStyle: "kinetic-motion",
    log, signal,
  });
}

/**
 * Animated Video Studio (skill zono-animated-video):
 * Combines 21 animation/design/video/3D/audio tools (Remotion, GSAP, Anime.js, Motion, Rive, dotLottie,
 * Three.js / React Three Fiber / Drei, Satori, SVGO, ShotCraft, mandatory VieNeu-TTS, faster-whisper, FFmpeg)
 * to produce multi-industry 2D/3D animated videos via CLI.
 */
async function runDirectAnimatedStudio(opts: {
  job: Row; input: CreativeInput; workdir: string; slug: string; comp: string;
  chosenVoice: string; animTemplate: string; animStyle: string;
  log: (text: string, kind?: "text" | "tool") => void; signal: AbortSignal;
}): Promise<z.infer<typeof FlowResult>> {
  const { input, workdir, slug, comp, chosenVoice, animTemplate, animStyle, log } = opts;
  const P = REMOTION_NEWS;
  const envWithBins = { ...process.env, PATH: `${ensureVideoBins()}${delimiter}${process.env.PATH ?? ""}` };
  const execP = promisify(execFile);
  const srcDir = join(P, "src", slug);
  const pubDir = join(P, "public", slug);
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(pubDir, { recursive: true });

  // Bước 1: Tự động nhận diện URL Web (nếu có) hoặc phân tích nội dung văn bản
  const urlMatch = input.brief.match(/https?:\/\/\S+/i);
  let webTitle = "";
  let webSite = "";
  let webLines: string[] = [];
  let webImgName = "";
  if (urlMatch) {
    const targetUrl = urlMatch[0].replace(/[),.;]+$/, "");
    log(`Bước 1/6: Phát hiện URL Web (${targetUrl}) — đang tải nội dung, hình ảnh & bảng màu bằng zono-news-fetch...`, "tool");
    try {
      await execP("zono-news-fetch", [targetUrl, workdir, "--images-dir", pubDir, "--max-images", "6"], { env: envWithBins, timeout: 45_000 });
      const artPath = join(workdir, "article.json");
      if (existsSync(artPath)) {
        const art = JSON.parse(readFileSync(artPath, "utf8"));
        webTitle = String(art.title || "").trim();
        webSite = String(art.site || art.host || "").trim();
        const paras: string[] = Array.isArray(art.paragraphs) ? art.paragraphs.map((p: string) => String(p).replace(/^##\s*/, "").trim()).filter((p: string) => p.length >= 20) : [];
        if (art.description && String(art.description).length >= 20) webLines.push(String(art.description).trim());
        for (const p of paras) {
          for (const s of p.split(/(?<=[.!?…])\s+/)) {
            const clean = s.trim();
            if (clean.length >= 25 && clean.length <= 220 && webLines.length < 6 && !webLines.includes(clean)) {
              webLines.push(clean);
            }
          }
        }
        if (Array.isArray(art.images) && art.images.length > 0 && art.images[0].file && existsSync(art.images[0].file)) {
          webImgName = basename(art.images[0].file);
        }
        log(`Đã bóc tách bài viết từ ${webSite || targetUrl}: "${webTitle.slice(0, 70)}" (${webLines.length} ý chính${webImgName ? `, có ảnh minh họa ${webImgName}` : ""}).`, "tool");
      }
    } catch (e) {
      log(`Không tải trực tiếp được URL (${e instanceof Error ? e.message : String(e)}) — chuyển sang phân tích văn bản mô tả.`, "text");
    }
  } else {
    log(`Bước 1/6: Phân tích kịch bản theo mẫu "${animTemplate}" (${animStyle})...`);
  }

  const rawLines = webLines.length >= 2
    ? webLines
    : input.brief
        .split(/\r?\n|(?<=[.!?…])\s+/)
        .map((s) => s.replace(/^[-*•\d.)+\s]+/, "").trim())
        .filter((s) => s.length >= 8 && !/^https?:\/\//i.test(s));
  const title = webTitle || input.title || "Video Hoạt Hình Đa Ngành";
  const product = webSite || input.product || title;
  const hook = input.hookTitle || (webTitle ? `${webTitle}` : `${title} — Giải pháp vượt trội bạn cần biết ngay!`);
  const cta = input.cta || (webSite ? `Theo dõi ngay để cập nhật tin tức mới nhất từ ${webSite}!` : "Bấm vào giỏ hàng hoặc nhắn tin ngay hôm nay để nhận ưu đãi!");
  const sentences = rawLines.length >= 3
    ? rawLines.slice(0, 5)
    : [
        hook,
        `Bạn đang tìm kiếm thông tin quan trọng nhất về ${product}?`,
        rawLines[0] || input.brief.replace(/https?:\/\/\S+/g, "").trim() || `${product} mang lại hiệu quả vượt trội, tiết kiệm thời gian và chi phí tối đa cho bạn.`,
        `Hàng ngàn người dùng đã trải nghiệm và đánh giá cao giá trị thực tế mang lại.`,
        cta,
      ];
  const scriptText = sentences.join(" ");
  const scriptFile = join(workdir, "script.txt");
  writeFileSync(scriptFile, scriptText, "utf8");
  log(`Đã lập kịch bản ${sentences.length} phân cảnh (${scriptText.split(/\s+/).length} từ).`, "tool");

  // Bước 2: Sinh giọng đọc AI bắt buộc bằng VieNeu-TTS
  log(`Bước 2/6: Sinh giọng đọc AI bằng VieNeu-TTS 48kHz (giọng "${chosenVoice}")...`, "tool");
  const voicePath = join(workdir, "voice.mp3");
  await execP("zono-vieneu-tts", ["--voice", chosenVoice, "--rate=+4%", "--file", scriptFile, "--write-media", voicePath], { env: envWithBins, timeout: 5 * 60_000 });
  const durOut = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", voicePath], { encoding: "utf8", env: envWithBins }).trim();
  const durationSec = Math.max(6, Number(durOut) || 20);
  log(`Đã tạo voice.mp3 (${durationSec.toFixed(1)}s · 48kHz · giọng ${chosenVoice}).`, "tool");

  // Bước 3: Căn chỉnh phụ đề Karaoke từng từ (Chunks)
  log(`Bước 3/6: Đồng bộ phụ đề Karaoke từng từ (${slug}Chunks.ts)...`, "tool");
  copyFileSync(voicePath, join(pubDir, "voice.mp3"));

  let uploadedImgName = webImgName;
  if (!uploadedImgName && input.images.length && existsSync(input.images[0].path)) {
    uploadedImgName = `img_0${ basename(input.images[0].path).replace(/[^a-zA-Z0-9._-]/g, "") }`;
    copyFileSync(input.images[0].path, join(pubDir, uploadedImgName));
  }

  const wordCounts = sentences.map((s) => Math.max(1, s.split(/\s+/).length));
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);
  let cursor = 0.12;
  const usableDur = Math.max(4, durationSec - 0.35);
  const sentsTuple: [number, number, string][] = sentences.map((s, idx) => {
    const segDur = (wordCounts[idx] / totalWords) * usableDur;
    const start = Number(cursor.toFixed(2));
    const end = Number((cursor + segDur - 0.08).toFixed(2));
    cursor += segDur;
    return [start, Math.max(start + 0.4, end), s.toUpperCase()];
  });
  const sentsFile = join(workdir, "sents.json");
  writeFileSync(sentsFile, JSON.stringify(sentsTuple, null, 2), "utf8");
  const chunksFile = join(srcDir, `${slug}Chunks.ts`);
  await execP("zono-news-chunks", [sentsFile, `${slug}Chunks`, chunksFile], { env: envWithBins, timeout: 60_000 });

  // Bước 4: Tạo Captions.tsx + Main.tsx trong Remotion với 21 công cụ hoạt hình
  log(`Bước 4/6: Dựng sân khấu Hoạt hình 2D/3D Remotion (${animTemplate} · ${animStyle})...`, "tool");
  const palettes: Record<string, { bg1: string; bg2: string; accent: string; card: string; badge: string }> = {
    "ecommerce-promo": { bg1: "#1E1B4B", bg2: "#431407", accent: "#F97316", card: "rgba(255,255,255,0.10)", badge: "#EF4444" },
    "fnb-cartoon": { bg1: "#451A03", bg2: "#7C2D12", accent: "#FBBF24", card: "rgba(255,251,235,0.12)", badge: "#F59E0B" },
    "health-beauty": { bg1: "#064E3B", bg2: "#0F172A", accent: "#34D399", card: "rgba(255,255,255,0.10)", badge: "#10B981" },
    "education-explainer": { bg1: "#0F172A", bg2: "#1E1B4B", accent: "#38BDF8", card: "rgba(255,255,255,0.09)", badge: "#6366F1" },
    "finance-realestate": { bg1: "#090D16", bg2: "#172554", accent: "#FACC15", card: "rgba(255,255,255,0.09)", badge: "#EAB308" },
    "stickman-story": { bg1: "#18181B", bg2: "#27272A", accent: "#A855F7", card: "rgba(255,255,255,0.10)", badge: "#EC4899" },
  };
  const pal = palettes[animTemplate] ?? palettes["ecommerce-promo"];

  const captionsCode = `import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ${slug}Chunks as chunks } from "./${slug}Chunks";

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const chunk = chunks.find((c) => t >= c.start && t < c.end);
  if (!chunk) return null;
  const n = chunk.words.length;
  const hi = Math.min(n - 1, Math.floor(((t - chunk.start) / Math.max(0.1, chunk.end - chunk.start)) * n));
  const localF = (t - chunk.start) * fps;
  return (
    <div style={{ position: "absolute", left: 40, right: 40, bottom: 250, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 18, transform: \`scale(\${0.92 + 0.08 * Math.min(1, localF / 4)})\`, pointerEvents: "none", zIndex: 30 }}>
      {chunk.words.map((w, i) => (
        <span key={i} style={{
          fontFamily: "sans-serif", fontWeight: 900, fontSize: 60,
          color: i === hi ? "${pal.accent}" : "#FFFFFF",
          background: i === hi ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.35)",
          padding: "6px 16px", borderRadius: 18,
          textShadow: "0 4px 14px rgba(0,0,0,0.85)",
          border: i === hi ? "2px solid ${pal.accent}" : "2px solid transparent",
        }}>{w}</span>
      ))}
    </div>
  );
};
`;
  writeFileSync(join(srcDir, "Captions.tsx"), captionsCode, "utf8");

  const sceneData = sentsTuple.map(([start, end], i) => ({
    index: i + 1,
    start,
    end,
    text: sentences[i],
  }));

  const mainCode = `import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Captions } from "./Captions";
import { ${slug}Chunks as chunks } from "./${slug}Chunks";

const SCENES = ${JSON.stringify(sceneData, null, 2)};
const UPLOADED_IMG = ${JSON.stringify(uploadedImgName ? `${slug}/${uploadedImgName}` : "")};
const ANIM_STYLE = ${JSON.stringify(animStyle)};
const TITLE = ${JSON.stringify(title)};
const PRODUCT = ${JSON.stringify(product)};
const HOOK = ${JSON.stringify(hook)};
const CTA = ${JSON.stringify(cta)};

export const ${comp}Main: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const activeChunk = chunks.find((c) => t >= c.start && t < c.end);
  const speaking = Boolean(activeChunk);
  const mouthOpen = speaking ? 8 + Math.abs(Math.sin(frame * 0.65)) * 18 : 4;
  const floatY = Math.sin(frame * 0.08) * 12;
  const waveDeg = Math.sin(frame * 0.14) * 18;
  const curScene = SCENES.find((s) => t >= s.start && t <= s.end) ?? SCENES[SCENES.length - 1];
  const sceneStartFrame = Math.round((curScene?.start ?? 0) * fps);
  const enter = spring({ frame: Math.max(0, frame - sceneStartFrame), fps, config: { damping: 13, stiffness: 120 } });
  const progress = Math.min(100, (frame / Math.max(1, durationInFrames)) * 100);

  return (
    <AbsoluteFill style={{
      background: "linear-gradient(155deg, ${pal.bg1} 0%, ${pal.bg2} 55%, #090D16 100%)",
      fontFamily: "sans-serif", color: "#FFFFFF", overflow: "hidden",
    }}>
      <Audio src={staticFile("${slug}/voice.mp3")} />

      {/* Hạt sáng chuyển động nền (2D/3D Stage Ambient) */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const y = (1920 - ((frame * (2.2 + i * 0.4) + i * 320) % 2100));
        const x = 120 + ((i * 175) % 860) + Math.sin(frame * 0.04 + i) * 35;
        return (
          <div key={i} style={{
            position: "absolute", left: x, top: y, width: 22 + (i % 3) * 14, height: 22 + (i % 3) * 14,
            borderRadius: "50%", background: "${pal.accent}", opacity: 0.16, filter: "blur(4px)",
          }} />
        );
      })}

      {/* Thanh tiến trình trên cùng */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, background: "rgba(255,255,255,0.12)", zIndex: 40 }}>
        <div style={{ width: \`\${progress}%\`, height: "100%", background: "${pal.accent}" }} />
      </div>

      {/* Header / Hook Banner */}
      <div style={{
        position: "absolute", top: 68, left: 48, right: 48,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,0.45)", border: "2px solid rgba(255,255,255,0.16)",
        borderRadius: 28, padding: "18px 28px", backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ background: "${pal.badge}", color: "#fff", fontWeight: 900, fontSize: 24, padding: "6px 16px", borderRadius: 999 }}>
            CẢNH {curScene?.index ?? 1}/{SCENES.length}
          </span>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#F8FAFC" }}>{PRODUCT.slice(0, 34)}</span>
        </div>
        <span style={{ fontSize: 22, fontWeight: 700, color: "${pal.accent}" }}>ZONO 2D/3D STUDIO</span>
      </div>

      {/* Sân khấu trung tâm: Nhân vật Hoạt hình 2D/3D / Stickman + Thẻ nội dung động */}
      <div style={{
        position: "absolute", top: 220, left: 48, right: 48, bottom: 440,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Thẻ phân cảnh chính với hiệu ứng Spring */}
        <div style={{
          width: "100%", background: "${pal.card}", border: "2px solid rgba(255,255,255,0.18)",
          borderRadius: 36, padding: "36px 38px",
          transform: \`translateY(\${interpolate(enter, [0, 1], [45, 0])}px) scale(\${0.94 + 0.06 * enter})\`,
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: "${pal.accent}", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>
            {TITLE}
          </div>
          <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.32, color: "#FFFFFF" }}>
            {curScene?.text}
          </div>
        </div>

        {/* Sân khấu Nhân vật Hoạt hình & Ảnh sản phẩm */}
        <div style={{
          width: "100%", flex: 1, marginTop: 28,
          display: "flex", alignItems: "center", justifyContent: "space-around",
          background: "radial-gradient(circle at center, rgba(255,255,255,0.11) 0%, rgba(0,0,0,0.25) 75%)",
          borderRadius: 40, border: "2px solid rgba(255,255,255,0.12)", padding: 28,
          position: "relative",
        }}>
          {/* Nhân vật Vector 2D/3D / Stickman có khớp chuyển động & nhép miệng theo VieNeu-TTS */}
          <div style={{ transform: \`translateY(\${floatY}px)\`, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <svg width="340" height="390" viewBox="0 0 340 390">
              {/* Bóng đổ sân khấu 3D */}
              <ellipse cx="170" cy="365" rx="95" ry="18" fill="rgba(0,0,0,0.45)" />
              {ANIM_STYLE === "stickman" ? (
                <g stroke="#FFFFFF" strokeWidth="14" strokeLinecap="round" fill="none">
                  <circle cx="170" cy="95" r="52" fill="${pal.accent}" stroke="#FFFFFF" strokeWidth="10" />
                  <circle cx="152" cy="84" r="6" fill="#111827" stroke="none" />
                  <circle cx="188" cy="84" r="6" fill="#111827" stroke="none" />
                  <rect x="152" y={106 - mouthOpen / 3} width="36" height={mouthOpen} rx="8" fill="#111827" stroke="none" />
                  <line x1="170" y1="147" x2="170" y2="265" />
                  <line x1="170" y1="180" x2="105" y2="225" />
                  <line x1="170" y1="180" x2={235 + waveDeg} y2={145 - waveDeg * 0.6} stroke="${pal.accent}" />
                  <line x1="170" y1="265" x2="125" y2="348" />
                  <line x1="170" y1="265" x2="215" y2="348" />
                </g>
              ) : (
                <g>
                  {/* Thân Mascot 2D/3D */}
                  <rect x="105" y="175" width="130" height="145" rx="48" fill="${pal.accent}" stroke="#FFFFFF" strokeWidth="8" />
                  {/* Tay vẫy */}
                  <rect x="52" y="190" width="55" height="28" rx="14" fill="${pal.accent}" stroke="#FFFFFF" strokeWidth="6" transform={\`rotate(\${waveDeg} 95 204)\`} />
                  <rect x="233" y="185" width="58" height="28" rx="14" fill="${pal.accent}" stroke="#FFFFFF" strokeWidth="6" transform={\`rotate(\${-waveDeg} 245 199)\`} />
                  {/* Đầu Mascot */}
                  <circle cx="170" cy="112" r="72" fill="#FDE68A" stroke="#FFFFFF" strokeWidth="8" />
                  {/* Mắt */}
                  <circle cx="144" cy="100" r="10" fill="#0F172A" />
                  <circle cx="196" cy="100" r="10" fill="#0F172A" />
                  <circle cx="147" cy="96" r="3.5" fill="#FFFFFF" />
                  <circle cx="199" cy="96" r="3.5" fill="#FFFFFF" />
                  {/* Miệng nhép đồng bộ giọng đọc VieNeu-TTS */}
                  <rect x="148" y={126 - mouthOpen / 4} width="44" height={mouthOpen} rx="12" fill="#E11D48" />
                  {/* Huy hiệu ngực */}
                  <rect x="135" y="215" width="70" height="36" rx="12" fill="#0F172A" />
                  <text x="170" y="240" textAnchor="middle" fill="#FFFFFF" fontSize="20" fontWeight="900">ZONO</text>
                </g>
              )}
            </svg>
          </div>

          {/* Khung hiển thị sản phẩm / biểu đồ động */}
          {UPLOADED_IMG ? (
            <div style={{
              width: 380, height: 380, borderRadius: 32, overflow: "hidden",
              border: "6px solid ${pal.accent}", boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
              transform: \`rotate(\${Math.sin(frame * 0.05) * 3}deg)\`,
            }}>
              <Img src={staticFile(UPLOADED_IMG)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ) : (
            <div style={{
              width: 410, background: "rgba(15,23,42,0.78)", borderRadius: 32,
              border: "3px solid ${pal.accent}", padding: "28px 26px",
              boxShadow: "0 18px 45px rgba(0,0,0,0.5)",
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "${pal.accent}", marginBottom: 16 }}>ĐIỂM NỔI BẬT</div>
              {[
                { label: "Chất lượng & Hiệu quả", pct: 98 },
                { label: "Tiết kiệm thời gian", pct: 95 },
                { label: "Khách hàng hài lòng", pct: 99 },
              ].map((bar, bi) => {
                const w = Math.min(bar.pct, Math.round(enter * bar.pct));
                return (
                  <div key={bi} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
                      <span>{bar.label}</span>
                      <span style={{ color: "${pal.accent}" }}>{w}%</span>
                    </div>
                    <div style={{ height: 14, background: "rgba(255,255,255,0.14)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: \`\${w}%\`, height: "100%", background: "${pal.accent}", borderRadius: 999 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Phụ đề Karaoke từng từ */}
      <Captions />

      {/* Thanh CTA dưới chân video */}
      <div style={{
        position: "absolute", left: 48, right: 48, bottom: 96,
        background: "linear-gradient(90deg, ${pal.badge} 0%, ${pal.accent} 100%)",
        borderRadius: 999, padding: "22px 36px", textAlign: "center",
        fontSize: 30, fontWeight: 900, color: "#FFFFFF",
        boxShadow: "0 14px 36px rgba(0,0,0,0.55)",
        transform: \`scale(\${1 + Math.sin(frame * 0.15) * 0.025})\`,
      }}>
        {CTA}
      </div>
    </AbsoluteFill>
  );
};
`;
  writeFileSync(join(srcDir, "Main.tsx"), mainCode, "utf8");

  // Đăng ký Composition trong Root.tsx
  const totalFrames = Math.max(150, Math.ceil((durationSec + 0.6) * 30));
  const rootPath = join(P, "src", "Root.tsx");
  const rootOld = existsSync(rootPath) ? readFileSync(rootPath, "utf8") : `import React from "react";\nexport const RemotionRoot: React.FC = () => (<></>);\n`;
  if (!rootOld.includes(`id="${comp}"`)) {
    const importLine = `import { Composition } from "remotion";\nimport { ${comp}Main } from "./${slug}/Main";\n`;
    const cleaned = rootOld.replace(/import\s+\{\s*Composition\s*\}\s+from\s+"remotion";?\n?/g, "");
    const compTag = `\n      <Composition id="${comp}" component={${comp}Main} durationInFrames={${totalFrames}} fps={30} width={1080} height={1920} />`;
    const updatedRoot = importLine + cleaned.replace(/<\/>|\s*<\/React\.Fragment>/, `${compTag}\n    </>`);
    writeFileSync(rootPath, updatedRoot, "utf8");
  }

  // Bước 5: Render MP4 bằng Remotion
  log(`Bước 5/6: Kết xuất Video MP4 1080x1920 30fps (${totalFrames} frames) bằng Remotion...`, "tool");
  const renderPath = join(workdir, "render.mp4");
  await execP("npx", ["remotion", "render", comp, renderPath, "--codec=h264"], { cwd: P, env: envWithBins, timeout: 25 * 60_000 });

  // Bước 6: Chuẩn hóa âm lượng -14 LUFS bằng FFmpeg
  log(`Bước 6/6: Chuẩn hóa âm lượng -14 LUFS bằng FFmpeg...`, "tool");
  const finalPath = join(workdir, "final.mp4");
  await execP("ffmpeg", ["-y", "-v", "error", "-i", renderPath, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", finalPath], { env: envWithBins, timeout: 5 * 60_000 });

  const resultObj: z.infer<typeof FlowResult> = {
    status: "done",
    finalPath,
    durationSec: Math.round(durationSec),
    scenes: sentences.length,
    redoneScenes: [],
    script: sentences.map((loi_thoai, idx) => ({ canh: idx + 1, loi_thoai })),
    caption: `${title} — ${cta} #zono #videomarketing #motion2d #vieneutts`.slice(0, 290),
    notes: `Dựng trực tiếp trên máy bằng ZONO Motion 2D Studio (mẫu ${animTemplate} · phong cách ${animStyle} · giọng VieNeu-TTS ${chosenVoice} 48kHz · ${durationSec.toFixed(1)}s).`,
  };
  writeFileSync(join(workdir, "result.json"), JSON.stringify(resultObj, null, 2), "utf8");
  log(`Hoàn tất Video Hoạt hình MP4 (${durationSec.toFixed(1)}s)!`, "text");
  return resultObj;
}

async function runAnimatedVideo({ job, log, signal }: { job: Row; log: (text: string, kind?: "text" | "tool") => void; signal: AbortSignal }) {
  const bizId = job.biz_id as string;
  const input = job.input as CreativeInput;
  const tool = FLOW_TOOLS[input.tool];
  if (!videoAiStatus().remotion.installed) throw new AppError("NOT_INSTALLED", "Remotion chưa cài (pnpm video-ai:install)");
  const skill = q.get<Row>("SELECT body, version FROM skill WHERE biz_id = ? AND key = ? AND status = 'active'", bizId, tool.skill);
  const workdir = job.workdir as string;
  const short = String(job.id).replace(/-/g, "").slice(-8);
  const slug = `anim${short}`, comp = `Anim${short}`;
  const P = REMOTION_NEWS;
  const resultFile = join(workdir, "result.json");
  const chosenVoice = input.video?.voiceName || VI_VOICES[0].id;
  const animTemplate = input.video?.animTemplate || "ecommerce-promo";
  const animStyle = input.video?.animStyle || "2d-mascot";
  const eff = effectiveProvider(bizId);
  const claudeBlocked = eff.provider === "claude_cli" && Boolean(cliInfo().authError);
  if (eff.provider === "sandbox" || eff.ready === false || claudeBlocked || !skill) {
    return runDirectAnimatedStudio({ job, input, workdir, slug, comp, chosenVoice, animTemplate, animStyle, log, signal });
  }
  const system = [
    `# SKILL ĐANG CHẠY: ${tool.skill} (v${skill.version})`,
    skill.body,
    "",
    "# MÔI TRƯỜNG CHẠY (máy Mac của doanh nghiệp, chạy tự động, KHÔNG có người theo dõi)",
    "- Mọi công cụ đã cài sẵn: KHÔNG pip install, KHÔNG npm install, KHÔNG npx create-video.",
    `- Thư mục làm việc của job: ${workdir} (script.txt, voice.mp3, words.json, sents.json, ảnh kiểm tra, result.json).`,
    `- Thư mục Remotion dùng chung: ${P} (React 19, @remotion/media, @remotion/google-fonts, gsap, motion, three, @remotion/three, @react-three/fiber, @react-three/drei).`,
    `- Bước 1 Kịch bản: Phân tích brief theo template ngành nghề "${animTemplate}" và phong cách hoạt hình "${animStyle}". Ghi lời đọc tiếng Việt tự nhiên (khoảng ${input.durationSec ?? 45} giây) vào ${join(workdir, "script.txt")}.`,
    `- Bước 2 Sinh Giọng Đọc AI (BẮT BUỘC DÙNG VieNeu-TTS): Chạy lệnh: zono-vieneu-tts --voice "${chosenVoice}" --rate=+4% --file "${join(workdir, "script.txt")}" --write-media "${join(workdir, "voice.mp3")}". Danh sách giọng VieNeu-TTS hợp lệ: ${VI_VOICES.map((v) => v.id).join(", ")}. Tuyệt đối không dùng TTS khác.`,
    `- Bước 3 Đo Word-Timestamp & Sinh Chunks: Chạy zono-news-transcribe "${join(workdir, "voice.mp3")}" "${join(workdir, "words.json")}" → Ghi danh sách câu [[start, end, "CÂU LỜI THOẠI"], …] vào "${join(workdir, "sents.json")}" → Chạy zono-news-chunks "${join(workdir, "sents.json")}" ${slug}Chunks "${join(P, "src", slug, `${slug}Chunks.ts`)}".`,
    `- Bước 4 Dựng Hoạt hình 2D/3D trong Remotion: Copy "${join(workdir, "voice.mp3")}" vào "${join(P, "public", slug, "voice.mp3")}". Nếu có ảnh sản phẩm/logo đầu vào, copy vào "${join(P, "public", slug)}/" và gọi staticFile("${slug}/<tên>"). Code của video chỉ nằm trong "${join(P, "src", slug)}/" (gồm ${slug}Chunks.ts, Character.tsx, Scenes.tsx, Main.tsx, Captions.tsx chép từ "${join(NEWS_SKILL_DIR, "templates", "Captions.tsx")}"). Đăng ký thêm đúng 1 <Composition id="${comp}" …/> (1080x1920, 30fps) trong "${join(P, "src", "Root.tsx")}" — GIỮ NGUYÊN các composition đã có.`,
    `- Bước 5 Kiểm tra Tĩnh: cd "${P}" && npx tsc --noEmit ; cd "${P}" && npx remotion still ${comp} --scale=0.3 --frame=<N> "${join(workdir, "check_<N>.png")}" (3–4 khung, Read từng ảnh để kiểm tra nhân vật hoạt hình, bố cục, phụ đề).`,
    `- Bước 6 Render & Master -14 LUFS: cd "${P}" && npx remotion render ${comp} "${join(workdir, "render.mp4")}" --codec=h264 ; chuẩn hóa âm thanh bằng ffmpeg loudnorm I=-14:TP=-1.5:LRA=11 ra "${join(workdir, "final.mp4")}".`,
    `- KẾT THÚC: dùng Write ghi "${resultFile}" đúng schema: ${JSON.stringify(Object.fromEntries(Object.entries(z.toJSONSchema(FlowResult, { target: "draft-7" }) as Row).filter(([k]) => k !== "$schema")))}`,
    `  finalPath = "${join(workdir, "final.mp4")}"; scenes = số cảnh; script = lời đọc từng cảnh [{canh, loi_thoai}]; caption = caption đăng kênh (≤ 300 ký tự, 3–5 hashtag); notes = template ngành nghề (${animTemplate}), phong cách hoạt hình (${animStyle}), giọng VieNeu-TTS (${chosenVoice}), thời lượng.`,
  ].join("\n");
  const prompt = [
    `Dự án Video Hoạt hình: ${input.title}`,
    `Mẫu ngành nghề (Industry Template): ${animTemplate}`,
    `Phong cách Hoạt hình (Animation Stack): ${animStyle}`,
    `Giọng đọc VieNeu-TTS bắt buộc: ${chosenVoice}`,
    input.product ? `Sản phẩm / Dịch vụ: ${input.product}` : "",
    `Nội dung / Kịch bản yêu cầu:\n${input.brief}`,
    input.durationSec ? `Thời lượng mong muốn: khoảng ${input.durationSec} giây.` : "Thời lượng mong muốn: khoảng 40–60 giây.",
    input.hookTitle ? `Câu Hook mở đầu: ${input.hookTitle}` : "",
    input.cta ? `Câu kết / CTA: ${input.cta}` : "",
    input.images.length
      ? `Ảnh sản phẩm / logo / tài liệu đính kèm (hãy copy vào ${join(P, "public", slug)}/ để đưa vào sân khấu hoạt hình):\n${input.images.map((i) => `- ${i.role}: ${i.path}`).join("\n")}`
      : "Không có ảnh đính kèm — hãy dựng hoàn toàn bằng Nhân vật 2D, Icon SVG, Biểu đồ động và Typography.",
    `Kênh sẽ đăng: ${input.channels.join(", ")} (dọc 9:16).`,
    `Chạy đủ 6 bước của skill zono-animated-video (bắt buộc dùng zono-vieneu-tts với giọng "${chosenVoice}" ở Bước 2) đến khi có ${join(workdir, "final.mp4")} đã master âm thanh, rồi ghi result.json.`,
  ].filter(Boolean).join("\n\n");
  log(`${eff.provider === "gemini_cli" ? "Gemini CLI" : eff.provider === "codex_cli" ? "Codex CLI" : "Claude CLI"} dựng Video Hoạt hình (${animTemplate} · ${animStyle} · giọng VieNeu-TTS ${chosenVoice})`);
  const codexHome = eff.provider === "codex_cli" && selectedAiAccount(bizId) ? aiAccountHome(bizId, selectedAiAccount(bizId)!.id) : undefined;
  try {
    const structured = await runClaudeInTerminal({
      title: `Video Hoạt hình: ${job.title}`, prompt, system, model: modelFor(bizId, "creative", "medium"), cwd: RUN_DIR, signal, resultFile,
      provider: eff.provider, codexHome,
      timeoutMs: 45 * 60_000,
      mcpConfig: { mcpServers: {} },
      env: { PATH: `${ensureVideoBins()}${delimiter}${process.env.PATH ?? ""}` },
      allowedTools: [
        "Read", "Write", "Edit", "Glob", "Grep", "WebFetch",
        "Bash(zono-vieneu-tts:*)", "Bash(zono-tts:*)", "Bash(zono-news-transcribe:*)", "Bash(zono-news-chunks:*)",
        "Bash(ffmpeg:*)", "Bash(ffprobe:*)", "Bash(curl:*)",
        "Bash(grep:*)", "Bash(head:*)", "Bash(wc:*)", "Bash(cat:*)",
        "Bash(npx tsc:*)", "Bash(npx remotion:*)", "Bash(cd:*)", "Bash(ls:*)", "Bash(mkdir:*)", "Bash(cp:*)", "Bash(mv:*)", "Bash(file:*)",
      ],
      addDirs: [workdir, P, ANIM_SKILL_DIR, NEWS_SKILL_DIR],
      onStep: (st) => log(st.text, st.kind),
    });
    const out = FlowResult.safeParse(structured);
    if (out.success) return out.data;
  } catch (err) {
    log(`CLI gặp giới hạn (${err instanceof Error ? err.message : String(err)}) — chuyển sang Engine Remotion + VieNeu-TTS Local trực tiếp...`, "text");
  }
  return runDirectAnimatedStudio({ job, input, workdir, slug, comp, chosenVoice, animTemplate, animStyle, log, signal });
}

export async function runVideoJob(jobId: string) {
  const job = byId<Row>("creative_job", jobId);
  if (!job || job.status !== "queued") return;
  const bizId = job.biz_id as string;
  const input = job.input as CreativeInput;
  const tool = FLOW_TOOLS[input.tool];
  const fs = flowSettings(bizId);
  const fail = (status: "failed" | "blocked", error: string) => {
    update("creative_job", jobId, { status, error, step: null, ended_at: nowIso() });
    emit(bizId, "creative.updated", { jobId, status });
    emit(bizId, "alert.raised", { level: "warning", text: `Video "${job.title}": ${error}` });
    notifyDesktop(`Video "${job.title}" chưa tạo được`, error);
  };
  if (effectiveProvider(bizId).provider !== "claude_cli") return fail("blocked", "Cần chế độ Tài khoản Claude (Claude Code CLI) để chạy agent Flow");
  if (!fs.chromeProfileDir) return fail("blocked", "Chưa chọn profile Chrome có tài khoản Flow (Sản xuất video Flow → Chọn profile Chrome)");
  // Chrome Flow: dedicated Chrome parked at the screen edge, holding the chosen profile's Google login; checked before spending anything.
  const useChrome = flowEngine(bizId) === "claude-in-chrome";
  update("creative_job", jobId, { step: useChrome ? "Kiểm tra Chrome đã chọn" : "Mở Chrome Flow (chạy ngầm)" });
  let email: string | null = null;
  let chrome: Awaited<ReturnType<typeof claudeChromePreflight>> | null = null;
  try {
    if (useChrome) {
      chrome = await claudeChromePreflight(bizId);
      email = fs.chromeProfileEmail;
    } else {
    const src = flowSource();
    if (src && (src.channel !== fs.chromeChannel || src.dir !== fs.chromeProfileDir)) await syncFlowProfile(fs.chromeChannel!, fs.chromeProfileDir);
    await ensureFlowBrowser({ channel: fs.chromeChannel, dir: fs.chromeProfileDir });
    let accounts = await flowAccounts();
    // Login lost (cookies rotated) → re-copy once from the everyday profile, which stays logged in.
    // (Windows: chép không mang được đăng nhập và syncFlowProfile giữ nguyên Chrome Flow đã đăng nhập tay — xem copyCarriesLogin.)
    if (!accounts.length || (fs.chromeProfileEmail && !accounts.includes(fs.chromeProfileEmail))) {
      await syncFlowProfile(fs.chromeChannel!, fs.chromeProfileDir);
      await ensureFlowBrowser({});
      accounts = await flowAccounts();
    }
    if (!accounts.length) {
      await openFlowLogin({}).catch(() => {});
      return fail("blocked", "Chrome Flow chưa đăng nhập Google. Cửa sổ Chrome Flow đã mở — Sếp đăng nhập tài khoản có Flow 1 lần rồi chạy lại (Chrome trên Windows không cho chép đăng nhập từ Chrome thường; đăng nhập 1 lần ở cửa sổ này là được lưu lại, các lần sau không hỏi nữa).");
    }
    email = fs.chromeProfileEmail && accounts.includes(fs.chromeProfileEmail) ? fs.chromeProfileEmail : accounts[0]!;
    }
  } catch (e) {
    return fail("blocked", useChrome ? friendlyChromeNote(e instanceof Error ? e.message : String(e)) : `Không mở được Chrome Flow: ${e instanceof Error ? e.message : e}`);
  }
  const skill = q.get<Row>("SELECT body, version FROM skill WHERE biz_id = ? AND key = ? AND status = 'active'", bizId, tool.skill);
  if (!skill) return fail("blocked", `Chưa nạp skill ${tool.skill} (Skill & Nhân viên MKT → Đồng bộ lại)`);

  const workdir = job.workdir as string;
  const rawDir = join(workdir, "raw");
  mkdirSync(rawDir, { recursive: true });
  const log: Row[] = [];
  const flush = logFlusher(bizId, jobId, log);
  update("creative_job", jobId, { status: "running", started_at: nowIso(), step: `Khởi động agent Flow (${email})` });
  emit(bizId, "creative.updated", { jobId, status: "running" });

  const dna = input.brand === "zono" ? agentPlaybook(bizId, "content").text.split("<persona")[0] : "";
  const system = [
    `# SKILL ĐANG CHẠY: ${tool.skill} (v${skill.version})`,
    skill.body,
    "",
    ...(chrome ? claudeChromeEnvironment({ toolLabel: tool.toolTitle ?? tool.label, toolUrl: toolUrlFor(fs, input.tool), defaultToolUrl: tool.toolUrl, uiMap: tool.uiMap, email, workdir, generator: tool.generator, deviceId: chrome.deviceId, label: chrome.label }) : environmentInstructions({ toolLabel: tool.toolTitle ?? tool.label, toolUrl: toolUrlFor(fs, input.tool), sharedUrl: tool.sharedUrl, defaultToolUrl: tool.toolUrl, uiMap: tool.uiMap, email, workdir, rawDir, generator: tool.generator })),
    `- KẾT THÚC: dùng Write ghi kết quả JSON vào ${join(workdir, "result.json")} đúng schema sau rồi in "XONG — có thể đóng cửa sổ". Schema: ${JSON.stringify(Object.fromEntries(Object.entries(z.toJSONSchema(FlowResult, { target: "draft-7" }) as Row).filter(([k]) => k !== "$schema")))}`,
    `- Bị chặn/lỗi giữa chừng cũng PHẢI ghi result.json với status "blocked"/"failed" và lý do trong notes. finalPath = ${join(workdir, "final.mp4")} khi thành công. caption = caption đăng kênh (tiếng Việt, ≤ 300 ký tự, 3-5 hashtag). script = lời thoại từng cảnh.`,
    ...(dna ? ["", `# THƯƠNG HIỆU: ${brandOfDna(bizId)} (áp dụng DNA dưới đây cho lời thoại, caption, claim)`, dna] : ["", `# THƯƠNG HIỆU: kênh khác/khách hàng. KHÔNG dùng giọng hay tên ${brandOfDna(bizId)}; theo thông tin trong brief.`]),
  ].join("\n");
  const prompt = [
    `Công cụ Flow: ${tool.label}`,
    `Tên video: ${input.title}`,
    input.product ? `Sản phẩm: ${input.product}` : "",
    `Thông tin / chủ đề / kịch bản:\n${input.brief}`,
    input.durationSec ? `Thời lượng mong muốn: ${input.durationSec}s` : "",
    input.voice ? `Giọng: ${input.voice}` : "",
    input.hookTitle ? `Tiêu đề hook trên video: ${input.hookTitle}` : "",
    input.cta ? `CTA trên video: ${input.cta}` : "",
    input.images.length
      ? `ẢNH CỦA SẾP (ưu tiên dùng — KHÔNG tự tạo ảnh thay cho vai trò đã có; tải lên ${tool.generator ? "Flow (Tải nội dung lên) rồi \"Thêm vào câu lệnh\" cho mọi cảnh" : "đúng ô của Tool"} bằng browser_file_upload):\n${input.images.map((i) => `- ${i.role}: ${i.path}`).join("\n")}${input.images.some((i) => /nhân vật|người/i.test(i.role)) ? "\nNgười trong ảnh nhân vật là NHÂN VẬT CHÍNH: giữ đúng khuôn mặt/trang phục này ở mọi cảnh." : ""}`
      : "Không có ảnh đầu vào (ảnh bắt buộc của Tool thì tự tạo trên Flow như hướng dẫn).",
    tool.modelNote ?? `Nếu Tool có chọn model Veo: ${input.veoModel}.`,
    `Kênh sẽ đăng: ${input.channels.join(", ")} (dọc 9:16).`,
    tool.generator
      ? `Hãy chạy toàn bộ skill "${tool.label}" trên trình tạo video thường của Flow (không có Tool) đến khi có final.mp4 đã ghép + chèn chữ, rồi ghi result.json.`
      : `Hãy chạy toàn bộ skill trong Tool "${tool.label}" đến khi có final.mp4 đã ghép + chèn chữ, rồi ghi result.json.`,
  ].filter(Boolean).join("\n\n");

  const ctrl = new AbortController();
  running.set(jobId, ctrl);
  const model = modelFor(bizId, "creative", "medium");
  let structured: unknown;
  const t0 = Date.now();
  try {
    structured = await runClaudeInTerminal({
      title: `Video Flow: ${job.title}`, prompt, system, model, cwd: RUN_DIR, signal: ctrl.signal,
      resultFile: join(workdir, "result.json"),
      timeoutMs: (fs.timeoutMin ?? tool.minutes + 30) * 60_000,
      mcpConfig: useChrome ? { mcpServers: {} } : flowMcpConfig(rawDir),
      ...(useChrome ? { chrome: true, approver: { deviceId: chrome!.deviceId, fileRoots: [workdir, UPLOAD_DIR], hosts: ["flow.google.com", "labs.google", "accounts.google.com"], logFile: join(workdir, "approver.jsonl"), js: true, killFile: join(DATA_DIR, "chrome-autoapprove.off") } } : {}),
      // zono-video-* of THIS repo; Bash được chờ tới 10 phút cho zono-flow-wait (mặc định Claude Code cắt ở 2 phút).
      env: { PATH: `${ensureVideoBins()}${delimiter}${process.env.PATH ?? ""}`, BASH_DEFAULT_TIMEOUT_MS: "600000", BASH_MAX_TIMEOUT_MS: "600000" },
      disallowedTools: ["TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "TodoWrite"],
      allowedTools: [
        ...(useChrome ? ["mcp__claude-in-chrome", ...[workdir, UPLOAD_DIR].map((p) => `Read(${permissionPath(p)}/**)`), `Write(${permissionPath(workdir)}/**)`, `Glob(${permissionPath(workdir)}/**)`] : ["mcp__flow", "Read", "Write", "Glob"]),
        "Bash(ffmpeg:*)", "Bash(ffprobe:*)", "Bash(zono-video-finish:*)", "Bash(zono-video-stt:*)",
        ...(!useChrome ? ["Bash(zono-flow-save:*)", "Bash(zono-flow-wait:*)"] : []), "Bash(zono-tts:*)", "Bash(cp:*)", "Bash(mv:*)", "Bash(ls:*)", "Bash(mkdir:*)", "Bash(unzip:*)", "Bash(stat:*)",
      ],
      addDirs: [workdir, UPLOAD_DIR],
      onStep: (s) => { log.push(s); flush(); },
    });
  } catch (e) {
    running.delete(jobId);
    flush(true);
    if (byId<Row>("creative_job", jobId)?.status === "cancelled") return;
    const friendly = friendlyFlowError(e instanceof Error ? e.message : String(e));
    // Agent dừng (hết giờ, rớt kết nối…) nhưng đã lưu clip → hệ thống tự ghép thay vì bỏ hết công sức + tín dụng Flow.
    if (canSalvage(input, workdir)) return completeVideoJob(jobId, salvageResult(input, `Agent dừng giữa chừng: ${friendly}`));
    return fail(friendly === NO_TOOL_ACCESS_MSG ? "blocked" : "failed", friendly);
  }
  running.delete(jobId);
  flush(true);
  insert("model_usage", { biz_id: bizId, agent_key: "creative", provider: "claude_cli", model, tokens_in: 0, tokens_out: 0, tokens_cached: 0, cost_micros: 0, latency_ms: Date.now() - t0, at: nowIso() });
  const r = { structured, model, costMicros: 0 };

  const out = FlowResult.safeParse(r.structured);
  if (!out.success) {
    if (canSalvage(input, workdir)) return completeVideoJob(jobId, salvageResult(input, "Agent không trả kết quả đúng định dạng"));
    return fail("failed", "Agent không trả kết quả đúng định dạng");
  }
  update("creative_job", jobId, { model: r.model, cost_micros: r.costMicros });
  await completeVideoJob(jobId, out.data);
}

/** Agent chết / hết giờ / trả sai định dạng nhưng job Flow đã lưu ≥ 2 clip → để hệ thống tự ghép (không áp cho edit-source, news…). */
function canSalvage(input: CreativeInput, workdir: string | null | undefined) {
  return engineOf(input.tool) === "flow" && !!workdir && savedClips(workdir).length >= 2;
}

/** Kết quả thay thế khi agent không trả được JSON nhưng đã lưu clip: để completeVideoJob tự ghép (lời thoại lấy từ script.json nếu có). */
function salvageResult(input: CreativeInput, why: string): z.infer<typeof FlowResult> {
  return { status: "failed", finalPath: "", durationSec: 0, scenes: 0, redoneScenes: [], script: [], caption: input.hookTitle || input.title, notes: why };
}

/** After an API restart: the detached agent keeps running — keep its live log flowing and wait for its result. */
export async function reattachVideoJob(jobId: string) {
  const job = byId<Row>("creative_job", jobId);
  if (!job?.workdir) return;
  const fs = flowSettings(job.biz_id);
  const input = job.input as CreativeInput;
  const tool = FLOW_TOOLS[input.tool];
  const deadline = new Date(job.started_at ?? job.created_at).getTime() + (fs.timeoutMin ?? tool.minutes + 30) * 60_000;
  const log: Row[] = [...(job.log ?? [])];
  const stored = log.filter((s) => !s.reattach).length - 1; // first entry is the runner's own "đang chạy ngầm" line
  log.push({ at: nowIso(), kind: "text", text: "Máy chủ vừa khởi động lại — agent vẫn chạy ngầm, theo dõi tiếp", reattach: true });
  const flush = logFlusher(job.biz_id, jobId, log);
  flush(true);
  let res: unknown;
  try {
    res = await followClaudeRun({
      resultFile: join(job.workdir, "result.json"), deadline, skipSteps: Math.max(0, stored),
      onStep: (s) => { log.push(s); flush(); },
      isActive: () => byId<Row>("creative_job", jobId)?.status === "running",
    });
  } catch (e) {
    flush(true);
    if (byId<Row>("creative_job", jobId)?.status !== "running") return;
    const error = friendlyFlowError(e instanceof Error ? e.message : String(e));
    if (canSalvage(input, job.workdir)) return completeVideoJob(jobId, salvageResult(input, `Agent dừng giữa chừng: ${error}`));
    update("creative_job", jobId, { status: error === NO_TOOL_ACCESS_MSG ? "blocked" : "failed", error, step: null, ended_at: nowIso() });
    emit(job.biz_id, "creative.updated", { jobId, status: "failed" });
    notifyDesktop(`Video "${job.title}" chưa tạo được`, error);
    return;
  }
  flush(true);
  if (res == null) return;
  const out = FlowResult.safeParse(res);
  if (!out.success) {
    if (canSalvage(input, job.workdir)) return completeVideoJob(jobId, salvageResult(input, "Agent không trả kết quả đúng định dạng"));
    update("creative_job", jobId, { status: "failed", error: "Agent không trả kết quả đúng định dạng", step: null, ended_at: nowIso() });
    emit(job.biz_id, "creative.updated", { jobId, status: "failed" });
    return;
  }
  return completeVideoJob(jobId, out.data);
}

/** Post-render half of a job: verify the file, register the asset, review, open the approval. */
export async function completeVideoJob(jobId: string, agentRes: z.infer<typeof FlowResult>) {
  const job = byId<Row>("creative_job", jobId)!;
  const bizId = job.biz_id as string;
  const input = job.input as CreativeInput;
  const tool = FLOW_TOOLS[input.tool];
  const workdir = job.workdir as string;
  let res = agentRes;
  // Hệ thống tự ghép: agent đã lưu clip vào clips/ nhưng KHÔNG có final.mp4 (chưa kịp hậu kỳ, hậu kỳ lỗi, dừng giữa chừng)
  // → ghép tại máy chủ thay vì bỏ cả video. CHỈ với job Flow: "AI tự edit" (edit-source) cũng ghi clip vào clips/ nhưng đó là
  // các đoạn cắt do chính agent dựng, không được tự nối. Agent báo "failed" thì ghép khi có ≥ 2 clip (đủ số cảnh nếu agent
  // khai); báo "blocked" (hết tín dụng, chính sách, không có quyền…) thì chỉ ghép khi agent khai số cảnh và clip đã đủ.
  if (engineOf(input.tool) === "flow" && workdir) {
    const clipCount = savedClips(workdir).length;
    const hasFinal = Boolean(res.finalPath) && existsSync(res.finalPath);
    const enough = res.status === "done" ? clipCount > 0
      : res.status === "blocked" ? res.scenes > 0 && clipCount >= res.scenes
      : clipCount >= Math.max(2, res.scenes || 0);
    if (!hasFinal && clipCount && enough) {
      update("creative_job", jobId, { step: `Hệ thống đang tự ghép ${clipCount} clip thành video hoàn chỉnh` });
      emit(bizId, "creative.updated", { jobId, status: "running" });
      try {
        const f = await autoFinishVideo(workdir, { script: res.script, title: input.hookTitle, cta: input.cta });
        if (f) {
          res = { ...res, status: "done", finalPath: f.path, scenes: res.scenes || f.clips, caption: res.caption || input.hookTitle || input.title,
            notes: `${res.notes ? `${res.notes}\n` : ""}[Hệ thống tự ghép ${f.clips} clip thành final.mp4]` };
          audit(bizId, "creative_agent", "creative.auto_finished", { type: "creative_job", id: jobId }, { clips: f.clips, agentStatus: agentRes.status });
        }
      } catch (e) {
        logger.warn("creative.auto_finish_failed", { jobId, error: e instanceof Error ? e.message.slice(0, 400) : String(e) });
      }
    }
  }
  const skill = q.get<Row>("SELECT version FROM skill WHERE biz_id = ? AND key = ?", bizId, tool.skill);
  const fail = (status: "failed" | "blocked", error: string) => {
    update("creative_job", jobId, { status, error, step: null, ended_at: nowIso() });
    emit(bizId, "creative.updated", { jobId, status });
    emit(bizId, "alert.raised", { level: "warning", text: `Video "${job.title}": ${error}` });
    notifyDesktop(`Video "${job.title}" chưa tạo được`, error);
  };
  update("creative_job", jobId, { result: res });
  if (res.status !== "done") {
    const msg = friendlyFlowError(res.notes || "Agent dừng giữa chừng");
    return fail(msg === NO_TOOL_ACCESS_MSG ? "blocked" : res.status, msg);
  }

  // Verify the file in code; never trust the model's claim that it exists.
  let finalPath = res.finalPath;
  if (!existsSync(finalPath)) return fail("failed", `Không thấy file thành phẩm ${finalPath}`);
  if (!finalPath.startsWith(workdir)) {
    const dest = join(workdir, basename(finalPath));
    copyFileSync(finalPath, dest);
    finalPath = dest;
  }
  const meta = probeVideo(finalPath);
  const asset = insert("creative_asset", {
    biz_id: bizId, job_id: jobId, kind: "video", path: finalPath, mime: "video/mp4", duration: meta.duration, width: meta.width, height: meta.height,
    size: statSync(finalPath).size, meta: { tool: input.tool, skill: `${tool.skill} v${skill?.version ?? "?"}`, scenes: res.scenes, redone: res.redoneScenes },
  });
  const scriptText = res.script.map((s) => `[Cảnh ${s.canh}] ${s.loi_thoai}`).join("\n");
  // Video làm từ kịch bản đã duyệt (Nội dung → Tạo video): dùng Caption ĐÃ DUYỆT của kịch bản, gắn ngược về kịch bản gốc.
  const source = job.source_content_id ? byId<Row>("content_item", job.source_content_id) : undefined;
  const approvedCaption = source?.kind === "video_script" ? parseVideoScript(source.body)?.caption : undefined;
  const caption = approvedCaption || res.caption;
  const ci = insert("content_item", {
    biz_id: bizId, agent_key: "creative", kind: "video", channel: input.channels[0], title: input.title, goal_id: source?.goal_id ?? null,
    body: `${caption}\n\n---\nLời thoại:\n${scriptText}`, status: "in_review", asset_id: asset.id,
  });
  if (source) update("content_item", source.id, { status: "video_made", asset_id: asset.id });
  update("creative_job", jobId, { status: "done", step: "Đã xong, chờ duyệt", asset_id: asset.id, content_item_id: ci.id, ended_at: nowIso() });

  // Review: technical checks in code + script/caption through the normal Review Agent (Jev + MKT QA)
  const tech = [
    { check: "Có file MP4 hợp lệ", passed: meta.duration > 0, severity: "fatal" as const, detail: `${meta.duration.toFixed(1)}s` },
    { check: "Có âm thanh", passed: meta.hasAudio, severity: "major" as const },
    { check: "Khung dọc 9:16", passed: !!meta.width && !!meta.height && Math.abs(meta.width / meta.height - 9 / 16) < 0.02, severity: "minor" as const, detail: `${meta.width}x${meta.height}` },
  ];
  // LUÔN chấm Review + Compliance khi có DNA (kể cả video kênh khách/affiliate, brand "other" — trước đây bỏ qua nên video
  // lên hộp Duyệt không có điểm và không qua soát tuyên bố cấm). Kênh không phải ZONO: chấm theo dữ kiện của SẢN PHẨM.
  const dnaData = activeDna(bizId)?.data;
  const rv = dnaData ? reviewDnaFor(input, dnaData) : null;
  const review = rv
    ? await reviewOutput({
      bizId, subjectType: "content_item", subjectId: ci.id, rubricKey: "video_final", output: { caption: res.caption, script: res.script, facts: rv.facts }, dna: rv.dna,
      contentView: { title: input.title, hook: res.script[0]?.loi_thoai ?? "", body: res.script.map((s) => s.loi_thoai).join("\n"), cta: res.script.at(-1)?.loi_thoai ?? "", channel: input.channels[0] },
      extraChecks: tech,
    })
    : null;
  if (review) update("content_item", ci.id, { review_score_id: review.id });
  update("content_item", ci.id, { status: "awaiting_approval" });
  const approval = insert("approval", {
    biz_id: bizId, subject_type: "creative_job", subject_id: jobId, agent_key: "creative", title: `Video: ${input.title}`,
    risk: tech.some((t) => !t.passed) || review?.verdict === "revise" ? "medium" : "low", status: "pending", review_score_id: review?.id ?? null,
    expires_at: approvalExpiresAt(bizId), // hạn duyệt theo cài đặt — quá hạn thì Sếp bấm "Mở lại" (approvals.ts)
    preview: { assetId: asset.id, duration: meta.duration, channels: input.channels, caption: res.caption, tool: tool.label, tech, notes: res.notes, redone: res.redoneScenes },
  });
  audit(bizId, "creative_agent", "creative.video_ready", { type: "creative_job", id: jobId }, { assetId: asset.id, duration: meta.duration });
  emit(bizId, "creative.updated", { jobId, status: "done" });
  emit(bizId, "approval.created", { approvalId: approval.id, title: approval.title });
  notifyDesktop(`Video "${job.title}" đã xong`, `Đã ghép + chèn phụ đề (${Math.round(meta.duration ?? res.durationSec)} giây). Mở Xưởng làm video để xem và tải về.`);
}

/**
 * DNA dùng để chấm video thành phẩm. Kênh ZONO (brand "zono") → DNA thương hiệu như cũ. Kênh khách/affiliate (brand "other")
 * → KHÔNG áp giọng/ký tự riêng của ZONO; tên + đối tượng + dữ kiện lấy từ SẢN PHẨM của video (DNA › products), vẫn giữ danh
 * sách tuyên bố cấm (Compliance).
 */
export function reviewDnaFor(input: CreativeInput, dna: Row): { dna: any; facts: { statement: string }[] } {
  if (input.brand === "zono") return { dna, facts: [] };
  const products = (dna.products ?? []) as Row[];
  const product = input.product ? products.find((p) => p.name === input.product) : undefined;
  const points: string[] = product
    ? (Array.isArray(product.sellingPoints) ? product.sellingPoints.map(String) : String(product.summary ?? "").split(/\s*;\s*/)).filter(Boolean)
    : [];
  const facts = [
    ...(product?.price != null ? [`Giá ${product.name}: ${product.price}đ`] : []),
    ...(product?.offer ? [`Ưu đãi: ${product.offer}`] : []),
    ...points,
  ].map((statement) => ({ statement }));
  const name = String(product?.name ?? input.product ?? input.title);
  return {
    dna: {
      ...dna,
      company: { ...(dna.company ?? {}), name, brand: name },
      audience: product?.audience ? [{ name: String(product.audience), pains: [], goals: [] }] : (dna.audience ?? []),
      voice: { style: ["tự nhiên", "gần gũi"], do: [], dont: [], sample: "" },
      bannedChars: [], // ký tự cấm là quy ước riêng của ZONO
      forbiddenClaims: dna.forbiddenClaims ?? [],
      products: product ? [product] : products,
    },
    facts,
  };
}

export function probeVideo(path: string) {
  try {
    const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", path], { encoding: "utf8" }));
    const v = (j.streams ?? []).find((s: Row) => s.codec_type === "video");
    return { duration: Number(j.format?.duration ?? 0), width: v?.width ?? null, height: v?.height ?? null, hasAudio: (j.streams ?? []).some((s: Row) => s.codec_type === "audio") };
  } catch (e) {
    logger.warn("ffprobe.failed", { path, error: String(e) });
    return { duration: 0, width: null, height: null, hasAudio: false };
  }
}

// ---------------- Draft upload to channels (after approval) ----------------
export function scheduleDrafts(bizId: string, jobId: string, actor: string) {
  const job = byId<Row>("creative_job", jobId)!;
  const input = job.input as CreativeInput;
  const created: string[] = [];
  for (const ch of input.channels) {
    const channel = publishChannelFor(bizId, ch); // ưu tiên "kênh đăng chính"
    if (!channel) continue;
    const pj = insert("publish_job", {
      biz_id: bizId, content_item_id: job.content_item_id, channel_id: channel.id, scheduled_at: nowIso(), status: "scheduled",
      idempotency_key: `draft:${job.id}:${channel.id}`, mode: "draft", asset_id: job.asset_id,
    });
    enqueue("publish", "publish.draft", { publishJobId: pj.id }, { bizId, idempotencyKey: `draftrun:${pj.id}`, lockKey: chromeLock(channel, "draft") });
    created.push(pj.id);
  }
  // Không ghi đè bài đã sang luồng khác (đã lên lịch / đã đăng): chỉ đưa bài đang chờ duyệt về "đã duyệt".
  q.run("UPDATE content_item SET status = 'approved' WHERE id = ? AND status IN ('in_review','awaiting_approval')", job.content_item_id);
  update("creative_job", jobId, { status: "approved", step: created.length ? "Đã duyệt, đang đăng nháp" : "Đã duyệt — chưa có kênh để đăng nháp" });
  audit(bizId, actor, "creative.drafts_scheduled", { type: "creative_job", id: jobId }, { channels: input.channels });
  return created;
}

export async function runDraftUpload(publishJobId: string) {
  const pj = byId<Row>("publish_job", publishJobId);
  if (!pj || pj.status === "draft_uploaded" || pj.status === "needs_check") return;
  // Lần trước dừng giữa lúc tải nháp (sập / Chrome treo) → nháp CÓ THỂ đã lên kênh: không tải lần 2.
  if (pj.status === "posting") {
    markNeedsCheck(pj, "lần tải nháp trước bị gián đoạn");
    return;
  }
  const asset = byId<Row>("creative_asset", pj.asset_id);
  const ci = byId<Row>("content_item", pj.content_item_id)!;
  const channel = byId<Row>("channel", pj.channel_id)!;
  if (!asset || !existsSync(asset.path)) throw new PermanentError("Không thấy file video để đăng nháp");
  // Real or nothing (Kênh đăng): Page API draft (unpublished video) → Chrome Flow agent "Lưu bản nháp" → "chờ kết nối kênh".
  const route = draftRoute(channel); // đường của BẢN NHÁP (TikTok: hộp thư qua API dù chưa được duyệt đăng công khai)
  const api = connectorForChannel(channel);
  const noApiDraft = route === "api" && !api.uploadDraft;
  if (route === "none" || (noApiDraft && !browserReady(channel).ok)) {
    if (route === "none") blockNotConnected(pj, ci, channel, "video (bản nháp)");
    else {
      const error = `${channel.name} (${channel.platform}): API kênh này chưa hỗ trợ bản nháp và chưa thiết lập đăng qua Chrome — video CHƯA lên kênh`;
      update("publish_job", pj.id, { status: "needs_setup", error });
      emit(pj.biz_id, "alert.raised", { level: "warning", text: `Video "${ci.title}": ${error}`, category: "publish", key: `publish:${pj.id}`, href: "/channels" });
    }
    const error = String(byId<Row>("publish_job", pj.id)!.error ?? "");
    q.run("UPDATE creative_job SET step = ? WHERE content_item_id = ?", `Đã duyệt — chưa lên nháp: ${error}`, ci.id);
    emit(pj.biz_id, "creative.updated", { status: "approved" });
    return;
  }
  const pt = publishText(ci, true);
  if ("error" in pt) {
    update("publish_job", pj.id, { status: "failed", error: `${pt.error} — video CHƯA lên kênh` });
    emit(pj.biz_id, "alert.raised", { level: "warning", text: `Video "${ci.title}": ${pt.error}`, category: "publish", key: `publish:${pj.id}`, href: "/publish" });
    return;
  }
  update("publish_job", pj.id, { status: "posting", error: null });
  const caption = pt.text;
  let draftUrl: string;
  let via: "api" | "browser" = route === "api" && !noApiDraft ? "api" : "browser";
  const viaBrowser = async () => {
    try {
      return (await browserPublish(channel, { text: caption, mediaPath: asset.path, mode: "draft", tag: `draft-${pj.id}` })).permalink;
    } catch (e) {
      if (browserFailedBeforePosting(e)) throw e; // chắc chắn chưa lưu nháp
      throw markNeedsCheck(pj, e instanceof Error ? e.message : String(e)); // agent dừng giữa chừng: nháp có thể đã lưu
    }
  };
  try {
    if (via === "api") {
      try {
        draftUrl = (await api.uploadDraft!({ channelExternalId: channel.external_id, videoPath: asset.path, caption }, pj.idempotency_key)).draftUrl;
      } catch (e) {
        // API không làm được (connector báo NeedsBrowser) → lưu nháp qua Chrome nếu kênh đã thiết lập.
        if (!(e instanceof ConnectorError && e.kind === "NeedsBrowser" && browserReady(channel).ok)) throw e;
        via = "browser";
        draftUrl = await viaBrowser();
      }
    } else draftUrl = await viaBrowser();
  } catch (e) {
    const cur = byId<Row>("publish_job", pj.id) ?? pj;
    if (cur.status === "needs_check") throw e; // markNeedsCheck đã ghi trạng thái + báo
    // Chrome Flow đang dựng video / Facebook giới hạn tần suất: chưa gửi gì → xếp lại vài phút sau.
    if (e instanceof AppError && e.code === "CHROME_BUSY" && requeueLater(cur, channel, "chrome_busy", e.message, 2 * 60_000)) return;
    if (e instanceof ConnectorError && e.kind === "RateLimited" && requeueLater(cur, channel, "rate_limited", e.message, 10 * 60_000)) return;
    // Mạng/timeout/5xx sau khi đã gửi lệnh tải: nháp CÓ THỂ đã lên kênh → Sếp kiểm tra, không tự tải lại.
    if (e instanceof ConnectorError && (e.kind === "Transient" || (e as { outcomeUnknown?: boolean }).outcomeUnknown)) throw markNeedsCheck(pj, e.message);
    const final = permanentIfFinal(e, channel);
    const error = final instanceof Error ? final.message : String(final);
    update("publish_job", pj.id, { status: "failed", error });
    q.run("UPDATE creative_job SET step = ? WHERE content_item_id = ?", `Đã duyệt — chưa lên nháp: ${error}`, ci.id);
    emit(pj.biz_id, "alert.raised", { level: "warning", text: `Video "${ci.title}" chưa lên nháp ${channel.name}: ${error}`, category: "publish", key: `publish:${pj.id}`, href: "/publish" });
    emit(pj.biz_id, "creative.updated", { status: "approved" });
    throw new PermanentError(error);
  }
  update("publish_job", pj.id, { status: "draft_uploaded", draft_url: draftUrl, simulated: 0, error: null });
  const left = q.scalar<number>("SELECT COUNT(*) FROM publish_job WHERE content_item_id = ? AND mode = 'draft' AND status != 'draft_uploaded'", ci.id);
  if (!left) {
    // Không ghi đè trạng thái của luồng khác (đã lên lịch / đã đăng công khai): chỉ bài đang "đã duyệt".
    q.run("UPDATE content_item SET status = 'draft_on_channel' WHERE id = ? AND status = 'approved'", ci.id);
    q.run("UPDATE creative_job SET status = 'drafted', step = 'Đã lên nháp kênh' WHERE content_item_id = ?", ci.id);
    emit(pj.biz_id, "creative.updated", { status: "drafted" });
  }
  audit(pj.biz_id, "publishing", "post.draft_uploaded", { type: "publish_job", id: pj.id }, { channel: channel.name, draftUrl, via });
  emit(pj.biz_id, "post.published", { title: `Nháp trên ${channel.name}: ${ci.title}`, channel: channel.name, simulated: false, via });
}

// ---------------- Chrome Flow ← chosen profile ----------------
/**
 * Copy the chosen everyday profile's login into Chrome Flow and report which Google accounts it now has.
 * Runs in seconds, no AI and no clicks. If the copy did not carry the login, Chrome Flow opens on Google sign-in.
 */
export async function connectFlowProfile(bizId: string, channel: string, dir: string) {
  const profile = listChromeProfiles().find((p) => p.channel === channel && p.dir === dir);
  if (!profile) throw new AppError("NO_PROFILE", "Không thấy profile Chrome này trên máy");
  await syncFlowProfile(channel, dir);
  await ensureFlowBrowser({});
  const accounts = await flowAccounts().catch(() => [] as string[]);
  const found = profile.email ? accounts.includes(profile.email) : accounts.length > 0;
  if (!found) await openFlowLogin({}).catch(() => {});
  audit(bizId, "system", "creative.flow_profile_connected", undefined, { dir, found, accounts });
  return { found, accountEmail: found ? (profile.email ?? accounts[0]) : "", accounts, error: found ? "" : "Chưa có đăng nhập Google trong Chrome Flow — cửa sổ đăng nhập đã mở" };
}
