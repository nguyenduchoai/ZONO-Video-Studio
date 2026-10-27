-- Chào hàng (2026-06-22)
-- Job chào hàng do BOT nội bộ bắn sang public API; CRM gửi ảnh chào hàng theo tier
-- khách qua 1 nick cố định (chạy nền, throttle), callback kết quả về BOT.
-- 2 bảng: chaohang_jobs (1 row/job, idempotent theo (org_id, bot_job_id)) +
-- chaohang_results (1 row/khách trong job, unique (job_id, customer_id)).

-- chaohang_jobs
CREATE TABLE "chaohang_jobs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "bot_job_id" INTEGER NOT NULL,
    "po_code" TEXT,
    "bot_base_url" TEXT NOT NULL,
    "internal_key" TEXT NOT NULL,
    "zalo_account_id" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "products" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'running',
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "last_callback_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chaohang_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chaohang_jobs_org_id_bot_job_id_key" ON "chaohang_jobs" ("org_id", "bot_job_id");
CREATE INDEX "chaohang_jobs_org_id_created_at_idx" ON "chaohang_jobs" ("org_id", "created_at" DESC);

-- chaohang_results
CREATE TABLE "chaohang_results" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "tier" TEXT,
    "uid_used" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "images_count" INTEGER NOT NULL DEFAULT 0,
    "uid_lookup_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chaohang_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chaohang_results_job_id_customer_id_key" ON "chaohang_results" ("job_id", "customer_id");
CREATE INDEX "chaohang_results_job_id_idx" ON "chaohang_results" ("job_id");

ALTER TABLE "chaohang_results" ADD CONSTRAINT "chaohang_results_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "chaohang_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
