# Xử Lý Tình Huống Thường Gặp — Facebook Ads B2C

## TÌNH HUỐNG 1: CPL / CPA QUÁ CAO

### Chẩn đoán theo funnel
```
CPM cao → Vấn đề ở AUDIENCE (hẹp / cạnh tranh)
CTR thấp → Vấn đề ở CREATIVE / COPY (không thu hút)
CVR thấp → Vấn đề ở LANDING PAGE / OFFER
```

### Checklist xử lý
1. Kiểm tra CPM vs benchmark → nếu cao, mở rộng audience
2. Kiểm tra CTR → nếu < 1%, đổi creative (đặc biệt 3 giây đầu video)
3. Kiểm tra tỷ lệ Click → Landing page view: nếu < 70% → trang load chậm
4. Kiểm tra tỷ lệ LP View → ATC: nếu < 3% → giá quá cao hoặc trang kém
5. Kiểm tra tỷ lệ ATC → Purchase: nếu < 30% → checkout phức tạp / thiếu trust

---

## TÌNH HUỐNG 2: ROAS THẤP (< 2x)

### Nguyên nhân phổ biến
- Giá sản phẩm thấp so với chi phí ads
- Target sai đối tượng (không có purchasing power)
- Offer không đủ hấp dẫn so với đối thủ
- Tracking lỗi (bỏ sót conversion)

### Giải pháp
1. **Kiểm tra tracking**: Vào Events Manager → Verify Events → đảm bảo Purchase đang ghi giá trị đúng
2. **Upsell/Bundle**: Tăng AOV (Average Order Value) bằng combo sản phẩm
3. **Retargeting mạnh hơn**: Tăng % budget cho retargeting (thường ROAS cao nhất)
4. **Cải thiện offer**: Free ship, quà tặng kèm, voucher thời gian có hạn

---

## TÌNH HUỐNG 3: ADS ĐANG CHẠY TỐT ĐỘT NHIÊN KÉM

### Checklist nguyên nhân
- [ ] Frequency đã vượt 4-5? → Ad fatigue
- [ ] Đã thay đổi gì trong account gần đây? (budget, audience, creative)
- [ ] Có sự kiện lớn đang diễn ra? (11/11, Tết, back to school → CPM tăng)
- [ ] Đối thủ tăng budget? (CPM auction cạnh tranh hơn)
- [ ] Landing page có vấn đề? (down server, giá thay đổi)
- [ ] Pixel có tiếp tục fire không?

### Giải pháp
1. Frequency cao → Refresh creative, duplicated adset với audience rộng hơn
2. Mùa cạnh tranh → Chấp nhận CPM cao hơn hoặc giảm CPA target tạm thời
3. Landing page → Kiểm tra và fix ngay
4. Không rõ nguyên nhân → Duplicate campaign, để campaign cũ chạy thêm 3-5 ngày

---

## TÌNH HUỐNG 4: ADS ĐANG LEARNING / LEARNING LIMITED

### Learning Phase
- Xảy ra khi: Mới tạo ad, chỉnh sửa significant, reset pixel events
- Cần: 50 optimization events trong 7 ngày để thoát learning
- KHÔNG nên: Chỉnh sửa budget/targeting/creative trong giai đoạn này

### Learning Limited
- Nghĩa là: Hệ thống không đủ sự kiện để học
- Giải pháp:
  1. Tăng budget (để có thêm reach và cơ hội conversion)
  2. Mở rộng audience (tăng pool người tiếp cận)
  3. Đổi optimization event sang đầu funnel hơn (ATC thay vì Purchase)
  4. Hợp nhất các adset có performance tương đương (ít adset hơn → mỗi cái nhiều data hơn)

---

## TÌNH HUỐNG 5: ADS BỊ TỪ CHỐI / TÀI KHOẢN BỊ HẠN CHẾ

### Các lý do thường bị từ chối
1. **Claim không có căn cứ**: "Giảm 10kg trong 7 ngày", "100% chắc chắn"
2. **Trước/Sau** (Before/After): Bị cấm trong ngành sức khỏe, làm đẹp
3. **Nhắm vào đặc điểm cá nhân**: "Bạn đang béo?", "Da bạn đang lão hóa?"
4. **Ngôn ngữ giật gân**: ALL CAPS quá nhiều, dấu chấm than quá nhiều
5. **Landing page không match**: Quảng cáo một thứ, trang đích khác

### Cách sửa
- Thay "Giảm béo nhanh" → "Hỗ trợ duy trì vóc dáng"
- Thay "Da bạn đang xấu?" → "Bí quyết chăm sóc da sáng mịn"
- Bỏ before/after → Dùng testimonial text hoặc video review tự nhiên
- Thêm disclaimer nếu cần: "Kết quả có thể khác nhau tùy người"

---

## TÌNH HUỐNG 6: SCALE ADS BỊ GIẢM HIỆU QUẢ

### Vấn đề scaling thường gặp
- Tăng budget quá nhanh → Reset learning phase
- Scale audience quá rộng → Dilute quality
- Không kịp refresh creative khi scale → Ad fatigue nhanh hơn

### Công thức scale an toàn
1. **Vertical Scale**: Tăng budget 20-30% mỗi 3-5 ngày (không hơn)
2. **Horizontal Scale**: Duplicate adset → test audience tương tự ở vị trí địa lý khác
3. **Creative Scale**: Mỗi khi tăng budget 2x → tạo thêm 2-3 creative mới
4. **Campaign Scale**: Khi 1 campaign win → tạo campaign mới với structure tương tự, không chỉnh sửa cái cũ

---

## QUICK DECISION TREE

```
Ads chạy không tốt?
│
├── CPM > 100K VNĐ?
│   ├── CÓ → Audience quá hẹp / Mùa cạnh tranh → Mở rộng audience
│   └── KHÔNG → Tiếp tục
│
├── CTR < 1%?
│   ├── CÓ → Creative kém → Đổi creative, đặc biệt hook
│   └── KHÔNG → Tiếp tục
│
├── Click→LP View < 70%?
│   ├── CÓ → Trang load chậm hoặc link lỗi → Fix landing page
│   └── KHÔNG → Tiếp tục
│
├── LP View→ATC < 3%?
│   ├── CÓ → Trang kém/Giá cao → Cải thiện trang + offer
│   └── KHÔNG → Tiếp tục
│
└── ATC→Purchase < 25%?
    ├── CÓ → Checkout phức tạp/thiếu trust → Đơn giản hóa checkout
    └── KHÔNG → Vấn đề khác → Kiểm tra tracking
```
