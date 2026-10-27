# Phase 6 — Lead Scoring Engine (Mô tả chức năng)

> Hệ thống chấm điểm KH tự động trong ZaloCRM. Mỗi KH có 1 điểm 0-100 cập nhật theo thời gian thực dựa trên hành vi chat + actions. Sale ưu tiên KH điểm cao, dashboard "đình trệ" cảnh báo KH bị bỏ rơi.

---

## 1. Triết lý thiết kế

**Vấn đề muốn giải:** Sale BĐS có 300-3000 friend / nick. Không thể đoán bằng mắt ai sắp chốt, ai chỉ hỏi cho biết, ai đang nguội. Mỗi sale đoán theo cảm tính → bỏ sót KH hot, lãng phí thời gian chăm KH cold.

**Giải:** Hệ thống tự đọc tin nhắn + actions + thời gian → tính điểm 4 chiều. Điểm cao = KH có thể chốt sớm. Điểm tụt = KH nguội. Sale chỉ cần làm việc theo thứ tự điểm.

**3 nguyên tắc cốt lõi:**
1. **Explainable** — Sale click vào điểm thấy được "tại sao 78" (signal list dạng audit log)
2. **Tunable** — Mọi rule + weight có thể chỉnh trong UI Settings, không cần deploy
3. **Per-pair scoring** — Score lưu ở `Friend` (nick × contact), không phải ở `Contact`. Cùng 1 KH chat với 3 nick có 3 điểm khác nhau. Contact-level điểm = MAX của 3 Friend.

---

## 2. Kiến trúc tổng quan

```
        ┌──────────────┐ chat msg, app event, time tick
        │   TRIGGER    │
        └──────┬───────┘
               ↓
   ┌────────────────────────┐
   │   SIGNAL DETECTOR      │  Đọc text/event/state → list signals
   │   signal-detector.ts   │  (keyword, action, silent, profile, velocity)
   └──────────┬─────────────┘
              ↓
   ┌────────────────────────┐
   │   SCORE ENGINE         │  Apply signals → sub-score → weighted sum
   │   score-engine.ts      │  → cap-per-day filter → persist Friend
   └──────────┬─────────────┘
              ↓
       ┌──────┴──────┬──────────┐
       ↓             ↓          ↓
  ┌─────────┐  ┌──────────┐  ┌──────────────┐
  │ Friend  │  │ Contact  │  │ Activity Log │
  │ (score) │  │ aggregate│  │ (audit trail)│
  └─────────┘  │ MAX score│  └──────────────┘
               └──────────┘
                    ↓
          Triggers downstream:
          - Stage promotion (auto-move KH stage)
          - Auto-tag recompute (active/cold/stuck/ready/...)
          - Stuck detection (cron daily)
```

**Hot path** (mỗi msg gửi đến): signal detect → engine apply → persist (~30-80ms).
**Cold path** (cron): decay hourly, stuck detection 6am daily, auto-tag 7am daily, backfill every 5 phút.

---

## 3. Bốn chiều chấm điểm

Mỗi Friend có 4 sub-score 0-100. Final score = trung bình có trọng số.

| Chiều | Weight default | Đo cái gì | Tăng khi |
|---|---|---|---|
| **Engagement** | **35%** | KH tương tác có thật, có nhiệt | Gửi tin, rep nhanh, voice/call, tin dài, chủ động chat lại sau im |
| **Intent** | **30%** | Ý định mua qua keyword | Hỏi giá, thanh toán, lãi suất, vị trí, ngày bàn giao, đặt cọc, "mai gửi a coi" |
| **Fit** | **15%** | Phù hợp portfolio | Ngân sách hợp lý, đúng khu vực, đúng phân khúc, độ tuổi/giới tính match |
| **Velocity** | **20%** | Tốc độ + đà tiến tiến triển | 3 ngày liên tiếp inbound, trend up tuần này, qua được milestone (hẹn gặp/đặt cọc) |

**Final = (E×35 + I×30 + F×15 + V×20) / 100**, clamp [0, 100].

