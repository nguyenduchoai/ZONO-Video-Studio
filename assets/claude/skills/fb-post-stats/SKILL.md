---
name: fb-post-stats
description: >
  Thu thập thống kê bài viết Facebook (Fanpage & trang cá nhân) qua trình duyệt Chrome,
  xuất file Excel (.xlsx) với đầy đủ chỉ số: Like, Comment, Share, Reach, Engagement Rate.
  Sử dụng Meta Business Suite để lấy dữ liệu chính xác nhất.
  Dùng skill này BẤT CỨ KHI NÀO người dùng muốn:
  - Thống kê bài viết Facebook, xem bài nào nhiều like/comment nhất
  - Xuất báo cáo tương tác Fanpage hoặc trang cá nhân
  - Phân tích hiệu suất content Facebook theo thời gian
  - So sánh các bài viết để tìm content hoạt động tốt nhất
  - Lấy data bài đăng Facebook ra Excel
  Từ khóa kích hoạt: "thống kê Facebook", "bài viết nhiều like", "phân tích Fanpage",
  "report Facebook", "xuất data FB", "top bài viết", "engagement Facebook",
  "thống kê bài đăng", "Facebook insights", "phân tích content FB",
  "bài nào nhiều tương tác", "báo cáo Facebook", "facebook analytics"
---

# Facebook Post Statistics Collector

Skill này sử dụng Claude in Chrome để truy cập Meta Business Suite, thu thập thống kê bài viết
Facebook và xuất kết quả ra file Excel có format chuyên nghiệp.

## Điều kiện tiên quyết

Người dùng cần **đã đăng nhập Facebook** trên trình duyệt Chrome trước khi chạy skill.
Nếu chưa đăng nhập, hướng dẫn họ đăng nhập trước rồi quay lại.

## Workflow tổng quan

```
1. Hỏi thông tin → 2. Mở Meta Business Suite → 3. Vào Insights/Content
→ 4. Cài đặt bộ lọc thời gian → 5. Cuộn & thu thập dữ liệu
→ 6. Xử lý & xuất Excel → 7. Trình bày kết quả
```

## Bước 1: Thu thập thông tin từ người dùng

Trước khi bắt đầu, cần xác nhận:

- **Loại trang**: Fanpage hay trang cá nhân (Professional Mode)? Hay cả hai?
- **Khoảng thời gian**: Mặc định 30 ngày. Có thể thay đổi: 7, 28, 30, 90 ngày hoặc tùy chỉnh.
- **Tên/URL trang** (nếu có nhiều Fanpage): Để chọn đúng trang cần thống kê.

Nếu người dùng đã cung cấp đủ thông tin trong câu hỏi ban đầu, không cần hỏi lại.

## Bước 2: Khởi tạo trình duyệt

Dùng `tabs_context_mcp` để lấy danh sách tab hiện có, sau đó tạo tab mới hoặc dùng tab có sẵn.

```
1. Gọi tabs_context_mcp (createIfEmpty: true)
2. Gọi tabs_create_mcp nếu cần tab mới
3. Ghi nhớ tabId để dùng xuyên suốt
```

## Bước 3: Truy cập Meta Business Suite

### Với Fanpage:

1. **Navigate** đến `https://business.facebook.com/latest/insights/content`
   - Nếu được redirect về trang chọn Page, dùng `read_page` + `find` để tìm và click vào đúng Fanpage
   - Nếu có popup/modal, đóng chúng bằng `find` (tìm nút "Close" hoặc "X")

2. **Xác nhận đã vào đúng trang Insights**:
   - Dùng `read_page` hoặc `screenshot` để kiểm tra
   - Nếu thấy bảng danh sách bài viết với các cột (Reach, Reactions, Comments...) → đúng rồi
   - Nếu không, thử navigate lại hoặc tìm menu "Content" / "Nội dung" trong sidebar

### Với trang cá nhân (Professional Mode):

1. **Navigate** đến `https://www.facebook.com/professional_dashboard/content`
2. Kiểm tra tương tự như Fanpage

### Xử lý các tình huống phổ biến:

