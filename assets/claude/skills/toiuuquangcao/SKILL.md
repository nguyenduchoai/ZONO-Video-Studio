---
name: toiuuquangcao
description: >
  Engine tối ưu chi phí quảng cáo Meta Ads theo tuần — lấy dữ liệu API trực tiếp,
  tính CPL trần từ unit economics, lọc nhiễu bằng ngưỡng significance, chẩn đoán
  bằng 3 Ranking của Meta, ra quyết định scale/giữ/tắt an toàn với learning phase,
  kèm kill-switch cắt lỗ trong ngày. Mục tiêu là TỐI ĐA HÓA LỢI NHUẬN trên mỗi
  đồng ngân sách, không phải làm CPL rẻ nhất. Dùng skill này BẤT CỨ KHI NÀO người
  dùng muốn: tạo báo cáo ads tuần, tối ưu chi phí quảng cáo, so sánh tuần này vs
  tuần trước, phân tích CPL/CPM/ROAS theo mã, quyết định scale/tắt mã, tính CPL
  trần hòa vốn, chẩn đoán mã đắt, lập kế hoạch phân bổ ngân sách. Kích hoạt khi
  nghe "báo cáo ads tuần", "tối ưu quảng cáo", "tối ưu chi phí ads", "report tuần",
  "so sánh tuần", "phân tích mã ads", "mã nào scale mã nào tắt", "CPL bao nhiêu thì
  lời", "tổng kết quảng cáo", "/toiuuquangcao", hoặc cung cấp số liệu thô từ Meta Ads.
---

# Tối Ưu Quảng Cáo — Meta Ads Profit Engine

Lấy dữ liệu Meta Ads API → neo vào kinh tế đơn vị → lọc nhiễu → chẩn đoán → ra quyết định ngân sách an toàn → báo cáo. Đây là engine **tối đa hóa lợi nhuận**, không phải công cụ săn CPL rẻ.

---

## Triết lý cốt lõi (đọc trước, áp dụng xuyên suốt)

1. **CPL rẻ không phải mục tiêu. Lợi nhuận mới là.** Một mã CPL cao mà lead chất, chốt tốt, lời nhiều thắng một mã CPL thấp mà lead rác. Mọi quyết định phải neo vào CPL trần tính từ unit economics, không phải vào con số CPL tuyệt đối.
2. **Không quyết khi chưa đủ data.** CPL trên mẫu nhỏ là số rác. Một mã chỉ được kết luận "tốt/tệ" khi vượt ngưỡng significance (Bước 2.3).
3. **Tôn trọng learning phase.** Đừng đụng vào mã đang học. Scale sai cách reset learning và đốt tiền. Quy tắc scale an toàn ở Bước 3 Phần 5.
4. **Cắt lỗ theo giờ, không theo tuần.** Báo cáo tuần để định hướng, kill-switch để chặn máu chảy trong ngày (Bước 3 Phần 6).
5. **Tách cold và retargeting.** Hai phễu khác bản chất, đặt ngưỡng riêng, không gộp CPL trung bình.
6. **Mọi nhận định kèm số. Không tô hồng. Không bịa.** Metric null → N/A.

> Chi tiết toàn bộ công thức và ngưỡng nằm ở `references/optimization_rules.md`. Đọc file đó khi cần con số chính xác.

---

## Bước 0 — Thu thập đầu vào

Hỏi user (nếu chưa có trong context). Chia 2 nhóm:

### 0.1 — Kỹ thuật (bắt buộc)
1. **Ad Account ID** (`act_XXXXXXXXXX`)
2. **Tuần này**: ngày bắt đầu → kết thúc
3. **Tuần trước**: ngày bắt đầu → kết thúc
4. **Định dạng xuất**: Markdown chat / Word / Cả hai

### 0.2 — Kinh tế đơn vị (để tính CPL trần — phần cốt lõi của tối ưu chi phí)
Hỏi đủ 3 số này để engine tự tính ngưỡng, KHÔNG bắt user đoán CPL hòa vốn:
5. **AOV** — giá trị đơn trung bình (VNĐ)
6. **Tỷ lệ chốt** từ lead/tin nhắn → đơn (%)
7. **Biên lợi nhuận gộp** trên doanh thu (%)
8. **Biên lời mong muốn giữ lại** (%, mặc định 30% nếu user không rõ)

> **Fallback**: Nếu user CHƯA có data chốt đơn (mới chạy, chưa đủ vòng), cho phép nhập tay `CPL hòa vốn` + `CPL lý tưởng` như cũ. Nhưng phải nói rõ: "Ngưỡng nhập tay là tạm. Khi có data chốt thật, engine sẽ tính CPL trần chính xác hơn."

### 0.3 — Phân tầng phễu (nếu user có chạy cả 2)
9. Mã nào là **cold** (tệp lạnh/mở rộng), mã nào là **retargeting/warm**? Để đặt ngưỡng riêng. Nếu user không phân, tự suy từ tên mã/tên adset (chứa "retar", "warm", "RT", "lookalike" vs "broad", "cold", "interest").

---

