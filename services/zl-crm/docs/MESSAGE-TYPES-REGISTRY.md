# ZaloCRM — Registry các loại tin nhắn / sự kiện trong hội thoại

> **Mục đích**: bảng tra cứu chuẩn để anh báo bug. Mỗi loại có **MÃ EVENT** (E01–E33).
> Khi thấy cột 2 (preview list) hoặc cột 3 (chat thread) render sai, anh gửi:
> "Mã **E_xx** sai ở cột _2/3_, hội thoại `<conversation_id>`, msg `<id>`" → em tìm thẳng tới chỗ fix.
>
> **Snapshot DB**: 2026-05-21 — query trực tiếp từ `zalo-crm-db` (PostgreSQL).
> Tổng số msg active: ~27,576. Reactions: 5,913. Quote/reply: 4,509. Album multi-image: 3,614.

---

## 1. Tổng quan kiến trúc

### 1.1 Nguồn lưu trữ
- **Table `messages`** (`Message` model) — bảng chính, mọi loại tin nhắn + bubble sự kiện (call, reminder, bank, ...).
- **Table `message_reactions`** — emoji thả vào tin nhắn (heart/like/...).
- **Table `friends`** + `activity_logs` — sự kiện kết bạn, đổi trạng thái, ... **KHÔNG render trong message thread**, nằm ở timeline KH.

### 1.2 Field phân loại trong `messages`
| Field | Vai trò |
|---|---|
| `content_type` | String classifier — `text`, `image`, `video`, `file`, `voice`, `audio`, `sticker`, `gif`, `image_album`, `link`, `location`, `contact_card`, `bank_transfer`, `call`, `qr_code`, `reminder`, `poll`, `note`, `forwarded`, `rich` |
| `content` | Plain text HOẶC JSON object (Zalo gửi structured) |
| `content`→`action` (JSON sub-field) | Sub-classifier khi `content_type=contact_card`/`call`/`bank_transfer`/`rich`/`poll`/`reminder`/`gif` — quyết định loại con cụ thể |
| `sender_type` | `contact` (KH gửi) / `self` (sale gửi) |
| `album_key` / `album_index` / `album_total` | Multi-image album grouping (chỉ image) |
| `quote` | JSON reply-to khi tin trả lời tin khác |
| `is_deleted` | true = đã thu hồi (hiện text "tin nhắn đã thu hồi") |

### 1.3 2 cột UI