Weight tunable 100% qua Settings. Tổng PHẢI = 100 (BE validate khi PUT).

---

## 4. Signal Rules (5 loại, 30+ rule default)

### 4.1 Keyword (text match tiếng Việt)

Detect khi text inbound chứa cụm. Diacritics-aware (giữ dấu để phân biệt "giá" vs "gia").

| Signal | Keywords | Δ | Dimension |
|---|---|---|---|
| `ask_price` | "giá bao nhiêu", "rao bao nhiêu", "bao tiền", "giá thật" | +15 | intent |
| `ask_payment` | "trả trước", "vay được không", "thanh toán", "trả góp", "lãi suất" | +20 | intent |
| `ask_project_detail` | "vị trí", "view", "hướng", "diện tích", "mặt tiền", "tầng" | +10 | intent |
| `ask_documents` | "pháp lý", "sổ đỏ", "giấy tờ", "hợp đồng" | +15 | intent |
| `ask_promo` | "ưu đãi", "giảm giá", "chiết khấu", "tặng" | +12 | intent |
| `ready_to_buy` | "chốt", "đặt cọc", "ký hợp đồng", "mai gửi a coi" | +25 | intent |
| `objection` | "đắt quá", "không hợp", "để xem đã" | −5 | intent |
| ... (~15 rule keyword tổng cộng) | | | |

Mỗi rule có `capPerDay`. VD `ask_price` cap 3/ngày — KH hỏi 5 lần cũng chỉ +15×3 = +45 max/ngày.

### 4.2 Action (event-driven)

Trigger từ event không phải text.

| Signal | Event | Δ | Dimension |
|---|---|---|---|
| `inbound_message` | KH gửi 1 tin | +3 (cap 15/day) | engagement |
| `fast_response` | KH rep < 5 phút | +5 (cap 5/day) | engagement |
| `long_message` | Tin > 50 chars | +2 (cap 10/day) | engagement |
| `voice_or_call` | KH gửi voice / video call | +8 | engagement |
| `kh_reacts` | KH react / reply tin sale | +1 (cap 5/day) | engagement |
| `kh_initiates_after_silent` | KH chủ động chat lại sau im lặng 7d+ | +15 | engagement |
| `slow_response_self` | Sale rep > 24h | −5 | engagement |
| `appointment_book` | Tạo lịch hẹn | +12 | intent |
| `appointment_complete` | Hoàn tất lịch hẹn (KH đi xem thật) | +25 | intent |
| `document_sent` | Sale gửi bảng giá / hợp đồng | +5 | engagement |
| `deposit` | KH đặt cọc | +35 | intent |
| `sign_contract` | KH ký hợp đồng | +50 | intent |
| `refuse_meeting` | KH từ chối hẹn gặp | −15 | intent |

### 4.3 Silent decay (time-based, cron mỗi giờ)

Per `ScoringConfig.decayDayN`, mỗi ngày không inbound trừ:

| Ngày silent | Δ/ngày | Cumulative |
|---|---|---|
| 3-7d | −1 | tối đa −5 |
| 7-14d | −3 | tối đa −21 |
| 14-30d | −5 | tối đa −80 |
| 30-60d | −8 | rất cold |

→ KH score 80 im lặng 21 ngày → 80 - 1×4 - 3×7 - 5×7 - 0 = **20**.

### 4.4 Profile (set 1 lần khi match)

Match Contact metadata → set sub-score Fit, không cộng dồn.

- `budget_match`: Contact.budget trong range project → fit +20
- `location_match`: Contact.province khớp project → fit +15
- `age_group_match`: 25-45 tuổi (đối tượng phổ biến BĐS) → fit +10

### 4.5 Velocity (compute weekly)

Cron hàng tuần đo trend:
- `3_days_inbound_streak`: 3 ngày liên tiếp inbound → velocity +20
- `score_up_5pts_week`: score tuần này > tuần trước ≥5 điểm → velocity +10
- `multiple_questions_burst`: ≥5 question marks trong 24h → velocity +15

### 4.6 Special signals (Phase 6 polish v2)