## Bước 1 — Lấy dữ liệu từ Meta Ads API

Gọi theo thứ tự. Cú pháp đầy đủ tại `references/api_calls.md`.

### 1.1 — Campaign level (cả 2 tuần)
Metrics: `spend, impressions, reach, frequency, clicks, inline_link_clicks, actions, action_values, cost_per_action_type, cpm, cpc, ctr, inline_link_click_ctr`

### 1.2 — Ad Set level (tuần này)
Thêm fields: `daily_budget, lifetime_budget, optimization_goal, bid_strategy` + insights như trên. **`optimization_goal` và budget dùng để đánh giá learning phase và fragmentation.**

### 1.3 — Ad level — "từng mã" (tuần này)
Insights như trên **+ bắt buộc thêm 3 Ranking**: `quality_ranking, engagement_rate_ranking, conversion_rate_ranking`. Đây là la bàn chẩn đoán tại sao mã đắt.

### 1.4 — Phễu chuyển đổi (tuần này, ad level)
Lấy đủ các bước phễu trong `actions` để đo chất lượng, không chỉ kết quả cuối:
- Lead/Message: `landing_page_view → lead`/`messaging_conversation_started_7d`
- Purchase: `add_to_cart → initiate_checkout → purchase` + `action_values` (để tính ROAS)

### 1.5 — Breakdown theo ngày (account level, `time_increment: 1`)
Để phát hiện xu hướng trong tuần (CPL tăng dần? CPM tăng dần? = fatigue động) và phục vụ kill-switch.

> ⚠️ **Breakdown Effect**: KHÔNG cộng dồn metrics qua nhiều breakdown. Xem `references/breakdown_effect.md`.
> 📌 **Ghi chú deprecation**: Đây là ad-level insights của Marketing API (`spend, reach, impressions, cpm...`), khác với Page/Post organic insights đang bị bỏ giữa 2026. Metric ad-level ở đây vẫn ổn định. Dùng API v21.0+.

---

## Bước 2 — Xử lý, neo kinh tế, lọc nhiễu

### 2.1 — Xác định "data (cd)" = kết quả chính
- LEAD → `lead` | MESSAGES → `onsite_conversion.messaging_conversation_started_7d` | SALES → `purchase`
- **CPL** = `spend / số_data`
- Nếu mục tiêu Purchase: tính thêm **ROAS** = `action_values(purchase) / spend`

### 2.2 — Tính CPL trần từ unit economics (TRÁI TIM CỦA TỐI ƯU CHI PHÍ)
```
Giá trị mỗi lead   = AOV × Tỷ lệ chốt × Biên LN gộp
CPL hòa vốn        = Giá trị mỗi lead          ← chi đúng mức này thì huề
CPL trần (mục tiêu)= Giá trị mỗi lead × (1 − Biên lời mong muốn)
```
**Ví dụ**: AOV 500k, chốt 20%, biên gộp 40%, muốn giữ 30% lời.
- Giá trị mỗi lead = 500.000 × 0,20 × 0,40 = **40.000đ**
- CPL hòa vốn = **40.000đ**
- CPL trần = 40.000 × 0,70 = **28.000đ** ← đây là mốc xanh thật, không phải con số user đoán.

Tách ngưỡng theo phễu: **CPL trần retargeting** thường đặt = 50–70% CPL trần cold (warm rẻ hơn). Quy tắc chi tiết ở `references/optimization_rules.md`.

### 2.3 — Cổng significance (đủ data mới được kết luận)
Một mã CHỈ được gắn nhãn quyết định khi đạt **ít nhất một** trong hai:
- Số kết quả ≥ **30** (lý tưởng ≥ 50 để thoát learning), HOẶC
- Chi tiêu ≥ **3 × CPL trần**

Chưa đủ → gắn ⚪ "CHƯA ĐỦ DATA", **cấm tắt, cấm scale**, chỉ được tiếp tục nuôi đến ngưỡng. Đây là chốt chặn chống giết mã tốt vì nhiễu tuần.

### 2.4 — Cờ Learning Phase
Với mỗi adset: nếu kết quả 7 ngày < ~50 → đánh dấu `🔵 LEARNING`. Mã learning không áp ngưỡng CPL bình thường và không được scale mạnh.

### 2.5 — Gắn màu (chỉ áp cho mã đã qua cổng 2.3)
| Màu | Điều kiện | Ý nghĩa |
|---|---|---|
| 🟢 | CPL < CPL trần | Đang lời tốt, ứng viên scale |
| 🟡 | CPL trần ≤ CPL ≤ CPL hòa vốn | Lời mỏng, theo dõi/tối ưu |
| 🔴 | CPL > CPL hòa vốn | Đang lỗ, sửa hoặc tắt |
| ⚪ | Chưa qua cổng significance | Nuôi tiếp, chưa quyết |
| 🔵 | Adset đang learning | Để yên cho học xong |

### 2.6 — Xử lý null
Metric null → "N/A". Date range chạm hôm nay → chú thích "*Dữ liệu một phần*".

---

## Bước 3 — Báo cáo (template tại `references/report_template.md`)

