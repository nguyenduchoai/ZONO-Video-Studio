# Thiết kế: Đăng bài sản phẩm tự động vào nhóm Zalo (Bot nội bộ → CRM)

> Ngày: 2026-06-19 · Trạng thái: Spec chờ duyệt
> Phạm vi: 2 repo — **BOT NỘI BỘ** (`/Users/man/Downloads/VS/BOT TONG HOP NOI BO`) và **Zalo CRM** (`/Users/man/Downloads/VS/Zalo CRM`).

## 0. SỬA PHẠM VI (chốt 2026-06-19)

- **Chỉ CODE phía CRM** trong session này. Bot nội bộ có vòng dev local→test→VPS riêng → không code chen vào (tránh lệch local/VPS). Phần bot §5 chỉ còn là **đặc tả để sinh MASTER PROMPT** (bạn dán cho Claude Code chạy trong repo bot tự dựng module "Đăng Bài").
- **Bổ sung CRM**: lưu **log mỗi lần bot bắn bài qua** (per-group ok/lỗi) + **tab "Nhật ký đăng bài"** trên giao diện CRM để soi lỗi (nhóm nào fail, vì sao). Xem §4.5 + §4.6.

## 1. Mục tiêu

Cho phép nhân viên ở **app bot nội bộ** tạo một **danh sách bài đăng theo lịch** (module "Đăng Bài"): chọn sản phẩm → bot soạn sẵn nội dung + ảnh, chọn **1 tài khoản Zalo (nick) + nhiều nhóm** của CRM, đặt **lịch lặp định kỳ**. Khi tới giờ, bot gọi API CRM để CRM **đăng bài + ảnh vào các nhóm Zalo đã chọn**.

Phân vai:
- **Bot nội bộ** sở hữu: dữ liệu sản phẩm (bảng `products`, ảnh là URL HTTPS KiotViet CDN), module UI "Đăng Bài", danh sách job, bộ lập lịch (`node-cron`), soạn nội dung bài.
- **CRM** sở hữu: tài khoản Zalo + danh sách nhóm, hành vi **đăng thật** vào Zalo (qua `zca-js`). CRM là "máy đăng" thuần — nhận payload đã sẵn sàng, **không sửa nội dung**.

## 2. Quyết định đã chốt (từ brainstorming)

| Vấn đề | Quyết định |
|---|---|
| Phạm vi | Làm cả 2 phía: CRM + bot nội bộ |
| Chuyển ảnh | Bot cung cấp **URL ảnh HTTPS công khai** (KiotViet CDN) → CRM tải về đăng. Đã xác minh qua được SSRF guard (HTTPS). |
| Phạm vi đăng | **1 tài khoản + nhiều nhóm** mỗi job |
| Kiểu lịch | **Lặp định kỳ** (cron), không có hẹn-1-lần |
| Mô hình nội dung | Bot có module "Đăng Bài", user thêm mục vào danh sách; bot soạn full nội dung |
| Caption | Bot soạn đầy đủ (tên + giá + mô tả + ảnh); **CRM đăng nguyên văn, không sửa** |
| Hướng tiếp cận | **A — endpoint broadcast chuyên dụng** ở CRM (giãn nhịp server-side, trả per-group) |

## 3. Kiến trúc & luồng dữ liệu

```
┌─ BOT NỘI BỘ (Express 5 + pg + node-cron) ─┐        ┌─ ZALO CRM (Fastify) ─┐
│ Module "Đăng Bài"                          │        │ Public API (API-key)  │
│                                            │        │                       │
│ 1. User thêm job vào danh sách:            │        │                       │
│    - chọn SP  → soạn content + image_urls  │  GET   │ /api/public/          │
│    - chọn account + nhiều nhóm  ───────────┼───────►│   zalo-accounts       │
│      (dropdown lấy từ CRM, qua proxy bot)  │  GET   │ /.../:id/groups       │
│    - đặt cron_expr                         │        │                       │
│                                            │        │                       │
│ 2. node-cron quét job tới hạn ─── POST ────┼───────►│ /api/public/groups/   │
│    {accountId, groupIds[],                 │        │   broadcast           │
│     content, imageUrls[]}                  │        │  → đăng từng nhóm      │
│                                            │        │    (giãn nhịp) qua     │
│ 3. Ghi log per-group  ◄────────────────────┼────────┤    zca-js → per-group │
└────────────────────────────────────────────┘        └───────────────────────┘
```

