---
name: zono-animated-video
description: Đạo diễn & sản xuất video hoạt hình 2D/3D và Motion Graphics đa ngành nghề (E-commerce, Ẩm thực F&B, Y tế/Mỹ phẩm, Giáo dục/Khóa học, Tài chính/BĐS, Người que kể chuyện) bằng tổ hợp Remotion + GSAP + Motion + Three.js/React-Three-Fiber + Lottie/Rive + Satori/SVGO + ShotCraft + VieNeu-TTS (bắt buộc) + Whisper + FFmpeg. Chạy tự động qua CLI (Claude/Codex/Gemini) xuất ra MP4 9:16 chuẩn -14 LUFS.
---

# ZONO ANIMATED VIDEO STUDIO — Tổ hợp 21 Công cụ Dựng Hoạt hình 2D/3D & Motion Graphics Đa Ngành Nghề

Skill này tích hợp tri thức từ:
1. **Agent Skills**: `remotion-dev/skills`, `greensock/gsap-skills`, `motiondivision/ai-kit`, `Vincentwei1021/video-shotcraft`
2. **Design & Vector**: `svg/svgo` (tối ưu vector nhân vật/icon), `vercel/satori` (bố cục card/typography chuẩn)
3. **Animation 2D & State Machine**: `greensock/GSAP`, `juliangarnier/anime`, `motiondivision/motion`, `rive-app/rive-wasm`, `LottieFiles/dotlottie-web`
4. **Video Engine**: `remotion-dev/remotion`, tư duy procedural từ `motion-canvas/motion-canvas`
5. **3D & Vật lý**: `three.js`, `@remotion/three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`, `@react-three/postprocessing`
6. **Âm thanh & Xuất bản**: **VieNeu-TTS (`pnnbao97/VieNeu-TTS` — bắt buộc)**, `faster-whisper`, `howler.js`, `mediabunny`, `ffmpeg`

---

## QUY TẮC BẤT BIẾN KHI DỰNG VIDEO HOẠT HÌNH TRONG REMOTION

1. **Mọi chuyển động PHẢI phụ thuộc vào `useCurrentFrame()` và `useVideoConfig()`**:
   - **CẤM** dùng CSS `transition`, CSS `@keyframes` tự chạy, hoặc `setTimeout`/`requestAnimationFrame` vì khi Remotion render từng frame song song sẽ bị lệch hình.
   - Khi dùng **GSAP** trong Remotion: Tạo `gsap.timeline({ paused: true })` trong `useMemo` và cập nhật vị trí theo frame hiện tại: `tl.seek(frame / fps)`.
   - Khi dùng **Remotion Spring / Interpolate**: Dùng `spring({ frame, fps, config: { damping: 14, stiffness: 120 } })` và `interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" })`.
2. **Không bịa timing — Đồng bộ tuyệt đối với giọng đọc thật từ VieNeu-TTS (`zono-vieneu-tts`)**:
   - **BẮT BUỘC** tạo giọng đọc bằng `zono-vieneu-tts` trước → Đo timestamp từng từ bằng `zono-news-transcribe` (`faster-whisper`) → Chia cảnh (Scene) và bung nhân vật/đồ họa/chữ động khớp đúng mốc giây của từng câu nói.
3. **Nhân vật Hoạt hình Vector / 2D / 3D Sống Động**:
   - Luôn có **nhân vật dẫn chuyện (Animated Character / Mascot)** ở mỗi cảnh: cử động nhịp thở (`Math.sin(frame * 0.12)`), nháy mắt định kỳ (`frame % 90 < 4`), cử động miệng khớp lúc có giọng đọc (mouth open/close theo chunk lời thoại), tay chỉ vào bảng số liệu/sản phẩm.
4. **Chuẩn khung hình & Âm thanh**:
   - Khung dọc `1080x1920`, `30fps`. Vùng an toàn (Safe Zone): nội dung chính và phụ đề karaoke nằm trong khoảng `top: 180px` đến `bottom: 260px` để không bị che bởi giao diện TikTok/Reels/Shorts.
   - Âm lượng thành phẩm chuẩn hóa `-14 LUFS` bằng `ffmpeg`.

---

## 6 TEMPLATE NGÀNH NGHỀ CHUẨN (INDUSTRY TEMPLATES)