Giữ khung 7 phần, nhưng nội hàm đã nâng cấp:

### Phần 1 — Tổng quan 2 tuần
Thêm dòng **CPL trần** và **% ngân sách đang chảy vào mã 🔴** (tiền đang lỗ là bao nhiêu).

### Phần 2 — Bảng chi tiết từng mã
Thêm cột: **CPL trần** (để so trực tiếp), **3 Ranking** (Above/Avg/Below), **cờ Learning/Significance**, **phân tầng cold/RT**. Sắp xếp theo khoảng cách tới CPL trần, không theo CPL tuyệt đối.

### Phần 3 — Điểm sáng & điểm tối
Điểm sáng = mã dưới CPL trần VÀ đã qua significance. Điểm tối ưu tiên mã đang **đốt nhiều tiền nhất vào kết quả lỗ**, không phải mã CPL cao nhất (mã CPL cao mà chi 50k thì kệ, mã CPL vừa mà chi 5 triệu lỗ mới nguy).

### Phần 4 — Chẩn đoán gốc rễ bằng phễu + 3 Ranking
Đọc 3 Ranking trước khi đoán:
- **Engagement Rate Ranking thấp** → creative/hook yếu (sửa nội dung).
- **Quality Ranking thấp** → quảng cáo bị đánh giá kém (clickbait, phản hồi tiêu cực, low-quality LP).
- **Conversion Rate Ranking thấp** → landing page / kịch bản chốt yếu (sửa sau cú click).
- **CPM cao + 3 ranking đều ổn** → audience hẹp/cạnh tranh/mùa cao điểm, không phải lỗi creative.
- **Fatigue động**: CPM tăng dần + CTR giảm dần theo ngày (Bước 1.5) → thay creative, đừng nhìn mỗi frequency tuyệt đối.
- **Fragmentation**: đếm số adset có kết quả < 50/tuần đang chia lẻ budget → đề xuất gộp.

### Phần 5 — Ma trận quyết định + SCALE AN TOÀN
4 nhóm 🚀 SCALE / ✅ GIỮ / ⚠️ THEO DÕI / ❌ TẮT, gắn điều kiện significance + learning. **Quy tắc scale bắt buộc**:
- Chỉ scale mã 🟢 đã qua significance VÀ adset đã thoát learning.
- Tăng budget **≤ 20% mỗi 2–3 ngày**. Muốn scale nhanh hơn → **duplicate adset** (scale ngang), không tăng dọc đột ngột.
- KHÔNG sửa nhiều thứ cùng lúc trên một adset (mỗi edit lớn reset learning).

### Phần 6 — Kế hoạch 7 ngày + KILL-SWITCH
Thêm ngưỡng cắt lỗ trong ngày (không đợi cuối tuần):
- Mã tiêu ≥ **1× CPL hòa vốn** mà **0 kết quả** → tắt trong ngày.
- Mã CPL ≥ **2× CPL hòa vốn** sau khi đã qua significance → tắt trong ngày.
- Một adset ngốn > 50% budget ngày mà CPL ở mức 🔴 → siết hoặc tắt ngay.

### Phần 7 — 2 Prompt AI
1 prompt kỹ thuật (theo lỗi 3-ranking/learning/fragmentation cụ thể nhất) + 1 prompt creative (theo lỗi engagement/fatigue cụ thể nhất).

---

## Bước 4 — Xuất kết quả
- **Markdown trong chat**: mặc định.
- **Word (.docx)**: đọc `/mnt/skills/public/docx/SKILL.md` trước khi tạo.
- **PDF**: đọc `/mnt/skills/public/pdf/SKILL.md` trước khi tạo.

---

## Nguyên tắc bắt buộc

1. **Tối ưu lợi nhuận, không tối ưu CPL rẻ.** Mọi quyết định neo vào CPL trần tính từ unit economics.
2. **Không quyết khi chưa qua cổng significance.** Mẫu nhỏ là số rác.
3. **Không scale mã đang learning. Scale ≤ 20%/2–3 ngày hoặc duplicate.**
4. **Tách cold vs retargeting.** Không gộp CPL trung bình.
5. **Đọc 3 Ranking trước khi chẩn đoán CPM/creative.**
6. **Cắt lỗ theo giờ qua kill-switch, không đợi tuần.**
7. **Mọi nhận định kèm con số.** Không "khá tốt", phải "tốt hơn 12%".
8. **Ưu tiên 1 hành động cao nhất.** Nếu chỉ làm 1 việc hôm nay, đó là gì?
9. **Tone thẳng, không tô hồng. Không bịa.** Null → N/A.

---

## References
- `references/optimization_rules.md` — **Rule engine đầy đủ**: công thức CPL trần, ngưỡng significance, quy tắc learning phase & scale, bảng đọc 3 Ranking, ngưỡng kill-switch, tách cold/RT.
- `references/api_calls.md` — Cú pháp API từng call.
- `references/report_template.md` — Template markdown 7 phần (đã nâng cấp).
- `references/breakdown_effect.md` — Xử lý Breakdown Effect tránh sai số.
