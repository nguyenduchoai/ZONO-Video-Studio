---
name: flow-review-thoi-trang
description: Người dùng đưa ảnh người mẫu/KOC + ảnh sản phẩm thời trang + thông tin sản phẩm trong Claude → Claude tự chạy công cụ "KOC FASHION – AI VIDEO STUDIO" trên Google Flow (nhân vật → sản phẩm & bối cảnh + thử đồ AI → cấu hình → kịch bản & ảnh mẫu → xuất video) → lấy clip, ghép nối, chèn chữ (phụ đề + tiêu đề + CTA) → trả video review thời trang thành phẩm về Claude.
---

# Video review thời trang tự động qua Google Flow

## Luồng chạy tổng quan (bắt buộc tuân theo)

```
[1] NGUỒN DỮ LIỆU: người dùng đưa trong Claude
     (ảnh người mẫu/KOC, ảnh sản phẩm, tên – chất liệu – màu, giá/ưu đãi, CTA…)
        ↓
[2] CLAUDE TỰ XỬ LÝ TRÊN GOOGLE FLOW
     đúng công cụ "KOC FASHION – AI VIDEO STUDIO"
     Nhân vật → Sản phẩm & Bối cảnh (thử đồ AI) → Cấu hình → Kịch bản + ảnh mẫu → Xuất video (tạo tất cả)
        ↓
[3] HẬU KỲ (Claude làm, không cần người dùng)
     Ghép các clip theo thứ tự cảnh + Edit chữ (phụ đề, tiêu đề hook, CTA)
        ↓
[4] TRẢ VỀ CLAUDE: 1 file MP4 thành phẩm
```

Nguyên tắc:
- **Mọi dữ liệu đầu vào lấy từ Claude.** Không bắt người dùng thao tác trên Google Flow.
- **Chỉ dùng đúng công cụ "KOC FASHION – AI VIDEO STUDIO"** — không dùng công cụ khác, không tự viết prompt Veo ngoài công cụ.
- **Giữ đúng sản phẩm thật:** màu, logo, đường may, form dáng trong video phải khớp ảnh sản phẩm. Ảnh thử đồ sai sản phẩm thì làm lại trước khi khoá.
- **Kết quả cuối là video đã nối + đã chèn chữ.** Không dừng ở các clip rời.

## 0. Nhận dữ liệu từ Claude

Chỉ hỏi (1 lần) những gì thiếu và không có mặc định:

| Trường | Bắt buộc | Mặc định |
|---|---|---|
| Tên sản phẩm | Có | — |
| Ảnh sản phẩm (1–4 ảnh: trước / sau / chi tiết vải, logo) | Nên có | Thiếu → tạo 1 ảnh sản phẩm bằng trình tạo ảnh của Flow theo mô tả, ghi chú "ảnh do AI tạo" |
| Ảnh người mẫu / KOC (1–3 ảnh, rõ mặt) | Không | Tạo 1 chân dung người mẫu Việt Nam hợp đối tượng (toàn thân, nền trơn) |
| Mô tả nhân vật | Không | Tự viết từ ảnh (giới tính, tuổi, tóc, da, dáng, phong cách) — tối thiểu 1 câu đầy đủ |
| Chất liệu, màu sắc | Không | Đọc từ ảnh sản phẩm |
| Bối cảnh | Không | Chọn preset hợp sản phẩm (xem bước 2) |
| Số cảnh / tỉ lệ | Không | 5 cảnh × 8 giây, 9:16 |
| Giá / ưu đãi / CTA | Không | CTA "Bấm giỏ hàng để chọn size" |
| Xưng hô | Không | "mình – các bạn" (trẻ, năng động) hoặc "em – các chị" (công sở, trung niên) |

Lưu lời thoại cuối cùng của từng cảnh vào `script.json` để làm phụ đề.

## 1. Mở công cụ

- Mở thẳng link Tool trong dự án Flow: `flow.google.com/project/<id>/tool/160aa62c-4027-46a9-a46a-7e5edb523c05`. Link chia sẻ gốc `flow.google.com/shared/tool/160aa62c-…` chỉ dùng khi chưa có trong dự án: bấm **Try in a project** → chọn dự án có sẵn → **Open** (không tạo dự án mới mỗi lần).
- Màn chào "KOC FASHION – AI VIDEO STUDIO" → bấm **Bắt đầu**. Bỏ qua nút logo nhỏ phía trên.
- Tool không lưu phiên: tải lại trang là về màn chào, làm lại từ đầu.
- Thanh bước: NHÂN VẬT · SẢN PHẨM · CẤU HÌNH · KỊCH BẢN · XUẤT VIDEO.

