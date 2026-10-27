# ZaloCRM Sprint Plan — ClaudeKit Pipeline

> Cấu trúc theo ClaudeKit 3-phase: Brainstorm → Plan → Cook
> Thiết kế để chạy song song trên Conductor (mỗi sprint = 1 workspace riêng)
> ClaudeKit tự sinh ra toàn bộ file chi tiết — file này chỉ là "context hint"

---

## Tổng quan dự án

**ZaloCRM** — CRM tích hợp Zalo đa tài khoản cho doanh nghiệp Việt Nam.

**MVP đã hoàn thành:**
- Auth (JWT, roles, multi-org)
- Zalo multi-account (OA integration)
- Chat real-time (WebSocket)
- Contact pipeline (kanban stages)
- Appointments & calendar
- Dashboard & reports cơ bản
- Public API & webhooks

**Stack:**
- Backend: NestJS + TypeScript + PostgreSQL + Prisma
- Frontend: Vue 3 + Vuetify + Pinia
- Infrastructure: Docker Compose

**6 sprint mở rộng MVP**, mỗi sprint độc lập, chạy đồng thời trên Conductor:

| Sprint | Tên | Ưu tiên | Ước tính |
|--------|-----|---------|----------|
| S1 | AI Assistant | Cao | 2-3 ngày |
| S2 | Workflow Automation | Cao | 2-3 ngày |
| S3 | Advanced Analytics | Trung bình | 1-2 ngày |
| S4 | Contact Intelligence | Trung bình | 1-2 ngày |
| S5 | Mobile API + PWA | Thấp | 2-3 ngày |
| S6 | Integration Hub | Thấp | 2-3 ngày |

---

## Cách ClaudeKit dùng file này

```
File này (context hint)
        ↓
/ck:brainstorm đọc → hỏi clarify → tự tạo plans/sX-name/phase-1-brainstorm.md
        ↓
/ck:plan đọc brainstorm → tự tạo plans/sX-name/plan.md + phase-XX-*.md
        ↓
/ck:cook đọc plan.md → implement → test → review → commit
```

**Bạn KHÔNG cần viết schema, endpoints, hay component structure** — ClaudeKit tự research và quyết định.

---

## Sprint S1: AI Assistant

**Mục tiêu:** Tích hợp AI (Claude/Gemini) hỗ trợ sales rep trong quá trình chat.

**Ý tưởng cốt lõi:**
- Gợi ý trả lời (draft) dựa trên lịch sử hội thoại
- Tóm tắt hội thoại dài
- Phân tích cảm xúc khách hàng
- Cấu hình AI per-org (chọn provider, giới hạn usage)

**Constraints quan trọng:**
- AI CHỈ gợi ý, KHÔNG tự động gửi tin nhắn
- Giới hạn request/ngày để kiểm soát chi phí
- API key lưu server-side, không leak ra frontend

**Modules liên quan trong codebase:**
- `backend/src/modules/chat/` — cần hook vào để lấy context hội thoại
- `frontend/src/views/` — cần thêm AI panel cạnh chat thread
- `prisma/schema.prisma` — cần thêm model mới (không sửa model cũ)

**Câu hỏi ClaudeKit sẽ hỏi khi brainstorm:**
- Provider nào ưu tiên: Claude hay Gemini?
- AI panel hiển thị ở đâu: slide-over hay column thứ 4?
- Giới hạn mặc định bao nhiêu request/ngày?

---

## Sprint S2: Workflow Automation

**Mục tiêu:** Rules engine để tự động hóa các tác vụ lặp lại trong CRM.

**Ý tưởng cốt lõi:**
- Trigger: message received, contact created, status changed, scheduled (cron)
- Condition: lọc theo field của contact/conversation (source, tags, stage...)
- Action: assign user, gửi template, đổi pipeline stage, tạo appointment

**Constraints quan trọng:**
- Rule chạy async, không block main thread
- Có thể bật/tắt từng rule
- Log lịch sử mỗi lần rule chạy

**Modules liên quan:**
- `backend/src/modules/chat/` — trigger khi nhận tin nhắn
- `backend/src/modules/contacts/` — trigger khi tạo/sửa contact
- `frontend/src/views/` — cần thêm trang Automation

**Câu hỏi ClaudeKit sẽ hỏi khi brainstorm:**
- Rule builder: visual drag-drop hay form đơn giản?
- Có cần template library có sẵn hay chỉ custom?
- Số action tối đa trong 1 rule?

---

## Sprint S3: Advanced Analytics

**Mục tiêu:** Báo cáo nâng cao, cho phép manager theo dõi hiệu suất team và pipeline.

**Ý tưởng cốt lõi:**
- Conversion funnel: tỷ lệ chuyển đổi qua các stage
- Team performance: xếp hạng theo contacts converted, response time
- Custom report: tự chọn metrics, filter, date range
- Weekly digest: gửi báo cáo tóm tắt tự động

**Constraints quan trọng:**
- Query phải có index, không làm chậm database production
- Saved reports per-org
- Export CSV/PDF

**Modules liên quan:**
- `backend/src/modules/dashboard/` — có thể tái dùng logic báo cáo cũ
- `frontend/src/views/` — cần trang Analytics riêng

**Câu hỏi ClaudeKit sẽ hỏi khi brainstorm:**
- Charting library: dùng gì (đã có sẵn Vuetify charts chưa)?
- Cần real-time hay chỉ refresh theo request?
- Export PDF hay chỉ CSV là đủ?

---

## Sprint S4: Contact Intelligence

