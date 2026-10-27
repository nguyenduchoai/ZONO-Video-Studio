# Meta Ads API — Cú pháp đầy đủ

## Endpoint gốc
```
https://graph.facebook.com/v21.0/
```
Access token được cấp qua MCP server — không cần truyền thủ công.

---

## 1. Lấy danh sách Campaigns

```http
GET /{act_id}/campaigns?fields=id,name,status,objective&limit=100
```

### Lấy insights kèm theo:
```http
GET /{campaign_id}/insights
  ?fields=spend,impressions,reach,clicks,inline_link_clicks,actions,cost_per_action_type,cpm,cpc,ctr,inline_link_click_ctr,frequency
  &time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
  &level=campaign
```

---

## 2. Lấy danh sách Ad Sets

```http
GET /{act_id}/adsets
  ?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,optimization_goal
  &limit=200
```

### Insights Ad Set level:
```http
GET /{adset_id}/insights
  ?fields=spend,impressions,reach,clicks,inline_link_clicks,actions,cost_per_action_type,cpm,cpc,ctr,frequency
  &time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
  &level=adset
```

---

## 3. Lấy danh sách Ads (từng mã)

```http
GET /{act_id}/ads
  ?fields=id,name,status,adset_id,campaign_id,creative{id,name}
  &limit=200
```

### Insights Ad level:
```http
GET /{ad_id}/insights
  ?fields=spend,impressions,reach,clicks,inline_link_clicks,actions,cost_per_action_type,cpm,cpc,ctr,frequency
  &time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
  &level=ad
```

---

## 4. Breakdown theo ngày (account level)

```http
GET /{act_id}/insights
  ?fields=spend,impressions,reach,clicks,actions,cpm,ctr
  &time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
  &time_increment=1
  &level=account
```

---

## 5. Xử lý phân trang (Pagination)

API trả về cursor-based pagination. Luôn kiểm tra `paging.next`:

```json
{
  "data": [...],
  "paging": {
    "cursors": { "after": "xxx" },
    "next": "https://graph.facebook.com/..."
  }
}
```

Nếu có `paging.next` → gọi tiếp với `&after={cursor}` cho đến khi hết.

---

## 6. Mapping action_type → "data (cd)"

| Mục tiêu campaign | action_type cần lấy |
|---|---|
| LEAD_GENERATION | `lead` |
| MESSAGES | `onsite_conversion.messaging_conversation_started_7d` |
| CONVERSIONS / SALES | `purchase` hoặc custom event |
| APP_INSTALLS | `app_install` |

> Nếu không rõ objective → lấy tất cả `actions` và hỏi user xác nhận action_type nào là "data chính".

---

## 7. Lưu ý rate limit

- Basic tier: 200 calls/giờ/user
- Nếu bị rate limit (error code 17 hoặc 4) → chờ 5 phút rồi thử lại
- Ưu tiên dùng batch request nếu cần gọi >10 ads cùng lúc
