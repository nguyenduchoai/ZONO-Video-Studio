# ZaloCRM Sprint Plan — Phase 6+

> Cau truc theo gstack 7-phase: Think → Plan → Build → Review → Test → Ship → Reflect
> Thiet ke de chay song song tren Conductor (moi sprint = 1 workspace rieng)

---

## Tong quan

ZaloCRM MVP da hoan thanh: auth, Zalo multi-account, chat real-time, contact pipeline,
appointments, dashboard, reports, public API, webhooks. Cac sprint duoi day mo rong
tu MVP thanh san pham hoan chinh.

**6 sprint song song**, moi sprint doc lap, co the chay dong thoi tren Conductor:

| Sprint | Ten | Do uu tien | Thoi gian |
|--------|-----|-----------|-----------|
| S1 | AI Assistant | Cao | 2-3 ngay |
| S2 | Workflow Automation | Cao | 2-3 ngay |
| S3 | Advanced Analytics | Trung binh | 1-2 ngay |
| S4 | Contact Intelligence | Trung binh | 1-2 ngay |
| S5 | Mobile API + PWA | Thap | 2-3 ngay |
| S6 | Integration Hub | Thap | 2-3 ngay |

---

## Sprint S1: AI Assistant

**Muc tieu:** Tich hop AI (Claude/Gemini) de tu dong tra loi, phan tich cam xuc,
goi y tin nhan, tom tat hoi thoai.

### Phase 1 — THINK (`/office-hours`)

Cau hoi can tra loi:
- User nao se dung AI? Sales rep hay manager?
- AI tu dong reply hay chi goi y draft?
- Gioi han bao nhieu tin nhan AI/ngay de kiem soat chi phi?
- Ngon ngu chinh: tieng Viet, co can ho tro tieng Anh?

### Phase 2 — PLAN

**CEO Review (`/plan-ceo-review`):**
- Scope: AI goi y tra loi (draft) + tom tat hoi thoai + phan tich cam xuc
- Khong lam: AI tu dong gui tin nhan (rui ro qua cao cho CRM)

**Eng Review (`/plan-eng-review`):**

Database changes:
```sql
-- Them vao schema.prisma
model AiSuggestion {
  id              String   @id @default(uuid())
  conversationId  String
  messageId       String?
  type            String   -- "reply_draft" | "summary" | "sentiment"
  content         String
  confidence      Float
  accepted        Boolean  @default(false)
  createdAt       DateTime @default(now())
  orgId           String
}

model AiConfig {
  id        String @id @default(uuid())
  orgId     String @unique
  provider  String @default("anthropic") -- "anthropic" | "gemini"
  model     String @default("claude-sonnet-4-6")
  maxDaily  Int    @default(500)
  enabled   Boolean @default(true)
}
```

Backend modules:
```
backend/src/modules/ai/
  ├── ai.routes.ts         -- POST /api/v1/ai/suggest, GET /api/v1/ai/config
  ├── ai.service.ts        -- LLM call, prompt builder, rate limiter
  ├── ai.controller.ts     -- Request handlers
  ├── providers/
  │   ├── anthropic.ts     -- Claude API wrapper
  │   └── gemini.ts        -- Gemini API wrapper
  └── prompts/
      ├── reply-draft.ts   -- System prompt cho goi y tra loi
      ├── summary.ts       -- System prompt cho tom tat
      └── sentiment.ts     -- System prompt cho phan tich cam xuc
```

Frontend components:
```
frontend/src/components/
  ├── AiSuggestionPanel.vue   -- Hien thi goi y ben canh chat
  ├── AiSummaryCard.vue       -- Tom tat hoi thoai
  └── AiConfigDialog.vue      -- Cau hinh AI trong Settings
```

API endpoints:
- `POST /api/v1/ai/suggest` — Goi y tra loi cho conversation
- `POST /api/v1/ai/summarize/:conversationId` — Tom tat hoi thoai
- `POST /api/v1/ai/sentiment/:conversationId` — Phan tich cam xuc
- `GET /api/v1/ai/config` — Lay cau hinh AI
- `PUT /api/v1/ai/config` — Cap nhat cau hinh AI
- `GET /api/v1/ai/usage` — Thong ke su dung AI hom nay

