# Nguồn gốc mã ZL-CRM trong hệ thống ZONO Agentic AI

- Repo gốc: https://github.com/zono/ZL-CRM (nhánh `main`), commit `398a170ada18c5e7c6b8d1533dd0c37cd53ee98d` (23/09/2026).
- Giấy phép: Apache License 2.0 — giữ nguyên `LICENSE`, `NOTICE`, `NGUON-GOC.md`, `THIRD-PARTY-LICENSES.md`.
- Thay đổi so với bản gốc (để ZONO Agentic AI follow-up đúng nick Zalo):
  - `backend/src/modules/api/public-api-routes.ts`: `GET /api/public/conversations` trả thêm `zaloAccountId` + `zaloAccount`, hỗ trợ lọc `since` và `threadType`.
- Cập nhật từ repo gốc: tải bản mới về thư mục tạm, chép đè vào đây (trừ `backend/.env`, `node_modules`, `data`) rồi áp lại thay đổi ở trên.
