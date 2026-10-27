---
name: chien-luoc-content-doanh-nghiep
description: >-
  Chiến lược content doanh nghiệp — dựng chiến lược content trọn gói. INPUT là bảng nạp thông tin doanh
  nghiệp 3 cấp độ (8, 24 hoặc 48 câu) để khách tự điền. OUTPUT gồm: quét đối thủ realtime chỉ
  ra cách làm đang hiệu quả nhất, 3 phương án chiến lược, concept truyền thông, ngân hàng ý
  tưởng có chấm điểm, kiến trúc phễu TOFU MOFU BOFU, kế hoạch 30 ngày và kịch bản content viết
  sẵn. PHẢI dùng skill này khi người dùng yêu cầu: "xây chiến lược content", "chiến lược nội
  dung cho khách", "tư vấn content cho doanh nghiệp", "gợi ý concept truyền thông", "quét đối
  thủ content", "spy đối thủ", "đối thủ đang chạy content gì hiệu quả", "cho tôi ý tưởng
  content", "khảo sát doanh nghiệp để làm content", "định hướng nội dung cho thương hiệu",
  "chiến lược kênh cho khách coaching", "phân tầng TOFU MOFU BOFU", "kế hoạch content 30
  ngày", "lịch đăng bài kèm kịch bản", "viết kịch bản content cho team". Kể cả khi chỉ nói
  "làm chiến lược content cho [doanh nghiệp/ngành]" hay "khách này nên làm content gì" — PHẢI
  dùng ngay.
---

# CHIẾN LƯỢC CONTENT DOANH NGHIỆP

## Skill này giải quyết việc gì

Skill này biến một doanh nghiệp chưa có định hướng nội dung thành bộ tài liệu mà
đội nội dung cầm lên là chạy được ngay: chiến lược, concept, phễu ba tầng, lịch
30 ngày và kịch bản viết sẵn. Mọi đề xuất đều dựa trên hai nguồn dữ liệu: thông
tin do chính doanh nghiệp khai báo, và bằng chứng thực tế về những gì đối thủ
đang làm hiệu quả tại thời điểm hiện tại.

Nguyên tắc nền: không đề xuất bất cứ điều gì bằng trí nhớ. Mọi nhận định về đối
thủ, trend, định dạng đang lên đều phải quét web ngay trong phiên làm việc.

## Ranh giới với các skill khác

Skill này chạy trọn vẹn từ đầu đến kịch bản, không cần chuyển giao giữa chừng.
Các skill dưới đây chỉ nạp thêm khi có nhu cầu cụ thể.

| Tình huống | Xử lý |
|---|---|
| Toàn bộ chuỗi từ nạp thông tin đến kịch bản content | Skill này, chạy đủ 7 bước |
| Cần thêm ngân sách, unit economics và đủ 17 hạng mục cấp CEO để trình hội đồng | Nạp thêm `master-ke-hoach-chi-tiet` ở Bước 6 |
| Cần lịch đa kênh cho 5 nền tảng cùng lúc với cấu trúc Excel riêng | Nạp thêm `mkt-content-calendar-multi-channel` ở Bước 6 |
| Kịch bản thuộc một công thức chuyên biệt đã có skill riêng | Nạp skill viết tương ứng ở Bước 7 |
| Việc của ZONO hoặc của anh Kiểm | Nạp thêm `zono-business-dna` ngay từ Bước 1 |
| Xuất deliverable ra slide | Nạp thêm `slide-cam-xanh-sieu-dep` hoặc `slide-thuyet-trinh-dep` |

---

## QUY TRÌNH 7 BƯỚC BẮT BUỘC

Thực hiện đúng thứ tự. Sau mỗi bước phải dừng lại để người dùng duyệt, trừ khi
người dùng nói rõ "làm một mạch".

### BƯỚC 1 — PHÁT BẢNG NẠP THÔNG TIN (INPUT)

Đọc `references/bang-nap-thong-tin.md` và chọn cấp độ phù hợp:

- **Cấp NHANH (8 câu)**: khi người dùng cần chiến lược sơ bộ trong phiên chat,
  hoặc khi đây là khách hàng đang ngồi trực tiếp trên lớp coaching.
- **Cấp CHUẨN (24 câu)**: mặc định cho khách coaching, khách tư vấn.
- **Cấp ĐẦY ĐỦ (48 câu)**: dự án lớn, doanh nghiệp trên 50 nhân sự, hợp đồng tư
  vấn dài hạn.