- **Trang yêu cầu chọn Page**: Dùng `find` để tìm tên Fanpage và click chọn
- **Popup cookie/notification**: Tìm và click "Decline" hoặc "Not now" hoặc nút đóng
- **Trang tải chậm**: Dùng `wait` (2-3 giây) rồi thử lại
- **Giao diện tiếng Việt hoặc tiếng Anh**: Skill hoạt động với cả hai ngôn ngữ. Tìm bằng cả tiếng Việt và tiếng Anh khi cần.

## Bước 4: Cài đặt bộ lọc thời gian

1. Tìm bộ lọc thời gian trên trang (thường ở phía trên bảng dữ liệu)
   - Dùng `find` với query: "date range" hoặc "time period" hoặc "Khoảng thời gian"
2. Click vào bộ lọc và chọn khoảng thời gian phù hợp
3. Đợi trang tải lại dữ liệu (wait 2-3 giây)

Nếu không tìm thấy bộ lọc thời gian rõ ràng, bỏ qua bước này — Meta Business Suite
thường hiển thị dữ liệu gần đây nhất theo mặc định.

## Bước 5: Thu thập dữ liệu (Bước quan trọng nhất)

Đây là bước cốt lõi. Có 2 cách tiếp cận, ưu tiên theo thứ tự:

### Cách 1: Dùng JavaScript để trích xuất dữ liệu từ DOM (Ưu tiên)

Dùng `javascript_tool` để chạy script trích xuất dữ liệu trực tiếp từ bảng HTML.
Cách này nhanh và chính xác hơn đọc accessibility tree.

```javascript
// Ví dụ script — cần điều chỉnh selector theo DOM thực tế
// Bước đầu: khám phá cấu trúc DOM
document.querySelectorAll('table').length
```

Quy trình:
1. **Khám phá cấu trúc DOM**: Chạy JS để xem cấu trúc bảng/danh sách trên trang
2. **Xác định selector**: Tìm CSS selector phù hợp cho hàng dữ liệu và các cột
3. **Trích xuất dữ liệu**: Viết script thu thập tất cả bài viết đang hiển thị
4. **Cuộn xuống**: Dùng `scroll` để load thêm bài viết
5. **Lặp lại**: Tiếp tục thu thập + cuộn cho đến khi không còn bài mới

Khi cuộn để lấy thêm dữ liệu:
- Cuộn xuống 5 lần (scroll_amount: 5)
- Đợi 2 giây để trang tải
- Kiểm tra xem có bài mới xuất hiện không
- Nếu không có bài mới sau 2 lần cuộn liên tiếp → đã lấy hết

### Cách 2: Dùng read_page + screenshot (Fallback)

Nếu JavaScript không lấy được dữ liệu (ví dụ do Shadow DOM hoặc iframe):

1. Dùng `screenshot` để chụp màn hình, đọc dữ liệu từ ảnh
2. Dùng `read_page` để đọc accessibility tree
3. Cuộn xuống và lặp lại

### Dữ liệu cần thu thập cho mỗi bài viết:

| Trường | Mô tả | Bắt buộc |
|--------|--------|----------|
| post_date | Ngày đăng bài | Có |
| post_content | Nội dung bài (50 ký tự đầu) | Có |
| post_type | Loại bài (ảnh, video, link, text) | Nếu có |
| reach | Lượt tiếp cận | Nếu có |
| impressions | Lượt hiển thị | Nếu có |
| reactions | Tổng lượt thả cảm xúc (like, love, haha...) | Có |
| comments | Số bình luận | Có |
| shares | Số lượt chia sẻ | Nếu có |
| engagement_rate | Tỷ lệ tương tác (%) | Nếu có, hoặc tính = (reactions+comments+shares)/reach |
| link_clicks | Lượt click link | Nếu có |

Lưu ý: Meta Business Suite có thể không hiển thị tất cả cột cùng lúc.
Thu thập những gì có sẵn trên trang, không cần ép đủ mọi trường.

## Bước 6: Xuất file Excel

Sau khi thu thập xong dữ liệu, tạo file Excel chuyên nghiệp bằng Python + openpyxl.

### Cấu trúc file Excel:

**Sheet 1: "Tổng quan"**
- Tên trang Facebook
- Khoảng thời gian thống kê
- Tổng số bài viết
- Tổng reactions / comments / shares
- Trung bình reactions / comments / shares mỗi bài
- Bài có tương tác cao nhất (top 1)

