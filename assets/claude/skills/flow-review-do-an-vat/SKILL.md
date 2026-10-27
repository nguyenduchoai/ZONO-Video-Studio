---
name: flow-review-do-an-vat
description: Người dùng đưa thông tin sản phẩm trong Claude → Claude tự chạy công cụ "Review Đồ Ăn Vặt AI V6" trên Google Flow (cấu hình → khung chủ → kịch bản → storyboard → sản xuất) → tải clip, ghép nối, chèn chữ (phụ đề + tiêu đề + CTA) → trả video thành phẩm về Claude.
---

# Video review đồ ăn vặt tự động qua Google Flow

## Luồng chạy tổng quan (bắt buộc tuân theo)

```
[1] NGUỒN DỮ LIỆU: người dùng đưa trong Claude
     (tên sản phẩm, ảnh, giọng, ưu đãi/CTA…)
        ↓
[2] CLAUDE TỰ XỬ LÝ TRÊN GOOGLE FLOW
     đúng công cụ "Review Đồ Ăn Vặt AI V6"
     Cấu hình → Khung chủ → Kịch bản → Storyboard → Sản xuất tất cả → Tải tất cả clip
        ↓
[3] HẬU KỲ (Claude làm, không cần người dùng)
     Ghép nối các clip theo thứ tự cảnh + Edit chữ (phụ đề, tiêu đề hook, CTA)
        ↓
[4] TRẢ VỀ CLAUDE: 1 file MP4 thành phẩm gửi trong cuộc trò chuyện
```

Nguyên tắc:
- **Mọi dữ liệu đầu vào lấy từ Claude** (tin nhắn/tệp người dùng gửi). Không bắt người dùng thao tác gì trên Google Flow.
- **Chỉ dùng đúng công cụ "Review Đồ Ăn Vặt AI V6"** trong Google Flow — không dùng công cụ khác (Avatar Studio, Cinematic, Cooking…), không tự viết prompt Veo ngoài công cụ.
- **Kết quả cuối cùng phải là video đã nối + đã chèn chữ, trả về trong Claude.** Không dừng ở bước có các clip rời.

## 0. Nhận dữ liệu từ Claude

Lấy từ tin nhắn/tệp người dùng; chỉ hỏi (1 lần, AskUserQuestion) những gì thiếu và không có mặc định:

| Trường | Bắt buộc | Mặc định |
|---|---|---|
| Tên sản phẩm | Có | — |
| Ảnh sản phẩm / khung chủ | Không | AI tạo khung chủ |
| Miền / Giới tính / Tốc độ / Xưng hô | Không | Miền Bắc / Nữ / 4.5 tiếng/giây / "chị" |
| Ưu đãi / nội dung CTA (chữ trên video) | Không | Rút từ lời thoại cảnh DEAL và CTA |
| Tiêu đề hook (chữ đầu video) | Không | Tự đặt ngắn gọn, vd. "REVIEW <TÊN SP> – CÓ ĐÁNG TIỀN?" |
| Duyệt kịch bản trước khi sản xuất | Không | Không — chạy thẳng |

Ảnh người dùng gửi trong Claude nằm ở thư mục uploads; nếu cần đưa lên Flow thì dùng tool upload của Chrome (upload_image / file_upload).
Lưu lại toàn bộ kịch bản cuối cùng (lời thoại từng cảnh) — dùng cho phụ đề ở bước 7.

## 1. Mở đúng công cụ trên Google Flow (Claude in Chrome)

Dùng Claude in Chrome (Chrome của người dùng, đã đăng nhập tài khoản Google có gói Flow ULTRA). Đọc skill `chrome-browser` trước, nạp tool Chrome trong 1 lần ToolSearch (tabs_context_mcp, tabs_create_mcp, navigate, read_page, find, computer, form_input, get_page_text, javascript_tool, upload_image, file_upload).

1. `tabs_context_mcp`, mở tab mới tới `https://flow.google.com`.
2. Mở một project (gần nhất, hoặc tạo mới bằng nút "+").
3. Sidebar → **Công cụ** → **"Review Đồ Ăn Vặt AI V6"** (thường ghim ngay dưới mục Công cụ; nếu không thấy: trang Công cụ → "Công cụ của tôi" → "Công cụ được chia sẻ với tôi"). URL dạng `flow.google.com/project/<id>/tool/906532d8-6672-4f21-8bc4-55e5bd9cac91`.
4. Kiểm tra tiêu đề trang là "Review Đồ Ăn Vặt AI V6" trước khi làm tiếp.
5. Nếu công cụ đang ở bước cũ của sản phẩm trước, bấm bước **1 CẤU HÌNH** trên thanh tiến trình để bắt đầu lại.

Định vị nút theo chữ bằng `find` / `read_page`, không click theo tọa độ cứng.

## 2. Bước 1 — CẤU HÌNH

- "THÔNG TIN SẢN PHẨM": điền tên sản phẩm.
- Bấm **XÁC NHẬN HỒ SƠ AI**, chờ hiện "HỒ SƠ ĐÃ ĐƯỢC XÁC NHẬN".
- "CẤU HÌNH GIỌNG NÓI": Miền, Giới tính, thanh tốc độ nói, ô "XƯNG HÔ".
- **TIẾP TỤC**.

## 3. Bước 2 — KHUNG CHỦ

- Có ảnh từ người dùng → **TẢI ẢNH LÊN**.
- Không có → **AI TẠO KHUNG CHỦ**, chờ ảnh hiện ra.
- **TIẾP TỤC**.

## 4. Bước 3 — KỊCH BẢN