Hai cách phát bảng:
1. Hiển thị trực tiếp trong chat để người dùng trả lời ngay.
2. Xuất ra file Excel hoặc Word có cột "Câu hỏi / Vì sao hỏi / Gợi ý trả lời /
   Ô điền" để gửi cho doanh nghiệp tự điền rồi gửi lại. Dùng cách này khi người
   dùng nói "gửi bảng cho khách", "xuất form", "làm bảng khảo sát".

Tự động điền trước những gì đã biết. Nếu doanh nghiệp đã có file trong bộ nhớ
(ví dụ các khách coaching đã lưu), đọc file đó và chỉ hỏi phần còn thiếu. Nếu có
website, quét website trước rồi điền sẵn, sau đó hỏi khách xác nhận thay vì hỏi
lại từ đầu.

Không được sang Bước 2 khi còn thiếu bốn thông tin cốt tử: sản phẩm và giá,
chân dung khách hàng, mục tiêu kinh doanh của kỳ, năng lực sản xuất của đội.

### BƯỚC 2 — QUÉT ĐỐI THỦ REALTIME

Đọc `references/quy-trinh-quet-doi-thu.md` và chạy đủ giao thức quét. Đây là
bước tạo ra giá trị khác biệt lớn nhất của skill, không được rút gọn.

Yêu cầu tối thiểu: xác định 5 đến 8 đối thủ thuộc ba lớp (trực tiếp cùng phân
khúc, gián tiếp khác phân khúc nhưng cùng tệp khách, và tham chiếu quốc tế), sử
dụng tối thiểu 8 truy vấn tìm kiếm, và trả về hai bảng bắt buộc: bảng hồ sơ đối
thủ và bảng "cách làm đang hiệu quả nhất" đã giải mã thành công thức lặp lại
được.

Khi không tìm được dữ liệu tương tác cụ thể, phải nói rõ là suy luận từ dấu hiệu
gián tiếp chứ không được bịa số liệu.

### BƯỚC 3 — BA PHƯƠNG ÁN CHIẾN LƯỢC

Không đưa một phương án duy nhất. Luôn dựng ba phương án có định hướng khác nhau
rõ rệt để người ra quyết định lựa chọn:

| Phương án | Bản chất | Phù hợp khi |
|---|---|---|
| **A — Bám sát thị trường** | Làm giống cách đối thủ mạnh đang làm nhưng chất lượng cao hơn và tần suất dày hơn | Đội chưa có kinh nghiệm, cần kết quả nhanh, ngân sách hạn chế |
| **B — Chiếm khoảng trống** | Đánh vào vùng nội dung chưa ai làm tốt phát hiện được ở Bước 2 | Có đội sản xuất ổn định, chấp nhận 30-60 ngày đầu chậm |
| **C — Đảo ngược luật chơi** | Đi ngược quy ước ngành, dùng định dạng hoặc giọng điệu chưa ai dùng | Thương hiệu có cá tính người thật, chịu được rủi ro tranh cãi |

Mỗi phương án phải có: luận điểm cốt lõi, kiến trúc kênh, phân bổ TOFU/MOFU/BOFU
kèm lý do, sản lượng yêu cầu đối chiếu với năng lực đội đã khai báo, thời gian
kỳ vọng thấy kết quả, rủi ro lớn nhất, và điều kiện để phương án này thất bại.

Phần cuối phải có khuyến nghị rõ ràng chọn phương án nào và vì sao, dựa trên số
liệu thật của doanh nghiệp chứ không nói chung chung.

### BƯỚC 4 — CONCEPT TRUYỀN THÔNG

Đọc `references/thu-vien-concept.md`. Đề xuất ba concept, mỗi concept gồm:

- Big idea diễn đạt trong một câu
- Tagline hoặc câu định vị dùng được trên bìa kênh
- Năm trụ cột nội dung kèm tỷ lệ phân bổ
- Giọng điệu và những điều tuyệt đối không nói
- Ba ví dụ tiêu đề bài viết thể hiện đúng concept để khách hình dung

Concept phải bám vào khoảng trống phát hiện ở Bước 2. Nếu concept đề xuất trùng
với thứ đối thủ đang làm, phải nói rõ điểm khác biệt nằm ở đâu.

### BƯỚC 5 — NGÂN HÀNG Ý TƯỞNG AI

