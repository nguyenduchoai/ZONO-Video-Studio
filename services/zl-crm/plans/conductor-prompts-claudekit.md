# Conductor Prompts — ClaudeKit Pipeline

> Pipeline: Brainstorm → Plan → Cook
> Mỗi workspace trong Conductor paste prompt vào ô "Starting prompt"
> Chuẩn: ClaudeKit agents + skills (KHÔNG dùng gstack)

---

## Cấu trúc 6 Workspace

| Workspace | Branch | Sprint |
|-----------|--------|--------|
| 1 | `feat/ai-assistant` | S1: AI Assistant |
| 2 | `feat/workflow-automation` | S2: Workflow Automation |
| 3 | `feat/advanced-analytics` | S3: Advanced Analytics |
| 4 | `feat/contact-intelligence` | S4: Contact Intelligence |
| 5 | `feat/mobile-pwa` | S5: Mobile API + PWA |
| 6 | `feat/integration-hub` | S6: Integration Hub |

---

## PHASE 1 — BRAINSTORM

> Chạy đầu tiên trong mỗi workspace

### Workspace 1 — S1: AI Assistant

```
Đọc file `plans/sprint-plan.md`, tập trung vào phần "Sprint S1: AI Assistant".

Dùng skill `/ck:brainstorm` để brainstorm solution cho sprint này.

Context cần biết:
- Đây là ZaloCRM project, MVP đã hoàn thành (auth, Zalo multi-account, chat real-time, contact pipeline)
- Sprint S1 mở rộng MVP: tích hợp AI (Claude/Gemini) để gợi ý trả lời, phân tích cảm xúc, tóm tắt hội thoại
- Stack: NestJS backend, Vue 3 frontend, PostgreSQL, Prisma ORM

Yêu cầu:
1. Đọc `plans/sprint-plan.md` phần S1 để lấy context
2. Scout codebase hiện tại (`backend/src/modules/`, `frontend/src/`) để hiểu structure
3. Brainstorm 2-3 approaches, đánh giá trade-offs
4. Xuất report ra `plans/s1-ai-assistant/phase-1-brainstorm.md`
5. Khi xong hỏi: có muốn chạy `/ck:plan` không
```

### Workspace 2 — S2: Workflow Automation

```
Đọc file `plans/sprint-plan.md`, tập trung vào phần "Sprint S2: Workflow Automation".

Dùng skill `/ck:brainstorm` để brainstorm solution cho sprint này.

Context cần biết:
- Đây là ZaloCRM project, MVP đã hoàn thành (auth, Zalo multi-account, chat real-time, contact pipeline)
- Sprint S2: rules engine tự động assign contact, gửi tin nhắn template, chuyển trạng thái pipeline, tạo appointment
- Stack: NestJS backend, Vue 3 frontend, PostgreSQL, Prisma ORM

Yêu cầu:
1. Đọc `plans/sprint-plan.md` phần S2 để lấy context
2. Scout codebase hiện tại (`backend/src/modules/`, `frontend/src/`) để hiểu structure
3. Brainstorm 2-3 approaches, đánh giá trade-offs
4. Xuất report ra `plans/s2-workflow-automation/phase-1-brainstorm.md`
5. Khi xong hỏi: có muốn chạy `/ck:plan` không
```

### Workspace 3 — S3: Advanced Analytics

```
Đọc file `plans/sprint-plan.md`, tập trung vào phần "Sprint S3: Advanced Analytics".

Dùng skill `/ck:brainstorm` để brainstorm solution cho sprint này.

Context cần biết:
- Đây là ZaloCRM project, MVP đã hoàn thành (auth, Zalo multi-account, chat real-time, contact pipeline)
- Sprint S3: custom report builder, trend analysis, team performance, conversion funnel
- Stack: NestJS backend, Vue 3 frontend, PostgreSQL, Prisma ORM

Yêu cầu:
1. Đọc `plans/sprint-plan.md` phần S3 để lấy context
2. Scout codebase hiện tại (`backend/src/modules/`, `frontend/src/`) để hiểu structure
3. Brainstorm 2-3 approaches, đánh giá trade-offs
4. Xuất report ra `plans/s3-advanced-analytics/phase-1-brainstorm.md`
5. Khi xong hỏi: có muốn chạy `/ck:plan` không
```