- Tạo/điền kịch bản cho tất cả cảnh theo đúng vai trò. Mặc định 6 cảnh × 8s: CHÀO → … → ĂN THỬ → ĐÁNH GIÁ → DEAL và CTA.
- Mỗi cảnh ~32–33 tiếng, ~8s. Cảnh lệch nhiều hoặc sai vai trò → nút làm mới (↻) của cảnh đó.
- Lời thoại khớp xưng hô và đúng tên sản phẩm; lồng ưu đãi người dùng đưa vào cảnh DEAL và CTA.
- Đọc lại toàn bộ lời thoại bằng get_page_text và lưu vào `script.json` (danh sách `{canh, vai_tro, loi_thoai}`).
- Nếu người dùng muốn duyệt → gửi kịch bản bằng SendUserMessage và chờ; nếu không → **DUYỆT KỊCH BẢN**.

## 5. Bước 4 — STORYBOARD

- Tạo tất cả khung hình (nút tạo tất cả nếu có, không thì từng cảnh). Chờ đủ ảnh.
- Khung lỗi/méo sản phẩm → **TẠO LẠI**.
- **SANG BƯỚC SẢN XUẤT**.

## 6. Bước 5 — SẢN XUẤT

- **SẢN XUẤT TẤT CẢ**.
- Kiểm tra ~60s/lần bằng read_page đến khi mọi cảnh có video (có nút TẢI VỀ). Cảnh lỗi → **LÀM LẠI CLIP** (tối đa 2 lần/cảnh, sau đó báo người dùng).
- **TẢI TẤT CẢ CLIP** (hoặc TẢI VỀ từng cảnh) → clip vào thư mục Downloads trên máy.

## 7. Hậu kỳ: ghép nối + edit chữ

### 7.1 Lấy clip
1. Xin quyền thư mục Downloads (`device_request_folder_access`) nếu chưa kết nối.
2. Chọn đúng các clip vừa tải (theo thời gian sửa đổi/tên file), giải nén nếu là .zip, sắp theo thứ tự cảnh 1 → N.
3. `device_stage_files` các clip lên workspace cloud (ở đó có sẵn ffmpeg và font tiếng Việt, kết quả ổn định). Kiểm tra `ffprobe` từng clip: thời lượng, độ phân giải (thường dọc 9:16), có audio.

### 7.2 Ghép nối
```
ffmpeg -i c1.mp4 -i c2.mp4 ... -filter_complex "[0:v][0:a][1:v][1:a]...concat=n=N:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 18 -preset medium -c:a aac -b:a 192k merged.mp4
```
Clip không có audio → thêm `anullsrc` cho clip đó. Clip khác độ phân giải/fps → `scale` + `fps` về cùng thông số trước khi concat.

### 7.3 Edit chữ (phụ đề + tiêu đề + CTA)
Tạo file `subs.ass` từ `script.json` và thời lượng thực của từng clip (mốc bắt đầu cảnh k = tổng thời lượng các clip trước):

- **Phụ đề lời thoại:** chia lời thoại mỗi cảnh thành các câu/cụm ≤ ~8–10 từ, chia đều thời lượng cảnh theo số tiếng. Vị trí nửa dưới khung hình (trên vùng UI TikTok/Reels ~ 25% từ đáy), chữ trắng đậm, viền đen 3–4px, font hỗ trợ tiếng Việt (Be Vietnam Pro / Noto Sans — kiểm tra bằng `fc-list | grep -i -E "vietnam|noto"`, cài nếu thiếu), cỡ ~6% chiều cao video.
- **Tiêu đề hook:** 0–3s đầu, phía trên khung hình, chữ vàng/trắng đậm nền hộp tối mờ.
- **CTA:** suốt cảnh cuối (DEAL và CTA), ví dụ "🛒 BẤM GIỎ HÀNG NGAY" hoặc ưu đãi người dùng đưa; chỉ dùng emoji nếu font hiển thị được, không thì bỏ.
- Kiểm tra chính tả, dấu tiếng Việt và đúng tên sản phẩm.

Burn chữ vào video:
```
ffmpeg -i merged.mp4 -vf "ass=subs.ass" -c:v libx264 -crf 18 -preset medium -c:a copy \
  -movflags +faststart /mnt/user-data/outputs/review_<ten-san-pham>_final.mp4
```

### 7.4 Kiểm tra chất lượng
- `ffprobe`: tổng thời lượng ≈ tổng các clip, có video + audio.
- Trích 3–4 khung hình (đầu, giữa, cảnh CTA) bằng `ffmpeg -ss <t> -frames:v 1`, dùng Read để xem: chữ không bị cắt, không che mặt/sản phẩm, dấu tiếng Việt đúng. Sai thì chỉnh `subs.ass` và render lại.

## 8. Trả thành phẩm về Claude

- File cuối: `/mnt/user-data/outputs/review_<ten-san-pham>_final.mp4` → gọi SendUserFile để video hiện trong cuộc trò chuyện.
- Nếu Downloads đang kết nối → thêm `device_commit_files` bản final vào cạnh các clip gốc.
- Trả lời 1–2 câu: tên file, thời lượng, số cảnh; nêu cảnh nào phải làm lại (nếu có).

## Xử lý sự cố

- Chưa đăng nhập Flow / hết credit / không thấy công cụ "Review Đồ Ăn Vặt AI V6" → dừng và báo người dùng, không chuyển sang công cụ khác, không thử vòng lặp.
- Không dùng được Claude in Chrome → dùng trình duyệt tích hợp (built-in browser) cùng quy trình; cả hai đều không có thì mới đề nghị bật computer use.
- Không được quyền Downloads → nhờ người dùng kéo các clip vào Claude, rồi làm tiếp bước 7 từ thư mục uploads.
- Không kích hoạt hộp thoại alert/confirm của trình duyệt.
