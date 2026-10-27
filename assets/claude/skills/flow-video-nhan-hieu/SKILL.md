---
name: flow-video-nhan-hieu
description: Người dùng đưa ảnh chân dung người xây nhân hiệu (CEO/chuyên gia/KOL) + chủ đề/thông điệp trong Claude → Claude tự chạy công cụ "BRANDUP STUDIO" trên Google Flow (thiết lập giọng & khung → hồ sơ nhân vật → bối cảnh & camera → master reference → kịch bản → tạo video từng cảnh) → lấy clip, ghép, chèn chữ (tiêu đề + phụ đề + CTA) → trả video nhân hiệu (người thật nói trước camera) thành phẩm.
---

# Video nhân hiệu tự động qua Google Flow (BRANDUP STUDIO)

## Luồng chạy tổng quan (bắt buộc tuân theo)

```
[1] NGUỒN DỮ LIỆU: người dùng đưa trong Claude
     (ảnh chân dung, chủ đề/quan điểm, giọng, bối cảnh, CTA…)
        ↓
[2] CLAUDE TỰ XỬ LÝ TRÊN GOOGLE FLOW — đúng công cụ "BRANDUP STUDIO"
     1 Thiết lập → 2 Nhân vật → 3 Bối cảnh → 4 Tạo mẫu → 5 Kịch bản → 6 Tạo video
        ↓
[3] HẬU KỲ: ghép các clip theo thứ tự + tiêu đề hook, phụ đề, CTA
        ↓
[4] TRẢ VỀ: 1 file MP4 thành phẩm
```

Nguyên tắc:
- **Chỉ dùng đúng công cụ "BRANDUP STUDIO"**. Không dùng công cụ khác, không tự viết prompt Veo ngoài công cụ.
- **Người thật = đúng người trong ảnh.** Chỉ dùng ảnh của chính người xây nhân hiệu (người dùng gửi). Không dựng mặt người nổi tiếng hay người khác. Không có ảnh chân dung thì dừng và báo, không tự tạo "người giả" đứng tên nhân hiệu.
- **Nội dung là quan điểm và kinh nghiệm thật** của người đó, dựa trên những gì người dùng đưa. Không bịa thành tích, con số hay chứng nhận.
- Kết quả cuối là video đã nối + đã chèn chữ.

## 0. Nhận dữ liệu

| Trường | Bắt buộc | Mặc định |
|---|---|---|
| Ảnh chân dung rõ mặt (1–5 ảnh, cùng 1 người) | Có | — |
| Chủ đề / thông điệp / câu chuyện | Có | — |
| Giới tính, tuổi | Không | Đọc từ ảnh |
| Trang phục | Không | Giữ đúng trang phục trong ảnh (khóa trang phục) |
| Bối cảnh | Không | Văn phòng hiện đại / Studio chuyên nghiệp; có ảnh nền thì dùng "Tải nền" |
| Giọng | Không | Có file giọng thật của người đó → dùng làm âm thanh tham chiếu; không có → tạo mẫu giọng (mục 1) |
| Thời lượng | Không | 40–60 giây (4–6 cảnh × ~10 giây) |
| Khung hình | Không | 9:16 |
| CTA | Không | "Theo dõi để xem phần tiếp theo" / "Inbox để nhận tài liệu" |

## 1. Bước 1 — THIẾT LẬP

- **KHÓA GIỌNG NÓI:**
  - Lưu ý: ô "GIỌNG AI CHUẨN (GEMINI)" chỉ để hiển thị. Tool KHÔNG gửi giọng này khi tạo video.
  - Muốn giọng đồng nhất giữa các cảnh, phải dùng **ÂM THANH THAM CHIẾU** → "CHỌN MẪU AUDIO" → hộp chọn âm thanh của Flow.
  - Hộp này KHÔNG nhận tệp .mp3 tải lên (đã thử thực tế). Dùng chức năng **tạo giọng tùy chỉnh** trong hộp: mô tả giọng bằng lời (giới tính, vùng miền, độ tuổi, phong thái, ví dụ "giọng nam miền Bắc Việt Nam, khoảng 35 tuổi, điềm tĩnh, tự tin"), rồi chọn giọng vừa tạo. Ghi chú trong kết quả là giọng do Gemini tạo, không phải giọng thật.
  - Chọn ô "GIỌNG AI CHUẨN" cùng giới tính và vùng miền để giao diện khớp (Hồng Hạnh nữ Bắc, Minh Quân nam Bắc, Tú Anh nữ Nam, Gia Bảo nam Nam…).
