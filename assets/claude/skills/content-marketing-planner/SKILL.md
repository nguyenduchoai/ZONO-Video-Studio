---
name: content-marketing-planner
description: >
  Lập Kế hoạch Content Marketing cá nhân hóa cho mọi ngành, xuất file Excel
  giữ nguyên 100% bố cục chuẩn: Chân dung KH, Định hướng, Pillar + Content
  Angle từng nền tảng (FB/TikTok/IG/YT/Threads), Content Calendar có tiêu đề
  cụ thể. Dùng khi user muốn: làm plan content marketing cho doanh nghiệp;
  đề xuất pillar & lịch đăng đa nền tảng; tạo content calendar có tiêu đề
  theo pillar; cá nhân hóa plan theo năng lực sản xuất; lên plan cho mọi
  ngành (F&B, spa, thẩm mỹ, BĐS, giáo dục, thời trang, mỹ phẩm, khóa học,
  B2B...). Kích hoạt: "plan content marketing", "kế hoạch content", "làm
  plan content", "pillar nội dung", "lịch đăng đa kênh", "content calendar",
  "chiến lược content đa nền tảng", "plan content cho [ngành]", "đề xuất
  pillar", "tiêu đề bài theo pillar".
---

# Content Marketing Planner (Mọi ngành) — Giữ form 100% theo mẫu

## Nguyên tắc cốt lõi

**FORM / BỐ CỤC / BẢNG BIỂU giữ nguyên 100%** theo mẫu (Biển Đông).
**NỘI DUNG cá nhân hóa 100%** theo từng khách hàng — không khách nào giống khách nào.

Mỗi plan phải điều chỉnh theo:
1. **Ngành nghề** của khách
2. **Chân dung khách hàng mục tiêu** (2–5 phân khúc)
3. **Năng lực sản xuất nội dung** (có quay được video không, có người mẫu không, có thể chụp ảnh thật hay chỉ làm ảnh thiết kế...)
4. **Nền tảng triển khai** (Facebook, TikTok, Instagram, YouTube, Threads — chọn theo ngành & năng lực)
5. **Định vị thương hiệu** (cao cấp / tầm trung / bình dân / đặc biệt)

## File tham chiếu bắt buộc đọc

| File | Dùng khi nào |
|---|---|
| `assets/customer_intake_questions.md` | Bước 1: hỏi khách để thu thập thông tin đầu vào |
| `assets/production_capability_guide.md` | Bước 2: phân tích năng lực, chọn mix định dạng (Ảnh thật / Ảnh thiết kế / Video) |
| `assets/pillar_design_guide.md` | Bước 3: thiết kế 3–6 pillar phù hợp khách |
| `assets/title_writing_guide.md` | Bước 4: viết tiêu đề cho content calendar (phong cách mẫu) |
| `assets/platform_templates.md` | Bước 5: chọn nền tảng & info section chuẩn từng nền tảng |
| `assets/json_schema.md` | Bước 6: dựng JSON input cho script build |
| `examples/bien_dong_example.json` | Tham chiếu JSON mẫu hoàn chỉnh |

## Quy trình chuẩn (6 bước)

### Bước 1 — Thu thập thông tin khách hàng
Nếu user chỉ mô tả qua loa, **hỏi ngay** các câu ở `assets/customer_intake_questions.md`.
Tối thiểu phải biết: tên/ngành, sản phẩm–dịch vụ chính, định vị, phân khúc khách, USP, năng lực sản xuất, nền tảng muốn chạy, mục tiêu trong quý/tháng.

Nếu user đã cung cấp đủ thông tin → bỏ qua bước hỏi, đi thẳng sang Bước 2.

### Bước 2 — Phân tích năng lực sản xuất
Đọc `assets/production_capability_guide.md`. Quyết định:
- Mix định dạng trên mỗi nền tảng (bao nhiêu % Ảnh thật / Ảnh thiết kế / Video-Reel)
- Có nên chạy TikTok không (TikTok bắt buộc có năng lực quay video)
- Tần suất khả thi (2 bài/tuần hay 5 bài/tuần…)