Auth: bot → CRM dùng **API key** `zcrm_...` (đã tạo cho org Kim Mỹ), lưu server-side trong bot (`.env`), gọi qua backend bot (proxy) để **không lộ key ra browser**.

## 4. Phía CRM — chi tiết (repo Zalo CRM)

File: `backend/src/modules/api/public-api-routes.ts` (đã có `apiKeyAuth` preHandler — tái dùng).

### 4.1 `GET /api/public/zalo-accounts`
Liệt kê nick để bot cho chọn "tài khoản đăng".
- Query: `prisma.zaloAccount.findMany({ where: { orgId, archivedAt: null }, select: { id, displayName, status, avatarUrl } })`.
- Response: `{ accounts: [{ id, displayName, status, avatarUrl }] }`.
- Không lọc `status` (trả cả connected/disconnected) để UI hiển thị trạng thái; bot/khuyến nghị chỉ cho chọn `connected`.

### 4.2 `GET /api/public/zalo-accounts/:accountId/groups`
Liệt kê nhóm của 1 nick để bot cho chọn nhóm.
- Verify account thuộc org (404 nếu không).
- Query: `prisma.conversation.findMany({ where: { orgId, zaloAccountId, threadType: 'group' }, select: { externalThreadId, groupName, groupAvatarUrl, groupMembersCount }, orderBy: { lastMessageAt: 'desc' } })`.
- Response: `{ groups: [{ groupId: externalThreadId, name: groupName, avatar: groupAvatarUrl, membersCount }] }`.
- Lưu ý: nguồn nhóm là các Conversation `threadType='group'` CRM đã đồng bộ. Nếu nick có nhóm mới chưa sync → không hiện. (Mục Rủi ro §8.)

### 4.3 `POST /api/public/groups/broadcast`
Đăng 1 bài (content + ảnh) vào **nhiều nhóm** của **1 nick**.
- Body: `{ zaloAccountId, groupIds: string[], content?: string, imageUrls?: string[] }`.
- Validate: `zaloAccountId` + `groupIds` (≥1) bắt buộc; phải có `content` HOẶC ≥1 ảnh; `groupIds.length ≤ 50`; `imageUrls.length ≤ 10`.
- Verify account thuộc org + `status='connected'` + có trong pool (giống `messages/send`).
- Với mỗi `groupId` (tuần tự, **giãn nhịp** `BROADCAST_GROUP_DELAY_MS`, mặc định 7000ms, env-config):
  - Tải ảnh (tái dùng `downloadImage` đã có: HTTPS-only, type/size guard) → tmp.
  - `api.sendMessage({ msg: content ?? '', attachments: tmpPaths }, groupId, /*threadType group*/ 1)` (hoặc text-only nếu không ảnh).
  - Thu kết quả `{ groupId, ok: true }` hoặc `{ groupId, ok: false, error }` — **không dừng cả lô khi 1 nhóm lỗi**.
  - Cleanup tmp sau mỗi nhóm (hoặc cuối cùng).
- Response: `{ success: true, results: [{ groupId, ok, error? }], sent, failed }` (HTTP 200 kể cả khi vài nhóm lỗi; 4xx chỉ khi sai input/account).
- Tái dùng tối đa code `messages/send`: tách helper `sendToThread(api, threadId, threadType, content, imageUrls)` để cả `messages/send` (group/user đơn) lẫn `broadcast` (nhiều nhóm) dùng chung → tránh trùng logic tải ảnh.

