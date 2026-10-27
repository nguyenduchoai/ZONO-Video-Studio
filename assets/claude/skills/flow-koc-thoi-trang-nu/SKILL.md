---
name: flow-koc-thoi-trang-nu
description: Người dùng đưa ảnh sản phẩm thời trang nữ (+ ảnh KOC/người mẫu, ảnh bối cảnh nếu có) và thông tin sản phẩm trong Claude → Claude tự chạy công cụ "KOC Fashion Studio v3" trên Google Flow (ảnh KOC gốc mặc đồ trong bối cảnh → 5 ảnh selfie → kịch bản 6 cảnh có thoại → 6 clip Veo 8 giây) → lấy clip, ghép, chèn chữ (tiêu đề + phụ đề + CTA) → trả video KOC review thời trang nữ khoảng 48 giây.
---

# Video KOC thời trang nữ qua Google Flow (KOC Fashion Studio v3)

## Luồng chạy tổng quan (bắt buộc tuân theo)

```
[1] NGUỒN DỮ LIỆU: người dùng đưa trong Claude
     (ảnh sản phẩm 1–3, ảnh KOC, ảnh bối cảnh, tên – điểm nổi bật – giá/ưu đãi)
        ↓
[2] CLAUDE TỰ XỬ LÝ TRÊN GOOGLE FLOW — đúng công cụ "KOC Fashion Studio v3"
     Tải ảnh + nhập thông tin → Tạo ảnh KOC gốc → Tạo 5 ảnh selfie → Viết kịch bản → Tạo tất cả video → lấy clip
        ↓
[3] HẬU KỲ: ghép 6 clip theo thứ tự + tiêu đề hook, phụ đề, CTA
        ↓
[4] TRẢ VỀ: 1 file MP4 khoảng 48 giây
```

Nguyên tắc:
- **Chỉ dùng đúng công cụ "KOC Fashion Studio v3"**. Không dùng công cụ thời trang khác, không tự viết prompt Veo ngoài công cụ.
- **Giữ đúng sản phẩm thật:** màu, hoạ tiết, chất vải, cúc, đường may phải khớp ảnh sản phẩm. Ảnh KOC gốc sai đồ thì tạo lại trước khi đi tiếp.
- **Lời thoại trung thực:** chỉ nói điểm nổi bật và giá/ưu đãi người dùng đưa. Không bịa chất liệu hay số liệu, không nêu tên người thật hay thương hiệu khác.
- Kết quả cuối là video đã nối + đã chèn chữ.

## 0. Nhận dữ liệu

| Trường | Bắt buộc | Mặc định |
|---|---|---|
| Ảnh sản phẩm SP1 (SP2, SP3 nếu phối nhiều món) | Có (ít nhất 1) | — |
| Ảnh KOC / người mẫu nữ (mặt, tóc, dáng) | Không | Tạo 1 ảnh người mẫu nữ Việt Nam toàn thân, nền trơn, ghi chú "ảnh do AI tạo" |
| Ảnh background (bối cảnh) | Không | Tạo 1 ảnh phòng/bối cảnh hợp sản phẩm (phòng ngủ sáng, phòng khách tối giản, góc cửa hàng…), không có người |
| Tên sản phẩm | Nên có | Tool tự mô tả theo ảnh |
| Điểm nổi bật | Không | Tool tự nhận xét từ ảnh |
| Giá / ưu đãi | Không | Chỉ nói "đang có ưu đãi", không nêu giá |
| Có thoại | Không | Có ("KOC nói thoại tiếng Việt") |
| Model video | Không | Veo 3.1 - Fast |
| Tỉ lệ | Không | 9:16 |

Ảnh tải lên phải là JPG/PNG/WebP, dưới 20 MB. Thiếu ảnh bắt buộc thì Tool hiện hộp thoại báo lỗi và không chạy.

## 1. Mở công cụ

