---
name: copywriting
description: Conversion copywriting formulas, headline templates, email copy patterns, landing page structures, CTA optimization, and writing style extraction. Activate for writing high-converting copy, crafting headlines, email campaigns, landing pages, or applying custom writing styles from assets/writing-styles/ directory.
license: MIT
---

# Viết Copy Chuyển Đổi Cao (Copywriting)

Công thức, template, mẫu và phong cách viết cho copy chuyển đổi cao.

## Khi Nào Sử Dụng

- Viết tiêu đề/dòng chủ đề email, copy landing page, chiến dịch email
- Bài đăng social, mô tả sản phẩm, tối ưu CTA, biến thể A/B
- Áp dụng phong cách viết tùy chỉnh

## Phong Cách Viết

Load: `references/writing-styles.md` | Catalog đầy đủ: `assets/writing-styles/default.md` (50 phong cách)

**Trích xuất phong cách từ file đa format:**
```bash
python scripts/extract-writing-styles.py --list        # Liệt kê file
python scripts/extract-writing-styles.py --style <tên>  # Trích xuất phong cách
```

**Format:** `.md` `.txt` `.pdf` `.docx` `.xlsx` `.pptx` `.jpg` `.png` `.mp4`

## Công Thức Copy

Load: `references/copy-formulas.md`

| Công thức | Cấu trúc | Dùng cho |
|-----------|-----------|----------|
| AIDA | Chú ý → Quan tâm → Mong muốn → Hành động | Landing page, quảng cáo |
| PAS | Vấn đề → Khuấy động → Giải pháp | Email, trang bán hàng |
| BAB | Trước → Sau → Cầu nối | Testimonial, case study |
| 4Ps | Hứa hẹn → Hình ảnh → Chứng minh → Thúc đẩy | Bài bán hàng dài |
| 4Us | Khẩn cấp + Độc đáo + Hữu ích + Cực kỳ cụ thể | Tiêu đề |
| FAB | Tính năng → Lợi thế → Lợi ích | Mô tả sản phẩm |

## Tiêu Đề

Load: `references/headline-templates.md`

Mẫu: "Cách [X] mà không cần [Y]" • "[Số] cách để [lợi ích]" • "Bí mật để [kết quả]" • "Tại sao [niềm tin] là sai"

## Email Copy

Load: `references/email-copy.md`

Dòng chủ đề: Tò mò • Lợi ích • Câu hỏi • Khẩn cấp

## Landing Page & CTA

Load: `references/landing-page-copy.md` | `references/cta-patterns.md`

Hero: Tiêu đề (hứa hẹn) → Phụ đề (cách) → CTA (hành động) → Social proof
CTA: "Bắt đầu [hành động]" • "Nhận [lợi ích]" • "Có, tôi muốn [lợi ích]"

## Tham Khảo

| File | Mục đích |
|------|---------|
| `references/writing-styles.md` | 30 phong cách viết tham khảo nhanh |
| `references/copy-formulas.md` | Công thức AIDA, PAS, BAB, 4Ps, FAB |
| `references/headline-templates.md` | Mẫu tiêu đề |
| `references/email-copy.md` | Mẫu email copy |
| `references/landing-page-copy.md` | Cấu trúc landing page |
| `references/cta-patterns.md` | Tối ưu CTA |
| `references/power-words.md` | Từ mạnh theo cảm xúc |
| `references/social-media-copy.md` | Copy theo nền tảng |
| `scripts/extract-writing-styles.py` | Trích xuất phong cách từ file đa format |
| `templates/copy-brief.md` | Template creative brief |

## Tích Hợp Agent

**Chính:** copywriter | **Liên quan:** brand-guidelines, content-marketing, email-marketing

## Best Practices

1. Dẫn đầu bằng lợi ích, không phải tính năng
2. Một CTA duy nhất cho mỗi bài
3. Cụ thể > mơ hồ (dùng số liệu)
4. Đọc to — nếu lủng củng thì viết lại
5. Test tiêu đề trước
6. Khớp copy với mức độ nhận thức của khách hàng