### Workspace 4 — S4: Contact Intelligence

```
Đọc file `plans/sprint-plan.md`, tập trung vào phần "Sprint S4: Contact Intelligence".

Dùng skill `/ck:brainstorm` để brainstorm solution cho sprint này.

Context cần biết:
- Đây là ZaloCRM project, MVP đã hoàn thành (auth, Zalo multi-account, chat real-time, contact pipeline)
- Sprint S4: phát hiện contact trùng, merge contacts, lead scoring, tag thông minh
- Stack: NestJS backend, Vue 3 frontend, PostgreSQL, Prisma ORM

Yêu cầu:
1. Đọc `plans/sprint-plan.md` phần S4 để lấy context
2. Scout codebase hiện tại (`backend/src/modules/contacts/`, `frontend/src/`) để hiểu structure
3. Brainstorm 2-3 approaches, đánh giá trade-offs
4. Xuất report ra `plans/s4-contact-intelligence/phase-1-brainstorm.md`
5. Khi xong hỏi: có muốn chạy `/ck:plan` không
```

### Workspace 5 — S5: Mobile API + PWA

```
Đọc file `plans/sprint-plan.md`, tập trung vào phần "Sprint S5: Mobile API + PWA".

Dùng skill `/ck:brainstorm` để brainstorm solution cho sprint này.

Context cần biết:
- Đây là ZaloCRM project, MVP đã hoàn thành (auth, Zalo multi-account, chat real-time, contact pipeline)
- Sprint S5: Progressive Web App cho mobile, push notifications, offline queue, responsive layout
- Stack: NestJS backend, Vue 3 frontend, PostgreSQL, Prisma ORM

Yêu cầu:
1. Đọc `plans/sprint-plan.md` phần S5 để lấy context
2. Scout codebase hiện tại (`frontend/src/`, `frontend/vite.config.ts`) để hiểu structure
3. Brainstorm 2-3 approaches, đánh giá trade-offs
4. Xuất report ra `plans/s5-mobile-pwa/phase-1-brainstorm.md`
5. Khi xong hỏi: có muốn chạy `/ck:plan` không
```

### Workspace 6 — S6: Integration Hub

```
Đọc file `plans/sprint-plan.md`, tập trung vào phần "Sprint S6: Integration Hub".

Dùng skill `/ck:brainstorm` để brainstorm solution cho sprint này.

Context cần biết:
- Đây là ZaloCRM project, MVP đã hoàn thành (auth, Zalo multi-account, chat real-time, contact pipeline)
- Sprint S6: kết nối với Google Sheets, Telegram, Facebook Messenger, Zapier
- Stack: NestJS backend, Vue 3 frontend, PostgreSQL, Prisma ORM

Yêu cầu:
1. Đọc `plans/sprint-plan.md` phần S6 để lấy context
2. Scout codebase hiện tại (`backend/src/modules/`, `frontend/src/`) để hiểu structure
3. Brainstorm 2-3 approaches, đánh giá trade-offs
4. Xuất report ra `plans/s6-integration-hub/phase-1-brainstorm.md`
5. Khi xong hỏi: có muốn chạy `/ck:plan` không
```

---

## PHASE 2 — PLAN

> Chạy sau khi brainstorm đã được approve

### Workspace 1 — S1: AI Assistant

```
Đọc file `plans/s1-ai-assistant/phase-1-brainstorm.md` để lấy context brainstorm đã được duyệt.

Dùng skill `/ck:plan --hard` để tạo implementation plan chi tiết cho Sprint S1: AI Assistant.

Yêu cầu:
- Input: `plans/s1-ai-assistant/phase-1-brainstorm.md`
- Output plan: `plans/s1-ai-assistant/plan.md` + các file `phase-01-*.md`, `phase-02-*.md`...
- Plan phải bao gồm: database schema, API endpoints, frontend components, file ownership rõ ràng
- Mỗi phase phải có: success criteria, risk assessment, files to create/modify
- KHÔNG implement code, chỉ tạo plan

Sau khi plan xong, xuất lệnh cook để dùng ở Phase 3.
```

### Workspace 2 — S2: Workflow Automation

