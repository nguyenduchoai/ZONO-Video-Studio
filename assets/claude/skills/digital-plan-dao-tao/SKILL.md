---
name: digital-plan-dao-tao
description: >
  Tạo file Excel kế hoạch Digital Marketing hàng tháng cho doanh nghiệp đào tạo AI/Online.
  Skill này tạo ra bộ kế hoạch hoàn chỉnh theo đúng cấu trúc chuẩn gồm: mục tiêu doanh thu,
  phân bổ ngân sách ADS (Test / Scale / Retargeting), Organic Traffic, Email Campaign,
  chân dung khách hàng theo sản phẩm, và kế hoạch nội dung theo từng kênh.

  Dùng skill này BẤT CỨ KHI NÀO người dùng muốn:
  - Tạo kế hoạch Digital tháng / quý cho doanh nghiệp đào tạo
  - Lập kế hoạch ngân sách quảng cáo Facebook, Google, TikTok
  - Xây dựng kế hoạch content các kênh (Facebook, TikTok, YouTube, Email)
  - Tạo bảng phân bổ ngân sách ADS theo sản phẩm (Test / Scale / Retargeting)
  - Lập kế hoạch chiến dịch Email Marketing
  - Xây dựng chân dung khách hàng (Customer Persona) theo sản phẩm
  - Từ khoá kích hoạt: "kế hoạch digital", "kế hoạch tháng", "ngân sách ads",
    "phân bổ ngân sách", "kế hoạch nội dung kênh", "kế hoạch marketing",
    "lập kế hoạch quảng cáo", "kế hoạch digital đào tạo"
---

# Skill: Kế Hoạch Digital Đào Tạo

## Mục đích

Tạo file Excel (.xlsx) kế hoạch Digital Marketing hàng tháng theo cấu trúc chuẩn đã được kiểm chứng thực tế cho doanh nghiệp đào tạo AI/Online (theo mẫu file KẾ HOẠCH DIGITAL THÁNG 9-12/2025).

---

## Quy trình thực hiện

### Bước 1 — Thu thập thông tin đầu vào

Hỏi người dùng (hoặc suy luận từ context) các thông tin sau:

| Thông tin | Ví dụ mẫu |
|-----------|-----------|
| Tháng/năm kế hoạch | Tháng 9/2025 → 01/09/2025 – 30/09/2025 |
| Mục tiêu doanh thu tháng | 3.100.000.000 đ |
| Doanh thu tháng trước | (để trống hoặc điền) |
| Ngân sách tối đa & mục tiêu | 670 tr tối đa / 610 tr mục tiêu |
| Tỉ lệ CP/DT mục tiêu | 20% |
| Danh sách sản phẩm & mục tiêu DT từng SP | Xem bảng ADS mẫu |
| Có sự kiện đặc biệt không? | Sự kiện 1500, Workshop offline... |
| Các kênh nội dung cần lập kế hoạch | Facebook, TikTok, YouTube, Email... |

Nếu người dùng không cung cấp, **dùng số liệu mẫu từ Tháng 9/2025** trong file references/data-mau.md.

---

### Bước 2 — Tạo file Excel theo cấu trúc chuẩn

Đọc file `references/data-mau.md` để lấy số liệu mẫu trước khi code.

Tạo workbook với **6 sheets** theo thứ tự:

```
Sheet 1: KẾ HOẠCH tháng [MM][YYYY]
Sheet 2: KẾ HOẠCH tháng [MM+1][YYYY]   ← (tuỳ chọn, nếu lập nhiều tháng)
Sheet 3–4: ...
Sheet 5: ĐỐI TƯỢNG KH + Các tuyến nội dung
Sheet 6: Kế hoạch nội dung các kênh
```

Nếu người dùng chỉ yêu cầu 1 tháng, tạo **3 sheets**: Sheet kế hoạch tháng + Sheet KH + Sheet nội dung kênh.

---

### Bước 3 — Cấu trúc Sheet "KẾ HOẠCH tháng"

Mỗi sheet kế hoạch tháng gồm các phần theo thứ tự:

#### PHẦN 1: Header & Mục tiêu
```
KẾ HOẠCH DIGITAL 01/MM/YYYY - 30/MM/YYYY
1. MỤC TIÊU:
  1.1. ...
  - Mục tiêu doanh thu tháng: X.XXX.000.000 tr/tháng
  - Doanh thu tháng trước: ........
  - Ngân sách đề xuất tối đa: XXX tr/tháng (mục tiêu YYY tr/tháng). CP/DT MỤC TIÊU: ZZ%
```

#### PHẦN 2: Bảng ADS
```
ADS
Cột: CÁC SẢN PHẨM | MỤC TIÊU DOANH THU | CHI PHÍ | DATA | TỈ LỆ CHUYỂN ĐỔI
```
Các sản phẩm thường gặp (điều chỉnh theo input người dùng):
- AIPLUS
- CÁC SP CHẠY QC THẲNG (AI SUPER TRAFFIC, AI BUILDER, AI PERSONALITY MASTER, TOOL TAOVIDEOAI)
- OFFLINE AI FOR CEO
- WORKSHOP
- AI COACHING + BUSINESS ELITE + F100
- SỰ KIỆN 1500 (nếu có)

#### PHẦN 3: Organic Traffic
```
ORGANIC TRAFFIC
Cột: CÁC SẢN PHẨM | MỤC TIÊU DOANH THU | MỤC TIÊU TRAFFIC | DATA | TỈ LỆ CHUYỂN ĐỔI
```