| Signal | Trigger | Δ | Dimension |
|---|---|---|---|
| `crm_tag_vip` | Sale gắn tag chứa "vip"/"tiềm năng cao"/"ưu tiên"/"hot lead"/"priority" | +8 | intent |
| `sale_note_long` | Sale viết note root >100 chars cho Contact | +5 | engagement |

→ KH lead VIP + sale chăm note kỹ tự push điểm cao tự động.

---

## 5. Tám Auto-Tag metadata

**Khác stage** (8 pipeline stages). Auto-tag là **metadata layer** áp dụng đồng thời.
1 Friend có thể có nhiều tag.

| Tag | Icon | Khi nào | Tính bằng |
|---|---|---|---|
| `active` | 🔥 | Inbound trong 24h qua | `lastInboundAt > NOW - 24h` |
| `cooling` | ❄️ | Im lặng 7-14d | `7 ≤ daysSilent < 15` |
| `cold` | 🧊 | Im lặng 15-30d hoặc 30-60d | `15 ≤ daysSilent < 60` |
| `frozen` | 🥶 | Im lặng 60d+ | `daysSilent ≥ 60` |
| `rewarmed` | 🔄 | Từ cold/frozen → có inbound trong 48h | cron history check |
| `stuck` | ⏰ | Bị `stuck-detection` flag | `stuckSince != null` |
| `ready` | 💯 | Score ≥ 80 | `leadScore ≥ 80` |
| `atrisk` | 🚧 | Score giảm >20 trong 7d | history compare |

Auto-tag compute 2 path:
- **Hot path**: tag-on-write trong score-engine + stuck-detection (cheap)
- **Cold path**: cron 7am daily recompute all (catch edge cases như `rewarmed`)

UI render auto-tag chip với badge **"AUTO"** + tonal color, read-only — sale không xoá được. Phase 6 polish v2: chip xuất hiện trong TagCrmBar đầu hàng trước CRM tag thường.

---

## 6. Tám Pipeline Stages + Auto-Promotion

8 stages BĐS pipeline, có thứ tự:

```
Mới → Tiếp cận → Hẹn gặp → Nóng → Tiềm năng → Chốt
                                              ↓
                                     Mất / Thất Bại (terminal)
```

**Bottleneck stages** (cần priority): Mới · Tiếp cận · Hẹn gặp. Sale dễ bỏ rơi ở đây.

### Auto-promote rules (default)

| From → To | Criteria | Manual confirm? |
|---|---|---|
| Mới → Tiếp cận | engagement ≥ 20 AND inboundCount ≥ 2 | ❌ tự động |
| Tiếp cận → Hẹn gặp | engagement ≥ 40 AND intent ≥ 30 AND có action `appointment_book` | ❌ tự động |
| Hẹn gặp → Nóng | Có action `appointment_complete` (KH đi xem thật) | ❌ tự động |
| Nóng → Tiềm năng | intent ≥ 70 AND daysInStage ≥ 5 | ✅ sale verify |
| Tiềm năng → Chốt | Có action `deposit` HOẶC `sign_contract` | ❌ tự động |

Auto-promote chạy mỗi khi score engine apply signals → fire-and-forget `evaluateAndPromote(friendId)`.

UI Settings cho phép enable/disable `autoPromote` toàn org.

---

## 7. Stuck Detection (Đình trệ)

Cron daily 6am scan: KH stay 1 stage quá threshold → flag `stuckSince`.

| Stage | Threshold | Extra decay/day | Alert label |
|---|---|---|---|
| Mới | 7 ngày | −2 | "Chưa được tiếp cận — cần liên hệ ngay" |
| Tiếp cận | 14 ngày | −1 | "KH chat ít — gửi video tour + brochure" |
| Hẹn gặp | 30 ngày | −2 | "Chưa đi xem — đề xuất gọi video / tour 360°" |
| Nóng | 21 ngày | −2 | "Chưa quyết — push ưu đãi tháng này" |
| Tiềm năng | 14 ngày | −3 | "KH do dự — gọi điện trực tiếp" |