```
Đọc file `plans/s2-workflow-automation/phase-1-brainstorm.md` để lấy context brainstorm đã được duyệt.

Dùng skill `/ck:plan --hard` để tạo implementation plan chi tiết cho Sprint S2: Workflow Automation.

Yêu cầu:
- Input: `plans/s2-workflow-automation/phase-1-brainstorm.md`
- Output plan: `plans/s2-workflow-automation/plan.md` + các file `phase-01-*.md`, `phase-02-*.md`...
- Plan phải bao gồm: database schema, API endpoints, frontend components, file ownership rõ ràng
- Mỗi phase phải có: success criteria, risk assessment, files to create/modify
- KHÔNG implement code, chỉ tạo plan

Sau khi plan xong, xuất lệnh cook để dùng ở Phase 3.
```

### Workspace 3 — S3: Advanced Analytics

```
Đọc file `plans/s3-advanced-analytics/phase-1-brainstorm.md` để lấy context brainstorm đã được duyệt.

Dùng skill `/ck:plan --hard` để tạo implementation plan chi tiết cho Sprint S3: Advanced Analytics.

Yêu cầu:
- Input: `plans/s3-advanced-analytics/phase-1-brainstorm.md`
- Output plan: `plans/s3-advanced-analytics/plan.md` + các file `phase-01-*.md`, `phase-02-*.md`...
- Plan phải bao gồm: database schema, API endpoints, frontend components, file ownership rõ ràng
- Mỗi phase phải có: success criteria, risk assessment, files to create/modify
- KHÔNG implement code, chỉ tạo plan

Sau khi plan xong, xuất lệnh cook để dùng ở Phase 3.
```

### Workspace 4 — S4: Contact Intelligence

```
Đọc file `plans/s4-contact-intelligence/phase-1-brainstorm.md` để lấy context brainstorm đã được duyệt.

Dùng skill `/ck:plan --hard` để tạo implementation plan chi tiết cho Sprint S4: Contact Intelligence.

Yêu cầu:
- Input: `plans/s4-contact-intelligence/phase-1-brainstorm.md`
- Output plan: `plans/s4-contact-intelligence/plan.md` + các file `phase-01-*.md`, `phase-02-*.md`...
- Plan phải bao gồm: database schema (lead scoring, duplicate detection), API endpoints, frontend components, file ownership rõ ràng
- Mỗi phase phải có: success criteria, risk assessment, files to create/modify
- KHÔNG implement code, chỉ tạo plan

Sau khi plan xong, xuất lệnh cook để dùng ở Phase 3.
```

### Workspace 5 — S5: Mobile API + PWA

```
Đọc file `plans/s5-mobile-pwa/phase-1-brainstorm.md` để lấy context brainstorm đã được duyệt.

Dùng skill `/ck:plan --hard` để tạo implementation plan chi tiết cho Sprint S5: Mobile API + PWA.

Yêu cầu:
- Input: `plans/s5-mobile-pwa/phase-1-brainstorm.md`
- Output plan: `plans/s5-mobile-pwa/plan.md` + các file `phase-01-*.md`, `phase-02-*.md`...
- Plan phải bao gồm: PWA manifest, service worker strategy, push notification setup, responsive components, file ownership rõ ràng
- Mỗi phase phải có: success criteria, risk assessment, files to create/modify
- KHÔNG implement code, chỉ tạo plan

Sau khi plan xong, xuất lệnh cook để dùng ở Phase 3.
```

### Workspace 6 — S6: Integration Hub

```
Đọc file `plans/s6-integration-hub/phase-1-brainstorm.md` để lấy context brainstorm đã được duyệt.

Dùng skill `/ck:plan --hard` để tạo implementation plan chi tiết cho Sprint S6: Integration Hub.

Yêu cầu:
- Input: `plans/s6-integration-hub/phase-1-brainstorm.md`
- Output plan: `plans/s6-integration-hub/plan.md` + các file `phase-01-*.md`, `phase-02-*.md`...
- Plan phải bao gồm: database schema (Integration, SyncLog), provider modules, sync engine, file ownership rõ ràng
- Mỗi phase phải có: success criteria, risk assessment, files to create/modify
- KHÔNG implement code, chỉ tạo plan

Sau khi plan xong, xuất lệnh cook để dùng ở Phase 3.
```

---

## PHASE 3 — COOK

> Chạy sau khi plan đã được review và approve

### Workspace 1 — S1: AI Assistant