#### PHẦN 4: Phân bổ ngân sách
```
Phân bổ ngân sách
Cột: Hạng mục | SẢN PHẨM | NGÂN SÁCH | TỈ LỆ | SỐ LƯỢNG NỘI DUNG
```

3 hạng mục ngân sách:

**NGÂN SÁCH TEST (Fb + GG)** — tỉ lệ thấp, nhiều nội dung để test:
- Số lượng nội dung: 24 VIDEO + 8 ẢNH (AIPLUS), 16 VIDEO + 8 ẢNH (các SP khác), 8 VIDEO + 8 ẢNH (Workshop)

**NGÂN SÁCH SCALE** — ngân sách lớn, ít nội dung, chỉ scale những gì đã test tốt:
- Số lượng nội dung: 8 VIDEO + 2 ẢNH (AIPLUS), 4 VIDEO + 2 ẢNH (các SP khác)

**NGÂN SÁCH TIẾP THỊ LẠI** — retargeting khách đã tiếp cận:
- Số lượng nội dung: 4 VIDEO + 4 ẢNH

#### PHẦN 5: Chiến dịch Email
```
CHIẾN DỊCH EMAIL
Cột: Sản phẩm | SỐ LẦN GỬI MAIL | TỈ LỆ OPEN | TỈ LỆ CLICK
```
Các sản phẩm email thường: AI SUPER TRAFFIC, AI PERSONALITY MASTER
Tỉ lệ chuẩn: Open 18%, Click 2%

---

### Bước 4 — Cấu trúc Sheet "ĐỐI TƯỢNG KH + Các tuyến nội dung"

Sheet này gồm **2 bảng**:

#### Bảng 1: Chân dung khách hàng (Customer Persona)
```
Cột: SẢN PHẨM | Độ tuổi | Giới tính | Nghề nghiệp | Nỗi đau (Pain Points) | Mong muốn (Desires) | Hành vi chính
```
Điền đầy đủ từng segment khách hàng theo sản phẩm. Xem mẫu chi tiết trong `references/data-mau.md`.

#### Bảng 2: Kế hoạch nội dung theo Combo sản phẩm (AIDA Framework)
```
Cột: Combo | Giai đoạn | Mục tiêu | Tuyến nội dung ví dụ | Điểm chạm với khách hàng
```
4 giai đoạn AIDA: Awareness → Interest → Desire → Action
Điểm chạm tương ứng: Organic → Ads FB+YT → Remarketing → Email+Retargeting

---

### Bước 5 — Cấu trúc Sheet "Kế hoạch nội dung các kênh"

```
Cột: Nền tảng | Kênh | Tuyến nội dung chính | Số lượng + tần suất | Ghi chú
```

Các nền tảng cần có:
- **Facebook**: Nick cá nhân, Page, Group
- **TikTok**: Các kênh content
- **YouTube**: Kênh chính
- **GG SEO**: Website/Blog
- **Automation n8n**: Các kênh auto
- **Email**: Platform (Behivv, Ladisales...)

---

### Bước 6 — Định dạng & Style

```python
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

# Màu header chính
HEADER_FILL = PatternFill('solid', start_color='1F4E79')  # Xanh navy đậm
HEADER_FONT = Font(bold=True, color='FFFFFF', size=11)

# Màu section (ADS, ORGANIC...)
SECTION_FILL = PatternFill('solid', start_color='2E75B6')  # Xanh dương
SECTION_FONT = Font(bold=True, color='FFFFFF', size=11)

# Màu sub-section (NGÂN SÁCH TEST...)
SUBSECTION_FILL = PatternFill('solid', start_color='BDD7EE')  # Xanh nhạt
SUBSECTION_FONT = Font(bold=True, color='000000')

# Row dữ liệu xen kẽ
ALTERNATE_FILL = PatternFill('solid', start_color='DEEAF1')

# Font mặc định
DEFAULT_FONT = Font(name='Arial', size=10)

# Số tiền: format #,##0
# Tỉ lệ %: format 0.0%
# Wrap text: True cho các ô có nhiều dòng
```

**Chiều rộng cột gợi ý**:
- Cột A (Hạng mục/Sản phẩm): 45
- Cột B: 35
- Cột C (Ngân sách): 18
- Cột D (Tỉ lệ): 15
- Cột E (Nội dung): 20

**Freeze panes**: Đóng băng hàng header của từng bảng.

---

### Bước 7 — Lưu file & Kiểm tra

```bash
# Recalculate sau khi tạo xong
python scripts/recalc.py output.xlsx 30
```

Tên file output: `Ke_Hoach_Digital_Thang_[MM]_[YYYY].xlsx`

---

## Số liệu mẫu tháng chuẩn

Xem `references/data-mau.md` để lấy toàn bộ số liệu mẫu từ Tháng 9/2025 (file gốc của người dùng).

---

## Lưu ý quan trọng

1. **Dùng Excel formula thay vì hardcode**: Tổng ngân sách, tỉ lệ... dùng SUM(), tính % bằng công thức.
2. **Wrap text**: Tất cả ô có nội dung dài (danh sách sản phẩm, ghi chú) đều cần wrap text = True.
3. **Merge cells**: Merge ô cho các hàng header chính và các nhóm sản phẩm cùng hạng mục.
4. **Số tiền**: Format dạng `#,##0` (không có đơn vị trong ô, ghi đơn vị ở header cột).
5. **Tiếng Việt**: Đảm bảo encoding UTF-8, không bị lỗi font khi mở trên máy Windows.
6. **Tên sheet**: Dùng đúng tên tiếng Việt có dấu như mẫu gốc.