Khi flag stuck:
1. Set `Friend.stuckSince = NOW`
2. Apply `extraDecayPerDay` mỗi ngày (KH stuck 5 ngày stage Tiềm năng → −3×5 = −15 thêm trên decay thường)
3. Add auto-tag `stuck` ⏰
4. Hiện trong Stuck Dashboard (`/leads/stuck`) — sale priority chăm
5. Suggest NBA template tương ứng

Khi KH inbound lại → auto-unstuck, clear `stuckSince`.

---

## 8. NBA — Next Best Action Templates

7 template Vietnamese default seed cho org mới. Mỗi template:
- `key`: unique identifier (`stuck_stage_new_greeting`, ...)
- `contentTemplate`: text với placeholders `{{customerName}}`, `{{projectName}}`, `{{promoMonth}}`, `{{viewingLink}}`, `{{callTime}}`
- `category`: `stuck` | `cold_reengage` | `hot_close` | `general`

VD template `stuck_stage_new_greeting`:
> *"Chào anh/chị {{customerName}}! Em là sale của dự án {{projectName}}. Tháng này dự án có ưu đãi đặc biệt: {{promoMonth}}. Anh/chị có muốn em gửi thông tin chi tiết không ạ?"*

**Phase 6 polish v2: "Gửi mẫu" actionable**
- ❌ Trước: button copy clipboard, sale phải mở chat paste manual
- ✅ Sau: `POST /api/v1/leads/stuck/send-template` — server resolve conversation, render variables qua `template-renderer.ts`, `formatMessage()` convert markdown → Zalo styles, send qua zalo-pool với throttle gate, log Activity

Sale 1 click → KH nhận tin ngay, không phải copy-paste.

Variables resolve từ `getOrgPromoContext(orgId)`:
- `orgName` ← `Organization.name`
- `projectName` ← "dự án" (TODO: bind `Org.promoSettings.currentProject` khi có table)
- `promoMonth` ← derived "ưu đãi tháng {M}/{Y}" từ NOW
- `customerName` ← `Contact.crmName || .fullName || Friend.zaloDisplayName || "Anh/chị"`

---

## 9. Friend → Contact Aggregate

Per-pair score lưu ở `Friend`. Sau mỗi update, trigger aggregate:

```
Contact.leadScore         = MAX(all Friend.leadScore của Contact đó)
Contact.statusId          = status có order cao nhất giữa Friend.statusRef
Contact.ownerFriendId     = Friend có score cao nhất + active 14d
Contact.aggregateBreakdown = breakdown của ownerFriend
Contact.autoTags          = UNION từ tất cả Friend.autoTags
Contact.stuckSinceAggregate = MIN(Friend.stuckSince) khi ALL Friend stuck
```

→ **Sale view dùng Friend score** (per-pair, chính xác từng nick). **Manager view dùng Contact score** (aggregate, KH level).

---

## 10. Decay Cron (silent score erosion)

Chạy mỗi 1 giờ, jittered 0-60s tránh thundering herd.

Logic per Friend:
1. Tính `daysSilent = NOW - lastInboundAt`
2. Lookup decay rate từ `ScoringConfig.decayDayN`
3. Apply ngày tương ứng: `Friend.scoreBreakdown.engagement -= rate`
4. Recompute `finalScore`
5. Log ActivityLog `score_change` với reason `decay_silent`

Default rates: -1/-3/-5/-8 cho 4 bucket (3-7/7-14/14-30/30-60d). Tunable.

---

## 11. Backfill Cron (Phase 6 polish v2)

**Vấn đề:** Phase 6 ship 16/05/2026. Friends tạo trước ngày này có `scoreUpdatedAt = null` → mở chat thấy điểm = 0 → sale mất tin.

**Giải:** `backfill-cron.ts` — tick mỗi 5 phút, mỗi tick:
1. Pick 100 friend `scoreUpdatedAt = null` AND `lastInboundAt > 90d ago`
2. Cho từng friend: load 50 inbound msg gần nhất → replay qua signal-detector → applySignalsToFriend
3. Stamp `scoreUpdatedAt = NOW` (tránh re-pick)
4. Khi không còn friend nào cần backfill → tự stop cron