Đọc `references/khung-y-tuong-va-cham-diem.md`.

Sinh tối thiểu 30 ý tưởng nội dung (50 nếu là cấp ĐẦY ĐỦ), phân bổ theo ma trận
góc tiếp cận nhân với tầng phễu. Mỗi ý tưởng gồm: tầng phễu, định dạng, tiêu đề
hoặc hook cụ thể, góc tiếp cận, và điểm dự đoán hiệu quả.

### BƯỚC 6 — KIẾN TRÚC PHỄU BA TẦNG VÀ KẾ HOẠCH 30 NGÀY

Đọc `references/kien-truc-pheu-3-tang.md` trước, rồi đến
`references/plan-30-ngay-va-kich-ban.md`.

Trình tự bắt buộc trong bước này:

1. Chốt tỷ lệ TOFU, MOFU, BOFU dựa trên tình trạng thật của doanh nghiệp, kèm
   giải thích vì sao chọn tỷ lệ đó và cái giá phải trả khi chọn như vậy.
2. Chỉ rõ ba cơ chế chuyển tầng: từ TOFU sang MOFU, từ MOFU sang BOFU, và từ
   khách đã mua sang mua lại. Mỗi cơ chế phải nêu tên công cụ cụ thể và người
   phụ trách. Phễu thiếu cơ chế chuyển tầng là phễu không hoạt động.
3. Chia 30 ngày thành bốn tuần có nhiệm vụ khác nhau, mỗi tuần một chủ đề trọng
   tâm duy nhất.
4. Dựng bảng lịch 30 ngày với đủ 16 cột cố định, kèm sheet tóm tắt cho người
   quản lý gồm sản lượng theo kênh, phân bổ ba tầng thực tế và khối lượng công
   việc theo từng người.
5. Dựng **Sheet 0 — CONCEPT KÊNH** theo đúng đặc tả ở mục "SHEET 0" bên dưới và
   đặt nó làm sheet đầu tiên của workbook. Đây là sheet người ra quyết định đọc
   trước tiên, không được gộp nó vào sheet lịch hay sheet tóm tắt.

Trước khi sang Bước 7, chạy ba câu hỏi kiểm tra phễu ở cuối file kiến trúc phễu.
Nếu có một câu chưa trả lời được thì quay lại sửa, không được đi tiếp.

### BƯỚC 7 — KỊCH BẢN CONTENT CHI TIẾT

Viết tối thiểu 7 kịch bản hoàn chỉnh tương ứng tuần đầu tiên, đủ để đội nhân bản
cho ba tuần còn lại. Viết đủ 30 kịch bản khi người dùng yêu cầu bản đầy đủ hoặc
khi đây là gói bàn giao cho khách trả phí.

Bảy kịch bản đầu tiên phải phủ đủ ba tầng phễu và ít nhất ba định dạng khác nhau,
để đội có mẫu cho mọi tình huống chứ không phải bảy biến thể của cùng một dạng.

Kịch bản bài viết phải viết nguyên văn đủ bảy phần. Kịch bản video phải viết
nguyên văn lời thoại theo cấu trúc HOOK, BODY, CTA, dựng theo đúng đặc tả ở mục
"ĐẶC TẢ KỊCH BẢN VIDEO" bên dưới. Không được nộp dàn ý, mô tả ý, hay gạch đầu dòng
thay cho lời thoại. Một kịch bản đạt là kịch bản host cầm lên đọc thẳng vào camera
được mà không phải nghĩ thêm chữ nào.

Sau đó tự chấm toàn bộ bản giao theo thang 100 điểm. Chỉ được xuất khi đạt từ 90
điểm trở lên. Nếu dưới 90, tự sửa và chấm lại, tối đa ba vòng, rồi mới trình.

---

## ĐỊNH DẠNG ĐẦU RA

Mặc định trả lời trong chat bằng văn bản có bảng. Chuyển sang file khi:

| Người dùng nói | Xuất ra |
|---|---|
| "dựng deck", "làm slide", "trình bày cho khách" | Slide HTML hoặc PPTX theo skill slide tương ứng |
| "gửi bảng cho khách điền" | Excel hoặc Word bảng nạp thông tin |
| "cho team thực thi", "giao cho đội content" | Excel gồm bốn sheet theo đúng thứ tự: `0. CONCEPT KÊNH`, `1. NGÂN HÀNG Ý TƯỞNG`, `2. LỊCH 30 NGÀY`, `3. TÓM TẮT QUẢN LÝ` |
| "viết luôn kịch bản", "viết sẵn bài cho team" | File Word hoặc Markdown chứa các kịch bản hoàn chỉnh |
| "làm đầy đủ để ký hợp đồng tư vấn" | Bộ ba: deck slide chiến lược, Excel lịch 30 ngày, file kịch bản |