### 4.4 Rate limit / chống khóa nick
- `broadcast` **không** áp daily limit (đồng nhất chủ trương đã chốt: gửi không giới hạn ngày).
- Giãn nhịp giữa nhóm (`BROADCAST_GROUP_DELAY_MS`) là cơ chế chính giảm rủi ro khóa nick khi đăng loạt.
- Burst guard CRM (`ZALO_MSG_BURST`) vẫn còn cho đường `messages/send`; broadcast tự giãn nhịp nên không trip.

### 4.5 Lưu log bài đăng (CRM) — model `GroupPostLog`
Mỗi lần `broadcast` chạy → ghi 1 row để CRM có nhật ký soi lỗi.
- Prisma model + migration (bảng mới `group_post_logs`):
  `id, orgId, zaloAccountId, accountName(snapshot), content, imageUrls(Json), groupResults(Json: [{groupId, groupName, ok, error, zaloMsgId}]), sentCount, failedCount, status('ok'|'partial'|'failed'), source(default 'bot'), externalRef(String? — id job/run bot gửi kèm để đối chiếu), createdAt`.
  `@@index([orgId, createdAt])`, `@@index([orgId, zaloAccountId, createdAt])`.
- Broadcast endpoint: sau khi đăng xong các nhóm → tính `sent/failed/status` → `prisma.groupPostLog.create(...)`. Group name lấy từ Conversation (join nhanh theo externalThreadId) để log dễ đọc.
- Body broadcast nhận thêm optional `externalRef` (bot truyền `jobId/runId`).

### 4.6 Tab "Nhật ký đăng bài" (frontend CRM)
- **API đọc** (JWT, không phải public): `GET /api/v1/group-post-logs?accountId&status&page&limit` → `{ logs, total }`. Đặt trong module phù hợp (vd `zalo-dashboard-routes` hoặc route mới `group-post-log-routes.ts`, register qua plugin).
- **Nav**: thêm tab vào `primaryTabs` (DefaultLayout.vue): `{ path: '/group-posts', label: 'Đăng nhóm', icon: '📢' }`.
- **Route**: `/group-posts` → `views/GroupPostsView.vue` (lazy).
- **View**: bảng log — thời gian, nick, số nhóm, preview nội dung, #ảnh, kết quả (✓ sent / ✗ failed badge), `source`, `externalRef`. Click 1 dòng → mở chi tiết **per-group** (nhóm nào OK, nhóm nào lỗi + thông báo lỗi). Filter theo nick + trạng thái + ngày, phân trang.
- API client: thêm hàm trong `frontend/src/api` + store/composable nhẹ (theo pattern hiện có).

## 5. Phía Bot — ĐẶC TẢ ĐỂ SINH MASTER PROMPT (KHÔNG code trong session này)

> Phần dưới mô tả những gì module "Đăng Bài" bên bot cần làm. Sẽ được đóng gói thành **master prompt** để Claude Code chạy trong repo bot tự dựng (theo vòng dev local→test→VPS của bot). CRM chỉ cung cấp hợp đồng API ở §4 + §6.

Stack: Express 5 + pg + node-cron, chạy bằng **PM2 cluster (4 worker)** trên host (KHÔNG trong Docker; chỉ `bot-postgres` trong Docker). Pattern module: `modules/<tool>/config.json` (đăng ký tool) + `frontend/modules/<tool>.js` (UI, phải khai báo trong `frontend/app.js` MODULE_REGISTRY) + `backend/routes/<tool>.js` (API, mount qua `requireLogin`). DB: `botniobo` (container `bot-postgres`).

> **Đã sửa theo review (đối chiếu code thật):**
> - Migration baseline thực tế là **119** (thư mục `./migrations/` repo-root), KHÔNG phải 040 như CLAUDE.md ghi (stale). File mới phải là **`120_zalo_post_jobs.sql`**.
> - **Tiền lệ**: `119_drop_dangbai_tables.sql` đã DROP một module đăng bài cũ (dùng LDPlayer local-agent, bảng `post_jobs`, `frontend/modules/dang-bai.js`, `backend/routes/dang-bai.js`). Cách mới (CRM đăng qua zca-js) là bản sửa đúng. → Dùng **tên file/bảng mới** tránh đụng code đã drop: route `dang-bai-zalo.js`, JS `dang-bai-zalo.js`, bảng `zalo_post_jobs`. Xác nhận không còn tham chiếu cũ trước khi build.

