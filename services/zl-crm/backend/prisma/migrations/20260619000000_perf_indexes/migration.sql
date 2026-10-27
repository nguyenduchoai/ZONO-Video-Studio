-- Perf indexes (2026-06-19)
-- Tăng tốc các truy vấn nóng được phát hiện trong audit hiệu năng:
--   1. Dashboard KPI + message volume: COUNT/aggregate messages theo khoảng sent_at
--      (không có conversation prefix) → trước đây seq-scan toàn bảng messages.
--   2. Analytics (response-time, team-performance): filter daily_message_stats theo
--      org_id + stat_date; @@unique([userId,...]) không phục vụ được → seq-scan.
--   3. Filter tag/label trên list chat & contact: JSONB @> containment không dùng
--      được b-tree → cần GIN.

-- 1 + 2 — b-tree (khớp tên Prisma default để tránh drift với schema)
CREATE INDEX IF NOT EXISTS "messages_sent_at_idx" ON "messages" ("sent_at");
CREATE INDEX IF NOT EXISTS "daily_message_stats_org_id_stat_date_idx" ON "daily_message_stats" ("org_id", "stat_date");

-- 3 — GIN cho JSONB tag/label containment filter (quản lý ngoài schema Prisma)
CREATE INDEX IF NOT EXISTS "contacts_tags_gin_idx" ON "contacts" USING GIN ("tags");
CREATE INDEX IF NOT EXISTS "contacts_auto_tags_gin_idx" ON "contacts" USING GIN ("auto_tags");
CREATE INDEX IF NOT EXISTS "friends_zalo_labels_gin_idx" ON "friends" USING GIN ("zalo_labels");
CREATE INDEX IF NOT EXISTS "friends_crm_tags_per_nick_gin_idx" ON "friends" USING GIN ("crm_tags_per_nick");
CREATE INDEX IF NOT EXISTS "friends_auto_tags_gin_idx" ON "friends" USING GIN ("auto_tags");
