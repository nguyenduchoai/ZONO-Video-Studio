---
name: flow-cooking-director-video
description: Tạo video review/nấu ăn hoàn chỉnh bằng công cụ Flow Cooking Director v2 trên Google Flow (Veo 3): nhập ảnh + kịch bản viral, duyệt storyboard, kiểm tra từng cảnh, tải về, ghép và chèn sub tiếng Việt.
---

# Flow Cooking Director → Video hoàn chỉnh có sub

Người dùng đưa lên: ảnh chân dung người dẫn (rõ mặt), ảnh món ăn/sản phẩm (góc đẹp nhất), ảnh bao bì hoặc góc bếp, và thông tin sản phẩm (tên, giá, điểm nổi bật, link affiliate nếu có). Kết quả trả về: 1 file MP4 9:16 đã ghép đủ cảnh, có phụ đề tiếng Việt.

## 0. Chuẩn bị
- Dùng Claude in Chrome (đọc skill `chrome-browser` trước; nạp tools trong 1 lần ToolSearch: tabs_context_mcp, tabs_create_mcp, navigate, read_page, find, computer, form_input, file_upload, upload_image, javascript_tool, get_page_text). Chrome của người dùng đã đăng nhập tài khoản có Google Flow.
- Nếu thiếu thông tin quan trọng (tên sản phẩm, vị, giá, giọng người dẫn), hỏi 1 lần bằng AskUserQuestion; nếu chạy không người trông thì tự giả định hợp lý và ghi rõ.
- Không dùng click chuột toàn màn hình (computer use) nếu Chrome extension hoạt động.

## 1. Mở công cụ
- Mở tab mới tới https://flow.google.com → mở project (hoặc project người dùng chỉ định) → sidebar **Công cụ** → **Flow Cooking Director v2**.
- Dùng read_page/find để xác định các ô nhập, không dựa vào toạ độ cố định.

## 2. Bước NHẬP LIỆU – điền cấu hình
- Upload 3 ảnh vào đúng 3 ô: *Ảnh chân dung rõ mặt*, *Góc chụp đẹp nhất*, *Bao bì hoặc góc bếp* (file_upload / upload_image).
- Cấu hình mặc định (đổi nếu người dùng yêu cầu):
  - Mô hình sản xuất: Omni 1.1 Flash (Tốc độ)
  - Tổng thời lượng: 80s (≈ 8 cảnh × 10s)
  - Tỉ lệ: 9:16 (TikTok/Reels)
  - Chế độ nối cảnh: INGREDIENTS (Ổn định mặt)
  - Phong cách hình ảnh: Cinematic ấm
  - Sản phẩm affiliate: tên sản phẩm
  - Giọng người dẫn: suy từ ảnh/người dùng (vd: "Nữ, 30 tuổi, miền Nam, ấm áp")
  - Các ô mô tả khác: điền theo ảnh đã đưa.

## 3. Viết kịch bản lời thoại tiếng Việt (quan trọng nhất)
Viết trong giới hạn từ hiển thị ở ô (vd ≤184 từ cho 80s; ~22 từ/cảnh 10s). Yêu cầu: thật cuốn, viral, văn nói tự nhiên, đúng giọng vùng miền.
Cấu trúc 8 nhịp, mỗi đoạn cách 1 dòng trống (công cụ chia cảnh theo đoạn):
1. Hook 0–3s gây tò mò/phá vỡ kỳ vọng ("ăn một miếng là không dừng được").
2. Giới thiệu sản phẩm + bối cảnh mua/nấu gần gũi.
3. Khoảnh khắc mở gói/nấu: âm thanh, mùi, màu sắc.
4. Cắn/nếm thử – phản ứng cảm xúc cụ thể (giòn, béo, cay…).
5. Chi tiết đáng tiền (thành phần, độ dày, cách ăn kèm).
6. Giá + so sánh giá trị.
7. "Điểm trừ" hài hước thực chất là khen.
8. Chấm điểm + CTA (theo dõi / mua qua link).

Quy tắc: viết số bằng chữ ("hai mươi lăm nghìn"), không ký hiệu, không tiếng Anh, không từ viết tắt, câu ngắn để model đọc đúng. Có thể chấm nhanh bằng skill `viral-content-scorer` (mục tiêu ≥ 85). Dán kịch bản vào ô *Kịch bản lời thoại tiếng Việt* (form_input hoặc javascript_tool để set giá trị + phát sự kiện input), kiểm tra bộ đếm từ không vượt giới hạn.

