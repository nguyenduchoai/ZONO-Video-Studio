---
name: ceo-annual-report
description: |
  Tạo báo cáo thường niên (annual report) gửi cổ đông và toàn công ty — gồm CEO letter, financial highlights, milestone, OKR, plan năm sau. Format đẹp, in được.
  Kích hoạt khi người dùng nói: "annual report", "báo cáo thường niên", "báo cáo năm", "year in review", "year-end report", "báo cáo cổ đông", "report cho công ty cả năm", "review năm".
  Output là PDF 20-40 trang in đẹp.
---

# CEO Annual Report — Báo Cáo Thường Niên

## Mục Tiêu
Cuối năm CEO phải có 1 cuốn báo cáo để gửi cổ đông + nội bộ + đối tác. Skill này tạo annual report đẹp chuẩn corporate trong 1 tuần thay vì 1 tháng.

## Khi Nào Dùng
- Cuối năm tài chính (Q4)
- Trước AGM (Annual General Meeting)
- Gửi báo cáo cho cổ đông
- Tài liệu re-recruiting / fundraising
- All-hands cuối năm

## Bước 1: Thu Thập Materials
- Số tài chính cả năm (đã audit hoặc tạm)
- Top 10 milestone
- Story khách hàng tiêu biểu (3-5)
- Headcount đầu năm vs cuối năm
- Câu trích từ founder, lãnh đạo
- Ảnh sự kiện công ty cả năm
- Plan năm sau (high-level)

## Bước 2: Cấu Trúc 25-35 Trang
1. Cover + tiêu đề
2-3. CEO Letter (2 trang, 600-800 từ)
4-5. Year at a glance (infographic số nổi)
6-9. Financial highlights (P&L, cash, growth)
10-13. Sản phẩm & Khách hàng (case study)
14-17. Vận hành & Operations
18-21. People & Culture (headcount, attrition, ảnh team)
22-25. Impact (CSR, sustainability nếu có)
26-29. Year ahead (3-5 priorities)
30-32. Board & Leadership (ảnh, bio)
33+ Appendix (BCTC chi tiết)

## Bước 3: CEO Letter Format
- Bắt đầu bằng câu mạnh: "2026 là năm chúng tôi học được X"
- Thừa nhận khó khăn trước, không tô hồng
- 3 thành tựu lớn nhất (có số)
- 3 bài học lớn nhất
- 3 ưu tiên năm tới
- Cảm ơn cụ thể (team, khách, investor)
- Ký tên CEO

## Bước 4: Tích Hợp Web Bên Ngoài (MCP-first + API fallback)

**Ưu tiên dùng MCP/Connectors có sẵn:**
- Google Drive MCP: pull số tài chính từ Sheets
- Canva MCP: dùng brand template báo cáo năm
- Notion MCP: pull milestone từ database company timeline
- Gmail MCP: gửi PDF cho danh sách shareholder + employee
- Slack MCP: post link annual report

**Fallback bằng API (nếu cần làm sâu hơn):**
```python
# Tạo PDF đẹp bằng ReportLab
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Image, Spacer
doc = SimpleDocTemplate('/tmp/annual-report.pdf', pagesize=A4)
story = [
    Paragraph("Annual Report 2026", title_style),
    Spacer(1, 20),
    Paragraph(ceo_letter, body_style),
    Image('chart_revenue.png', width=400, height=300),
]
doc.build(story)
```

## Bước 5: Output Format
- PDF 25-35 trang, A4, print-ready 300 DPI
- Phiên bản web (interactive, scroll) với charts động
- 1-page summary cho social media
- Tên: `annual-report-YYYY.pdf`
- Lưu vào `/Users/nguyenkiem/Documents/Claude/SKILL/LÀM SKILL/outputs/`

## Checklist Trước Khi Giao
- [ ] CEO Letter ≤ 800 từ, có thừa nhận khó khăn
- [ ] Có ≥ 3 customer story
- [ ] Số tài chính đã verify với CFO
- [ ] Ảnh team đại diện đủ phòng ban
- [ ] Year ahead có 3-5 priority rõ
- [ ] PDF dưới 20 MB