- **Khi có âm thanh tham chiếu:** Tool tạo video bằng các ảnh tham chiếu, không dùng ảnh chính làm khung đầu. Vì vậy ảnh tham chiếu phải rõ mặt, và chỉ nên để ảnh của đúng người đó.
- **NGÔN NGỮ KỊCH BẢN:** Tiếng Việt (Việt Nam).
- **VIDEO MODEL:** Gemini Omni 1.1 (mặc định, cảnh dài tới 10 giây). Google Veo 3.1 cắt cảnh xuống tối đa 8 giây, nên nếu dùng Veo thì viết mỗi cảnh ≤ 22 từ.
- **KÍCH THƯỚC VIDEO:** 9:16 cho TikTok/Reels/Shorts, 16:9 cho YouTube. 1:1 sẽ ra 16:9 nên không dùng.
- **TIẾP TỤC**.

## 2. Bước 2 — NHÂN VẬT

1. **ẢNH THAM KHẢO** → chọn hoặc tải 1–5 ảnh của đúng người đó. Bấm vào ảnh rõ mặt, chính diện nhất để đặt làm ảnh chính (có dấu ✓ xanh).
2. Điền:
   - Giới tính (Nam/Nữ), Độ tuổi.
   - **Khóa gương mặt = KHÓA**.
   - Kiểu tóc, Màu tóc.
3. **Trang phục:**
   - Muốn giữ đồ như trong ảnh → **Khóa trang phục = KHÓA**.
   - Muốn đổi đồ → chọn TỰ DO, chọn "Mẫu trang phục" (Công sở / Đời thường / …) hoặc tự mô tả.
   - Phụ kiện: nếu trong ảnh không có kính thì xóa "Kính gọng đen" ở ô Phụ kiện.
4. **TIẾP TỤC**.

## 3. Bước 3 — BỐI CẢNH & CAMERA

- **Cấu hình có sẵn:**
  - Chọn **Địa điểm chính**. Nhân hiệu CEO hợp: Văn phòng hiện đại / Studio chuyên nghiệp / Phòng khách ấm cúng / Thư viện cổ điển / Sân thượng view thành phố.
  - Có ảnh nền thật (văn phòng, studio của người dùng) → **Master Background → Tải nền**; địa điểm tự chuyển sang "Sử dụng Background tải lên".
  - Chỉnh Thời điểm, Mood, Ánh sáng, Nhiệt độ màu, DoF, Thời tiết, Chuyển động môi trường. Gợi ý cho chuyên gia: Studio / Trung tính / Xóa phông mạnh / Tĩnh.
- **Cấu hình tự điền:** khi cần bối cảnh riêng, mô tả địa điểm, ánh sáng, mood bằng lời.
- **Camera:**
  - Cách quay: "Người khác quay (Cố định)" là chuẩn talking-head; "Selfie" hợp kiểu vlog.
  - Chuyển động NV: Đang ngồi / Đang đứng / Đang đi bộ.
  - Cỡ cảnh: Medium Close-up mặc định.
  - Chuyển động máy: Cố định / Zoom nhẹ.
- **Tính cách / Phong thái:** ví dụ "Điềm tĩnh, tự tin, truyền cảm hứng".
- **TIẾP TỤC**.

## 4. Bước 4 — TẠO MẪU (Master Reference)

- Bấm **TẠO MẪU MASTER REFERENCE** (tốn 1 ảnh, Nano Banana Pro). Ảnh mới được đặt làm ảnh chính, đúng người, đúng trang phục, đúng bối cảnh.
- Chụp màn hình so với ảnh gốc.
  - Lệch mặt → bấm tạo lại, tối đa 2 lần.
  - Vẫn lệch → quay lại bước 2, bấm chọn ảnh gốc làm ảnh chính rồi đi tiếp.
- **TIẾP TỤC**.

## 5. Bước 5 — KỊCH BẢN (Claude tự viết rồi dán)

Tool tự chia cảnh theo câu, tối đa 30 từ/cảnh, khoảng 3 từ/giây. Số từ quyết định thời lượng mỗi cảnh: ≥25 từ = 10s, 19–24 từ = 8s, 13–18 từ = 6s, ít hơn = 4s.

- Kịch bản theo ngôi thứ nhất, giọng nói tự nhiên như đang trò chuyện. Mạch:
  1. **Hook:** câu hỏi hoặc nhận định gây chú ý.
  2. **Câu chuyện / trải nghiệm thật.**
  3. **Quan điểm / bài học** (1–3 ý).
  4. **Giá trị cho người xem.**
  5. **CTA.**
- Tổng số từ ≈ thời lượng × 3. Ví dụ 50 giây ≈ 150 từ.
- Mỗi câu kết thúc bằng dấu chấm, chấm hỏi hoặc chấm than để Tool chia cảnh đúng. Nên viết mỗi cảnh là 1–2 câu, tổng 22–28 từ.
- Viết số bằng chữ. Không chen tiếng Anh, không dùng ký hiệu.
- Dán vào ô kịch bản → bấm **SẢN XUẤT**. Tool tự chia cảnh và sang bước 6.

