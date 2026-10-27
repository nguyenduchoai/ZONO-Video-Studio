---
name: flow-cinematic-short-film
description: Tạo phim ngắn tự động trên Google Flow bằng công cụ Cinematic Short Film Studio: từ ảnh nhân vật/bối cảnh/đạo cụ + chủ đề → kịch bản, storyboard, video, kiểm lỗi và ghép thành 1 video hoàn chỉnh.
---

# Phim ngắn tự động trên Google Flow – Cinematic Short Film Studio

Mục tiêu duy nhất: người dùng chỉ đưa **ảnh tham chiếu + chủ đề**, nhận về **1 video phim hoàn chỉnh, đã kiểm lỗi**. Claude tự viết cốt truyện, tự vận hành công cụ, tự tạo lại cảnh lỗi.

## 0. Đầu vào cần có

- Ảnh tham chiếu (tối đa 5 ô trong "Kho ảnh tham chiếu"): Nhân vật 1, Nhân vật 2, Bối cảnh, Đạo cụ/Sản phẩm, Style/Color (tuỳ chọn).
- Form chủ đề của người dùng: chủ đề phim, thông điệp/sản phẩm cần lồng, thời lượng (30s / 60s / 90s), thể loại mong muốn (nếu có).
- Thiếu gì thiết yếu (ví dụ không có ảnh nhân vật chính, không rõ thời lượng) → hỏi 1 lần. Phần còn lại tự quyết và ghi rõ giả định.

## 1. Viết cốt truyện (phần quan trọng nhất)

Tự nghiên cứu chủ đề và viết kịch bản hấp dẫn, **toàn bộ lời thoại tiếng Việt**:

- Số cảnh = thời lượng / 10s: 30s → 3 cảnh, 60s → 6 cảnh, 90s → 9 cảnh.
- Cấu trúc: Hook 0–3s gây tò mò → xung đột → leo thang → cao trào → giải quyết/ấm áp → câu chốt đọng lại (lồng sản phẩm tự nhiên nếu có).
- Mỗi cảnh 10s: lời thoại tối đa ~20–25 từ, 1–2 câu, rõ ai nói. Không để câu thoại dài hơn thời lượng cảnh.
- Nhân vật, bối cảnh, đạo cụ phải khớp đúng ảnh tham chiếu (tuổi, trang phục, không gian).
- Định dạng logline điền vào công cụ:
  ```
  Mẹ: ...

  Con: ...
  ```
- Chọn **Thể loại** (Tâm lý / Hành động / Viễn tưởng / Kinh dị / Lãng mạn / Noir / Cổ trang) hợp với câu chuyện; **Nhịp độ** Chậm/Vừa/Nhanh (mặc định Vừa; hài/drama gia đình nhanh → Nhanh; cảm xúc sâu → Chậm).
- Gửi kịch bản cho người dùng xem nhanh rồi tiếp tục (không chờ nếu người dùng đang vắng).

## 2. Mở đúng công cụ trên Flow (Claude in Chrome)

Nạp tool Chrome trong 1 lần: tabs_context_mcp, tabs_create_mcp, navigate, computer, read_page, find, form_input, file_upload, upload_image, get_page_text.

1. tabs_context_mcp → mở tab mới → vào `https://flow.google.com`.
2. Vào project của người dùng → mục **Công cụ** → **Cinematic Short Film Studio** (URL dạng `flow.google.com/project/<id>/tool/<toolId>`; lưu lại URL này để lần sau vào thẳng).
3. Nếu chưa đăng nhập hoặc không thấy công cụ → dừng, báo người dùng.

## 3. Điền form

1. **Kho ảnh tham chiếu**: tải từng ảnh vào đúng ô (Nhân vật 1 → ô 1, Nhân vật 2 → ô 2, Bối cảnh → ô 3, Đạo cụ → ô 4, Style → ô 5) bằng file_upload/upload_image. Nếu không đưa được file vào trình duyệt → nhờ người dùng kéo ảnh vào ô, rồi làm tiếp.
2. **Tên phim**: tên ngắn, hấp dẫn.
3. **Cốt truyện (Logline)**: dán toàn bộ kịch bản bước 1.
4. **Cấu hình kỹ thuật**: chọn Thể loại, Thời lượng, Nhịp độ.
5. Bấm **"Khóa nhân vật & Tiếp tục"** → chờ "Đang phân tích và thiết lập kịch bản...".

