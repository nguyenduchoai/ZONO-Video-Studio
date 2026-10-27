# Template Báo Cáo 7 Phần — Meta Ads Weekly Report

---

## PHẦN 1 — TỔNG QUAN SO SÁNH 2 TUẦN

```markdown
## 📊 PHẦN 1 — TỔNG QUAN 2 TUẦN

| Chỉ số | Tuần trước ({date_prev}) | Tuần này ({date_curr}) | Thay đổi |
|---|---|---|---|
| Tổng chi tiêu | {spend_prev} | {spend_curr} | {delta_spend}% {arrow} |
| Tổng data (cd) | {data_prev} | {data_curr} | {delta_data}% {arrow} |
| CPL trung bình | {cpl_prev} | {cpl_curr} | {delta_cpl}% {arrow} |
| CPL tốt nhất | {best_cpl_prev} | {best_cpl_curr} | {arrow} |
| CPL tệ nhất | {worst_cpl_prev} | {worst_cpl_curr} | {arrow} |
| Số mã vượt ngưỡng lỗ | {over_threshold_prev} mã | {over_threshold_curr} mã | {arrow} |

**Nhận định tổng thể:** [2–3 câu mô tả trạng thái hệ thống: tốt hơn/xấu hơn/đi ngang, lý do chính]
```

**Quy tắc arrow:**
- ▲ màu xanh: tốt hơn (data tăng, CPL giảm, chi tiêu tăng khi data cũng tăng)
- ▼ màu đỏ: xấu hơn (data giảm, CPL tăng)
- → đi ngang: thay đổi < 5%

---

## PHẦN 2 — BẢNG CHI TIẾT TỪNG MÃ

```markdown
## 📋 PHẦN 2 — CHI TIẾT TỪNG MÃ QUẢNG CÁO

> Sắp xếp theo CPL từ thấp đến cao | Ngưỡng hòa vốn: {threshold}đ | Ngưỡng lý tưởng: {ideal}đ

| Tên mã | Tài khoản | Trạng thái | Data | CPL | Chi tiêu | CPM | Đánh giá |
|---|---|---|---|---|---|---|---|
| {ad_name} | {account} | {status} | {data} | {cpl}đ | {spend}đ | {cpm}đ | 🟢/🟡/🔴 |
```

**Trạng thái:** ACTIVE / PAUSED / ARCHIVED

---

## PHẦN 3 — ĐIỂM SÁNG & ĐIỂM TỐI

```markdown
## 🔍 PHẦN 3 — 3 ĐIỂM SÁNG & 3 ĐIỂM TỐI

### ✅ 3 ĐIỂM SÁNG

**1. {ad_name_1}**
- CPL: {cpl}đ — thấp hơn ngưỡng {X}%
- Data: {data} cd trong {days} ngày
- Lý do hiệu quả: [phân tích ngắn]

**2. {ad_name_2}** ...

**3. {ad_name_3}** ...

---

### ⚠️ 3 ĐIỂM TỐI

**1. {ad_name_1}**
- CPL: {cpl}đ — cao hơn ngưỡng {X}%
- Đã chi: {spend}đ, chỉ về {data} cd
- Chẩn đoán: [nguyên nhân — CPM cao? CTR thấp? CVR kém?]

**2. {ad_name_2}** ...

**3. {ad_name_3}** ...
```

---

## PHẦN 4 — CHẨN ĐOÁN NGUYÊN NHÂN GỐC RỄ

```markdown
## 🩺 PHẦN 4 — CHẨN ĐOÁN NGUYÊN NHÂN

**1. Vấn đề CPM (giá hiển thị)**
[Liệt kê mã có CPM bất thường, so sánh với trung bình tài khoản, giải thích ảnh hưởng đến CPL]

**2. Vấn đề Audience (tệp khách hàng)**
[Frequency > 3.0? Mã nào đang bão hòa? Gợi ý mở rộng hoặc làm mới tệp]

**3. Vấn đề Creative (nội dung)**
[Định dạng nào đang tốt/kém? Video vs ảnh? So sánh CTR giữa các mã]

**4. Vấn đề cấu trúc tài khoản**
[Có mã nào đang cạnh tranh ngân sách với nhau? Ad set chồng chéo tệp?]
```

---

## PHẦN 5 — MA TRẬN QUYẾT ĐỊNH NGÂN SÁCH

```markdown
## 💰 PHẦN 5 — MA TRẬN QUYẾT ĐỊNH NGÂN SÁCH

| Nhóm | Hành động | Mã | Lý do |
|---|---|---|---|
| 🚀 SCALE | Tăng ngân sách 30–50% | | CPL < ngưỡng lý tưởng, ổn định ≥ 3 ngày |
| ✅ GIỮ | Duy trì ngân sách | | CPL trong ngưỡng chấp nhận |
| ⚠️ THEO DÕI | Không tăng, quan sát 2–3 ngày | | CPL biến động hoặc data ít |
| ❌ TẮT NGAY | Dừng ngay hôm nay | | CPL vượt ngưỡng lỗ liên tục ≥ 3 ngày |

**Phân bổ ngân sách đề xuất tuần tới** (Tổng: {total_budget}đ):
| Mã | % | Số tiền |
|---|---|---|
| {ad_name} | {pct}% | {amount}đ |
```

---

## PHẦN 6 — KẾ HOẠCH HÀNH ĐỘNG 7 NGÀY

```markdown
## 📅 PHẦN 6 — KẾ HOẠCH HÀNH ĐỘNG 7 NGÀY

**🚨 Ngày 1–2 (Khẩn cấp):**
- [ ] {action_1}
- [ ] {action_2}

**🔧 Ngày 3–5 (Tối ưu):**
- [ ] {action_1}
- [ ] {action_2}

**🧪 Ngày 6–7 (Thử nghiệm):**
- [ ] {action_1}
- [ ] {action_2}

**🎯 KPI mục tiêu cuối tuần:**
- CPL trung bình: < {target_cpl}đ
- Tổng data: > {target_data} cd
- Số mã vượt ngưỡng lỗ: < {target_bad_ads} mã
```

---

## PHẦN 7 — 2 PROMPT AI SẴN SÀNG DÙNG

```markdown
## 🤖 PHẦN 7 — 2 PROMPT AI SẴN SÀNG DÙNG

**Prompt 1 — Kỹ thuật/Thuật toán:**
[Viết dựa trên vấn đề kỹ thuật cụ thể nhất phát hiện: CPM cao, learning phase, cấu trúc tài khoản, v.v.]

**Prompt 2 — Tối ưu Creative:**
[Viết dựa trên vấn đề creative/content cụ thể: CTR thấp, ad fatigue, định dạng kém hiệu quả, v.v.]
```