## 2. Các bước trong Tool

### Bước 1 — NHÂN VẬT
- **THÊM ẢNH** → hộp chọn ảnh của Flow → tải ảnh người mẫu lên (tối đa 3, cùng một người).
- Ô **MÔ TẢ ĐẶC ĐIỂM NHÂN VẬT**: mô tả chi tiết (giới tính, tuổi, tóc, da, dáng, phong cách). Ô này có >10 ký tự thì nút mới sáng.
- **Khoá nhân vật & Tiếp tục** → **Tiếp tục**.

### Bước 2 — SẢN PHẨM & BỐI CẢNH
1. **Ảnh sản phẩm** (+) → tải 1–4 ảnh. Ảnh đầu tiên là ảnh được dùng làm tham chiếu chính, nên chọn ảnh mặt trước rõ nhất.
2. Điền **Tên sản phẩm**, **Chất liệu**, **Màu sắc**.
3. **AI Phân tích chi tiết**: tự viết (loại, màu, chất liệu, cổ, tay, logo, đường may) sau khi xem ảnh. Hoặc bấm **⚡ Tự động phân tích** rồi sửa lại cho đúng.
4. **Bối cảnh**: chọn 1 trong 6 preset: Phòng khách sang trọng · Phòng ngủ ấm áp · Studio nền trơn · Quán cà phê vintage · Đường phố hiện đại · Bãi biển hoàng hôn. Viết mô tả ánh sáng/không gian. Gợi ý: đồ công sở → Studio nền trơn/Phòng khách; đồ dạo phố → Đường phố hiện đại/Quán cà phê; đồ đi biển → Bãi biển hoàng hôn; đồ ngủ → Phòng ngủ.
   - Tool KHÔNG nhận ảnh bối cảnh tải lên. Nếu người dùng gửi ảnh bối cảnh, xem ảnh rồi chuyển thành mô tả và chọn preset gần nhất.
5. **Tạo ảnh bối cảnh chuẩn** → chờ ảnh hiện (tốn 1 ảnh).
6. **Thử đồ AI** → chờ ảnh nhân vật mặc sản phẩm (tốn 1 ảnh). Chụp màn hình xem kỹ:
   - đúng mặt người mẫu;
   - đúng màu, logo, cổ, tay, đường may như ảnh sản phẩm.
   Sai thì bấm **Thử đồ AI** lại, tối đa 2 lần. Vẫn sai thì sửa phần phân tích cho cụ thể hơn rồi thử thêm 1 lần.
7. **Khoá sản phẩm** → **Tiếp tục cấu hình**.

### Bước 3 — CẤU HÌNH
- **Số lượng cảnh**: dùng nút − / +. Bằng `round(thời lượng / 8)`, trong khoảng 3–8; mặc định 5.
- **Tỷ lệ khung hình**: 9:16, mặc định cho TikTok/Reels. 1:1 sẽ ra video 16:9 nên không dùng.
- Các công tắc Lời thoại / Phụ đề / Nhạc nền để mặc định; phụ đề làm ở hậu kỳ.
- **Tiếp tục viết kịch bản**.

### Bước 4 — KỊCH BẢN
Chế độ "AI Soạn thảo" không có nút viết khi chưa có cảnh. Cách làm chuẩn:

1. Bấm **Tự dán kịch bản**. Dán lời thoại, **mỗi dòng = 1 cảnh**, đúng số cảnh đã chọn. Bấm **Áp dụng cho N cảnh**.
2. Lời thoại tự viết theo mạch 5 nhịp: **Hook/vấn đề → Khám phá sản phẩm → Chi tiết (chất liệu, form, đường may) → Trải nghiệm mặc/phối đồ → Giá/ưu đãi + CTA.**
   - Mỗi cảnh 17–23 từ, vì Tool đếm 2,5 từ/giây cho 8 giây.
   - Nối mạch bằng từ nối, xưng hô nhất quán, không chào lại ở các cảnh sau.
   - Tên sản phẩm và giá/ưu đãi phải đúng như người dùng đưa.
3. Với từng cảnh:
   - Đặt **Thời lượng = 8 giây** (Tool luôn quay clip 8 giây).
   - Sửa ô **Mô tả hình ảnh** cho khớp lời thoại: pose, hành động, góc máy và chuyển động vải. Ví dụ: "xoay nhẹ khoe tà váy bay, camera lia ngang chậm", "cận chất vải và đường may ở tay áo, camera zoom chậm", "đi vài bước về phía camera, toàn thân".
   - Các cảnh nên có góc máy khác nhau.