## 4. Phân tích
- Bấm **KHÓA NHẬN DIỆN & PHÂN TÍCH**, đợi xong.
- Đọc kết quả (get_page_text): nhận diện nhân vật, sản phẩm, bối cảnh, Voice Lock. Nếu sai (sai sản phẩm, sai giọng) → QUAY LẠI sửa rồi phân tích lại.
- Bấm **DUYỆT & CHIA STORYBOARD**.

## 5. Duyệt storyboard
Đọc toàn bộ các cảnh (lời thoại, hành động, trạng thái món, start/end, loại shot). Kiểm tra:
- Lời thoại khớp nguyên văn kịch bản, đủ cảnh, đúng thứ tự, thời lượng khớp tổng.
- Hành động hợp lý với sản phẩm (vd snack: xé gói, cắn giòn; món nấu: các bước nấu đúng).
- Nhân vật/trang phục/sản phẩm nhất quán giữa các cảnh.

Nếu không ổn → QUAY LẠI chỉnh kịch bản/cấu hình. Ổn → **XÁC NHẬN SẢN XUẤT VIDEO** → bấm bắt đầu sản xuất ở **Trung tâm sản xuất**.

## 6. Theo dõi & kiểm tra từng cảnh
- Việc render mất vài phút/cảnh; kiểm tra trạng thái định kỳ (đợi ~60–90s giữa các lần, không spam).
- Khi 1 cảnh xong, kiểm tra (xem thumbnail/screenshot vài khung; lấy URL video qua javascript_tool để tải và soát kỹ ở bước 7):
  - Đúng khuôn mặt người dẫn, đúng bối cảnh, đúng sản phẩm/bao bì.
  - Đúng lời thoại của cảnh, **nói tiếng Việt** (không lẫn tiếng Anh), đúng giọng Voice Lock.
  - Không lỗi âm thanh (câm, rè, bị cắt, lặp), không biến dạng tay/mặt, không chữ lạ trên hình.
- Cảnh lỗi → bấm tạo lại/sản xuất lại cảnh đó (tối đa 3 lần/cảnh; quá thì báo người dùng). Ghi lại cảnh nào đã tạo lại và lý do.

## 7. Tải video về
Ưu tiên theo thứ tự:
1. Dùng javascript_tool đọc `src` của các thẻ `<video>` theo thứ tự cảnh, rồi tải trực tiếp trong cloud workspace (`curl -L -o scene_01.mp4 "<url>"`). Nếu URL cần cookie/hết hạn thì dùng cách 2.
2. Bấm Download từng cảnh trong Chrome (vào thư mục Downloads) → xin quyền thư mục Downloads bằng device_request_folder_access → device_stage_files các file mới vào cloud.

Đặt tên `scene_01.mp4 … scene_08.mp4` theo đúng thứ tự storyboard.
Soát kỹ tiếng: chạy nhận dạng giọng nói (faster-whisper, language=vi) trên từng cảnh; nếu phát hiện tiếng Anh hoặc lệch lời thoại nhiều → quay lại bước 6 tạo lại cảnh đó.

## 8. Ghép + hậu kỳ + phụ đề (cloud, ffmpeg)
- Chuẩn hoá mọi cảnh về cùng thông số (1080x1920, 30fps, h264, aac 48k) rồi nối bằng concat; có thể thêm crossfade ngắn 0.2s giữa cảnh; chuẩn hoá âm lượng `loudnorm`.
- Phụ đề: lấy timing từ faster-whisper (word timestamps) nhưng dùng **chữ đúng của kịch bản** thay cho chữ nhận dạng. Chia dòng ≤ 7–8 từ, ≤ 2 dòng.
- Style sub TikTok: font sans đậm hỗ trợ tiếng Việt (vd Be Vietnam Pro/Montserrat), chữ trắng viền đen dày, đặt khoảng 1/3 dưới màn hình, tránh vùng UI TikTok. Burn bằng `subtitles=subs.ass`.
- Xuất `ten-san-pham_review_9x16.mp4` và kèm `.srt` riêng.

## 9. Bàn giao
- Ghi file vào /mnt/user-data/outputs/; nếu có thư mục được kết nối thì commit vào đó.
- Báo ngắn: thời lượng, số cảnh, cảnh nào đã tạo lại và vì sao, đường dẫn file.

## Lưu ý
- Công cụ trên Flow tốn tín dụng: không bấm sản xuất lại quá mức cần thiết.
- Không đăng xuất, không đổi cài đặt tài khoản Google.
- Nếu Chrome extension không kết nối được: dừng lại, báo người dùng; phương án thay thế là bật computer use để thao tác như bản demo.
