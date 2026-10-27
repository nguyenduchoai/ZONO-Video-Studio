# Cấu Trúc Campaign Facebook Ads Chuẩn — B2C

## TEMPLATE 1: CAMPAIGN BÁN HÀNG (Purchase/Conversion)

### Cấu trúc tổng quan
```
📁 CAMPAIGN: SALES_[TênSản phẩm]_[T/Năm]
   Mục tiêu: Sales
   Budget: CBO — [Tổng ngân sách ngày]
   
   ├── 📁 ADSET 1: RETARGET_Website7D
   │   Target: Custom Audience — Website Visitors 7 ngày
   │   Exclude: Purchasers 30 ngày
   │   Budget weight: ~25%
   │   
   ├── 📁 ADSET 2: LAL_Purchase_1pct  
   │   Target: Lookalike 1% từ Purchasers
   │   Exclude: Existing customers
   │   Budget weight: ~35%
   │   
   ├── 📁 ADSET 3: LAL_ATC_1pct
   │   Target: Lookalike 1% từ Add-to-Cart
   │   Budget weight: ~20%
   │   
   └── 📁 ADSET 4: COLD_Interest
       Target: Interest targeting theo ngành
       Budget weight: ~20%
```

### Chi tiết từng AdSet

**ADSET 1 — Retargeting (Nóng nhất)**
- Audience: Website visitors 7 ngày (cần Pixel)
- Hoặc: Video viewers 75% (nếu chưa có pixel data)
- Placement: Feed + Story (manual)
- Optimization: Purchase hoặc Add to Cart
- Ad content: Reminder, urgency, social proof, offer đặc biệt

**ADSET 2 — Lookalike Purchase (Ấm)**
- Source: Danh sách khách đã mua (min 500 người, tốt nhất 1000+)
- Size: 1% (tốt nhất), có thể test 2% và 3%
- Location: Tỉnh/thành phố mục tiêu
- Age/Gender: Rộng hơn retarget (không cần hẹp)

**ADSET 3 — Lookalike ATC (Ấm)**
- Source: Người đã Add to Cart (min 300)
- Size: 1%
- Exclude: Purchasers

**ADSET 4 — Cold Interest (Lạnh)**
- Interest layers: 2-3 interest liên quan, không quá hẹp
- Audience size: Tối thiểu 500K người
- Age/Gender: Theo insight khách hàng thực tế
- Hoặc: Broad audience (chỉ target location + age)

---

## TEMPLATE 2: CAMPAIGN LEAD GEN

```
📁 CAMPAIGN: LEADS_[TênSản phẩm]_[T/Năm]
   Mục tiêu: Leads
   Budget: ABO (Ad Set Budget Optimization)
   
   ├── 📁 ADSET 1: RETARGET_Engaged3D
   │   Target: Engaged with Page/Post 3 ngày
   │   
   ├── 📁 ADSET 2: LAL_LeadForm_1pct
   │   Target: LAL từ Lead Form submitters
   │   
   └── 📁 ADSET 3: COLD_Interest_Primary
       Target: Interest chính của sản phẩm
```

---

## TEMPLATE 3: TESTING CAMPAIGN (A/B Test)

```
📁 CAMPAIGN TEST: TEST_[Hypothesis]_[Ngày]
   Budget: Nhỏ (10-15% tổng)
   
   ├── 📁 ADSET A: [Biến thể 1]
   │   └── 📄 Ad: Creative A
   │   
   └── 📁 ADSET B: [Biến thể 2]
       └── 📄 Ad: Creative B
```

**Nguyên tắc A/B test:**
- Chỉ test 1 biến tại một thời điểm (audience OR creative OR placement)
- Chạy tối thiểu 3-7 ngày để có đủ data
- Sample size: Tối thiểu 100 click mỗi variant trước khi kết luận
- Winning criteria: CPA thấp hơn + statistical significance > 90%

---

## NAMING CONVENTION CHUẨN

### Campaign
```
[Mục tiêu]_[Sản phẩm]_[Tháng.Năm]
Ví dụ: SALES_KemChongNang_06.2025
        LEADS_KhoaHocMakeup_Q3.2025
        TEST_VideovsImage_15.06.25
```

### AdSet
```
[AudienceType]_[Detail]_[AgeRange]_[Gender]
Ví dụ: LAL_Purchase1pct_F25-35_HCM
        RETARGET_WebVisit7D_All
        COLD_Interest_LamDep_F18-45
```

### Ad
```
[Format]_[Angle/Message]_[Version]
Ví dụ: VID_PainPoint_SunBurn_V1
        IMG_SocialProof_Review_V2
        CAR_ProductFeature_3items_V1
```

---

## CÀI ĐẶT KỸ THUẬT QUAN TRỌNG

### Pixel Setup Checklist
- [ ] Pixel đã cài đúng vào website
- [ ] Sự kiện ViewContent đang fire
- [ ] Sự kiện AddToCart đang fire  
- [ ] Sự kiện InitiateCheckout đang fire
- [ ] Sự kiện Purchase đang fire (với value)
- [ ] Test trong Events Manager: tất cả green

### Campaign Budget Optimization (CBO) vs ABO
- **CBO** (Campaign level): Meta tự phân bổ budget → dùng khi đã có data, muốn scale
- **ABO** (AdSet level): Bạn kiểm soát từng adset → dùng khi testing, muốn đảm bảo mỗi audience được test đủ

### Bid Strategy
- **Lowest Cost** (default): Meta tối ưu để có nhiều conversion nhất với budget cho sẵn
- **Cost Cap**: Đặt CPA mục tiêu, Meta cố gắng không vượt quá → dùng khi đã biết CPA target
- **Bid Cap**: Nâng cao, kiểm soát bid trong auction

### Placement Strategy
- **Advantage+ Placements** (auto): Meta tự chọn placement tốt nhất → ưu tiên dùng khi mới bắt đầu
- **Manual**: Chọn Feed + Reels + Story nếu muốn kiểm soát
- **Tránh**: Audience Network (thường kém chất lượng cho B2C)