Tên file theo mẫu `ChienLuocContent_<TenDoanhNghiep>_<TTTT-NNNN>`, riêng file kịch
bản đặt là `KichBanContent_<TenDoanhNghiep>_<TTTT-NNNN>`.

---

## SHEET 0 — CONCEPT KÊNH (BẮT BUỘC, LUÔN LÀ SHEET ĐẦU TIÊN)

Mọi file Excel chiến lược do skill này xuất ra đều phải mở đầu bằng sheet tên
`0. CONCEPT KÊNH`. Không có sheet này thì bản giao coi như chưa hoàn thành, bất kể
các sheet còn lại làm tốt đến đâu. Lý do: người ra quyết định cần thấy định vị và
concept trước khi xem lịch đăng; nếu định vị sai thì 60 dòng lịch bên trong đều
sai theo.

### Cấu trúc bắt buộc

Trình bày dạng hai cột: cột A là tên hạng mục, cột B là nội dung. Chia thành các
khối, mỗi khối có một dòng tiêu đề nền màu đậm chữ trắng chạy hết chiều ngang.

**Dòng 1 và 2 — Đầu sheet**
- Dòng 1: tên kênh viết in, cỡ chữ lớn nhất trong file.
- Dòng 2: một câu duy nhất nêu nhiệm vụ của kênh, kèm dòng ghi người chuẩn bị và
  ngày chuẩn bị.

**Khối 1 — ĐỊNH VỊ KÊNH**

| Hạng mục | Nội dung phải có |
|---|---|
| Tên kênh đề xuất | Tên cụ thể, kèm ghi chú đồng bộ đúng một tên trên tất cả nền tảng đang chạy |
| Vai trò trong hệ thống kênh | Kênh này là kênh gì trong hệ sinh thái, các kênh khác đổ khách về đâu. Nếu doanh nghiệp chỉ có một kênh thì ghi rõ là kênh duy nhất và hệ quả của việc đó |
| Tệp khán giả lõi | Giới tính, khoảng tuổi, tình trạng sống, khu vực địa lý cụ thể, mức thu nhập, mối quan tâm |
| Giọng điệu | Ai xưng gì gọi gì, nói dài hay ngắn, chứng minh bằng cách nào |
| Vũ khí thương hiệu phải cài vào kịch bản | Đánh số từng vũ khí. Đây là những lợi thế đối thủ không copy được, mọi kịch bản đều phải cài ít nhất một cái |

**Khối 2 — TRỤ NỘI DUNG VÀ NHỊP ĐĂNG**

| Hạng mục | Nội dung phải có |
|---|---|
| Từng trụ nội dung | Đặt tên trụ theo kiểu gọi được thành tên riêng, kèm tỷ lệ phần trăm ngay trong tên trụ. Mô tả rõ mỗi video hoặc mỗi bài của trụ đó làm gì |
| Tần suất đề xuất | Số video mỗi tuần, khung giờ vàng cụ thể, đăng chéo mấy nền tảng |
| Phễu chuyển đổi | Vẽ thành chuỗi có mũi tên từ video tới đơn hàng. Phải nêu cơ chế đo được kênh nào ra khách, ví dụ mỗi video một từ khóa comment riêng |
| KPI theo mốc thời gian | Chia theo tháng 1, tháng 2, tháng 3. Ghi rõ là đề xuất và sẽ chốt lại khi có baseline thật |

**Khối 3 — CÁCH DÙNG FILE NÀY**