4. Không bấm "Viết lại toàn bộ kịch bản": nút này ghi đè lời thoại đã viết. Chỉ dùng **Làm mượt chuyển tiếp** khi lời thoại bị gãy, rồi đọc lại.
5. **Tạo tất cả ảnh mẫu** → **Bắt đầu tạo N ảnh** (N ảnh khung đầu). Chờ đủ ảnh, chụp màn hình kiểm tra. Ảnh sai người hoặc sai đồ: rê lên ảnh → nút làm mới của cảnh đó.
6. Đọc lại toàn bộ lời thoại (khung "Đọc nối toàn bộ lời thoại") và lưu `script.json`.
7. **Tiến hành tạo Video**.

### Bước 5 — XUẤT VIDEO
- **Tạo tất cả video**: Tool quay lần lượt từng cảnh (Veo 3.1 Lite, 8 giây, khung đầu = ảnh mẫu). Sau mỗi cảnh Tool tự so khuôn mặt với ảnh gốc và tự quay lại tối đa 2 lần nếu lệch.
- Theo dõi khoảng 60 giây/lần đến khi thanh "Tiến độ hoàn tất" đạt N/N.
- Cảnh báo "Nhân vật chưa khớp" sau 2 lần tự quay lại: xem clip.
  - Lệch rõ → **Tạo lại cảnh**, tối đa 1 lần.
  - Chấp nhận được → **Bỏ qua lỗi**.
- Cảnh lỗi (không có video) → **Bắt đầu quay** lại cảnh đó, tối đa 2 lần.
- **Ghép & Tải Video** tải qua trình duyệt, có thể bị chặn. Chỉ dùng khi môi trường cho phép tải; nếu không thì lấy từng clip từ trang theo hướng dẫn của môi trường chạy, rồi tự ghép ở bước hậu kỳ.

## 3. Hậu kỳ: ghép nối + edit chữ

1. Lấy đủ N clip theo thứ tự cảnh 1 → N. Kiểm tra bằng `ffprobe`: khoảng 8 giây/clip, có audio, khung dọc.
2. Soát lời thoại thực tế trong clip (nhận dạng giọng nói nếu có công cụ). Cập nhật `script.json` theo lời thực tế để phụ đề khớp.
3. Ghép + chèn chữ:
   - **Tiêu đề hook** 0–3 giây đầu, ví dụ "REVIEW <TÊN SP> – MẶC LÊN CÓ XỊN?".
   - **Phụ đề lời thoại** ở nửa dưới, chữ trắng viền đen, tránh che mặt và sản phẩm.
   - **CTA** suốt cảnh cuối (ưu đãi người dùng đưa, hoặc "BẤM GIỎ HÀNG CHỌN SIZE").
4. Trích 2–3 khung hình để kiểm tra: chữ không che mặt/sản phẩm, dấu tiếng Việt đúng, đúng tên sản phẩm.

## 4. Trả thành phẩm

- File cuối: `review_thoi_trang_<ten-san-pham>_final.mp4`.
- Báo 1–2 câu: thời lượng, số cảnh, cảnh nào phải làm lại, ảnh nào do AI tạo.
- Caption đăng kèm: 1 câu hook + 2–3 ý nổi bật (chất liệu, form, phối đồ) + giá/ưu đãi + CTA + 3–5 hashtag thời trang.

## Tín dụng Flow (ước tính mỗi video N cảnh)

| Hạng mục | Số lần tạo |
|---|---|
| Ảnh bối cảnh | 1 ảnh |
| Ảnh thử đồ | 1 ảnh |
| Ảnh mẫu | N ảnh (Nano Banana Pro) |
| Clip | N clip Veo 3.1 Lite 8 giây |
| Làm lại | Có thể thêm tối đa 2 lần/cảnh do Tool tự quay lại |

Không bấm tạo lặp vô ích.

## Xử lý sự cố

- **Chưa đăng nhập Flow / hết tín dụng / không mở được Tool:** dừng và báo, không chuyển sang công cụ khác.
- **Nút bị mờ:** kiểm tra điều kiện của nút đó.
  - Khoá nhân vật: cần ≥1 ảnh và mô tả >10 ký tự.
  - Thử đồ AI: cần đủ ảnh nhân vật, ảnh sản phẩm và ảnh bối cảnh.
  - Tiếp tục cấu hình: cần đã khoá sản phẩm.
  - Tiến hành tạo Video: cần đã có cảnh.
- **Lỡ tải lại trang** (Tool về màn chào, mất dữ liệu): làm lại từ bước 1. Ảnh đã tải lên vẫn còn trong mục Images của Flow, chọn lại từ đó, không tải lên lần nữa.
- Không kích hoạt hộp thoại alert/confirm của trình duyệt.