### 5.1 DB migration 120 (file mới, KHÔNG sửa migration cũ)
> Runner `backend/runMigrations.js` tự ghi `schema_migrations` (version = `file.split('_')[0]`) → **KHÔNG** tự `INSERT INTO schema_migrations` trong file SQL (gây double-insert + sai version).
```sql
-- 120_zalo_post_jobs.sql
CREATE TABLE IF NOT EXISTS zalo_post_jobs (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255),                 -- nhãn job (tự gợi ý từ tên SP)
  product_ids     INTEGER[] DEFAULT '{}',       -- SP nguồn (để soạn lại content khi sửa)
  crm_account_id  VARCHAR(64) NOT NULL,         -- zaloAccountId bên CRM
  crm_account_name VARCHAR(255),                -- snapshot tên nick (hiển thị)
  crm_group_ids   TEXT[] NOT NULL DEFAULT '{}', -- externalThreadId các nhóm
  crm_group_names JSONB DEFAULT '[]',           -- snapshot tên nhóm (hiển thị)
  content         TEXT,                         -- nội dung đã soạn (bot gửi nguyên văn)
  image_urls      JSONB DEFAULT '[]',           -- URL ảnh HTTPS
  cron_expr       VARCHAR(120) NOT NULL,        -- lịch lặp (node-cron 5-field)
  enabled         BOOLEAN DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  last_status     VARCHAR(20),                  -- ok | partial | failed
  next_run_at     TIMESTAMPTZ,
  created_by      INTEGER,                      -- nhân viên tạo
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zalo_post_job_runs (
  id          SERIAL PRIMARY KEY,
  job_id      INTEGER REFERENCES zalo_post_jobs(id) ON DELETE CASCADE,
  ran_at      TIMESTAMPTZ DEFAULT now(),
  trigger     VARCHAR(20) DEFAULT 'cron',       -- cron | manual
  status      VARCHAR(20),                       -- ok | partial | failed
  results     JSONB DEFAULT '[]',                -- [{groupId, groupName, ok, error}]
  sent        INTEGER DEFAULT 0,
  failed      INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_zpj_enabled ON zalo_post_jobs(enabled);
CREATE INDEX IF NOT EXISTS idx_zpjr_job ON zalo_post_job_runs(job_id, ran_at DESC);
-- KHÔNG INSERT schema_migrations ở đây — runMigrations.js tự ghi.
```

### 5.2 Backend route (`backend/routes/dang-bai-zalo.js` — file mới)
Router Express, mount: `app.use('/api/dang-bai', requireLogin, dangBaiZaloRouter)` (session-based như mọi route nội bộ; dùng `requirePermission('dangbai-tool', …)` per-route). **API key CRM chỉ dùng cho gọi RA CRM (outbound proxy), KHÔNG để auth route của bot.** Endpoint:
- `GET  /api/dang-bai/jobs` — danh sách job + last run.
- `POST /api/dang-bai/jobs` — tạo job (body: name, product_ids, crm_account_id, crm_group_ids, content, image_urls, cron_expr).
- `PUT  /api/dang-bai/jobs/:id` — sửa.
- `DELETE /api/dang-bai/jobs/:id` — xoá.
- `POST /api/dang-bai/jobs/:id/run` — **đăng ngay** (trigger='manual').
- `POST /api/dang-bai/jobs/:id/toggle` — bật/tắt.
- `GET  /api/dang-bai/jobs/:id/runs` — lịch sử chạy.
- **Proxy CRM** (giữ key server-side):
  - `GET /api/dang-bai/crm/accounts` → gọi CRM `GET /api/public/zalo-accounts`.
  - `GET /api/dang-bai/crm/accounts/:id/groups` → gọi CRM `GET /api/public/zalo-accounts/:id/groups`.
  - HTTP client: dùng **axios** (chuẩn của codebase bot), không dùng fetch.
