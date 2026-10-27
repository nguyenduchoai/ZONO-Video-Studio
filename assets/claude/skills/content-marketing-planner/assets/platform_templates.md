# Platform Templates (Info Section mẫu)

Tham chiếu cho phần **info_section** của từng nền tảng (ở đầu sheet nền tảng, trước bảng pillar).

## FACEBOOK — theme "blue_1"
```json
"info_section": [
  {"label": "Mục tiêu", "value": "Xây dựng nhận diện thương hiệu, kéo tương tác, seed ra đơn/booking thông qua bài viết + Reel"},
  {"label": "Đối tượng", "value": "Người dùng FB 25–45 tuổi tại [khu vực], quan tâm đến [ngách ngành]"},
  {"label": "Tần suất", "value": "2 bài/ngày (1 Video/Reel + 1 Bài viết), 5–7 ngày/tuần"},
  {"label": "Định dạng chính", "value": "Video Reel ≤ 90s, Bài viết + Ảnh thật, Carousel ảnh thiết kế"},
  {"label": "Tone & Voice", "value": "[Cao cấp/Thân thiện/Chuyên gia] — giọng [mô tả]"}
]
```

## TIKTOK — theme "blue_2"
```json
"channel_title": "[Tên thương hiệu]",
"info_section": [
  {"label": "Mục tiêu", "value": "Tiếp cận khách lạnh bằng content ngắn dạng hook nhanh, build channel brand nhận diện"},
  {"label": "Đối tượng", "value": "Gen Z & Millennials 18–35, thích nội dung ngắn, nhanh, thực tế"},
  {"label": "Tần suất", "value": "1 bài/ngày, 5–7 ngày/tuần"},
  {"label": "Định dạng", "value": "Video ngắn 15–60s, trend-based, hook ≤3s"},
  {"label": "Loại khách", "value": "Lạnh — chưa biết brand, cần hook mạnh"}
]
```

## INSTAGRAM — theme "blue_1"
```json
"info_section": [
  {"label": "Mục tiêu", "value": "Xây mood board visual thương hiệu, kéo booking qua Stories + Reels"},
  {"label": "Đối tượng", "value": "Nữ 22–40, thích visual đẹp, lifestyle cao cấp"},
  {"label": "Tần suất", "value": "1 bài feed/ngày + 3–5 stories/ngày + 3 reels/tuần"},
  {"label": "Định dạng", "value": "Feed ảnh thật chất lượng cao, Reel 15–30s, Stories BTS"},
  {"label": "Tone & Voice", "value": "Visual-first, ngắn gọn, aspirational"}
]
```

## YOUTUBE — theme "blue_1"
```json
"info_section": [
  {"label": "Mục tiêu", "value": "Xây kênh authority, giáo dục chuyên sâu, SEO lâu dài"},
  {"label": "Đối tượng", "value": "Người đang tìm hiểu sâu về [ngách], sẵn sàng xem video >5 phút"},
  {"label": "Tần suất", "value": "1 video dài/tuần + 2–3 Shorts/tuần"},
  {"label": "Định dạng", "value": "Long-form 5–15 phút + YouTube Shorts ≤60s"},
  {"label": "Tone & Voice", "value": "Chuyên gia, uy tín, cấu trúc rõ ràng"}
]
```

## THREADS — theme "blue_1"
```json
"info_section": [
  {"label": "Mục tiêu", "value": "Xây thương hiệu cá nhân thông qua tư duy, quan điểm, câu chuyện ngắn"},
  {"label": "Đối tượng", "value": "Người dùng Threads thích nội dung text, tư duy & trải nghiệm"},
  {"label": "Tần suất", "value": "2–3 posts/ngày"},
  {"label": "Định dạng", "value": "Text ngắn (<500 ký tự), thỉnh thoảng ảnh đơn"},
  {"label": "Tone & Voice", "value": "Thân thiện, suy ngẫm, có quan điểm rõ ràng"}
]
```

## Cấu trúc pillar_table theo nền tảng

### Facebook style (dọc) — pillars nằm thành các hàng
Dùng cho: Facebook, Instagram, YouTube, Threads
```json
"pillar_table": {
  "style": "facebook_style",
  "title": "NỘI DUNG VÀ TẦN SUẤT POST",
  "pillars": [
    {
      "name": "Tên pillar ngắn",
      "ratio": 0.3,
      "content_angle": "Mô tả chi tiết góc tiếp cận của pillar",
      "goal": "Nhận diện / Niềm tin / Chuyển đổi",
      "format_real_photo": true,
      "format_design_photo": true,
      "format_reel_video": true
    }
  ]
}
```

### TikTok style (ngang) — pillars nằm thành các cột
Dùng cho: TikTok
```json
"pillar_table": {
  "style": "tiktok_style",
  "title": "CONTENT PILLAR",
  "info_rows": [
    {"label": "Định dạng", "values": ["Video ngắn 15-30s", "...", "...", "..."]},
    {"label": "Đối tượng", "values": ["Lạnh", "Lạnh", "Warm", "Warm"]},
    {"label": "Mục tiêu", "values": ["...", "...", "...", "..."]}
  ],
  "pillars": [
    {"name": "Pillar 1", "ratio": 0.25, "content_angle": "..."}
  ]
}
```

## Cấu trúc Content Mapping theo nền tảng

### Dual-post style (2 slot/ngày: Video + Bài viết)
Dùng cho: Facebook
```json
"content_mapping": {
  "style": "dual_post",
  "weeks": [
    {
      "label": "Tuần 1",
      "start_date": "2026-05-01",
      "days_count": 7,
      "slots": [
        {
          "slot_name": "Video/Reel",
          "titles": ["T2: ...", "T3: ...", "T4: ...", "T5: ...", "T6: ...", "T7: ...", "CN: ..."]
        },
        {
          "slot_name": "Bài viết",
          "titles": ["T2: ...", "T3: ...", "T4: ...", "T5: ...", "T6: ...", "T7: ...", "CN: ..."]
        }
      ]
    }
  ]
}
```

### Single-post style (1 slot/ngày)
Dùng cho: TikTok, Instagram, Threads, YouTube Shorts
```json
"content_mapping": {
  "style": "single_post",
  "weeks": [
    {
      "label": "Tuần 1",
      "start_date": "2026-05-01",
      "days_count": 7,
      "slots": [
        {
          "slot_name": "Video TikTok",
          "titles": ["T2: ...", "T3: ...", "T4: ...", "T5: ...", "T6: ...", "T7: ...", "CN: ..."]
        }
      ]
    }
  ]
}
```

## Số tuần khuyến nghị

- **Plan ngắn (thử nghiệm)**: 2 tuần
- **Plan chuẩn (1 tháng)**: 4 tuần
- **Plan quý**: 12 tuần (chia theo theme tháng: Tháng 1 Khai trương, Tháng 2 Tết, Tháng 3 Mùa hè…)

Mặc định nên làm **4 tuần** cho khách mới, đủ để họ test và thấy kết quả.