**Sheet 2: "Chi tiết bài viết"**
- Bảng đầy đủ tất cả bài viết, sắp xếp theo ngày mới nhất
- Có header bold, freeze row đầu tiên
- Auto-fit column width
- Format số có dấu phân cách hàng nghìn
- Conditional formatting: highlight top 5 bài có reactions cao nhất (nền vàng nhạt)

**Sheet 3: "Top bài viết"**
- Top 10 bài có tổng tương tác cao nhất (reactions + comments + shares)
- Sắp xếp giảm dần

### Code pattern cho Excel:

```python
import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, numbers
from openpyxl.utils import get_column_letter
from datetime import datetime

wb = Workbook()

# Sheet 1: Tổng quan
ws_overview = wb.active
ws_overview.title = "Tổng quan"

# Sheet 2: Chi tiết
ws_detail = wb.create_sheet("Chi tiết bài viết")

# Sheet 3: Top bài viết
ws_top = wb.create_sheet("Top bài viết")

# ... populate data ...

# Formatting
header_font = Font(bold=True, color="FFFFFF")
header_fill = PatternFill(start_color="1877F2", end_color="1877F2", fill_type="solid")  # Facebook blue
# ... apply formatting ...

output_path = "/sessions/bold-zealous-dijkstra/mnt/outputs/facebook_stats_YYYYMMDD.xlsx"
wb.save(output_path)
```

Lưu ý quan trọng:
- Dùng **Excel formulas** cho các phép tính (SUM, AVERAGE, RANK) thay vì hardcode kết quả Python
- File lưu vào `/sessions/bold-zealous-dijkstra/mnt/outputs/` để người dùng có thể tải về
- Tên file bao gồm ngày để phân biệt các lần chạy

## Bước 7: Trình bày kết quả

Sau khi xuất Excel, tóm tắt ngắn gọn cho người dùng:

1. Tổng số bài viết đã thu thập
2. Top 3 bài có tương tác cao nhất (tiêu đề ngắn + số liệu)
3. Trung bình tương tác mỗi bài
4. Link tải file Excel

Ví dụ output:
```
Đã thu thập 47 bài viết trong 30 ngày gần nhất.

Top 3 bài tương tác cao nhất:
1. "Cách sử dụng AI để..." — 234 reactions, 56 comments, 12 shares
2. "5 sai lầm khi khởi..." — 189 reactions, 43 comments, 28 shares
3. "Workshop miễn phí..." — 167 reactions, 89 comments, 45 shares

Trung bình: 45 reactions, 12 comments, 5 shares / bài

[View your report](computer:///sessions/bold-zealous-dijkstra/mnt/outputs/facebook_stats_20260326.xlsx)
```

## Xử lý lỗi

| Tình huống | Cách xử lý |
|------------|------------|
| Chưa đăng nhập Facebook | Thông báo người dùng cần đăng nhập trước, cung cấp link facebook.com |
| Không tìm thấy Fanpage | Hỏi tên/URL chính xác của Fanpage |
| Trang tải quá chậm | Tăng thời gian wait lên 5 giây, thử lại tối đa 3 lần |
| Không đọc được dữ liệu từ DOM | Chuyển sang Cách 2 (screenshot + read_page) |
| Bị chặn hoặc CAPTCHA | Thông báo người dùng can thiệp thủ công |
| Trang đổi giao diện | Dùng `read_page` + `find` thay vì CSS selector cố định |

## Mẹo quan trọng

- **Luôn chụp screenshot** trước khi thao tác để biết chính xác giao diện hiện tại
- **Dùng `find` thay vì hardcode selector** vì Facebook thay đổi DOM thường xuyên
- **Kiểm tra ngôn ngữ trang**: Dùng cả tiếng Việt và tiếng Anh khi tìm kiếm element
  (ví dụ: "Nội dung" hoặc "Content", "Thông tin chi tiết" hoặc "Insights")
- **Xác nhận dữ liệu**: Sau khi thu thập, đối chiếu nhanh với 1-2 bài trên màn hình
  để đảm bảo dữ liệu chính xác
- **Timeout tổng**: Nếu quá trình thu thập kéo dài hơn 5 phút, dừng lại và xuất
  những gì đã có thay vì tiếp tục cuộn vô hạn