### 1. `ecommerce-promo` — Hoạt hình E-commerce, Sản phẩm & Flash Sale
- **Màu sắc chủ đạo**: Cam Đỏ năng lượng (`#FF4D2D`), Vàng kim (`#FFD166`), Nền tối sang trọng (`#0F172A`) hoặc Trắng kem (`#FFFBEB`).
- **Cấu trúc ShotCraft (5 cảnh)**:
  - **Shot 1 (0–3s · Hook Bắt Mắt)**: Nhân vật Mascot hoạt hình giật mình / cầm loa phóng thanh + Tiêu đề Kinetic Typography bung mạnh bằng `spring`.
  - **Shot 2 (3–10s · Nỗi đau khách hàng)**: Hoạt hình minh họa vấn đề (icon vỡ, đồng hồ chạy nhanh, so sánh cách cũ bất tiện).
  - **Shot 3 (10–22s · Giải pháp & Sân khấu Sản phẩm 3D/2D)**: Sản phẩm đặt giữa sân khấu có vòng sáng hào quang xoay (`frame * 2`), 3 badge tính năng bung tuần tự từ 3 góc.
  - **Shot 4 (22–32s · Bằng chứng & So sánh Giá)**: Bảng VS (Sản phẩm thường vs Sản phẩm của Shop) + Bộ đếm số (Counter) giảm giá nhảy từ giá gốc xuống giá ưu đãi.
  - **Shot 5 (32–40s · CTA Chốt Đơn)**: Nút mua hàng nhấp nháy nhịp tim + Mũi tên chỉ xuống giỏ hàng.

### 2. `fnb-cartoon` — Hoạt hình Ẩm thực, Nhà hàng, Đồ ăn vặt & Trà sữa
- **Màu sắc chủ đạo**: Đỏ ớt (`#E63946`), Vàng bơ (`#FFB703`), Kem sữa (`#FFF8F0`), Nâu cacao (`#3D251E`).
- **Cấu trúc ShotCraft**:
  - Nhân vật Đầu bếp Hoạt hình (Chef Mascot đội mũ trắng, cử động tay tung hứng).
  - Hiệu ứng làn khói thơm bay lên bằng đường cong SVG Bezier chuyển động (`strokeDashoffset` + `Math.sin`), ngôi sao lấp lánh quanh món ăn, thẻ đánh giá 5 sao vàng bung nảy.

### 3. `health-beauty` — Hoạt hình Y tế, Dược phẩm, Nha khoa, Spa & Mỹ phẩm
- **Màu sắc chủ đạo**: Xanh Ngọc Y Khoa (`#0EA5E9` / `#10B981`), Trắng tinh khiết (`#F8FAFC`), Hồng Pastel (`#F43F5E` cho mỹ phẩm).
- **Cấu trúc ShotCraft**:
  - Nhân vật Bác sĩ / Chuyên gia Hoạt hình (mặc áo blouse trắng, đeo kính, cầm bảng clipboard, gật đầu giải thích).
  - Đồ họa cơ chế tác dụng (vòng tròn bảo vệ, hạt dưỡng chất thẩm thấu, biểu đồ cải thiện theo tuần).

### 4. `education-explainer` — Hoạt hình Giáo dục, Khóa học, AI & Kiến thức (Phong cách Motion Canvas / Kurzgesagt)
- **Màu sắc chủ đạo**: Tím Indigo (`#6366F1`), Xanh Cyan (`#06B6D4`), Nền Deep Space (`#0B1021`).
- **Cấu trúc ShotCraft**:
  - Sơ đồ khối (Flowchart / Mindmap) tự vẽ đường nối (`strokeDasharray` / `strokeDashoffset`) theo từng câu giảng.
  - Nhân vật học viên hoạt hình từ trạng thái bối rối (dấu `?` xoay trên đầu) chuyển sang bừng sáng (bóng đèn `💡` phát sáng).

### 5. `finance-realestate` — Hoạt hình Tài chính, Bất động sản, Đầu tư & B2B SaaS
- **Màu sắc chủ đạo**: Xanh Emerald (`#10B981`), Vàng Gold (`#F59E0B`), Xanh Navy (`#0F172A`).
- **Cấu trúc ShotCraft**:
  - Biểu đồ cột / đường tăng trưởng dựng động theo thời gian thực, tòa nhà/tài sản vector 2.5D mọc lên theo hiệu ứng spring, con số ROI/Lợi nhuận chạy counter mượt.

### 6. `stickman-story` — Hoạt hình Người Que (Stickman) Kể Chuyện, So Sánh & Đạo Lý
- **Màu sắc chủ đạo**: Nền giấy vẽ (`#FAF6F0`) hoặc Bảng đen (`#18181B`), nét vẽ rõ nét kèm điểm nhấn màu Đỏ/Xanh.
- **Cấu trúc ShotCraft**:
  - Nhân vật Người Que có khớp tay/chân/đầu hoạt hoạt bằng hàm lượng giác theo `frame` (đi bộ, chỉ tay, nhún vai, vui mừng).
  - Chia đôi màn hình (Split-screen): Bên trái "Người làm cách cũ (Đỏ)" vs Bên phải "Người thông thái (Xanh)".