```
Đọc file `plans/s1-ai-assistant/plan.md` để nắm toàn bộ plan.

Dùng skill `/ck:cook plans/s1-ai-assistant/plan.md --auto` để implement Sprint S1: AI Assistant.

Yêu cầu:
- Implement tuần tự từng phase theo đúng plan
- Dùng `scout` skill tìm đúng file cần sửa trước khi code
- Sau mỗi phase: chạy compile check, không để syntax error
- Khi implement xong: spawn `tester` agent chạy test
- Khi test pass: spawn `code-reviewer` agent review
- Khi review pass: spawn `git-manager` agent commit với conventional commit message
- Branch hiện tại: `feat/ai-assistant`
- KHÔNG commit lên main/dev, chỉ commit lên branch này

File ownership (không được đụng file của sprint khác):
- Backend: `backend/src/modules/ai/` (tạo mới)
- Frontend: `frontend/src/components/Ai*.vue` (tạo mới)
- Schema: chỉ thêm model AiSuggestion, AiConfig vào `prisma/schema.prisma`, không sửa model cũ
```

### Workspace 2 — S2: Workflow Automation

```
Đọc file `plans/s2-workflow-automation/plan.md` để nắm toàn bộ plan.

Dùng skill `/ck:cook plans/s2-workflow-automation/plan.md --auto` để implement Sprint S2: Workflow Automation.

Yêu cầu:
- Implement tuần tự từng phase theo đúng plan
- Dùng `scout` skill tìm đúng file cần sửa trước khi code
- Sau mỗi phase: chạy compile check, không để syntax error
- Khi implement xong: spawn `tester` agent chạy test
- Khi test pass: spawn `code-reviewer` agent review
- Khi review pass: spawn `git-manager` agent commit với conventional commit message
- Branch hiện tại: `feat/workflow-automation`
- KHÔNG commit lên main/dev, chỉ commit lên branch này

File ownership (không được đụng file của sprint khác):
- Backend: `backend/src/modules/automation/` (tạo mới)
- Frontend: `frontend/src/views/AutomationView.vue`, `frontend/src/components/Rule*.vue`, `frontend/src/components/Template*.vue` (tạo mới)
- Schema: chỉ thêm model AutomationRule, MessageTemplate vào `prisma/schema.prisma`, không sửa model cũ
```

### Workspace 3 — S3: Advanced Analytics

```
Đọc file `plans/s3-advanced-analytics/plan.md` để nắm toàn bộ plan.

Dùng skill `/ck:cook plans/s3-advanced-analytics/plan.md --auto` để implement Sprint S3: Advanced Analytics.

Yêu cầu:
- Implement tuần tự từng phase theo đúng plan
- Dùng `scout` skill tìm đúng file cần sửa trước khi code
- Sau mỗi phase: chạy compile check, không để syntax error
- Khi implement xong: spawn `tester` agent chạy test
- Khi test pass: spawn `code-reviewer` agent review
- Khi review pass: spawn `git-manager` agent commit với conventional commit message
- Branch hiện tại: `feat/advanced-analytics`
- KHÔNG commit lên main/dev, chỉ commit lên branch này

File ownership (không được đụng file của sprint khác):
- Backend: `backend/src/modules/analytics/` (tạo mới)
- Frontend: `frontend/src/views/AnalyticsView.vue`, `frontend/src/components/Conversion*.vue`, `frontend/src/components/Team*.vue`, `frontend/src/components/Report*.vue` (tạo mới)
- Schema: chỉ thêm model SavedReport vào `prisma/schema.prisma`, không sửa model cũ
```

### Workspace 4 — S4: Contact Intelligence

```
Đọc file `plans/s4-contact-intelligence/plan.md` để nắm toàn bộ plan.

Dùng skill `/ck:cook plans/s4-contact-intelligence/plan.md --auto` để implement Sprint S4: Contact Intelligence.

Yêu cầu:
- Implement tuần tự từng phase theo đúng plan
- Dùng `scout` skill tìm đúng file cần sửa trước khi code
- Sau mỗi phase: chạy compile check, không để syntax error
- Khi implement xong: spawn `tester` agent chạy test
- Khi test pass: spawn `code-reviewer` agent review
- Khi review pass: spawn `git-manager` agent commit với conventional commit message
- Branch hiện tại: `feat/contact-intelligence`
- KHÔNG commit lên main/dev, chỉ commit lên branch này

File ownership (không được đụng file của sprint khác):
- Backend: `backend/src/modules/contacts/duplicate-detector.ts`, `merge.service.ts`, `lead-scoring.ts`, `auto-tagger.ts` (tạo mới trong module contacts có sẵn)
- Frontend: `frontend/src/components/Duplicate*.vue`, `frontend/src/components/LeadScore*.vue`, `frontend/src/components/ContactTimeline.vue` (tạo mới)
- Schema: chỉ thêm field leadScore, lastActivity, mergedInto vào Contact model và thêm model DuplicateGroup, không sửa field cũ
```

