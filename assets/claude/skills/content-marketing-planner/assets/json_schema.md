# JSON Input Schema cho `build_plan.py`

## Tổng thể
```json
{
  "company_name": "Tên thương hiệu",
  "customer_portrait": { ... },
  "general_direction": [ ... ],
  "platforms": [ ... ]
}
```

## 1. customer_portrait (Chân dung khách hàng)

```json
"customer_portrait": {
  "segments": [
    "Phân khúc 1 (VD: Gia đình 3-5 người)",
    "Phân khúc 2 (VD: Đoàn công ty)",
    "Phân khúc 3 (VD: Đoàn du lịch)"
  ],
  "dimensions": [
    {
      "label": "Nhân khẩu học",
      "values": [
        "Mô tả cho phân khúc 1",
        "Mô tả cho phân khúc 2",
        "Mô tả cho phân khúc 3"
      ]
    },
    {"label": "Hành vi tiêu dùng", "values": [...]},
    {"label": "Tâm lý/Insight", "values": [...]},
    {"label": "Nhu cầu & Mong muốn", "values": [...]},
    {"label": "Động lực", "values": [...]},
    {"label": "Rào cản", "values": [...]}
  ]
}
```

**Yêu cầu**:
- `segments`: 2–5 phân khúc
- `dimensions`: luôn đủ 6 chiều theo thứ tự trên
- Số lượng `values` trong mỗi dimension = số lượng `segments`

## 2. general_direction (Định hướng chung)

```json
"general_direction": [
  {"label": "Mục tiêu chính", "value": "..."},
  {"label": "Định vị hình ảnh", "value": "..."},
  {"label": "Gợi ý định vị", "value": "..."},
  {"label": "Gợi ý BIO", "value": "..."},
  {"label": "Mục tiêu cụ thể", "value": "..."}
]
```

**Yêu cầu**: 5 dòng theo thứ tự trên.

## 3. platforms (Mảng các nền tảng)

Mỗi platform có cấu trúc:
```json
{
  "name": "FACEBOOK" | "TIKTOK" | "INSTAGRAM" | "YOUTUBE" | "THREADS",
  "theme": "blue_1" | "blue_2",
  "channel_title": "Tên kênh (optional — chỉ TikTok)",
  "info_section": [
    {"label": "Mục tiêu", "value": "..."},
    {"label": "Đối tượng", "value": "..."},
    {"label": "Tần suất", "value": "..."},
    {"label": "Định dạng", "value": "..."}
  ],
  "pillar_table": { ... },
  "content_mapping": { ... }
}
```

### 3a. pillar_table — style "facebook_style" (cho FB, IG, YT, Threads)
```json
"pillar_table": {
  "style": "facebook_style",
  "title": "NỘI DUNG VÀ TẦN SUẤT POST",
  "pillars": [
    {
      "name": "Câu chuyện thương hiệu",
      "ratio": 0.15,
      "content_angle": "Kể về founder, nguyên liệu đặc biệt...",
      "goal": "Xây dựng nhận diện",
      "format_real_photo": true,
      "format_design_photo": false,
      "format_reel_video": true
    },
    {
      "name": "Sản phẩm / món ăn",
      "ratio": 0.3,
      "content_angle": "Ảnh món đẹp, review chi tiết...",
      "goal": "Kích thích nhu cầu",
      "format_real_photo": true,
      "format_design_photo": false,
      "format_reel_video": true
    }
  ]
}
```

### 3b. pillar_table — style "tiktok_style" (cho TikTok)
```json
"pillar_table": {
  "style": "tiktok_style",
  "title": "CONTENT PILLAR",
  "info_rows": [
    {"label": "Định dạng", "values": ["Video 15-30s", "Video 15-30s", "Video 30-60s", "Video 30-60s"]},
    {"label": "Đối tượng", "values": ["Lạnh", "Lạnh", "Warm", "Warm"]},
    {"label": "Mục tiêu", "values": ["Tiếp cận", "Tiếp cận", "Thuyết phục", "Chuyển đổi"]}
  ],
  "pillars": [
    {"name": "Pillar A", "ratio": 0.25, "content_angle": "..."},
    {"name": "Pillar B", "ratio": 0.25, "content_angle": "..."},
    {"name": "Pillar C", "ratio": 0.25, "content_angle": "..."},
    {"name": "Pillar D", "ratio": 0.25, "content_angle": "..."}
  ]
}
```

### 3c. content_mapping — style "dual_post" (FB)
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
          "titles": [
            "T2 01/05: Tiêu đề video ngày 1",
            "T3 02/05: Tiêu đề video ngày 2",
            "T4 03/05: ...",
            "T5 04/05: ...",
            "T6 05/05: ...",
            "T7 06/05: ...",
            "CN 07/05: ..."
          ]
        },
        {
          "slot_name": "Bài viết",
          "titles": [
            "T2 01/05: Tiêu đề bài viết ngày 1",
            "T3 02/05: ...",
            "..."
          ]
        }
      ]
    }
  ]
}
```

### 3d. content_mapping — style "single_post" (TikTok, IG, Threads)
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
          "titles": [
            "T2: Tiêu đề 1",
            "T3: Tiêu đề 2",
            "..."
          ]
        }
      ]
    }
  ]
}
```

## Quy tắc bắt buộc

1. **Tổng ratio các pillar = 1.0 (100%)**. Sai là plan sẽ mất cân đối.
2. **`titles` của mỗi slot phải có đúng `days_count` phần tử**. Nếu `days_count` = 7 thì phải có 7 tiêu đề.
3. **Date format**: "YYYY-MM-DD".
4. **Theme "blue_2"** chỉ dùng cho TikTok; còn lại dùng "blue_1".
5. **pillar_table.style "tiktok_style"** chỉ dùng cho TikTok; nền tảng khác dùng "facebook_style".
6. **content_mapping.style "dual_post"** hợp với Facebook (2 slot/ngày); "single_post" cho TikTok, IG, Threads.
7. **Số tuần**: thường 4 tuần. Có thể 2, 6, 8, 12 tùy quy mô plan.

## Ví dụ hoàn chỉnh
Xem file `examples/bien_dong_example.json`.