**Design Review (`/plan-design-review`):**
- AI panel nam ben phai chat thread (thu 4 column hoac slide-over)
- Nut "Ask AI" trong message input area
- Skeleton loading khi cho AI response (~2-3s)
- Badge hien thi so goi y chua doc

### Phase 3 — BUILD
Trien khai theo plan da lock.

### Phase 4 — REVIEW (`/review`)
- Kiem tra prompt injection prevention
- Kiem tra rate limiting hoat dong dung
- Kiem tra API key khong leak ra frontend

### Phase 5 — TEST (`/qa`)
- Test AI suggest voi conversation thuc
- Test rate limiter khi vuot 500 request/ngay
- Test fallback khi AI provider loi
- Test UI hien thi suggestion panel

### Phase 6 — SHIP (`/ship`)
- Tao PR, chay tests, merge

### Phase 7 — REFLECT (`/retro`)
- Do AI response time trung binh
- Ti le user accept AI suggestion
- Chi phi AI/ngay

---

## Sprint S2: Workflow Automation

**Muc tieu:** Rules engine de tu dong assign contact, gui tin nhan template,
chuyen trang thai pipeline, tao appointment.

### Phase 1 — THINK (`/office-hours`)

Cau hoi:
- Nhung workflow nao duoc dung nhieu nhat? (auto-assign, auto-reply, auto-status)
- User tu tao rule hay dung template co san?
- Trigger events: message received, contact created, status changed, time-based?

### Phase 2 — PLAN

**Eng Review (`/plan-eng-review`):**

Database:
```sql
model AutomationRule {
  id          String   @id @default(uuid())
  orgId       String
  name        String
  description String?
  trigger     String   -- "message_received" | "contact_created" | "status_changed" | "scheduled"
  conditions  Json     -- [{"field": "source", "op": "eq", "value": "facebook"}]
  actions     Json     -- [{"type": "assign_user", "userId": "..."}, {"type": "send_template", "templateId": "..."}]
  enabled     Boolean  @default(true)
  priority    Int      @default(0)
  runCount    Int      @default(0)
  lastRunAt   DateTime?
  createdAt   DateTime @default(now())
}

model MessageTemplate {
  id        String   @id @default(uuid())
  orgId     String
  name      String
  content   String   -- Ho tro {{contact.name}}, {{contact.phone}} variables
  category  String?  -- "greeting" | "follow_up" | "closing"
  createdAt DateTime @default(now())
}
```

Backend:
```
backend/src/modules/automation/
  ├── automation.routes.ts
  ├── automation.service.ts      -- Rule engine: evaluate conditions, execute actions
  ├── automation.controller.ts
  ├── triggers/
  │   ├── message-trigger.ts     -- Hook vao chat module
  │   ├── contact-trigger.ts     -- Hook vao contact module
  │   └── schedule-trigger.ts    -- Cron-based triggers
  ├── actions/
  │   ├── assign-action.ts       -- Assign contact to user/team
  │   ├── send-template.ts       -- Gui tin nhan template
  │   ├── update-status.ts       -- Chuyen trang thai pipeline
  │   └── create-appointment.ts  -- Tu dong tao lich hen
  └── templates/
      └── template.service.ts    -- CRUD message templates
```

Frontend:
```
frontend/src/views/AutomationView.vue       -- Rule list + builder
frontend/src/components/
  ├── RuleBuilder.vue              -- Visual rule builder (trigger → condition → action)
  ├── ConditionEditor.vue          -- Field/operator/value selector
  ├── ActionEditor.vue             -- Action type + config
  └── TemplateManager.vue          -- Message template CRUD
```

### Phase 3-7: Tuong tu S1

---

## Sprint S3: Advanced Analytics

**Muc tieu:** Custom report builder, trend analysis, team performance,
conversion funnel.

### Phase 2 — PLAN