### Bước 3 — Thiết kế Chân dung + Định hướng + Pillar
- **Chân dung**: 2–5 phân khúc, mỗi phân khúc 6 chiều (Nhân khẩu học / Hành vi tiêu dùng / Tâm lý-Insight / Nhu cầu & Mong muốn / Động lực / Rào cản)
- **Định hướng chung**: Mục tiêu chính, Định vị hình ảnh, Gợi ý định vị, Gợi ý BIO, Mục tiêu cụ thể (KPI)
- **Pillar**: Dùng `assets/pillar_design_guide.md`. FB thường 5 pillar (tỉ lệ cộng = 1.0). TikTok thường 3–4 pillar.

### Bước 4 — Viết Content Calendar (tiêu đề theo pillar)
Đọc `assets/title_writing_guide.md`.
- FB: 2 bài/ngày (Video/Reel + Bài viết), gợi ý 4–6 tuần
- TikTok: 1 bài/ngày, gợi ý 4–6 tuần
- Tiêu đề bám sát **Content Angle** của từng pillar, cá nhân hóa theo giọng điệu và định vị khách
- Xoay vòng pillar theo tỉ lệ: pillar tỉ lệ cao → xuất hiện nhiều hơn

### Bước 5 — Dựng JSON input
Đọc `assets/json_schema.md`. Tạo JSON đầy đủ theo schema, lưu ở `/home/claude/plan_input.json`.
Tham khảo `examples/bien_dong_example.json` cho format.

### Bước 6 — Chạy script sinh file Excel
```bash
python /home/claude/content-marketing-planner/scripts/build_plan.py \
    /home/claude/plan_input.json \
    /mnt/user-data/outputs/Plan_Content_Marketing_<TenKhach>.xlsx
```
Sau đó dùng `present_files` để gửi file cho user.

## Checklist chất lượng trước khi bàn giao

- [ ] Tên sheet đúng thứ tự: CHÂN DUNG KHÁCH HÀNG → ĐỊNH HƯỚNG CHUNG → [Nền tảng 1] → [Nền tảng 1] CONTENT MAPPING → [Nền tảng 2] → [Nền tảng 2] CONTENT MAPPING…
- [ ] Chân dung có 2–5 phân khúc, mỗi phân khúc đủ 6 chiều
- [ ] Định hướng chung có đủ 5 dòng
- [ ] Mỗi pillar có: Tên / Tỉ lệ / Content Angle / Mục tiêu / Định dạng
- [ ] Tổng tỉ lệ các pillar = 1.0 (tức 100%)
- [ ] Content Calendar có đủ tiêu đề cho từng ngày/từng slot, không để trống
- [ ] Tiêu đề không chung chung — có số cụ thể / góc nhìn lạ / cảm xúc / insight
- [ ] Xuất file ra `/mnt/user-data/outputs/` rồi `present_files`

## Nhắc nhở khi làm việc với user Việt Nam

- Dùng tiếng Việt xuyên suốt file Excel
- Các pillar, tiêu đề, mô tả đều viết tiếng Việt tự nhiên
- Giọng điệu bám đúng định vị thương hiệu (cao cấp ≠ bình dân)
- Khi user chưa rõ năng lực sản xuất → phải hỏi, đừng tự đoán để đưa Reel/Video tràn lan

## Ghi chú kỹ thuật

- File output giữ nguyên bố cục/ bảng biểu/ font / màu / border / merge của mẫu Biển Đông
- Không thay đổi cấu trúc bảng, chỉ thay đổi **nội dung bên trong**
- Font "Be Vietnam Pro" được áp dụng toàn bộ file
- Nếu user muốn thêm nền tảng mới (VD: Threads, YouTube), dùng style tương ứng trong `platform_templates.md`