### Workspace 5 — S5: Mobile API + PWA

```
Đọc file `plans/s5-mobile-pwa/plan.md` để nắm toàn bộ plan.

Dùng skill `/ck:cook plans/s5-mobile-pwa/plan.md --auto` để implement Sprint S5: Mobile API + PWA.

Yêu cầu:
- Implement tuần tự từng phase theo đúng plan
- Dùng `scout` skill tìm đúng file cần sửa trước khi code
- Sau mỗi phase: chạy compile check, không để syntax error
- Khi implement xong: spawn `tester` agent chạy test
- Khi test pass: spawn `code-reviewer` agent review
- Khi review pass: spawn `git-manager` agent commit với conventional commit message
- Branch hiện tại: `feat/mobile-pwa`
- KHÔNG commit lên main/dev, chỉ commit lên branch này

File ownership (không được đụng file của sprint khác):
- Frontend: `frontend/public/manifest.json`, `frontend/src/service-worker.ts`, `frontend/src/views/Mobile*.vue`, `frontend/src/components/BottomNav.vue`, `frontend/src/components/PullToRefresh.vue`, `frontend/src/components/OfflineIndicator.vue` (tạo mới)
- Config: chỉ thêm vite-plugin-pwa vào `frontend/vite.config.ts`, không sửa config khác
```

### Workspace 6 — S6: Integration Hub

```
Đọc file `plans/s6-integration-hub/plan.md` để nắm toàn bộ plan.

Dùng skill `/ck:cook plans/s6-integration-hub/plan.md --auto` để implement Sprint S6: Integration Hub.

Yêu cầu:
- Implement tuần tự từng phase theo đúng plan
- Dùng `scout` skill tìm đúng file cần sửa trước khi code
- Sau mỗi phase: chạy compile check, không để syntax error
- Khi implement xong: spawn `tester` agent chạy test
- Khi test pass: spawn `code-reviewer` agent review
- Khi review pass: spawn `git-manager` agent commit với conventional commit message
- Branch hiện tại: `feat/integration-hub`
- KHÔNG commit lên main/dev, chỉ commit lên branch này

File ownership (không được đụng file của sprint khác):
- Backend: `backend/src/modules/integrations/` (tạo mới hoàn toàn)
- Frontend: `frontend/src/views/IntegrationsView.vue`, `frontend/src/components/Integration*.vue` (tạo mới)
- Schema: chỉ thêm model Integration, SyncLog vào `prisma/schema.prisma`, không sửa model cũ
```

---

## Ghi chú quan trọng

### Thứ tự chạy khuyến nghị

```
Đợt 1 — Chạy song song (độc lập nhau):
  Workspace 3 (S3), Workspace 4 (S4), Workspace 5 (S5), Workspace 6 (S6)

Đợt 2 — Sau đợt 1 xong:
  Workspace 2 (S2) — dùng templates từ các sprint trước

Đợt 3 — Cuối cùng:
  Workspace 1 (S1) — tích hợp AI, dùng templates từ S2
```

### Nguyên tắc ClaudeKit

| Skill/Agent | Vai trò |
|-------------|---------|
| `/ck:brainstorm` | CTO-level advisor, HARD GATE trước khi plan |
| `/ck:plan --hard` | Tech Lead, 2 researcher song song + red-team review |
| `/ck:cook --auto` | End-to-end implementation, auto-chain agents |
| `scout` | Tìm đúng file trước khi code, tránh tạo trùng |
| `tester` | Chạy test, KHÔNG bỏ qua test fail |
| `code-reviewer` | Review trước khi commit |
| `git-manager` | Commit chuẩn conventional commit |
