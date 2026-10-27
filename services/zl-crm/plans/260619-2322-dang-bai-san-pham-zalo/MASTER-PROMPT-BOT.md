# MASTER PROMPT — Dán cho Claude Code chạy trong repo BOT NỘI BỘ

> Dán toàn bộ phần dưới (từ dòng `---` trở xuống) vào Claude Code đang mở ở
> `/Users/man/Downloads/VS/BOT TONG HOP NOI BO`. CRM phía bên kia ĐÃ XONG và đang chạy
> production — phần này chỉ làm phía bot.

---

Bạn đang ở repo **BOT NỘI BỘ** (Express 5 + pg + node-cron, chạy PM2 cluster 4 worker trên host; chỉ `bot-postgres` trong Docker). Hãy xây **module "Đăng Bài"** để lên lịch đăng sản phẩm vào nhóm Zalo. Việc đăng thật do hệ **Zalo CRM** đảm nhận — bot chỉ quản lý danh sách + lịch rồi gọi API CRM khi tới giờ.

## Bối cảnh & phân vai
- Bot: chọn sản phẩm (bảng `products`, ảnh là URL HTTPS KiotViet trong cột `images` JSONB + `thumbnail`), soạn nội dung, chọn **1 nick Zalo + nhiều nhóm** (lấy từ CRM), đặt **lịch lặp định kỳ (cron)**. Tới giờ → gọi CRM broadcast.
- CRM: "máy đăng" — nhận `{accountId, groupIds[], content, imageUrls[]}` và đăng vào các nhóm Zalo, trả kết quả từng nhóm.

## HỢP ĐỒNG API CRM (đã chạy production — không sửa gì bên CRM)
Base: `http://localhost:3080` (bot trên host, CRM publish cổng 3080). Header bắt buộc: `x-api-key: <CRM_API_KEY>`.

1. `GET /api/public/zalo-accounts` → `{ accounts: [{ id, displayName, status, avatarUrl }] }` (chỉ chọn nick `status==='connected'`).
2. `GET /api/public/zalo-accounts/:accountId/groups` → `{ groups: [{ groupId, name, avatar, membersCount }] }`.
3. `POST /api/public/groups/broadcast`
   Body: `{ zaloAccountId, groupIds: string[], content?: string, imageUrls?: string[], externalRef?: string, source?: string }`
   → `200 { success, sent, failed, status: 'ok'|'partial'|'failed', results: [{ groupId, groupName, ok, error? }] }`
   Ràng buộc: ≤50 nhóm, ≤10 ảnh, ảnh phải **HTTPS công khai**, phải có `content` HOẶC ≥1 ảnh. CRM tự giãn nhịp ~7s/nhóm.
   `externalRef` nên truyền `jobId:runId` để đối chiếu log bên CRM.

`CRM_API_KEY` (đặt trong `.env` bot, KHÔNG hardcode): `zcrm_<API_KEY_CỦA_BẠN>`

## CÔNG VIỆC PHÍA BOT

### 1. DB migration (BẮT BUỘC đúng số)
- Migration mới nhất hiện tại là **119** (`migrations/119_drop_dangbai_tables.sql` — đã DROP một module đăng bài cũ dùng LDPlayer). Tạo file **`migrations/120_zalo_post_jobs.sql`**.
- **KHÔNG** tự `INSERT INTO schema_migrations` trong file SQL — `backend/runMigrations.js` tự ghi.
- Dùng **tên bảng mới** tránh đụng code đã drop: `zalo_post_jobs`, `zalo_post_job_runs`.
```sql
CREATE TABLE IF NOT EXISTS zalo_post_jobs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  product_ids INTEGER[] DEFAULT '{}',
  crm_account_id VARCHAR(64) NOT NULL,
  crm_account_name VARCHAR(255),
  crm_group_ids TEXT[] NOT NULL DEFAULT '{}',
  crm_group_names JSONB DEFAULT '[]',
  content TEXT,
  image_urls JSONB DEFAULT '[]',
  cron_expr VARCHAR(120) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_status VARCHAR(20),
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS zalo_post_job_runs (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES zalo_post_jobs(id) ON DELETE CASCADE,
  ran_at TIMESTAMPTZ DEFAULT now(),
  trigger VARCHAR(20) DEFAULT 'cron',
  status VARCHAR(20),
  results JSONB DEFAULT '[]',
  sent INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_zpj_enabled ON zalo_post_jobs(enabled);
CREATE INDEX IF NOT EXISTS idx_zpjr_job ON zalo_post_job_runs(job_id, ran_at DESC);
```

### 2. Backend route — `backend/routes/dang-bai-zalo.js` (file mới)
- Mount trong `backend/server.js`: `app.use('/api/dang-bai', requireLogin, dangBaiZaloRouter)` (theo đúng cách mọi route nội bộ mount với `requireLogin`; thêm `requirePermission('dangbai-tool', …)` nếu hệ phân quyền yêu cầu).
- Dùng **axios** (chuẩn codebase) cho mọi call ra CRM; đọc `CRM_BASE_URL`, `CRM_API_KEY` từ `process.env`.
- Endpoints:
  - `GET /api/dang-bai/jobs`, `POST /api/dang-bai/jobs`, `PUT /api/dang-bai/jobs/:id`, `DELETE /api/dang-bai/jobs/:id`
  - `POST /api/dang-bai/jobs/:id/run` (đăng ngay, trigger='manual'), `POST /api/dang-bai/jobs/:id/toggle`
  - `GET /api/dang-bai/jobs/:id/runs` (lịch sử)
  - Proxy (giữ key server-side): `GET /api/dang-bai/crm/accounts`, `GET /api/dang-bai/crm/accounts/:id/groups`