Idempotent, resumable sau server restart. Scale 150,000 friend ÷ 100/tick × 5 phút = ~125 giờ done (5 ngày). Background, không ảnh hưởng hot path.

---

## 12. UI Touchpoints

### `/leads/stuck` — Stuck Dashboard

Group KH stuck theo stage. Mỗi card:
- Avatar + tên KH + auto-tag chips
- Score badge
- "Đình trệ X ngày · Tin nhắn cuối Y ngày trước"
- "💡 Gợi ý NBA" + button **"📤 Gửi mẫu"** (Phase 6 polish: gửi trực tiếp, không clipboard)
- "Mở chat" + "Snooze 3 ngày"

**Phase 6 polish v2: Search box** — filter client-side theo tên KH / SĐT / stage.

### `/friends` (FriendsView) — Friend list per-nick

Bảng có column **Score** (Phase 6 polish v2: **click header sort** desc → asc → off). Column **⚠ Stuck** click toggle sort theo `stuckSince`. Persist localStorage.

Column **🤖 Tag** render auto-tag chips + CRM tag.

### Chat (ChatContactPanel + MessageThread)

- Cột 3 header: score badge `⭐ 78`
- Cột 4 tab "Hồ sơ KH": ScoreInlinePanel (4 bar mini + breakdown click)
- TagCrmBar (input area): auto-tag chips read-only đầu hàng, CRM tag editable phía sau

Click score badge → mở `ScoreBreakdownModal`:
- 4 bar dimension + final score
- Trail 50 signal gần nhất (key, delta, dimension, timestamp)
- Score history timeline (Phase 6+ P1 sparkline 30d)

### `/settings/scoring` — Scoring Settings (admin/owner)

Form tunable:
- Weights 4 dimension (validate sum = 100)
- Decay rates 4 bucket
- Toggle `autoPromote`, `stuckDetectionEnabled`, `explainabilityEnabled`
- Edit Signal Rules table (delta, capPerDay, keywords, applicableStages)
- Edit Stage Transition Rules
- Edit Stuck Thresholds
- Edit NBA Templates
- Button **"Re-compute all scores"** (sau khi đổi weights)
- Button **"Seed defaults"** (idempotent reset)

---

## 13. API Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/scoring/config` | Get org-level config |
| PUT | `/api/v1/scoring/config` | Update weights/decay/flags (owner/admin) |
| GET | `/api/v1/scoring/rules` | List signal rules |
| PUT | `/api/v1/scoring/rules/:id` | Update 1 rule |
| GET | `/api/v1/scoring/stage-transitions` | List stage transition rules |
| GET | `/api/v1/scoring/stuck-thresholds` | List per-stage stuck thresholds |
| GET | `/api/v1/scoring/nba-templates` | List NBA templates |
| POST | `/api/v1/scoring/seed-defaults` | Trigger seed (idempotent) |
| GET | `/api/v1/friends/:id/score-breakdown` | Full breakdown for explainability UI |
| POST | `/api/v1/friends/:id/promote` | Manual promote stage |
| POST | `/api/v1/scoring/recompute-all` | Recompute final scores (sau khi đổi weights) |
| GET | `/api/v1/leads/stuck` | Stuck deals dashboard data |
| POST | `/api/v1/leads/stuck/scan` | Trigger stuck detection scan (admin) |
| POST | `/api/v1/leads/stuck/send-template` | **(Polish v2)** Gửi NBA template trực tiếp |

---

## 14. Files Map (codebase)

### Backend (`backend/src/modules/scoring/`)