- Mở link Tool trong dự án: `flow.google.com/project/<id>/tool/91a76ef9-7703-42d5-a264-7031a9b6a5f6`. Link chia sẻ `flow.google.com/shared/tool/91a76ef9-…` chỉ dùng khi chưa có trong dự án: bấm "Try in a project / Dùng thử trong một dự án" → chọn dự án có sẵn → "Open / Mở".
- Màn chào "KOC FASHION – AI VIDEO STUDIO" → bấm **Bắt đầu**.
- Tool không lưu phiên. Tải lại trang là mất hết dữ liệu.

## 2. Cột trái — Cấu hình

- **Model video:** Veo 3.1 - Fast / Lite / Quality, hoặc Omni 1.1 Flash. Mặc định Fast.
- **Tỷ lệ khung hình:** 9:16 cho TikTok/Reels, hoặc 16:9. Áp cho cả ảnh và video.
- **Âm thanh:** "KOC nói thoại tiếng Việt" hoặc "Không thoại (chỉ âm thanh môi trường)". Áp cho mọi cảnh.
- Thời lượng cố định 6 cảnh × 8 giây ≈ 48 giây.
- **KHÔNG bấm "Tạo full video 1 click".** Nút này chạy hết các bước liền một mạch, không dừng lại cho kiểm tra ảnh KOC gốc. Cuối cùng nó còn tự ghép video trong trình duyệt, sinh thêm một video thừa trên trang. Chạy từng bước như dưới đây.
- Không bấm "Bắt đầu lại" (nút này mở hộp xác nhận và xoá hết).

## 3. Các bước trong vùng làm việc

1. **Tải ảnh:** 5 ô tải ảnh "KOC (mặt / tóc / dáng)", "Sản phẩm SP1/SP2/SP3", "Background (bối cảnh)". Bấm ô nào thì mở hộp chọn tệp của trình duyệt (không phải hộp chọn ảnh của Flow) để tải đúng tệp. Thiếu KOC hoặc bối cảnh thì tạo trước bằng trình tạo ảnh của Flow, tải xuống rồi tải lên ô.
2. **Thông tin sản phẩm:** ô tên ("Tên SP…"), ô điểm nổi bật, ô giá/ưu đãi.
3. **Tạo ảnh KOC gốc** (Nano Banana Pro, 1 ảnh): KOC mặc sản phẩm, đứng trong bối cảnh, toàn thân.
   - Chụp màn hình soát: đúng mặt, đúng đồ (màu, hoạ tiết, chi tiết), ánh sáng hoà vào bối cảnh, không lộ vết ghép.
   - Sai thì bấm tạo lại ảnh cảnh 1, tối đa 2 lần.
4. **Tạo 5 ảnh selfie** (5 ảnh, 2 ảnh song song): cảnh 2–6 là góc selfie cầm tay, dựng từ ảnh KOC gốc. Ảnh selfie lệch mặt hoặc đồ → tạo lại riêng ảnh đó. Có thể bấm "Dùng ảnh có sẵn" ở từng cảnh để thay bằng ảnh thật, tỉ lệ đúng 9:16.
5. **Viết kịch bản:** Tool viết cho 6 cảnh theo vai trò cố định: Hook toàn thân → Chất liệu → Form dáng → Phối đồ / dịp mặc → Giá và ưu đãi → CTA. Mỗi cảnh có:
   - "Prompt chuyển động (tiếng Anh)";
   - "Câu thoại tiếng Việt" (tối đa 16 từ).
   Đọc lại toàn bộ câu thoại, sửa tay nếu:
   - sai tên sản phẩm, giá hoặc ưu đãi;
   - quá 16 từ;
   - có emoji, ký tự đặc biệt hoặc tên thương hiệu khác.
   Lưu lời thoại 6 cảnh vào `script.json`.