Database:
```sql
model SavedReport {
  id        String   @id @default(uuid())
  orgId     String
  name      String
  type      String   -- "conversion_funnel" | "team_performance" | "response_time" | "custom"
  config    Json     -- {metrics: [...], filters: [...], groupBy: "...", dateRange: "..."}
  createdBy String
  createdAt DateTime @default(now())
}
```

Backend:
```
backend/src/modules/analytics/
  ├── analytics.routes.ts
  ├── analytics.service.ts
  ├── reports/
  │   ├── conversion-funnel.ts    -- Pipeline conversion rates + thoi gian trung binh
  │   ├── team-performance.ts     -- Messages/contacts/appointments per user
  │   ├── response-time.ts        -- Thoi gian tra loi trung binh
  │   └── custom-report.ts        -- User-defined metrics + filters
  └── scheduler/
      └── weekly-digest.ts        -- Email/notification tom tat hang tuan
```

Frontend:
```
frontend/src/views/AnalyticsView.vue
frontend/src/components/
  ├── ConversionFunnel.vue        -- Funnel visualization
  ├── TeamLeaderboard.vue         -- Bang xep hang team
  ├── ResponseTimeChart.vue       -- Bieu do thoi gian tra loi
  ├── ReportBuilder.vue           -- Keo tha metrics, filters
  └── TrendLine.vue               -- So sanh tuan nay vs tuan truoc
```

KPI moi:
- Conversion rate: % contact tu "Moi" den "Chuyen doi"
- Avg response time: Thoi gian tra loi tin nhan trung binh
- Team ranking: Xep hang theo so contact converted
- Revenue attribution: (neu co truong gia tri deal)

---

## Sprint S4: Contact Intelligence

**Muc tieu:** Tu dong phat hien contact trung, merge contacts, lead scoring,
tag thong minh.

### Phase 2 — PLAN

Database:
```sql
-- Them truong vao Contact model
model Contact {
  // ... existing fields
  leadScore     Int      @default(0)    -- 0-100
  lastActivity  DateTime?
  mergedInto    String?                  -- ID cua contact goc neu da merge
}

model DuplicateGroup {
  id         String   @id @default(uuid())
  orgId      String
  contactIds String[] -- Danh sach contact ID trung lap
  matchType  String   -- "phone" | "name" | "zalo_id"
  resolved   Boolean  @default(false)
  createdAt  DateTime @default(now())
}
```

Backend:
```
backend/src/modules/contacts/
  ├── duplicate-detector.ts    -- Cron chay hang dem, tim contact trung (phone, name fuzzy)
  ├── merge.service.ts         -- Merge 2+ contacts, giu lich su toan bo
  ├── lead-scoring.ts          -- Tinh diem: so tin nhan, tan suat, appointment, thoi gian
  └── auto-tagger.ts           -- Gan tag tu dong dua tren hanh vi
```

Frontend:
```
frontend/src/components/
  ├── DuplicateReview.vue      -- Danh sach contact trung, nut merge
  ├── LeadScoreBadge.vue       -- Hien thi diem lead (mau: xanh/vang/do)
  └── ContactTimeline.vue      -- Timeline toan bo tuong tac voi contact
```

Lead scoring formula:
- +10: Moi tin nhan gui/nhan trong 7 ngay
- +20: Co appointment scheduled
- +30: Status = "Quan tam"
- -10: Khong hoat dong > 14 ngay
- -20: Khong hoat dong > 30 ngay

---

## Sprint S5: Mobile API + PWA

**Muc tieu:** Progressive Web App de nhan vien sales dung tren dien thoai.

### Phase 2 — PLAN

Frontend:
```
frontend/
  ├── vite.config.ts              -- Them vite-plugin-pwa
  ├── public/manifest.json        -- PWA manifest
  ├── src/
  │   ├── service-worker.ts       -- Cache strategy, offline queue
  │   ├── views/
  │   │   ├── MobileChatView.vue      -- Chat toi uu cho mobile
  │   │   ├── MobileContactView.vue   -- Contact list + swipe actions
  │   │   └── MobileQuickActions.vue  -- Floating action button
  │   └── components/
  │       ├── BottomNav.vue           -- Tab navigation (Chat/Contacts/Appointments)
  │       ├── PullToRefresh.vue       -- Keo xuong de refresh
  │       └── OfflineIndicator.vue    -- Banner khi mat mang
```