| File | LOC | Purpose |
|---|---|---|
| `types.ts` | 215 | Type definitions (ScoreBreakdown, SignalRule, StageCriteria, AutoTagKey, ...) |
| `constants.ts` | 455 | Default seed data — 30+ signal rules, 5 stage transitions, 5 stuck thresholds, 7 NBA templates |
| `seed-defaults.ts` | 195 | `seedScoringDefaults(orgId)` — idempotent seed cho org mới |
| `config-cache.ts` | 143 | Cache `ScoringConfigSnapshot` per orgId, invalidate on update |
| `signal-detector.ts` | 226 | Detect signals từ text + actions + state |
| `score-engine.ts` | 298 | Core: `applySignalsToFriend()` — cap filter, weighted sum, persist |
| `scoring-hooks.ts` | ~320 | Fire-and-forget hooks: `onInbound/OutboundMessage`, `onAppointmentX`, `onCrmTagsAdded` (Polish v2), `onNoteAdded` (Polish v2) |
| `aggregate-contact.ts` | 212 | Friend → Contact aggregate (MAX score, UNION tags) |
| `decay-cron.ts` | 252 | Hourly silent decay |
| `stage-promotion.ts` | 376 | Auto-promote logic + manual promote endpoint |
| `stuck-detection.ts` | 201 | Daily 6am stuck scan, flag `stuckSince` + extra decay |
| `auto-tag.ts` | 228 | Compute 8 auto-tags từ state |
| `scoring-scheduler.ts` | 147 | Background scheduler: decay + stuck + auto-tag + **backfill** (Polish v2) |
| `backfill-cron.ts` | 166 | **(Polish v2)** Chunked replay 100 friend / 5 phút |
| `scoring-routes.ts` | ~600 | REST API endpoints |

### Frontend (`frontend/src/`)

| File | Purpose |
|---|---|
| `views/StuckLeadsView.vue` | Stuck Dashboard — group by stage, NBA template, **search box (Polish v2)**, **gửi trực tiếp (Polish v2)** |
| `views/ScoringSettingsView.vue` | Admin tunable form |
| `views/FriendsView.vue` | Friend list — **score column sort (Polish v2)** |
| `components/scoring/ScoreBreakdownModal.vue` | Modal 4 dimension + signal trail explainability |
| `components/scoring/ScoreHistoryModal.vue` | Timeline điểm theo thời gian |
| `components/scoring/ScoreInlinePanel.vue` | Inline 4 mini bar trong chat panel |
| `components/chat/TagCrmBar.vue` | Tag bar có **auto-tag chips (Polish v2)** + CRM tag |
| `components/chat/ChatContactPanel.vue` | Cột 3+4 chat — score badge |
| `components/friends/FriendsTable.vue` | Bảng friends — sortable Score/Stuck header (Polish v2) |
| `composables/use-scoring.ts` | API client |
| `composables/use-friends.ts` | Friends list state + sortBy (Polish v2) |

### Schema Prisma (`backend/prisma/schema.prisma`)

```prisma
model ScoringConfig {
  orgId               String   @id
  weightEngagement    Int      @default(35)
  weightIntent        Int      @default(30)
  weightFit           Int      @default(15)
  weightVelocity      Int      @default(20)
  decayDay3to7        Int      @default(1)
  decayDay7to14       Int      @default(3)
  decayDay14to30      Int      @default(5)
  decayDay30to60      Int      @default(8)
  autoPromote         Boolean  @default(true)
  stuckDetectionEnabled Boolean @default(true)
  explainabilityEnabled Boolean @default(true)
}

model Friend {
  ...
  leadScore        Int       @default(0)
  scoreBreakdown   Json?     // ScoreBreakdown
  scoreUpdatedAt   DateTime?
  autoTags         Json?     // AutoTagKey[]
  stuckSince       DateTime?
  stageEnteredAt   DateTime?
  statusId         String?   // FK to Status (stage)
  ...
}

model Contact {
  ...
  leadScore            Int       @default(0)  // = MAX of Friend.leadScore
  aggregateBreakdown   Json?
  autoTags             Json?     // UNION
  ownerFriendId        String?   // best Friend
  ...
}

model ScoreSignalRule { id, orgId, signalKey, dimension, ruleType, delta, capPerDay, capTotal, keywords[], label, applicableStages[], enabled }
model StageTransitionRule { id, orgId, fromStage, toStage, criteria: Json, requiresManualConfirm, enabled }
model StuckThreshold { id, orgId, stage, thresholdDays, extraDecayPerDay, nbaTemplateKey, alertLabel, enabled }
model NbaTemplate { id, orgId, key, label, contentTemplate, category, enabled }
```

