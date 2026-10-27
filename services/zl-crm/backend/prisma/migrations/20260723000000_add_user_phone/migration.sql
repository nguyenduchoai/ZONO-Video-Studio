-- Add User.phone (2026-07-23)
-- Cho phép đăng nhập bằng SĐT (bên cạnh email). Lưu canonical "84xxxxxxxxx"
-- (xem normalizePhone). Nullable để user cũ chỉ-email không vướng; unique để
-- không trùng nick. Postgres cho phép nhiều NULL trên cột unique.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- Unique index (nullable-safe) — chỉ chặn trùng số thật, nhiều NULL vẫn OK.
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_key" ON "users" ("phone");