| Hạng mục | Nội dung phải có |
|---|---|
| Giải thích các cột tự tính | Nêu công thức và giả định đằng sau, ví dụ tốc độ đọc voice-over bao nhiêu từ mỗi giây |
| Quy tắc khi quay | Mỗi video đúng một thông điệp, hook lên hình trong mấy giây đầu, số liệu kỹ thuật phải lấy số thật không được bịa |
| Quy tắc cạnh tranh | Được so sánh theo nhóm sản phẩm, không chê đích danh thương hiệu khác |
| Ràng buộc pháp lý của ngành | Bắt buộc có khối này nếu ngành bị quản lý về quảng cáo (sữa và dinh dưỡng trẻ nhỏ, dược và thực phẩm chức năng, y tế, tài chính, giáo dục, bất động sản). Nêu căn cứ văn bản, nội dung bị cấm, hệ quả cho kênh, nhóm sản phẩm được phép đẩy mạnh, và câu nhắc cần luật sư xác nhận |

### Quy tắc trình bày — bám đúng mẫu

| Thành phần | Đặc tả |
|---|---|
| Font toàn file | Arial |
| Dòng 1, tên kênh | Cỡ 20, in đậm, màu đỏ `C00000`, viết in hoa, có dấu chấm giữa ngăn cách phần loại kênh và tên thương hiệu, ví dụ `KÊNH CHÍNH · KINGSOFA SOFA ĐIỆN` |
| Dòng 2, nhiệm vụ | Cỡ 10, in nghiêng, màu xám `808080`, gộp ô A và B |
| Dòng tiêu đề khối | Nền đỏ `C00000`, chữ trắng in đậm cỡ 11, viết in hoa, gộp ô hết chiều ngang, cao 22 |
| Tên hạng mục, cột A | In đậm, màu đỏ `C00000`, cỡ 10, canh trên, bật ngắt dòng |
| Nội dung, cột B | Chữ đen cỡ 10, canh trên, bật ngắt dòng |
| Viền | Viền mảnh màu `BFBFBF` cho mọi ô có nội dung |
| Độ rộng cột | Cột A từ 30 đến 36, cột B từ 60 đến 96 |
| Khoảng cách khối | Chừa đúng một dòng trống giữa hai khối |
| Lưới | Tắt đường lưới của sheet |

Khối nào mang tính hướng dẫn vận hành thay vì định vị, ví dụ khối Cách dùng file
này, được dùng nền xanh `1F4E79` thay cho đỏ để phân biệt bằng mắt.

### Mẫu đã điền — dùng làm chuẩn đối chiếu

```
KÊNH CHÍNH · KINGSOFA SOFA ĐIỆN
Kênh gốc của thương hiệu. Nhiệm vụ: giáo dục thị trường về sofa điện, xây niềm
tin bằng xưởng thật và bảo hành khủng, đổ khách về phễu. Chuẩn bị ngày 24/07/2026.

▌ĐỊNH VỊ KÊNH
Tên kênh đề xuất    │ Kingsofa · Sofa Điện May Đo (đồng bộ đúng 1 tên trên
                    │ TikTok, Facebook Reels, YouTube Shorts, Zalo OA)
Vai trò trong hệ    │ Kênh MẶT TIỀN của thương hiệu. Kênh 2 và kênh 3 kéo view
thống 3 kênh        │ xong đều trỏ khách về Zalo OA.
Tệp khán giả lõi    │ Nữ 25-45 và cặp vợ chồng trẻ sở hữu hoặc sắp nhận căn hộ
                    │ chung cư tại HN, SG, Hải Phòng, Đà Nẵng. Quan tâm nội
                    │ thất thông minh, tiết kiệm diện tích.
Giọng điệu          │ Người thật việc thật. Anh kỹ thuật xưởng thật thà + chị
                    │ tư vấn tinh tế. Nói ngắn, chứng minh bằng demo. Xưng em,
                    │ gọi anh chị.
Vũ khí thương hiệu  │ 1) Tự sản xuất động cơ tại xưởng Việt Nam. 2) May đo theo
PHẢI cài vào kịch   │ bản vẽ căn hộ. 3) Bảo hành tốt nhất thị trường: KHUNG 15
bản                 │ NĂM, MÚT 5 NĂM, ĐỘNG CƠ 3 NĂM ĐỔI MỚI. 4) Dùng thử, đổi
                    │ trả rõ ràng, lỗi giao hàng 1 đổi 1.

▌3 TRỤ NỘI DUNG & NHỊP ĐĂNG
Trụ 1 · HỎI XOÁY    │ Trả lời câu hỏi thật của khách về sofa điện: tốn điện,
ĐÁP THẬT (40%)      │ mất điện, hỏng động cơ, giá, bảo hành. Mỗi video 1 câu,
                    │ nói cả nhược điểm, có demo.
Tần suất đề xuất    │ 5-7 video/tuần. Khung giờ vàng: 11h30-13h00 và 19h00-
                    │ 21h00. Đăng chéo 3 nền tảng cùng lúc.
Phễu chuyển đổi     │ Video → comment từ khóa (ĐIỆN, BÓC GIÁ, BẢO HÀNH...) →
                    │ inbox → kéo về Zalo OA → gửi bản vẽ → báo phí → chốt.
                    │ Mỗi video 1 từ khóa riêng để đo kênh nào ra khách.
KPI 90 ngày (đề     │ Tháng 1: dựng nền, 30 video, đo baseline view và lead.
xuất, chốt lại khi  │ Tháng 2: tối thiểu 2 video vượt trung bình kênh 5 lần.
có baseline)        │ Tháng 3: chuẩn hóa công thức thắng, lead tăng so tháng 2.
```