---

## QUY TRÌNH 6 BƯỚC THỰC THI TỰ ĐỘNG QUA CLI

1. **Bước 1 — Phân tích Yêu cầu & Lập Kịch bản Phân cảnh (ShotCraft Blueprint)**:
   - Xác định ngành nghề (`template`: `ecommerce-promo` | `fnb-cartoon` | `health-beauty` | `education-explainer` | `finance-realestate` | `stickman-story`).
   - Viết lời thoại tiếng Việt (`script.txt`, độ dài 35–75 giây, câu ngắn gọn, giàu hình ảnh, viết số dễ đọc cho TTS).
2. **Bước 2 — Sinh Giọng Đọc AI Bắt Buộc Bằng VieNeu-TTS (`zono-vieneu-tts`)**:
   - **BẮT BUỘC** dùng lệnh `zono-vieneu-tts` để chọn giọng đọc tiếng Việt 48kHz của VieNeu-TTS (tuyệt đối không tự gọi TTS khác):
     ```bash
     zono-vieneu-tts --voice "<Tên giọng VieNeu-TTS>" --rate=+4% --file script.txt --write-media voice.mp3
     ```
   - **Danh sách 9 giọng đọc VieNeu-TTS chuẩn để chọn theo ngành nghề**:
     - `Ngọc Huyền` — Nữ miền Bắc (Tự nhiên, biên tập viên, giáo dục, y tế)
     - `Thanh Bình` — Nam miền Bắc (Trầm ấm, kể chuyện người que, tài chính)
     - `Phạm Tuyên` — Nam miền Bắc (Tự nhiên, review sản phẩm, e-commerce)
     - `Xuân Vĩnh` — Nam miền Bắc (Tin tức, chuyên gia B2B/BĐS)
     - `Ngọc Linh` — Nữ miền Bắc (Truyền cảm, dẫn chuyện)
     - `Đoan Trang` — Nữ miền Nam (Trẻ trung, bán hàng Flash Sale, F&B)
     - `Trúc Ly` — Nữ miền Nam (Dịu dàng, mỹ phẩm, spa, ẩm thực)
     - `Ngọc Trân` — Nữ miền Trung (Tự nhiên, gần gũi)
     - `Quang Sơn` — Nam miền Trung (Chững chạc, uy tín)
   - Nếu có tệp âm thanh mẫu để nhân bản giọng nói (Zero-shot Voice Cloning), truyền thêm `--ref-audio <path.wav> --ref-text "<nội dung mẫu>"`.
3. **Bước 3 — Đo Word-Timestamp (`zono-news-transcribe`) & Sinh Phụ đề Karaoke (`zono-news-chunks`)**:
   - Chạy `zono-news-transcribe voice.mp3 words.json`.
   - Tạo `sents.json` khớp từng câu với mốc giây thật, rồi chạy `zono-news-chunks sents.json <slug>Chunks <out.ts>`.
4. **Bước 4 — Thiết kế Nhân vật Hoạt hình & Phân cảnh trong Remotion (`src/<slug>/`)**:
   - Tạo component Nhân vật Hoạt hình SVG/Canvas riêng cho ngành nghề (có cử động mắt, miệng khớp âm thanh, tay, nhịp thở).
   - Tạo các Scene chuyển cảnh mượt (kết hợp `spring`, `interpolate`, hiệu ứng hạt/ánh sáng, biểu đồ động, thẻ thông tin).
   - Luôn hiển thị lớp Phụ đề Karaoke (`Captions.tsx`) nổi bật phía dưới.
5. **Bước 5 — Kiểm tra Tĩnh (`tsc` & `remotion still`)**:
   - Chạy `npx tsc --noEmit` để đảm bảo 0 lỗi TypeScript.
   - Chụp 3–4 frame bằng `npx remotion still` và dùng `Read` kiểm tra bố cục không tràn lề, chữ rõ đẹp.
6. **Bước 6 — Render MP4 & Chuẩn hóa Âm thanh `-14 LUFS`**:
   - Render bằng `npx remotion render <CompId> render.mp4 --codec=h264`.
   - Chuẩn hóa loudness bằng `ffmpeg` ra `final.mp4` và ghi `result.json`.