## 4. Duyệt nhân vật/bối cảnh và kịch bản phân cảnh

1. Đọc khối **NHÂN VẬT (LOCKED)** và **BỐI CẢNH (LOCKED)** bằng get_page_text. So với ảnh: tuổi, tóc, trang phục, không gian. Sai lệch lớn → quay lại, sửa logline cho rõ hơn, khoá lại.
2. Bấm **"Lập kịch bản phân cảnh"**. Đọc hết các cảnh (S1…Sn): đủ số cảnh, đúng thứ tự, lời thoại **tiếng Việt**, khớp kịch bản gốc, không lặp câu.
3. Bấm **"Bắt đầu sản xuất Storyboard"**.

## 5. Kiểm storyboard (keyframe)

- Chờ ảnh render (chụp màn hình ~mỗi 30–60s, không spam).
- Với mỗi cảnh, zoom xem ảnh: đúng nhân vật (mặt, tóc, trang phục), đúng bối cảnh, đúng đạo cụ/sản phẩm, đúng góc máy mô tả, đúng phong cách.
- Cảnh báo **"Lỗi tạo ảnh"** hoặc ảnh sai → bấm nút tạo lại (↻) trên thẻ cảnh đó.
- Tối đa 3 lần tạo lại mỗi cảnh (tốn tín dụng); quá 3 lần → ghi vào báo cáo, tiếp tục.
- Khi đủ keyframe đạt → bấm **"Bước cuối: Tạo video toàn bộ"**.

## 6. Kiểm video từng cảnh

Chờ các cảnh render xong (chụp màn hình ~mỗi 60s). Sau đó tải từng clip (hoặc bản Master) về máy người dùng và kiểm tra:

1. Lấy file: dùng thư mục Downloads đã được người dùng cấp quyền → chuyển file vào môi trường xử lý.
2. Với mỗi clip:
   - `ffprobe` kiểm thời lượng (~10s), có âm thanh.
   - `ffmpeg` trích 3–5 khung hình → xem: đúng nhân vật, bối cảnh, không méo mặt/tay, không chữ lạ.
   - Tách audio → chuyển giọng nói thành văn bản (whisper, language=vi) → so với lời thoại kịch bản.
3. Lỗi cần bắt:
   - Cảnh nói **tiếng Anh** hoặc lẫn ngôn ngữ trong khi phải tiếng Việt.
   - **Nói lắp, lặp từ, lặp đoạn**, cắt ngang câu, thoại sai người nói.
   - Sai/thiếu lời thoại so với kịch bản.
   - Sai nhân vật, bối cảnh, đạo cụ; nhân vật đổi mặt giữa các cảnh.
   - Clip lỗi render, đen hình, không tiếng.
4. Cảnh lỗi → quay lại Flow, bấm ↻ (hoặc biểu tượng clapper) trên đúng cảnh để tạo lại, tải về, kiểm lại. Tối đa 3 lần/cảnh.

## 7. Ghép và trả kết quả

- Khi mọi cảnh đạt: bấm **"Ghép & Tải Master"** (bật **Phụ đề** nếu người dùng muốn). Hoặc ghép bằng ffmpeg concat theo đúng thứ tự S1→Sn (chuẩn hoá cùng độ phân giải/fps/audio trước khi ghép).
- Kiểm lại video master lần cuối (thời lượng tổng, chuyển cảnh, âm thanh liền mạch).
- Giao video cho người dùng và lưu vào thư mục của họ (nếu có kết nối).
- Kèm báo cáo ngắn: tên phim, số cảnh, cảnh nào đã tạo lại và vì sao, lỗi còn tồn (nếu có).

## Lưu ý

- Người dùng chỉ quan tâm đầu ra: tự xử lý lỗi, chỉ hỏi khi thật sự bị chặn (chưa đăng nhập, hết tín dụng, không tải được ảnh).
- Mỗi lần tạo lại tốn tín dụng Flow → giới hạn số lần như trên.
- Không bấm nút xoá hoặc đổi cài đặt tài khoản Flow.