Hai chi tiết trong mẫu này bắt buộc giữ lại ở mọi bản giao. Thứ nhất, tên trụ viết
in hoa và có tỷ lệ phần trăm ngay trong tên, để người viết kịch bản đọc tên là biết
phải viết gì. Thứ hai, ô KPI luôn kèm chữ trong ngoặc nói rõ đây là đề xuất và sẽ
chốt lại khi có baseline thật, vì đặt KPI cứng khi chưa biết xuất phát điểm là đặt
sai.

### Tự kiểm trước khi xuất

Sheet 0 chỉ được coi là đạt khi trả lời được cả bốn câu: một người mới vào đội đọc
riêng sheet này có hiểu kênh đang làm gì và cho ai không; có đủ vũ khí thương hiệu
để người viết kịch bản cài vào bài không; có nêu ràng buộc pháp lý của ngành chưa;
và mở file ra nhìn có giống mẫu đối chiếu ở trên về màu sắc và bố cục không. Thiếu
một câu thì sửa, chưa được xuất file.

---

## ĐẶC TẢ KỊCH BẢN VIDEO

Đây là phần quyết định chất lượng cảm nhận của cả bản giao. Chiến lược sai thì sửa
được, kịch bản nhạt thì đội quay xong mới biết và mất luôn ngày quay đó.

### Nguyên tắc gốc: viết lời thoại, không viết mô tả

Sai: "Host giải thích rằng động cơ chỉ chạy khi bấm nút nên rất tiết kiệm điện."

Đúng: "Sự thật là động cơ chỉ chạy lúc mình bấm nút chỉnh, mỗi lần vài giây. Ngả
lưng, nâng chân, xong là nó nghỉ. Không phải cắm chạy suốt như tủ lạnh đâu ạ."

Mọi ô HOOK, BODY, CTA đều là chữ host sẽ nói ra miệng. Viết như nói chuyện: câu
ngắn, có ngắt hơi, có từ đệm tự nhiên, có xưng hô. Chốt xưng hô ngay ở Sheet 0 và
giữ nguyên trong toàn bộ kịch bản.

### Cấu trúc mười hai cột bắt buộc

| # | Cột | Yêu cầu |
|---|---|---|
| 1 | STT | |
| 2 | Tên video | Gọi được thành tên, không phải mô tả |
| 3 | Trụ nội dung | Khớp tên trụ đã đặt ở Sheet 0 |
| 4 | Insight đánh trúng | Một câu nêu nỗi sợ hoặc mong muốn thật của khách. Không có insight thì không được viết tiếp |
| 5 | HOOK (thoại 0–5s) | Nguyên văn, tối đa hai câu |
| 6 | BODY (thoại chính) | Nguyên văn, viết liền mạch như một đoạn nói |
| 7 | CTA (thoại chốt) | Nguyên văn, hai tầng |
| 8 | Số từ thoại | Công thức tự đếm, xem bên dưới |
| 9 | Ước tính giây | Công thức tự tính, xem bên dưới |
| 10 | Cảnh quay và B-roll | Cảnh cụ thể quay được, không nói chung chung |
| 11 | Mục tiêu và phễu | Ghi rõ mục tiêu kèm từ khoá comment riêng của video này |
| 12 | Ghi chú sản xuất | Điều dễ làm sai hoặc dễ vi phạm khi quay video này |

Hai cột tự tính, viết đúng công thức này, thay số dòng tương ứng:

```
Số từ thoại  = (LEN(TRIM(E5))-LEN(SUBSTITUTE(TRIM(E5)," ",""))+1)
             + (LEN(TRIM(F5))-LEN(SUBSTITUTE(TRIM(F5)," ",""))+1)
             + (LEN(TRIM(G5))-LEN(SUBSTITUTE(TRIM(G5)," ",""))+1)
Ước tính giây = ROUND(H5/2.8,0)
```

Giả định tốc độ đọc voice-over 2,8 từ mỗi giây, tương đương 168 từ mỗi phút. Chuẩn
thoại 45 đến 90 giây tương đương 126 đến 252 từ. Sửa thoại xong mở file là số tự
nhảy lại. Phải ghi giả định này vào Sheet 0.

### Tám kiểu hook, mỗi kịch bản chọn một

| Kiểu hook | Cách dựng | Ví dụ |
|---|---|---|
| Câu hỏi khách đang sợ | Hỏi đúng nỗi sợ rồi hứa trả lời dứt điểm | "Mất điện thì sofa điện có thành cục gạch không? Câu này ngày nào em cũng nhận được, trả lời dứt điểm luôn." |
| Con số gây choáng | Ném con số ra trước, giải thích sau | "Mẹ đang đốt gần bốn triệu một năm, chỉ vì cái này đóng sai size." |
| Lệnh dừng lại | Ra lệnh ngược với việc khách sắp làm | "Sắp nhận nhà mà ví vừa cạn? Khoan mua sofa. Nghe hết sáu mươi giây này đã." |
| Đếm ngược vào demo | Đếm ngược rồi cho xem ngay biến hoá | "Đây là chiếc giường giấu trong phòng khách sáu mươi lăm mét vuông. Nhìn kỹ nhé. Ba. Hai. Một. Đấy." |
| Người bán tự phản | Người bán nói điều bất lợi cho chính mình | "Tôi bán mặt hàng này, và tôi nói thẳng là anh chị đang mua thừa." |
| Tình huống có twist | Mở bằng sự việc lạ rồi hé lộ lỗi không nằm ở chỗ ai cũng nghĩ | "Một mẹ tới đổi tã lần thứ ba trong một tuần. Và lỗi không nằm ở tã." |
| Bác bỏ niềm tin phổ biến | Nêu điều ai cũng tin rồi lật lại | "Mẹ tưởng mua lố là rẻ. Tính ra thì không phải lúc nào cũng vậy." |
| Chỉ thẳng vào người xem | Nói đúng tình trạng người xem đang có | "Bé chật size hai tuần rồi mà mẹ vẫn chưa nhận ra." |

Trong bảy kịch bản đầu tiên phải dùng ít nhất bốn kiểu hook khác nhau. Bảy hook
cùng một kiểu là bản giao không đạt.

### Năm nhịp bắt buộc trong BODY

Viết liền mạch thành một đoạn, nhưng bên trong phải đi đủ năm nhịp theo thứ tự:

1. **Neo độ tin.** Một câu cho biết vì sao host có tư cách nói chuyện này. Thường
   là tần suất gặp: "Đây là câu em bị inbox hỏi nhiều nhất."
2. **Giải thích bằng vật quen thuộc.** Quy cái khách không hiểu về cái khách sờ
   được mỗi ngày: ngang một cái quạt bàn, chưa bằng một cốc trà đá, luồn vừa hai
   ngón tay.
3. **Bằng chứng.** Số đo thật, demo trên tay, tin nhắn khách có xin phép và che
   tên, hoặc cảnh quay tại nơi sản xuất. Cấm dựng số, cấm bịa tình huống rồi nói
   là chuyện thật.
4. **Cài vũ khí thương hiệu.** Ít nhất một vũ khí đã khai ở Sheet 0, cài vào mạch
   nói chứ không đọc như quảng cáo.
5. **Câu chốt đảo ngược.** Một câu ngắn lật lại cách nghĩ thông thường, để người
   xem nhớ được sau khi quên hết phần còn lại: "Đừng mua sofa may sẵn rồi về cắt
   gọt không gian nhà mình theo nó, phải ngược lại chứ ạ."

### CTA hai tầng

Mỗi CTA gồm một hành động nhẹ và một hành động nặng, viết trong cùng một đoạn nói.

Tầng nhẹ là bình luận đúng một từ khoá viết hoa, riêng cho từng video, để đo được
video nào ra khách. Tầng nặng là nhắn tin kèm thứ khách phải gửi, càng cụ thể càng
tốt: ảnh bản vẽ, mã căn hộ, cân nặng của bé, tháng nhận nhà.