- Khi tạo job: nhận `product_ids` → query `products` (name, sell_price, description, images/thumbnail) → soạn `content` mặc định + gom `image_urls` (cho user sửa/preview ở UI). Lưu snapshot tên nick + tên nhóm để hiển thị.
- Hàm `runJob(job, trigger)` (export để cả route "đăng ngay" lẫn scheduler dùng): POST CRM broadcast `{zaloAccountId: crm_account_id, groupIds: crm_group_ids, content, imageUrls: image_urls, externalRef: \`${job.id}\`, source:'bot'}` → ghi `zalo_post_job_runs` + cập nhật `last_run_at/last_status`.

### 3. Scheduler — `backend/services/dang-bai-zalo-scheduler.js` (file mới)
- **BẮT BUỘC** chỉ chạy ở primary worker: bọc trong `if (IS_PRIMARY)` (`process.env.NODE_APP_INSTANCE === '0'`) — y như các cron sẵn có trong `server.js`. PM2 cluster 4 worker, không guard sẽ đăng **4 lần**.
- Theo **pattern `backend/services/reportScheduler.js`** (đọc file đó trước để bắt chước): mỗi job `enabled` → `cron.schedule(job.cron_expr, () => runJob(job,'cron'))` (validate `cron.validate()`); giữ map `jobId → task`, `task.stop()` + đăng ký lại khi job sửa/bật/tắt/xoá. KHÔNG poll mỗi phút, KHÔNG cần thêm `cron-parser`.
- Cron theo **giờ VN** — chuẩn hoá rõ trong UI (server có thể UTC).

### 4. Frontend — `frontend/modules/dang-bai-zalo.js` (file mới)
- Tận dụng tile "Đăng Bài" sẵn có: `modules/dangbai-tool/` (slug `dangbai-tool`, đang là placeholder).
- **BẮT BUỘC sửa `frontend/app.js`**: thêm entry vào `MODULE_REGISTRY` (vd `'dangbai-tool': { file: '/modules/dang-bai-zalo.js', init: 'initDangBaiZalo' }`). Không có entry → bấm tile không load gì. (Đây là ngoại lệ hợp lệ của quy tắc "chỉ mở file module" — app.js là router phải đụng để đăng ký.)
- Giao diện:
  - Bảng danh sách job: tên, nick, số nhóm, lịch, trạng thái lần chạy cuối; nút bật/tắt, đăng ngay, sửa, xoá, xem log.
  - Form thêm/sửa: chọn sản phẩm (preview content tự soạn + ảnh, cho sửa) → chọn nick (dropdown `/api/dang-bai/crm/accounts`, chỉ connected) → chọn **nhiều nhóm** (multiselect `/api/dang-bai/crm/accounts/:id/groups`) → đặt lịch (UI sinh `cron_expr`: hàng ngày giờ X / hàng tuần thứ Y / cron tuỳ chỉnh).
  - Log: bảng `zalo_post_job_runs`, hiện kết quả per-group (nhóm nào OK/lỗi + lý do).

### 5. `.env` bot (thêm)
```
CRM_BASE_URL=http://localhost:3080
CRM_API_KEY=zcrm_<API_KEY_CỦA_BẠN>
```

## QUY TẮC AN TOÀN (theo CLAUDE.md của bot)
- TRƯỚC khi sửa file: backup + đếm functions; SAU khi sửa: đếm lại ≥ số cũ.
- KHÔNG sửa migration cũ — chỉ tạo file 120 mới. KHÔNG ghi đè file > 200 dòng.
- Trước khi xây: kiểm tra sạch tham chiếu module dang-bai cũ đã drop ở migration 119 (grep `post_jobs`, `dang-bai.js` cũ) để không đụng.
- Syntax check: `node --check <file>` cho mọi file JS sửa.
- Deploy: chạy migration (`node backend/runMigrations.js` hoặc cơ chế sẵn có) → `pm2 reload bot-noi-bo` → `pm2 logs bot-noi-bo --lines 20 --nostream | grep -E "Error|FATAL"`.
- Verify trước khi báo xong: tạo 1 job test, bấm "đăng ngay" tới 1 nhóm test, kiểm tra bài+ảnh lên nhóm Zalo + log per-group, và xem CRM tab "Đăng nhóm" có ghi nhận.

## KIỂM THỬ
- Test route CRUD + `runJob` (mock axios CRM) + proxy.
- E2E thủ công như mục Verify ở trên.

Bắt đầu bằng việc đọc `backend/server.js` (cách mount route + IS_PRIMARY + khởi động cron), `backend/services/reportScheduler.js` (pattern cron), `backend/runMigrations.js` (cách ghi schema_migrations), `frontend/app.js` (MODULE_REGISTRY), và 1 module mẫu (vd `frontend/modules/hang-hoa.js` + route hàng hoá) để theo đúng convention. Sau đó hãy brainstorm nhanh rồi triển khai.