Key features:
- Push notifications (Firebase Cloud Messaging)
- Offline message queue (gui khi co mang lai)
- Camera access de chup va gui anh
- Responsive layout cho man hinh < 768px

---

## Sprint S6: Integration Hub

**Muc tieu:** Ket noi ZaloCRM voi cac dich vu ben ngoai (Google Sheets,
Telegram, Facebook Messenger).

### Phase 2 — PLAN

Database:
```sql
model Integration {
  id          String   @id @default(uuid())
  orgId       String
  type        String   -- "google_sheets" | "telegram" | "facebook" | "zapier"
  config      Json     -- Encrypted credentials + settings
  enabled     Boolean  @default(true)
  lastSyncAt  DateTime?
  createdAt   DateTime @default(now())
}

model SyncLog {
  id             String   @id @default(uuid())
  integrationId  String
  direction      String   -- "import" | "export"
  recordCount    Int
  status         String   -- "success" | "partial" | "failed"
  errorMessage   String?
  createdAt      DateTime @default(now())
}
```

Backend:
```
backend/src/modules/integrations/
  ├── integration.routes.ts
  ├── integration.service.ts
  ├── providers/
  │   ├── google-sheets.ts     -- Dong bo contacts 2 chieu
  │   ├── telegram-bot.ts      -- Nhan thong bao qua Telegram
  │   ├── facebook.ts          -- Import leads tu Facebook
  │   └── zapier-webhook.ts    -- Zapier trigger/action endpoints
  └── sync/
      └── sync-engine.ts       -- Scheduler + conflict resolution
```

---

## Conductor Setup — Chay 6 Sprint Song Song

### File da co

```
ZaloCRM/
├── conductor.json
├── bin/
│   ├── dev-setup
│   └── dev-teardown
```

### Cach chay

1. Mo Conductor app
2. Them repo ZaloCRM
3. Tao 6 workspace:

| Workspace | Branch | Prompt cho agent |
|-----------|--------|-----------------|
| 1 | `feat/ai-assistant` | "Doc plans/sprint-plan.md, phan Sprint S1. Thuc hien day du theo 7 phase." |
| 2 | `feat/workflow-automation` | "Doc plans/sprint-plan.md, phan Sprint S2. Thuc hien day du theo 7 phase." |
| 3 | `feat/advanced-analytics` | "Doc plans/sprint-plan.md, phan Sprint S3. Thuc hien day du theo 7 phase." |
| 4 | `feat/contact-intelligence` | "Doc plans/sprint-plan.md, phan Sprint S4. Thuc hien day du theo 7 phase." |
| 5 | `feat/mobile-pwa` | "Doc plans/sprint-plan.md, phan Sprint S5. Thuc hien day du theo 7 phase." |
| 6 | `feat/integration-hub` | "Doc plans/sprint-plan.md, phan Sprint S6. Thuc hien day du theo 7 phase." |

4. Moi agent doc sprint plan, chay tu Phase 1 den Phase 7
5. Ket qua: 6 PR doc lap, review va merge tung cai

### Thu tu merge khuyen nghi

```
S4 (Contact Intelligence)    -- Khong phu thuoc gi
  ↓
S3 (Advanced Analytics)      -- Dung lead score tu S4
  ↓
S2 (Workflow Automation)     -- Dung templates, co the trigger analytics
  ↓
S1 (AI Assistant)            -- Co the dung templates tu S2
  ↓
S5 (Mobile PWA)              -- Can tat ca features da co
  ↓
S6 (Integration Hub)         -- Cuoi cung, ket noi voi ben ngoai
```

---

## Checklist truoc khi chay

- [ ] PostgreSQL dev dang chay (`docker-compose -f docker-compose.dev.yml up -d`)
- [ ] Backend `.env` co day du config
- [ ] `npm install` da chay cho ca backend va frontend
- [ ] Conductor da cai va ket noi repo
- [ ] Moi sprint doc lap, khong sua cung file