Kèm một câu gỡ rủi ro cho người xem, để hành động nặng bớt nặng: "vừa và đẹp thì
mình tính tiếp, không vừa coi như xem cho vui."

### Sheet kịch bản chuyển đổi tách riêng

Khi doanh nghiệp có chạy quảng cáo, tách một sheet riêng cho kịch bản chuyển đổi,
tối thiểu năm kịch bản. Sheet này dùng đủ mười hai cột ở trên, thêm hai cột chèn
vào sau cột Trụ nội dung:

- **Công thức**: đặt tên công thức đang dùng, ví dụ PAS, Demo 3 giây, So sánh
  trước sau, Phản chứng, Đếm ngược chi phí.
- **Tệp target và setup ads**: độ tuổi, khu vực, sở thích, tệp retarget, và mục
  tiêu chiến dịch.

### Bảng tự kiểm từng kịch bản trước khi xuất

Chạy qua bảy câu này cho từng kịch bản. Sai một câu thì sửa, không được xuất.

| # | Câu hỏi kiểm |
|---|---|
| 1 | Ô HOOK, BODY, CTA có phải là chữ đọc thẳng ra miệng được không, hay vẫn đang là mô tả |
| 2 | Hook có nói được trong 5 giây không, đọc thử bấm giờ |
| 3 | BODY có đủ năm nhịp không, đặc biệt là nhịp bằng chứng và câu chốt đảo ngược |
| 4 | Có cài ít nhất một vũ khí thương hiệu từ Sheet 0 không |
| 5 | CTA có đủ hai tầng và có từ khoá riêng không trùng video khác không |
| 6 | Cột số giây có rơi vào khoảng 45 đến 90 không. Quá dài thì cắt BODY, không cắt HOOK |
| 7 | Có vi phạm ràng buộc pháp lý hoặc quy tắc cạnh tranh đã ghi ở Sheet 0 không |

### Định dạng khi xuất ra Word thay vì Excel

Khi người dùng muốn file kịch bản dạng Word, giữ nguyên toàn bộ nội dung mười hai
cột nhưng trình bày mỗi kịch bản thành một mục riêng: tiêu đề mục là tên video kèm
trụ và tầng phễu, sau đó là dòng thông tin sản xuất, rồi bảng chia theo mốc giây
gồm bốn cột là mốc giây, hình ảnh, lời thoại của host, và chữ trên màn hình. Phần
insight, từ khoá phễu và ghi chú sản xuất đặt ngay dưới bảng.

## GIỌNG VIẾT VÀ NGUYÊN TẮC

Viết câu hoàn chỉnh theo văn phong công việc. Không dùng câu ngắn giật cục, khẩu
hiệu, câu hỏi tu từ làm tiêu đề, hay các cụm sáo rỗng kiểu "bứt phá ngoạn mục".

Mọi con số phải có nguồn hoặc được ghi rõ là ước tính kèm cách tính. Khi năng lực
sản xuất của đội không đủ cho phương án đề xuất, phải nói thẳng và đưa phương án
thu hẹp thay vì im lặng cho qua.

Không hứa kết quả cụ thể theo kiểu cam kết. Nói về khoảng kỳ vọng kèm điều kiện.

## FILE THAM CHIẾU

- `references/bang-nap-thong-tin.md` — bảng nạp thông tin ba cấp độ
- `references/quy-trinh-quet-doi-thu.md` — giao thức quét và giải mã đối thủ
- `references/thu-vien-concept.md` — thư viện 12 concept truyền thông
- `references/khung-y-tuong-va-cham-diem.md` — ma trận sinh ý tưởng và thang điểm 100
- `references/kien-truc-pheu-3-tang.md` — định nghĩa và tỷ lệ TOFU, MOFU, BOFU cùng cơ chế chuyển tầng
- `references/plan-30-ngay-va-kich-ban.md` — kiến trúc bốn tuần, bảng lịch 16 cột và mẫu kịch bản

Nếu một file tham chiếu không tồn tại trên đĩa, vẫn chạy đủ bảy bước theo đúng đặc
tả đã viết trong file này và nói rõ với người dùng là file tham chiếu đó đang thiếu,
để họ biết mà bổ sung. Không được lấy việc thiếu file làm lý do rút gọn quy trình.