---

## 15. Mental model nhanh

```
Sale gửi msg cho KH  ───→  no score change (chỉ track lastOutboundAt)
KH gửi msg cho sale  ───→  signal-detector(text)  ───→  list signals
                            └─→  score-engine.applySignals(friendId)
                                  ├─→  filter capPerDay
                                  ├─→  delta theo dimension
                                  ├─→  weighted sum → finalScore
                                  ├─→  persist Friend
                                  ├─→  log ActivityLog (explainability)
                                  ├─→  fire aggregate-contact (MAX)
                                  ├─→  fire evaluateAndPromote (auto stage)
                                  └─→  fire auto-tag recompute

App tick mỗi giờ ────→  decay-cron  ───→  giảm engagement theo silent days
App tick 6h sáng ────→  stuck-detection  ───→  flag stuckSince
App tick 7h sáng ────→  auto-tag recompute (cold path catch edge cases)
App tick 5 phút ─────→  backfill-cron  ───→  chunk 100 friend cũ
```

---

## 16. Tunable knobs (không cần code)

Admin/owner trong `/settings/scoring` chỉnh được:
1. Weights 4 dimension (sum = 100)
2. Decay rates 4 bucket
3. Mỗi signal rule: enable/disable, delta, capPerDay, keywords list, applicable stages filter
4. Mỗi stage transition: criteria thresholds, manual confirm flag
5. Mỗi stuck threshold: days, extraDecay, alertLabel
6. NBA templates: edit text + placeholders
7. Toggles: autoPromote, stuckDetection, explainability

→ Khi sale phàn nàn "điểm sai" hoặc "stuck quá nhiều" → vào Settings tune chứ KHÔNG sửa code.

---

## 17. Phase 6 polish v2 changelog (Phase 6 polish v2)

Ship 20/05/2026 trên branch `feat/phase-6-polish-v2` merged main.

**P0 close (sale visibility):**
- Sort theo Score header trong FriendsView (cycle desc → asc → off + Stuck toggle)
- Auto-tag chips render trong TagCrmBar chat input
- Race-safe try/catch P2002 trong zalo-labels CrmTag sync
- Auto-seed scoring defaults trong auth login hook

**P1 actionable (NBA + backfill):**
- `POST /leads/stuck/send-template` — gửi NBA trực tiếp qua Zalo SDK
- StuckLeadsView confirmSendTemplate() async API call
- Bug fix: `send-template-action.ts` thêm `formatMessage()` (markdown render)
- `backfill-cron.ts` — chunked replay 100 friend / 5 phút, lookback 90 ngày

**P2 quick wins:**
- CRM Tag VIP signal (+8 intent)
- Sale note >100 chars signal (+5 engagement)
- Search box trong Stuck Dashboard (filter client-side)

---

## 18. Roadmap còn lại

| Tier | Item | Status |
|---|---|---|
| P1 #4-8 | Snooze backend, sparkline, socket realtime, per-sale filter, manager/sale view | Nice-to-have, defer |
| P2 #1 | KPI Dashboard Conversion (~5h) | Recommend sau 1 tuần data |
| P2 #2-6 | Cohort, forecast, bulk, push notif, stage demotion, profile signals | Cần data đủ |
| **Phase 7 AI** | LLM intent classification, AI-generated NBA, forecast ML | **DEFER Q3 2026** sau 30+ closed deals |

---

## Phụ lục — Tài liệu liên quan

- Code: `backend/src/modules/scoring/`, `frontend/src/components/scoring/`, `frontend/src/views/ScoringSettingsView.vue`, `frontend/src/views/StuckLeadsView.vue`
- Schema: `backend/prisma/schema.prisma` (models ScoringConfig, ScoreSignalRule, StageTransitionRule, StuckThreshold, NbaTemplate)
- Activity log: `category: 'score'` filter trong ActivityLog để xem trail
- TODO local: `TODO.local.md` (P0/P1/P2/Phase 7 roadmap chi tiết)