- **Cột 2** — `ConversationList.vue` → render preview qua `messagePreview()` ([use-contacts.ts:151](frontend/src/composables/use-contacts.ts#L151)) + `CONTENT_TYPE_LABEL` ([use-contacts.ts:139](frontend/src/composables/use-contacts.ts#L139)). Tin gọi/danh thiếp có nhánh riêng trong [ConversationList.vue:473](frontend/src/components/chat/ConversationList.vue#L473).
- **Cột 3** — `MessageThread.vue` → mỗi message render qua `message-bubble.vue` → các loại đặc biệt delegate sang `special-message-renderer.vue`.

### 1.4 Detect type từ Zalo SDK
File: [backend/src/modules/zalo/zalo-message-helpers.ts](backend/src/modules/zalo/zalo-message-helpers.ts) → `detectContentType(msgType, content)`. Thứ tự ưu tiên:
1. `content.action` (specific) — `recommened.calltime/misscall` → call; `zinstant.bankcard` → bank_transfer; `qrCodeUrl` in description → qr_code
2. `msgType` keyword — `photo/image`, `sticker`, `video`, `voice`, `gif`, `link`, `location`, `file/doc`, `recommended/card`, `bank/transfer`, `call/voip`, `qr`, `remind/todo`, `poll/vote`, `note`, `forward`
3. Content shape fallback — auto-unfurl link (href + thumb + empty action) → link
4. Unknown object → `rich`; unknown string → `text`

---

## 2. Bảng FULL các loại sự kiện (E01–E33)

> **Direction**: 📥 inbound (KH → sale) / 📤 outbound (sale → KH) / ↔️ both
> **In DB?**: số rows hiện có (theo snapshot)
> **Sample**: 1 `id` thực, có thể paste vào URL `/chat/<conversation_id>` rồi scroll tới
> **Render file**: ưu tiên file/line cần check khi bug

### 2.1 Tin nhắn cơ bản

| Mã | Loại | content_type | action sub | Cột 2 preview | Cột 3 render | DB rows | Sample ID | Render file:line |
|---|---|---|---|---|---|---|---|---|
| **E01** | Text thường ↔️ | `text` | — | Trích text (max 60 char + "…") | Plain text + escape HTML + @mention highlight + `\n`→`<br>` | 17,940 | `b9c7578a-223a-4b05-a7d7-f0690fa51900` (📥) `6bfc8140-8313-4696-bf52-064552040875` (📤) | [message-bubble.vue:181](frontend/src/components/chat/message-bubble.vue#L181) |
| **E02** | RTF rich text ↔️ | `rich` | `rtf` | Trích text từ `content.title` | Generic rich card + apply bold/italic/color/underline từ `params.styles` + mentions | 1,448 | `40097ca8-3a02-479c-8f0d-6eab63995a4f` (📥) `b2e07550-298f-48f3-96d8-a965b32721e1` (📤) | [special-message-renderer.vue:180](frontend/src/components/chat/special-message-renderer.vue#L180) |
| **E03** | Rich không action ↔️ | `rich` | (rỗng) | "rich" (KHÔNG có label) | Generic rich card best-effort | 16 | `4a72e95d-bcf3-4a1f-8b25-970630860a69` | [special-message-renderer.vue:180](frontend/src/components/chat/special-message-renderer.vue#L180) |
| **E04** | Tin đã thu hồi | (bất kỳ) | — | (preview cuối còn lại) | Italic xám "tin nhắn (đã thu hồi)" | 0 hiện tại | — | [message-bubble.vue:31](frontend/src/components/chat/message-bubble.vue#L31) |
| **E05** | Reply / Trả lời | (bất kỳ + `quote` not null) | — | (preview của tin trả lời) | Quote card phía trên + nội dung tin trả lời | 4,509 | `3e8698ab-7f18-4c28-a63d-5c9b1eb2abde` | [message-bubble.vue:36](frontend/src/components/chat/message-bubble.vue#L36) |

### 2.2 Media

| Mã | Loại | content_type | action sub | Cột 2 preview | Cột 3 render | DB rows | Sample ID | Render file:line |
|---|---|---|---|---|---|---|---|---|
| **E06** | Ảnh đơn ↔️ | `image` | — | "📷 Hình ảnh" (nếu rỗng content) hoặc caption | `<img>` element, click → preview modal full | 5,894 | `d057a95a-38a9-4c35-80a4-08162222cd56` (📥) `e35975dd-9d46-4568-b49c-e51fbae205d6` (📤) | [message-bubble.vue:58](frontend/src/components/chat/message-bubble.vue#L58) |
| **E07** | Album ảnh ↔️ | `image` + `album_key` not null | — | "📷 Hình ảnh" | Render gallery group (album_total ảnh, scroll/grid) | 3,614 | `844f31b3-6d8a-4dbf-81a0-046dea83cad1` (album_key `1779340045231`, total 2) | [message-bubble.vue:58](frontend/src/components/chat/message-bubble.vue#L58) + album logic |
| **E08** | Video ↔️ | `video` | — | "🎥 Video" | Thumbnail + play overlay HOẶC `<video>` inline | 302 | `27726462-5589-48b6-87b3-4f24d10c11e0` (📥) `363d8437-0b35-415e-a5cb-0ccc5594a3e2` (📤) | [message-bubble.vue:118](frontend/src/components/chat/message-bubble.vue#L118) |
| **E09** | File / tài liệu ↔️ | `file` | — | "📎 File" | File card: icon + tên + size + nút download | 192 | `c53ddcf7-251c-4898-9c24-8584830a8a09` (📥 .mp4) `8eaef9ad-04da-4201-92fc-200c45fb0c2d` (📤 .xlsx) | [message-bubble.vue:69](frontend/src/components/chat/message-bubble.vue#L69) |
| **E10** | Ghi âm / voice ↔️ | `voice` | — | "🎤 Voice" | Play button + link "▶ Nghe" | 2 (📥 only) | `c6861af7-2bea-452b-95ed-a9217afb1f3e` | [message-bubble.vue:148](frontend/src/components/chat/message-bubble.vue#L148) |
| **E11** | Audio (alias) ↔️ | `audio` | — | "🎤 Voice" (cùng label) | Tương tự voice | 0 (chưa có) | — | [message-bubble.vue:264](frontend/src/components/chat/message-bubble.vue#L264) |
| **E12** | Sticker ↔️ | `sticker` | — | "🎴 Sticker" | Sticker animated CSS sprite hoặc static (fetch metadata `/api/v1/zalo-sticker/{catId}/{id}`) | 545 | `1c45861b-4a33-48de-96d9-ed052a7f952d` (📥) `b07dda39-815b-4bc3-b946-05b1eb633c1b` (📤) | [message-bubble.vue:90](frontend/src/components/chat/message-bubble.vue#L90) |
| **E13** | GIF 📤 | `gif` | `recommend.gif` | "🎞️ GIF" | `<img>` animated GIF | 2 (📤 only) | `627772ee-ef35-4759-81ef-3868c1e91c62` | [message-bubble.vue:158](frontend/src/components/chat/message-bubble.vue#L158) |

### 2.3 Cuộc gọi (stored as `content_type=call`, sub by action + params)

| Mã | Loại | content_type | action sub | Cột 2 preview | Cột 3 render | DB rows | Sample ID | Render file:line |
|---|---|---|---|---|---|---|---|---|
| **E14** | Cuộc gọi đến — đã nghe 📥 | `call` | `recommened.calltime` (isCaller=0) | "📞 Cuộc gọi (mm:ss)" | Call card: icon phone-incoming + duration | 87 (gộp cả video) | `5ea517b9-145c-42dc-bc8f-6b9b1e0ce323` | [special-message-renderer.vue:64](frontend/src/components/chat/special-message-renderer.vue#L64) |
| **E15** | Cuộc gọi đi — đã nghe 📤 | `call` | `recommened.calltime` (isCaller=1) | "📞 Cuộc gọi (mm:ss)" | Call card: icon phone-outgoing + duration | 16 | `f6b1a8e3-02aa-49c9-a43b-e5fe70ef2960` | [special-message-renderer.vue:64](frontend/src/components/chat/special-message-renderer.vue#L64) |
| **E16** | Cuộc gọi video — đã nghe ↔️ | `call` | `recommened.calltime` (calltype=1) | "📹 Video (mm:ss)" | Call card: icon video + duration | (subset của E14/15) | (cùng E14/15, phân theo `params.calltype=1`) | [special-message-renderer.vue:64](frontend/src/components/chat/special-message-renderer.vue#L64) |
| **E17** | Cuộc gọi nhỡ — KH gọi 📥 | `call` | `recommened.misscall` (isCaller=0) | "❌ Cuộc gọi nhỡ" | Call card: icon phone-missed (đỏ) | 22 | `b8a367e6-885a-46b4-9d3f-ebf3f5e7db9b` | [special-message-renderer.vue:64](frontend/src/components/chat/special-message-renderer.vue#L64) |
| **E18** | Cuộc gọi không trả lời — sale gọi 📤 | `call` | `recommened.misscall` (isCaller=1) | "❌ Cuộc gọi không trả lời" | Call card: icon phone-missed (đỏ) | 15 | `bb35f4c9-f738-4e1c-a54e-f94c55934f56` | [special-message-renderer.vue:64](frontend/src/components/chat/special-message-renderer.vue#L64) |
| **E19** | Cuộc gọi video nhỡ ↔️ | `call` | `misscall` (calltype=1) | "❌ Cuộc gọi video nhỡ" | Call card: icon video-off (đỏ) | (subset E17/18) | (lọc theo `params.calltype=1`) | [special-message-renderer.vue:64](frontend/src/components/chat/special-message-renderer.vue#L64) |

> ⚠️ Logic detect call inbound/outbound/video hiện ĐANG dựa vào `params.isCaller` + `params.calltype` trong `content` JSON. Anh check kỹ ở [ConversationList.vue:473-510](frontend/src/components/chat/ConversationList.vue#L473) và [special-message-renderer.vue:64](frontend/src/components/chat/special-message-renderer.vue#L64).

### 2.4 Contact card polymorphic (stored as `content_type=contact_card`, sub by action)

| Mã | Loại | content_type | action sub | Cột 2 preview | Cột 3 render | DB rows | Sample ID | Render file:line |
|---|---|---|---|---|---|---|---|---|
| **E20** | Gửi link với preview ↔️ | `contact_card` | `recommened.link` | "👤 Danh thiếp" hoặc title link | **HIỆN ĐANG render generic** — nên là link preview card | 635 | `9a276256-69db-42f8-b5fe-5f3af08d809d` (📥) `f1ed8bb3-f43a-49cb-bbeb-49d7de416150` (📤) | [special-message-renderer.vue (cần kiểm)](frontend/src/components/chat/special-message-renderer.vue) |
| **E21** | Danh thiếp (profile) ↔️ | `contact_card` | `show.profile` | "👤 Danh thiếp" | Contact card: avatar + name + phone | 49 | `e6dc418f-562e-4caa-9019-b2c1a49ffcc8` (📥) `b5f0e390-cb23-4199-ad2e-81b9db3d4190` (📤) | [special-message-renderer.vue](frontend/src/components/chat/special-message-renderer.vue) |
| **E22** | Gợi ý user (recommend friend) ↔️ | `contact_card` | `recommened.user` | "👤 Danh thiếp" | Suggest-user card | 35 | `e93d5edd-64d3-4b07-a9e5-933beaaa3dce` (📥) `a61911b5-f715-4db1-97f5-f5c676e69578` (📤) | [special-message-renderer.vue](frontend/src/components/chat/special-message-renderer.vue) |

> 🐞 **Nghi vấn bug E20**: `recommened.link` là chia sẻ link có preview (Facebook reel, Google Maps, ...). DB có 635 rows nhưng vẫn ghi `content_type='contact_card'` thay vì `link`. Cột 2 preview hiển thị "👤 Danh thiếp" → sai semantic. **Anh check lại `detectContentType()` xem có cần promote `recommened.link` → `link`** khi `content.action='recommened.link'` + `content.href` not empty.

### 2.5 Link / Location

| Mã | Loại | content_type | action sub | Cột 2 preview | Cột 3 render | DB rows | Sample ID | Render file:line |
|---|---|---|---|---|---|---|---|---|
| **E23** | Link preview (auto-unfurl) ↔️ | `link` | (rỗng) | "🔗 Liên kết" | Link card 2-col: thumb + title + description | 0 (Zalo SDK không trả thẳng — toàn fall vào E20) | — | [special-message-renderer.vue:162](frontend/src/components/chat/special-message-renderer.vue#L162) |
| **E24** | Vị trí pinned 📍 ↔️ | `location` | (rỗng) | "📍 Vị trí" | Google Maps iframe + tọa độ + "live location" badge nếu có | 11 | `d64b6aff-711a-4cd2-9f32-30eae7ecaa66` (📥) `2023a666-ab42-4786-8618-394a7ec1d20c` (📤) | [special-message-renderer.vue:131](frontend/src/components/chat/special-message-renderer.vue#L131) |

### 2.6 Chuyển khoản / QR

| Mã | Loại | content_type | action sub | Cột 2 preview | Cột 3 render | DB rows | Sample ID | Render file:line |
|---|---|---|---|---|---|---|---|---|
| **E25** | Chuyển khoản (VietQR) ↔️ | `bank_transfer` | `zinstant.bankcard` | "bank_transfer" (KHÔNG có label) | Bank card: logo NH + STK + QR ảnh, fallback link | 18 | `12182c56-5064-4951-a46e-ef1fe0fc4d5f` (📥) `44b0b12b-48b0-4577-a314-55f2f664c3c5` (📤) | [special-message-renderer.vue:6](frontend/src/components/chat/special-message-renderer.vue#L6) |
| **E26** | Chuyển khoản (misclassified→rich) ↔️ | `rich` | `zinstant.bankcard` | "rich" | Generic rich card (KHÔNG ra bank card!) | 14 | `d0e3cd40-d1c9-4b43-af37-92be31043525` (📥) `39b3b239-3142-49fe-b85d-8094a5f65751` (📤) | (bug — không vào nhánh bank) |
| **E27** | Mã QR code 📥 | `qr_code` | — | "qr_code" (KHÔNG có label) | QR image clickable | 0 | — (Zalo SDK không trả type này) | [special-message-renderer.vue:76](frontend/src/components/chat/special-message-renderer.vue#L76) |

> 🐞 **Bug E26**: 14 row bank được Zalo gửi nhưng `detectContentType` không match → fallback thành `rich`. Cần kiểm tra `msgType` của batch này so với rule "msgType includes 'bank/transfer'". Có thể msgType là `webchat` hoặc rỗng, chỉ action mới phân biệt. Anh search trong logger.info `[zalo:msgType] Unknown object type`.

### 2.7 Nhắc hẹn / Reminder

| Mã | Loại | content_type | action sub | Cột 2 preview | Cột 3 render | DB rows | Sample ID | Render file:line |
|---|---|---|---|---|---|---|---|---|
| **E28** | Reminder / system notice ↔️ | `reminder` | `msginfo.actionlist` | "reminder" (KHÔNG có label) | Warning card: ⏰ + title + body (vd "Anh Thư được … mời tham gia nhóm") | 129 | `d27a6b7d-4d62-4a56-ac2e-1041f6d37d53` (📥) `3a26706d-deb2-418d-acfd-d645f97cf52e` (📤) | [special-message-renderer.vue:94](frontend/src/components/chat/special-message-renderer.vue#L94) + [message-bubble.vue:46](frontend/src/components/chat/message-bubble.vue#L46) |

### 2.8 Poll (bình chọn) — `content_type=poll`, sub by action

| Mã | Loại | content_type | action sub | Cột 2 preview | Cột 3 render | DB rows | Sample ID | Render file:line |
|---|---|---|---|---|---|---|---|---|
| **E29** | Poll — tạo mới 📥 | `poll` | `create` | "poll" (KHÔNG có label) | Poll card: title + danh sách options + radio/checkbox | 9 | `831b8ff5-bb88-43e2-9f26-a5e05ee3610e` | [special-message-renderer.vue:102](frontend/src/components/chat/special-message-renderer.vue#L102) |
| **E30** | Poll — bỏ phiếu ↔️ | `poll` | `vote` | "poll" | Poll card: hiển thị vote choice | 159 | `9f82e082-6448-4828-9893-7c4b840e422c` (📥) `ac3cbe31-0efc-454b-9b66-70279799598a` (📤) | [special-message-renderer.vue:102](frontend/src/components/chat/special-message-renderer.vue#L102) |
| **E31** | Poll — sửa option 📥 ↔️ | `poll` | `update` | "poll" | Poll card update notice | 6 | `22fa0907-5e47-4891-82c0-9581e9dfc265` (📥) `928c00b0-583a-4f1e-b938-e8ea8bc37195` (📤) | [special-message-renderer.vue:102](frontend/src/components/chat/special-message-renderer.vue#L102) |
| **E32** | Poll — đóng poll 📥 | `poll` | `close` | "poll" | Poll card "đã đóng" | 1 | `146f1bc2-c82f-495e-9eef-6e08f60aff93` | [special-message-renderer.vue:102](frontend/src/components/chat/special-message-renderer.vue#L102) |

### 2.9 Loại được code support nhưng CHƯA có data thực

| Mã | Loại | content_type | Trạng thái |
|---|---|---|---|
| **E33** | Note / Ghi chú | `note` | Code có handle ([special-message-renderer.vue:113](frontend/src/components/chat/special-message-renderer.vue#L113)) nhưng 0 row trong DB |
| **E34** | Forwarded / Chuyển tiếp | `forwarded` | Code có handle ([special-message-renderer.vue:122](frontend/src/components/chat/special-message-renderer.vue#L122)) nhưng 0 row trong DB |

---

## 3. Reaction (emoji thả vào tin) — bảng phụ `message_reactions`

KHÔNG phải message — là **child entity** của message. Render bám vào bubble (góc phải dưới).

| Mã | Emoji Zalo code | Hiển thị | Số lần thấy trong DB | File mapping |
|---|---|---|---|---|
| **R01** | `/-heart` | ❤️ | 4,292 | [zalo-listener-factory.ts:14](backend/src/modules/zalo/zalo-listener-factory.ts#L14) |
| **R02** | `:>` | 😆 | 860 | (cùng file) |
| **R03** | `/-strong` | 👍 | 603 | (cùng file) |
| **R04** | `:o` | 😮 | 92 | (cùng file) |
| **R05** | `:-((` | 😭 | 57 | (cùng file) |
| **R06** | `:-h` | 😡 | 8 | (cùng file) |
| **R07** | `/-rose` | 🌹 | 0 | mapping có sẵn |
| **R08** | `/-break` | 💔 | 0 | mapping có sẵn |
| **R09** | `/-weak` | 👎 | 0 | mapping có sẵn |
| **R10** | Custom text (vd `Dạ 💗`) | passthrough | 1 | reactor có thể gửi raw |

Reaction logic: row trong `message_reactions` có thể là từ `reactor_source='zalo'` (KH bỏ reaction trên Zalo) hoặc `reactor_source='crm'` (sale thả qua UI ZaloCRM). Khi `emoji` rỗng + `rType<0` → removal event.

Sample reaction ID: `3684e381-5614-45fc-8199-84037c3736a6` (mới nhất, ❤️ trên msg `e258e749-...`).

---

## 4. Các sự kiện KHÔNG phải message (chỉ ở Timeline KH, không ở Chat thread)

> Đặt riêng để rõ scope — anh đừng nhầm với mã E01–E34.

| Mã | Loại sự kiện | Bảng | UI cột nào |
|---|---|---|---|
| **A01** | Kết bạn (request gửi/nhận/accept/reject) | `friends` + `activity_logs` (`action='friend_alias_change'/'friend_state_change'`) | Timeline tab KH ([ActivityItem.vue](frontend/src/components/chat/ActivityItem.vue)) |
| **A02** | Đổi care status | `activity_logs` (`action='status_change'`) | Timeline |
| **A03** | Đổi score | `activity_logs` (`action='score_change'`) | Timeline |
| **A04** | Gắn/gỡ CRM tag | `activity_logs` (`action='tag_add_crm'/'tag_remove_crm'`) | Timeline |
| **A05** | Gắn/gỡ Zalo tag (sync) | `activity_logs` (`action='tag_add_zalo'/'tag_remove_zalo'/'tag_change_zalo'`) | Timeline |
| **A06** | Tạo / dời / huỷ / hoàn thành lịch hẹn | `appointments` + `activity_logs` (`appointment_create/reschedule/cancel/complete`) | Timeline |
| **A07** | Auto-tag bot scoring | `activity_logs` (`auto_tag_change`) | Timeline |
| **A08** | Friend alias change | `activity_logs` (`friend_alias_change`) | Timeline |

---

## 5. Tổng hợp gap đã phát hiện (CẦN KIỂM CHỨNG)

| Gap | Mô tả | Mã liên quan | Ưu tiên |
|---|---|---|---|
| **G1** | `recommened.link` (635 rows) bị nhận diện là `contact_card` thay vì `link` → preview cột 2 sai semantic ("👤 Danh thiếp" thay vì "🔗 Liên kết") | E20 vs E23 | **CAO** |
| **G2** | Bank transfer (14 rows) bị fallback vào `rich` → cột 3 không ra bank card | E26 vs E25 | **CAO** |
| **G3** | `bank_transfer`, `call`, `qr_code`, `reminder`, `poll`, `note`, `forwarded`, `rich` KHÔNG có entry trong `CONTENT_TYPE_LABEL` ([use-contacts.ts:139](frontend/src/composables/use-contacts.ts#L139)) → cột 2 hiện raw string xấu ("call", "bank_transfer", ...) thay vì label đẹp | E14–E19, E25–E32 | **TRUNG** |
| **G4** | Call detect cột 2 đã có nhánh đặc biệt ([ConversationList.vue:473](frontend/src/components/chat/ConversationList.vue#L473)), nhưng bank/qr/reminder/poll thì chưa | E25, E27, E28, E29–32 | **TRUNG** |
| **G5** | Album multi-image (3,614 rows) render từng ảnh riêng — chưa group thành gallery UI | E07 | **THẤP** (cần check render thực tế) |
| **G6** | Voice chỉ có 2 row, có thể KH dùng nhiều hơn nhưng SDK ingest sót — anh check log | E10 | **THẤP** |

---

## 6. Cách báo bug

> **Format chuẩn**:
> ```
> Mã E_xx — Cột _2 hoặc 3_ sai
> conversation_id: <uuid>
> msg id: <uuid>  (lấy từ bảng trên)
> Mô tả: thực tế hiển thị gì vs. mong muốn gì
> Screenshot (nếu có)
> ```

Em sẽ:
1. Tra mã E_xx → biết loại nào, action sub gì
2. Mở file:line tương ứng cột anh báo
3. Query `SELECT content FROM messages WHERE id='<uuid>'` để xem JSON thực
4. Fix logic detect (backend) hoặc render (frontend)

---

## 7. Lệnh query nhanh tự tra cứu

```bash
# Connect DB
docker exec -it zalo-crm-db psql -U crmuser -d zalocrm

# Đếm số rows theo type+action
SELECT content_type, sender_type,
       substring(content from '"action":\s*"([^"]*)"') AS action,
       COUNT(*)
FROM messages WHERE is_deleted=false
GROUP BY 1,2,3 ORDER BY 1, 4 DESC;

# Lấy sample mới nhất 1 type
SELECT id, conversation_id, content_type, sent_at, content
FROM messages
WHERE content_type='call' AND is_deleted=false
ORDER BY sent_at DESC LIMIT 5;

# Decode 1 message cụ thể
SELECT content::text FROM messages WHERE id='<uuid>';

# Reaction của 1 message
SELECT emoji, reactor_source, reactor_name, created_at
FROM message_reactions WHERE message_id='<uuid>';
```

---

## 8. Phiên bản

- **v1.0** — 2026-05-21: tạo lần đầu, 34 mã sự kiện E01–E34 + 10 reaction R01–R10 + 8 timeline A01–A08 + 6 gap G1–G6
- Cập nhật khi: thêm loại mới (vd Zalo SDK upgrade), phát hiện gap mới, hoặc fix render bug