**Mục tiêu:** Làm sạch và làm giàu dữ liệu contact tự động.

**Ý tưởng cốt lõi:**
- Phát hiện contact trùng (phone, name fuzzy match, Zalo ID)
- Merge contacts: gộp 2+ contact, giữ toàn bộ lịch sử
- Lead scoring: tính điểm dựa trên hoạt động (0-100)
- Auto-tag: gắn tag tự động dựa trên hành vi

**Constraints quan trọng:**
- Duplicate detection chạy background (cron), không realtime
- Merge không xóa data cũ, chỉ redirect
- Lead score tính lại mỗi đêm

**Modules liên quan:**
- `backend/src/modules/contacts/` — extend module hiện tại
- `frontend/src/views/` — cần UI review duplicates
- `prisma/schema.prisma` — thêm field vào Contact model hiện tại

**Câu hỏi ClaudeKit sẽ hỏi khi brainstorm:**
- Ngưỡng fuzzy match name là bao nhiêu % để coi là trùng?
- Merge: ai quyết định contact nào là "master"?
- Lead score hiển thị ở đâu: badge, column, hay cả hai?

---

## Sprint S5: Mobile API + PWA

**Mục tiêu:** Cho phép sales rep dùng ZaloCRM trên điện thoại.

**Ý tưởng cốt lõi:**
- Progressive Web App: cài từ browser, không cần app store
- Push notifications: nhận thông báo tin nhắn mới
- Offline queue: soạn tin khi mất mạng, tự gửi khi có lại
- Mobile-first UI: bottom nav, swipe gestures, touch-friendly

**Constraints quan trọng:**
- Không tạo codebase riêng, PWA build từ frontend Vue hiện tại
- Push notification qua Firebase Cloud Messaging
- Offline chỉ cho chat, không cho báo cáo

**Modules liên quan:**
- `frontend/` — thêm PWA config vào Vite build hiện tại
- `frontend/src/views/` — tạo thêm Mobile views tối ưu cho nhỏ
- Backend không cần sửa nhiều (FCM token storage)

**Câu hỏi ClaudeKit sẽ hỏi khi brainstorm:**
- Breakpoint mobile: dưới 768px hay 480px?
- Offline: chỉ queue tin nhắn hay cả việc xem contact offline?
- FCM hay Web Push API trực tiếp?

---

## Sprint S6: Integration Hub

**Mục tiêu:** Kết nối ZaloCRM với các công cụ bên ngoài doanh nghiệp đang dùng.

**Ý tưởng cốt lõi:**
- Google Sheets: đồng bộ 2 chiều danh sách contact
- Telegram Bot: nhận thông báo quan trọng qua Telegram
- Facebook Messenger: import leads từ Facebook
- Zapier: expose trigger/action endpoints để kết nối 1000+ app

**Constraints quan trọng:**
- Credentials lưu encrypted (không plaintext trong DB)
- Mỗi integration có thể bật/tắt riêng
- Sync log để debug khi có lỗi
- Rate limit tuân theo giới hạn của từng platform

**Modules liên quan:**
- Backend: tạo module `integrations/` hoàn toàn mới
- `frontend/src/views/` — trang Settings > Integrations
- `prisma/schema.prisma` — thêm model Integration, SyncLog

**Câu hỏi ClaudeKit sẽ hỏi khi brainstorm:**
- Zapier hay Make.com (hoặc cả hai)?
- Google Sheets sync: manual trigger hay tự động theo schedule?
- Facebook: official Graph API hay third-party?

---

## Thứ tự chạy trên Conductor

```
Đợt 1 — Chạy song song (hoàn toàn độc lập):
  S3 Advanced Analytics      → branch: feat/advanced-analytics
  S4 Contact Intelligence    → branch: feat/contact-intelligence
  S5 Mobile PWA              → branch: feat/mobile-pwa
  S6 Integration Hub         → branch: feat/integration-hub

Đợt 2 — Sau đợt 1 xong:
  S2 Workflow Automation     → branch: feat/workflow-automation
  (có thể dùng template từ S3/S4)

Đợt 3 — Cuối cùng:
  S1 AI Assistant            → branch: feat/ai-assistant
  (có thể dùng template từ S2)
```

---

## File ownership — tránh conflict giữa các workspace

| Sprint | Backend | Frontend | Schema |
|--------|---------|----------|--------|
| S1 | `modules/ai/` (mới) | `components/Ai*.vue` (mới) | thêm AiSuggestion, AiConfig |
| S2 | `modules/automation/` (mới) | `views/AutomationView.vue`, `components/Rule*.vue` (mới) | thêm AutomationRule, MessageTemplate |
| S3 | `modules/analytics/` (mới) | `views/AnalyticsView.vue`, `components/Report*.vue` (mới) | thêm SavedReport |
| S4 | `modules/contacts/duplicate-*.ts`, `lead-scoring.ts` (thêm vào module cũ) | `components/Duplicate*.vue`, `components/LeadScore*.vue` (mới) | thêm field vào Contact, thêm DuplicateGroup |
| S5 | không đụng backend nhiều | `views/Mobile*.vue`, `service-worker.ts`, `public/manifest.json` (mới) | thêm FcmToken |
| S6 | `modules/integrations/` (mới) | `views/IntegrationsView.vue` (mới) | thêm Integration, SyncLog |

**Quy tắc:** Mỗi sprint chỉ được **thêm model mới** hoặc **thêm field mới** vào `prisma/schema.prisma` — KHÔNG sửa model của sprint khác.