- Cấu hình CRM trong `.env` bot: `CRM_BASE_URL=http://localhost:3080` (bot chạy PM2 trên host, CRM publish `3080:3000` → gọi host-port OK), `CRM_API_KEY=zcrm_...`.
  - Lưu ý: ảnh đi qua **broadcast** dạng `imageUrls` (URL HTTPS công khai KiotViet), không phụ thuộc CRM_BASE_URL.

### 5.3 Bộ lập lịch (`backend/services/dang-bai-zalo-scheduler.js` — file mới)
Theo **đúng pattern `reportScheduler.js` sẵn có** (không thêm dep `cron-parser`, không poll mỗi phút):
- **Bọc khởi động trong `IS_PRIMARY`** (`NODE_APP_INSTANCE === '0'`) — BẮT BUỘC: PM2 cluster 4 worker, nếu không guard sẽ đăng **4 lần**. Mutex theo job_id chỉ in-process, không chặn được cross-worker.
- Khi start: load mọi job `enabled=true`, mỗi job `cron.schedule(cron_expr, () => runJob(job))` (validate bằng `cron.validate()`); giữ map `jobId → task` để `task.stop()`/đăng ký lại khi job được sửa/bật/tắt/xoá.
- `runJob(job)`: POST CRM `broadcast` `{zaloAccountId, groupIds, content, imageUrls}` → ghi `zalo_post_job_runs` + cập nhật `last_run_at/last_status`. (`next_run_at` chỉ để hiển thị, có thể tính lười bằng tiện ích nhỏ hoặc bỏ.)
- Lỗi gọi CRM → ghi run `failed`; lần cron kế tiếp tự chạy lại (không retry dồn).

### 5.4 Frontend (`frontend/modules/dang-bai-zalo.js` + `modules/dangbai-tool/`)
- Tận dụng tool "Đăng Bài" (`modules/dangbai-tool/config.json`, slug `dangbai-tool`) đang là placeholder → wire vào module thật.
- **BẮT BUỘC sửa `frontend/app.js`**: thêm entry vào `MODULE_REGISTRY` (vd `'dangbai-tool': { file: '/modules/dang-bai-zalo.js', init: 'initDangBaiZalo' }`) — nếu không, bấm tile sidebar không load gì. (Đây là ngoại lệ hợp lệ với quy tắc "chỉ mở file module": app.js là router bắt buộc phải đụng để đăng ký module mới.)
- Màn chính: bảng danh sách job (tên, nick, số nhóm, lịch, trạng thái lần chạy cuối, nút bật/tắt, đăng ngay, sửa, xoá, xem log).
- Form thêm/sửa job:
  1. Chọn sản phẩm (từ module hàng hoá) → preview content tự soạn (tên + giá + mô tả) + ảnh (từ `products.images`); cho sửa content.
  2. Chọn tài khoản (dropdown từ `GET /api/dang-bai/crm/accounts`).
  3. Chọn nhiều nhóm (multiselect từ `GET /api/dang-bai/crm/accounts/:id/groups`).
  4. Đặt lịch lặp (UI thân thiện → sinh `cron_expr`: hàng ngày giờ X / hàng tuần thứ Y giờ X / cron tuỳ chỉnh).
- Xem log: bảng `zalo_post_job_runs` với kết quả per-group.

## 6. Hợp đồng API (contract tóm tắt)

CRM broadcast (bot gọi):
```http
POST /api/public/groups/broadcast
x-api-key: zcrm_...
{ "zaloAccountId":"66c4...", "groupIds":["123","456"],
  "content":"Hộp Trang Sức 3 Tầng Sunmi\nGiá: 150.000đ\n...",
  "imageUrls":["https://cdn2-retail-images.kiotviet.vn/.../a.jpg"] }
→ 200 { "success":true, "sent":2, "failed":0,
        "results":[{"groupId":"123","ok":true},{"groupId":"456","ok":true}] }
```

