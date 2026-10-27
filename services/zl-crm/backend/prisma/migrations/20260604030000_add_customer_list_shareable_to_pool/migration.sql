-- Cho phép admin đánh dấu 1 tệp KH được chia sẻ vào pool phân phối chung.
-- Mặc định false (không chia sẻ). Plugin phân phối lead tiêu thụ cờ này.
ALTER TABLE "customer_lists" ADD COLUMN "shareable_to_pool" BOOLEAN NOT NULL DEFAULT false;