6. **Tạo tất cả video:** Tool quay tối đa 2 cảnh cùng lúc, mỗi cảnh 8 giây từ đúng ảnh khung đầu. Khi lỗi, Tool **tự** xử lý theo thứ tự:
   1. thử lại sau 5, 15 rồi 30 giây;
   2. đổi sang model Veo dự phòng;
   3. bỏ thoại;
   4. rút gọn prompt.
   Đây là những lần tạo thêm, tốn thêm tín dụng.
   - Theo dõi khoảng 60 giây/lần.
   - Cảnh vẫn lỗi (khung đỏ, có mã lỗi) → đọc lỗi, bấm tạo lại cảnh đó tối đa 1 lần.
   - Cảnh ra "Dự phòng không thoại" hoặc "prompt rút gọn" là cảnh mất lời. Ghi chú để phụ đề vẫn có, hoặc tạo lại 1 lần nếu cần lời.
7. **Bảng "Nhật ký tạo video"** cuối trang ghi từng lần thử: model, kết quả, lỗi. Dùng để báo cáo.
8. **"Ghép full video" / "Tải từng clip"** tải qua trình duyệt, có thể bị chặn. Lấy clip theo hướng dẫn môi trường chạy, rồi tự ghép ở hậu kỳ.

## 4. Hậu kỳ

1. Lấy đủ 6 clip theo thứ tự cảnh 1 → 6, mỗi clip khoảng 8 giây, có audio. Cảnh nào bỏ thì ghi rõ.
2. Soát lời thoại thực tế trong clip, cập nhật `script.json` cho khớp.
3. Ghép và chèn chữ:
   - **Tiêu đề hook** 0–3 giây, ví dụ "<TÊN SP> – MẶC LÊN XINH CỠ NÀO?".
   - **Phụ đề** đặt nửa dưới, không che mặt và đồ.
   - **CTA** suốt cảnh 6, ví dụ "BẤM GIỎ HÀNG CHỌN SIZE" hoặc ưu đãi người dùng đưa.
4. Trích 3 khung hình (cảnh 1, 3, 6) để soát mặt KOC nhất quán, đồ đúng, chữ không che.

## 5. Trả thành phẩm

- File: `koc_thoi_trang_nu_<ten-san-pham>_final.mp4`.
- Báo: thời lượng, số cảnh, model đã dùng (theo Nhật ký), cảnh nào bị dự phòng hoặc mất thoại, ảnh nào do AI tạo.
- Caption: 1 câu hook + 2–3 ý (chất liệu, form, phối đồ) + giá/ưu đãi + CTA + 3–5 hashtag thời trang nữ.

## Tín dụng Flow (ước tính)

- **Ảnh:** 1 ảnh KOC gốc + 5 ảnh selfie, cộng 1–2 ảnh nếu phải tự tạo KOC hoặc bối cảnh.
- **Clip:** 6 clip Veo 8 giây, cộng các lần Tool tự thử lại hoặc dự phòng khi lỗi.
- Không bấm tạo lặp vô ích.

## Xử lý sự cố

- **Chưa đăng nhập / hết tín dụng / không mở được Tool:** dừng và báo, không đổi công cụ.
- **Tool dùng hộp thoại alert/confirm của trình duyệt** (báo thiếu ảnh, báo lỗi, xác nhận xoá). Khi hộp thoại hiện: đọc nội dung, chỉ bấm đồng ý với hộp **thông báo**. Với hộp **xác nhận xoá** ("Xoá toàn bộ…") thì bấm Huỷ.
- **"Đầu vào chưa hợp lệ":** thiếu ảnh KOC, sản phẩm hoặc bối cảnh, hoặc sai định dạng/dung lượng. Sửa rồi bấm lại.
- **Cảnh báo lỗi khung đầu:** ảnh cảnh sai tỉ lệ so với cấu hình. Tạo lại ảnh cảnh đó, hoặc dùng ảnh 9:16.
- **Lỗi bộ lọc nội dung:** Tool tự bỏ thoại hoặc rút gọn prompt. Vẫn lỗi thì sửa câu thoại cho trung tính (bỏ từ nhạy cảm) rồi tạo lại cảnh đó 1 lần.
- **Lỡ tải lại trang:** mất hết, làm lại từ bước 1.
