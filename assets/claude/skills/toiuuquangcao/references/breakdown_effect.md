# Breakdown Effect — Cách xử lý tránh sai số

## Breakdown Effect là gì?

Khi bạn phân tích dữ liệu Meta Ads theo các chiều phân loại (tuổi, giới tính, placement, vùng địa lý), tổng số trong breakdown **KHÔNG bằng** tổng số ở cấp account/campaign.

**Lý do:** Một impression có thể thuộc nhiều nhóm cùng lúc (ví dụ: người 25–34 tuổi xem quảng cáo trên Facebook Feed và Instagram Stories → được đếm 2 lần trong breakdown placement).

---

## Quy tắc quan trọng

### ✅ Đúng
- Dùng **Campaign level** cho CBO (Campaign Budget Optimization)
- Dùng **Ad Set level** cho ABO (Ad Set Budget Optimization)
- Phân tích breakdown chỉ để **so sánh tỷ lệ**, không để tính tổng

### ❌ Sai
- Cộng tổng spend/data từ breakdown age+gender → sẽ bị inflate
- Dùng breakdown data để tính CPL toàn tài khoản
- Cộng dồn metrics từ nhiều breakdown khác nhau

---

## Cách xử lý đúng trong báo cáo này

1. **Tổng quan (Phần 1)**: Lấy từ account-level insights, KHÔNG phải cộng từ breakdown
2. **Chi tiết mã (Phần 2)**: Lấy từ ad-level insights trực tiếp
3. **Phân tích breakdown (Phần 4)**: Chỉ dùng để nhận xét xu hướng (VD: "nhóm 25–34 có CTR cao hơn 18–24 → creative đang phù hợp người trung niên"), KHÔNG dùng để tính CPL hay spend tuyệt đối

---

## Ví dụ cụ thể

**Sai:**
```
Breakdown theo placement:
- Facebook Feed: 500 leads, 50tr spend
- Instagram Stories: 300 leads, 30tr spend
→ Tổng: 800 leads, 80tr spend ← SAI (có thể overlap)
```

**Đúng:**
```
Account level insights:
→ Tổng thực: 720 leads, 75tr spend ← LẤY SỐ NÀY
Breakdown chỉ dùng để biết: Feed chiếm tỷ trọng lớn hơn Stories
```