## 6. Bước 6 — TẠO VIDEO (Bàn dựng phân cảnh)

1. Mỗi cảnh có lời thoại, ô "AI Visualization Prompt" và nhãn "x từ • ys". Đổi đa dạng góc máy bằng cách sửa NHẸ phần cuối prompt (cỡ cảnh / chuyển động máy) cho vài cảnh, ví dụ cảnh hook "Close-up … Zoom nhẹ", cảnh giữa "Upper Body … Cố định". KHÔNG xóa phần khóa mặt, khóa trang phục và lời thoại.
2. Bấm **TẠO TẤT CẢ**: Tool tạo lần lượt từng cảnh.
3. Theo dõi khoảng 60 giây/lần. Cảnh báo lỗi → **TẠO VIDEO** lại cảnh đó, tối đa 2 lần. Clip sai mặt, sai lời hoặc méo → **TẠO LẠI**, tối đa 1 lần.
4. Đủ video mọi cảnh thì lấy clip theo hướng dẫn môi trường chạy. Tool không có nút ghép phim, nên tự ghép ở hậu kỳ.
5. Lưu lời thoại từng cảnh vào `script.json`.

## 7. Hậu kỳ

1. Lấy đủ N clip theo thứ tự cảnh. Kiểm tra bằng ffprobe và soát lời thoại thực tế, sửa `script.json` cho khớp.
2. Ghép và chèn chữ:
   - **Tiêu đề hook** 0–3 giây (rút từ câu mở đầu, ≤ 8 chữ).
   - **Phụ đề** lời thoại, đặt nửa dưới, không che mặt.
   - **CTA** suốt cảnh cuối.
3. Trích 2–3 khung hình để kiểm tra: đúng mặt người, chữ không che mặt, dấu tiếng Việt đúng.

## 8. Trả thành phẩm

- File: `nhan_hieu_<chu-de>_final.mp4`.
- Báo ngắn: thời lượng, số cảnh, cảnh nào phải làm lại, có dùng âm thanh tham chiếu không.
- Caption ngôi thứ nhất: hook + 2–3 ý chính + CTA + 3–5 hashtag.

## Tín dụng Flow (ước tính N cảnh)

- **Ảnh:** 1 ảnh Master Reference (cộng số lần tạo lại).
- **Clip:** N clip Omni 1.1 Flash 720p, mỗi clip 4–10 giây.

## Xử lý sự cố

- **Chưa đăng nhập / hết tín dụng / không mở được Tool:** dừng và báo.
- **Nút RESET** tải lại Tool và mất toàn bộ thiết lập. Chỉ bấm khi muốn làm lại từ đầu.
- **Chuyển bước:** bước 1–4 chuyển bằng TIẾP TỤC / QUAY LẠI ở thanh dưới; bước 5 là SẢN XUẤT; bước 6 có "SỬA KỊCH BẢN" để quay về bước 5. Sửa kịch bản phải bấm SẢN XUẤT lại thì prompt từng cảnh mới cập nhật.
- **Không tải được âm thanh tham chiếu:** bỏ qua, chạy tiếp và ghi chú "giọng có thể khác nhau giữa các cảnh".
- **Lỗi "Lỗi tham số SDK…":** thường do thời lượng hoặc model không khớp. Đổi model về Gemini Omni 1.1 ở bước 1, quay lại bước 5 bấm SẢN XUẤT lại.
- **Lỗi "Video generation service unavailable":** dịch vụ Flow quá tải tạm thời, không phải lỗi thao tác. Chờ 2–3 phút rồi bấm TẠO VIDEO lại từng cảnh lỗi, không bấm TẠO TẤT CẢ liên tục. Vẫn lỗi sau 2 lần thì dừng, status "blocked".
- **Lỗi "You've reached your usage limit":** tài khoản Flow đã hết lượt cho model đang chọn. Thử lại không có tác dụng.
  - Chỉ khi đang dùng Gemini Omni 1.1: đổi sang model còn lại ĐÚNG 1 lần. Quay về bước 1 bằng QUAY LẠI (không bấm RESET), đổi model, rồi TIẾP TỤC tới bước 5 bấm SẢN XUẤT lại để prompt cập nhật.
  - Vẫn báo hết lượt → dừng, status "blocked", ghi rõ model nào hết lượt để Sếp chờ hạn mức mới hoặc nâng gói.
- **Sau khi bị ngắt và tiếp tục lại:** chụp snapshot trước để biết Tool đang ở bước nào. Không làm lại Master Reference nếu ảnh chính vẫn còn.
- Không kích hoạt hộp thoại alert/confirm của trình duyệt.