## 7. Xử lý lỗi & ràng buộc

- CRM broadcast: 1 nhóm lỗi (vd nhết là member, ảnh tải fail) → ghi `ok:false` nhóm đó, tiếp tục nhóm khác; HTTP vẫn 200.
- Nick `disconnected` lúc chạy → CRM trả 422; bot ghi run `failed`, giữ job để lần sau.
- Ảnh URL chết / không HTTPS → nhóm đó lỗi (báo trong results), không vỡ cả job.
- Bot cron lỗi mạng tới CRM → run `failed`, retry lần lịch kế tiếp (không retry dồn).
- Idempotency: chấp nhận "at-most-once mỗi mốc lịch" (mutex job + next_run_at). Không chống trùng nếu user bấm "đăng ngay" nhiều lần (có cảnh báo UI).

## 8. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| **PM2 cluster đăng 4 lần** (4 worker đều chạy cron) | **BẮT BUỘC** guard scheduler bằng `IS_PRIMARY` (`NODE_APP_INSTANCE==='0'`) — như mọi cron sẵn có (server.js) |
| Khóa nick do đăng loạt nhiều nhóm | Giãn nhịp `BROADCAST_GROUP_DELAY_MS` (mặc định 7s); khuyến nghị user chia nhỏ số nhóm/job, giãn lịch |
| Nhóm mới chưa sync → không hiện trong dropdown | Nút "đồng bộ nhóm" (gọi sync nhóm CRM) hoặc nhập groupId thủ công (v2) |
| API key lộ | Key chỉ ở backend bot (`.env`), proxy; không xuống browser |
| Spam nội dung trùng → Zalo cờ spam | Trách nhiệm nội dung thuộc người dùng; có thể thêm xoay ảnh/nội dung (v2) |
| Lệch giờ cron (server UTC vs VN) | Chuẩn hoá: lưu cron theo giờ VN, quy đổi rõ trong UI |

## 9. Phạm vi loại trừ (YAGNI / để v2)

- Không làm đăng-1-lần (chỉ lặp định kỳ — đã chốt).
- Không gộp nhiều SP trong 1 bài ở v1 (mỗi job 1 nội dung; có thể nhiều ảnh).
- Không nhiều tài khoản/job ở v1 (1 nick/job — đã chốt).
- Không xoay nội dung/ảnh tự động chống spam (v2).
- Không gửi video/file (chỉ text + ảnh).

## 10. Kiểm thử

CRM:
- Unit/integration cho 3 endpoint: liệt kê accounts/groups (mock prisma), broadcast happy-path + 1 nhóm lỗi + account disconnected + sai input. Theo mẫu `tests/chat-operations-routes.test.ts` (mockIO/mockPrisma).
Bot:
- Test route CRUD job + cron tick (mock thời gian/next_run + mock CRM call) + proxy.
Thủ công (E2E): tạo job test → "đăng ngay" tới 1 nhóm test → kiểm tra bài + ảnh lên nhóm Zalo + log per-group.

## 11. Thứ tự triển khai (cho writing-plans)

1. CRM: helper `sendToThread` (refactor `messages/send`, giữ caps `imageUrls≤10` + SSRF per-URL) + 3 endpoint public + test (mẫu `chat-operations-routes.test.ts`).
2. CRM: deploy (rebuild image) + tạo nhóm test, verify broadcast bằng key thật.
3. Bot: kiểm tra sạch tham chiếu module dang-bai cũ (đã drop ở 119) → migration **120** + route `dang-bai-zalo.js` (mount `requireLogin`) + proxy (axios) + scheduler (`IS_PRIMARY` + cron.schedule-per-job) + đăng ký vào `server.js`.
4. Bot: frontend `dang-bai-zalo.js` + **thêm entry vào `app.js` MODULE_REGISTRY** (form + danh sách + log).
5. E2E (đăng ngay → nhóm test) + tài liệu hướng dẫn nội bộ.
