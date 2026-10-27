---
name: flow-nguoi-que-so-sanh
description: Người dùng đưa 2 (hoặc nhiều) sản phẩm cần so sánh + ảnh trong Claude → Claude tự chạy công cụ "Storyboard Studio VN" trên Google Flow với nhân vật người que (stick figure) — đầu vào tham chiếu → kịch bản phân cảnh → storyboard (cảnh neo) → video có thoại tiếng Việt → lấy clip, ghép nối, chèn chữ (tiêu đề + phụ đề + CTA) → trả video người que so sánh sản phẩm thành phẩm.
---

# Video người que so sánh sản phẩm qua Google Flow

## Luồng chạy tổng quan (bắt buộc tuân theo)

```
[1] NGUỒN DỮ LIỆU: người dùng đưa trong Claude
     (sản phẩm A vs B, tiêu chí so sánh, ảnh sản phẩm, ảnh người que mẫu, giọng, CTA…)
        ↓
[2] CLAUDE TỰ XỬ LÝ TRÊN GOOGLE FLOW — đúng công cụ "Storyboard Studio VN"
     1 Đầu vào → 2 Kịch bản → 3 Storyboard (neo cảnh 1) → 4 Video → lấy clip
        ↓
[3] HẬU KỲ: ghép các clip theo thứ tự + tiêu đề hook, phụ đề, CTA
        ↓
[4] TRẢ VỀ: 1 file MP4 thành phẩm
```

Nguyên tắc:
- **Chỉ dùng đúng công cụ "Storyboard Studio VN"**. Không dùng công cụ khác, không tự viết prompt Veo ngoài công cụ.
- **Nét vẽ do ẢNH THAM CHIẾU quyết định.** Tool chép đúng nhân vật, nét vẽ và màu của ảnh "Nhân vật". Muốn ra người que thì ảnh Nhân vật phải là người que.
- **So sánh trung thực:** chỉ nêu ưu/nhược đúng với thông tin người dùng đưa. Không bịa thông số, không bôi xấu thương hiệu đối thủ. Không có dữ liệu thì nói chung ("giá mềm hơn", "phù hợp người mới"), không đưa con số.
- Kết quả cuối là video đã nối + đã chèn chữ.

## 0. Nhận dữ liệu

| Trường | Bắt buộc | Mặc định |
|---|---|---|
| Sản phẩm A (của mình) và B (đối chứng) | Có | — |
| Tiêu chí so sánh | Không | 3–4 tiêu chí: giá, chất lượng/hiệu quả, tiện lợi, hậu mãi |
| Ảnh sản phẩm A / B | Không | Không có → Tool vẽ theo mô tả (người que cầm hộp/biểu tượng) |
| Ảnh người que mẫu | Không | Tạo bằng trình tạo ảnh gốc của Flow (xem bước 1) |
| Giọng | Không | Nam miền Bắc |
| Số cảnh / thời lượng | Không | 6 cảnh × 8 giây ≈ 48 giây, khung 9:16 |
| Kết luận / CTA | Không | Nghiêng về A bằng lý do có thật + CTA "Bấm link để xem chi tiết" |

## 1. Bước 1 — ĐẦU VÀO

1. **Kiểm tra dữ liệu cũ:** Tool tự lưu bản nháp trong trình duyệt. Nếu đang mở dự án cũ (đã có ảnh tham chiếu, đang ở bước > 1 hoặc ô kịch bản có chữ), bấm **Làm mới** 2 lần (lần 1 hiện "Xóa dữ liệu?", lần 2 xác nhận). Nút này chỉ xóa nháp của Tool, ảnh và video trong Flow vẫn còn.
2. **Debug Prompt** phải TẮT. Khi bật, Tool chỉ hiện prompt và không tạo gì.
3. **1. THAM CHIẾU** (tối đa 4 ảnh; dùng 3 là tốt nhất) → **THÊM ẢNH** → hộp chọn ảnh của Flow.
   - Ảnh đầu tiên mặc định vai "NHÂN VẬT", các ảnh sau là "SẢN PHẨM". Bấm nhãn vai dưới ảnh để đổi vòng: Nhân vật → Sản phẩm → Bối cảnh → Khác.
   - Thứ tự nên dùng: (1) người que = Nhân vật, (2) sản phẩm A = Sản phẩm, (3) sản phẩm B = Sản phẩm.
   - Mỗi ảnh tạo khung chỉ dùng tối đa 3 tham chiếu, nên ảnh thứ 4 thường bị bỏ qua.
   - Chưa có ảnh người que: về trang project, tạo 1 ảnh bằng trình tạo gốc (Image, 9:16, x1). Prompt: "simple black stick figure character, round head, expressive face, thick clean lines, flat pastel background, minimal doodle explainer style, no text". Sau đó chọn ảnh đó trong Images. Ghi chú là ảnh do AI tạo.
4. **2. PHONG CÁCH BỔ SUNG** (tiếng Anh, ngắn): ví dụ "stick figure doodle explainer, white background, bold black lines, product shown as simple colored icons, comparison graphics".
5. **3. TỶ LỆ KHUNG HÌNH:** 9:16 (TikTok/Reels) hoặc 16:9 (YouTube).
6. **4. GIỌNG AI:** bấm "Nam miền Bắc" / "Nữ miền Bắc" / "Nữ miền Nam". Có thể sửa ô mô tả giọng, viết bằng tiếng Anh.
7. **DÁN KỊCH BẢN TIẾNG VIỆT:** dán kịch bản đã viết (xem mục 2) → **Phân tích kịch bản**. Tool tự chia cảnh rồi sang bước 2.

## 2. Viết kịch bản so sánh (Claude tự viết trước khi dán)

Mạch chuẩn 6 cảnh:

1. **Hook / nỗi đau:** "Phân vân giữa A và B?"
2. **Giới thiệu hai bên:** người que đứng giữa, A một bên, B một bên.
3. **Tiêu chí 1**
4. **Tiêu chí 2**
5. **Tiêu chí 3**
6. **Kết luận + CTA:** ai nên chọn A, ai hợp với B.

Quy tắc khi dán: ghi rõ "Cảnh n:", mô tả hành động người que, và lời thoại trong ngoặc kép. Mỗi cảnh 8 giây thì lời thoại **≤ 16 từ**, vì Tool tính 2 từ/giây và báo đỏ khi vượt. Ghi số bằng chữ ("hai trăm nghìn"), không dùng ký hiệu %/$, không chen tiếng Anh vào lời thoại.

## 3. Bước 2 — KỊCH BẢN (bảng phân cảnh)

Kiểm tra từng cảnh:
- **Tiêu đề**.
- **Thời lượng:** 4s / 6s / 8s / 10s. Mặc định 8s.
- **Mô tả hình ảnh (EN):** tiếng Anh, cụ thể. Ví dụ: "stick figure holds product A on the left, product B on the right, a scale tips toward A, split-screen comparison". Không yêu cầu chữ trên hình, vì Tool cấm chữ mới.
- **Lời thoại (VN):** bộ đếm "x/y từ" phải không đỏ.
- **Chuyển động:** static / push-in / action. Mặc định static, dùng push-in cho hook và kết luận.
- **Có thoại:** bật, chọn **voice over** (người que không mấp máy môi, hợp phong cách người que).
- Thiếu cảnh → **Thêm cảnh**. Thừa cảnh → **Gỡ cảnh** (bấm 2 lần).

Lưu toàn bộ lời thoại vào `script.json`, rồi bấm **Duyệt kịch bản → Sang Storyboard**.

## 4. Bước 3 — STORYBOARD (khóa phong cách bằng cảnh neo)

1. Bấm **Tạo Scene 1 làm neo** ở thanh dưới, chờ ảnh. Chụp màn hình kiểm tra:
   - đúng phong cách người que như ảnh tham chiếu;
   - không có người thật, không 3D;
   - sản phẩm nhận ra được.
   Sai thì bấm **Tạo lại**, hoặc nút mỏ neo (tạo lại và bám ảnh tham chiếu chặt hơn). Tối đa 2 lần.
2. Bấm **Duyệt Neo & Tạo phần còn lại**. Tool tạo các khung còn lại, 2 khung cùng lúc.
3. Xem tất cả khung. Khung lệch phong cách → mỏ neo / **Tạo lại**.
4. Bấm **Chuyển sang Video**.

## 5. Bước 4 — VIDEO

- Bấm **Tạo tất cả video chưa có**. Model Omni 1.1 Flash, 2 clip cùng lúc. Nếu lỗi, Tool tự thử lại 1 lần bằng ảnh tham chiếu.
- Theo dõi khoảng 60 giây/lần bằng thanh dưới "x / N clip video" cho tới khi đạt N/N.
- Cảnh lỗi → **Thử lại** trên thẻ cảnh, tối đa 2 lần. Clip sai lời hoặc lệch phong cách → **Tạo lại**, tối đa 1 lần.
- Bước 5 HOÀN THIỆN có "Ghép phim / Lưu video / Tải clip gốc", tải qua trình duyệt nên có thể bị chặn. Ưu tiên lấy clip ngay ở bước 4 theo hướng dẫn môi trường chạy, rồi tự ghép ở hậu kỳ.

## 6. Hậu kỳ

1. Lấy đủ N clip theo thứ tự cảnh. Kiểm tra bằng ffprobe (thời lượng, có audio) và soát lời thoại thực tế.
2. Ghép và chèn chữ:
   - **Tiêu đề hook** 0–3 giây: "<A> HAY <B>? CHỌN CÁI NÀO".
   - **Phụ đề** lời thoại.
   - **CTA** suốt cảnh cuối.
3. Trích 2–3 khung hình để kiểm tra chữ không che người que hoặc sản phẩm, dấu tiếng Việt đúng.

## 7. Trả thành phẩm

- File: `so_sanh_<a>_vs_<b>_final.mp4`.
- Báo ngắn: thời lượng, số cảnh, cảnh nào phải làm lại, ảnh nào do AI tạo.
- Caption: câu hỏi hook + 3 gạch đầu dòng so sánh + kết luận + CTA + hashtag.

## Tín dụng Flow (ước tính N cảnh)

- **Ảnh khung:** N ảnh (Nano Banana Pro), cộng 1 ảnh người que nếu phải tạo.
- **Clip:** N clip Omni 1.1 Flash.
- **Phân tích:** mỗi ảnh tham chiếu và lần phân tích kịch bản gọi thêm 1 lượt phân tích chữ.

## Xử lý sự cố

- **Chưa đăng nhập / hết tín dụng / không mở được Tool:** dừng và báo, không đổi công cụ.
- **"Phân tích kịch bản" bị mờ:** cần ít nhất 1 ảnh tham chiếu và ô kịch bản có chữ.
- **Lỗi phân tích (hộp "Lỗi phân tích"):** đóng hộp, rút gọn kịch bản (≤ 12 cảnh, mỗi cảnh 1–2 câu) rồi bấm lại.
- **Ảnh tham chiếu hiện dấu ⚠:** nháp cũ bị mất ảnh. Gỡ bỏ và chọn lại ảnh trong Images, không tải lên lại.
- **Khung ra người thật hoặc 3D:** ảnh Nhân vật chưa đúng người que, hoặc ô phong cách bổ sung mâu thuẫn. Sửa rồi tạo lại khung neo.
- Không kích hoạt hộp thoại alert/confirm của trình duyệt.
