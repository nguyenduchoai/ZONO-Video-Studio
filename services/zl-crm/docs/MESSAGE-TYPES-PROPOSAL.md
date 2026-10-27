# Đề xuất render UI cho tin nhắn — v1.0 (2026-05-21)

> File chị em với [MESSAGE-TYPES-REGISTRY.md](MESSAGE-TYPES-REGISTRY.md).
> Registry = mô tả CODE HIỆN TẠI. File này = ĐỀ XUẤT cách render mới + so sánh trước/sau.
>
> Anh tick **✅ Okie** hoặc **❌ Fix → ghi chú** ở cuối từng mục. Em sẽ implement đúng các mục anh chốt OK, skip các mục anh ghi chú khác.

---

## 1. Triết lý thiết kế

### 1.1 Cột 2 (conversation list) phải làm gì?

- Trong **1 dòng ngắn (≤50 ký tự)** trả lời 3 câu hỏi: **(a)** Loại tin gì? **(b)** Ai gửi? **(c)** Có gấp không?
- Outbound luôn có prefix **"Bạn: "** (giống Zalo gốc) — để sale phân biệt mình gửi vs KH gửi mà không phải đọc kỹ.
- Tin text luôn ưu tiên trích nội dung. Tin media/sự kiện hiện **icon + label tiếng Việt** thay vì content.
- Tin có trạng thái xấu (cuộc gọi nhỡ, tin recall) hiển thị **màu khác** (đỏ/xám) để bắt mắt khi quét list.

### 1.2 Cột 3 (chat thread) phải làm gì?

- Mỗi loại có **1 bubble dạng riêng** — sale liếc 0.5s biết ngay đây là cuộc gọi, ảnh, link, ...
- Tin inbound = bubble trắng bên trái có avatar nhỏ. Tin outbound = bubble xanh bên phải, không avatar.
- Reply card (quote) **luôn nằm trên cùng bubble**, nội dung tin trả lời ngay dưới.
- Reaction stack ở góc dưới phải bubble, click → bottom sheet xem ai react gì.
- Time + read receipt (✓ ✓✓) ở góc dưới bubble, font 11px xám.

### 1.3 Icon system — nguyên tắc 1 icon = 1 type (sticky)

| Nhóm                           | Icon                                                                                 | Dùng cho     |
| ------------------------------- | ------------------------------------------------------------------------------------ | ------------- |
| **Tin cơ bản**          | 💬 (text), ✨ (rich format), ↩️ (reply), 🚫 (recall)                               | E01–E05      |
| **Media**                 | 📷 image, 🖼️ album, 🎥 video, 📎 file, 🎤 voice, 🎴 sticker, 🎞 gif                | E06–E13      |
| **Cuộc gọi**            | 📞 voice, 📹 video — kèm trạng thái (xanh = ok, đỏ = nhỡ, xám = không bắt) | E14–E19      |
| **Liên kết / vị trí** | 🔗 link, 📍 location                                                                 | E20, E23, E24 |
| **Danh thiếp**           | 👤 profile, 👥 gợi ý bạn bè                                                      | E21, E22      |
| **Tiền / QR**            | 💳 chuyển khoản, 🔲 QR code                                                        | E25–E27      |
| **Tổ chức**             | ⏰ nhắc hẹn, 📊 bình chọn, 📝 ghi chú                                           | E28–E32, E33 |
| **Chuyển tiếp**         | ↪️ forwarded                                                                       | E34           |

### 1.4 Color vocabulary cho cuộc gọi (anh check kỹ — 6 variant)

| Trạng thái                          | Màu icon              | Màu text              |
| ------------------------------------- | ---------------------- | ---------------------- |
| Đã nghe (cả 2 phía)               | xanh #16a34a           | đen #1f2937           |
| Sale gọi đi không trả lời        | xám #6b7280           | xám #6b7280           |
| KH gọi đến nhỡ (sale không bắt) | **đỏ #dc2626** | **đỏ #dc2626** |

**Logic phân biệt** (lưu ý anh):

- `recommened.calltime` = đã nghe → có duration
- `recommened.misscall` + `isCaller=0` (KH gọi) = **KH gọi đến SALE KHÔNG BẮT** → đỏ ⚠️ (cần để sale alert)
- `recommened.misscall` + `isCaller=1` (sale gọi) = **SALE gọi KH không bắt** → xám (sale đã thấy rồi)
- `calltype=1` thay 📞 thành 📹 (video)

---

## 2. Mockup chuẩn

### 2.1 Cell cột 2 chuẩn

```
┌──────────────────────────────────────────────┐
│ [avatar]  Anh Tran                15:08 ✓✓  │
│           Bạn: 📞 Cuộc gọi · 2:35       💬  │
└──────────────────────────────────────────────┘
   ↑ avatar                          ↑ time/read     ↑ unread badge
   tròn 40px                         (sale gửi)      hoặc reaction count
```

Layout: 1 dòng tên + time, 1 dòng preview + badge. Preview tối đa 50 char.

### 2.2 Bubble cột 3 chuẩn

**Inbound (KH gửi):**

```
[av]  ┌──────────────────────────────┐
      │ ↩️ trả lời: tin trước của Bạn │
      │   "ok anh chốt căn B2-12A"   │
      │ ─────────────────────────────│
      │ Em chốt căn này, anh transfer│
      │ giúp em qua MB nhé           │
      │                              │
      │ 14:23                    ❤️ 2│
      └──────────────────────────────┘
```

**Outbound (sale gửi):**

```
              ┌──────────────────────────────┐
              │ Anh chuyển em số TK này:    │
              │ 0789xxx — MB Bank           │
              │                              │
              │ 14:25 ✓✓                    │
              └──────────────────────────────┘
                              (xanh #2563eb)
```

---

## 3. Fix 6 gap đã phát hiện

| Mã          | Gap hiện tại                                                                            | Đề xuất fix                                                                                                                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1** | 635 row `recommened.link` lưu thành `contact_card` → preview "👤 Danh thiếp" sai. | Bổ sung detect rule trong `detectContentType()`: nếu `action='recommened.link'` AND `href` not empty → trả về `link`. Migrate 635 row cũ qua 1 script SQL update content_type.                          |
| **G2** | 14 row bank fall vào `rich`.                                                           | Bổ sung detect rule:`action='zinstant.bankcard'` LUÔN trả `bank_transfer`, bất kể msgType. Backfill SQL 14 row.                                                                                              |
| **G3** | 8 type thiếu label cột 2 → hiện raw "call", "bank_transfer", "reminder", ...          | Bổ sung 8 entry vào `CONTENT_TYPE_LABEL` (xem section 4 từng mã).                                                                                                                                               |
| **G4** | Cột 2 chỉ có special branch cho `call`.                                              | Mở rộng switch trong `getPreviewText()` để có nhánh riêng cho `bank_transfer` (trích bank name), `reminder` (trích title), `poll` (trích action create/vote/...), `location` (trích địa chỉ). |
| **G5** | Album multi-image (3,614 row) chưa group thành gallery.                                 | Trong message thread, gom các message cùng `albumKey` thành 1 bubble chứa grid 2×N. Cột 2 preview hiện "🖼️ Bộ ảnh ({albumTotal})".                                                                       |
| **G6** | Voice chỉ 2 row — nghi SDK ingest sót.                                                 | Check log Zalo SDK: msgType nào bị fall vào `rich`/`text` mà có `params.voiceUrl` hoặc đuôi `.m4a/.aac` → promote thành `voice`. Cần investigate riêng.                                         |

---

## 4. Bảng BEFORE / AFTER chi tiết

### 4.1 Tin cơ bản

#### E01 — Tin text thường

**BEFORE**

- Cột 2: Trích text 60 char (đã OK)
- Cột 3: Plain text + escape HTML + @mention highlight

**AFTER**

- Cột 2: Y nguyên (đã đúng) — chỉ thêm prefix "Bạn: " cho outbound
- Cột 3: Y nguyên

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E02 — Tin RTF (text có format)

**BEFORE**

- Cột 2: Trích text raw (mất format bold/italic/color)
- Cột 3: Apply bold/italic/color/underline + mention

**AFTER**

- Cột 2: Trích **plain text** từ rich content + dấu hiệu "✨" prefix khi tin có format đặc biệt: `✨ Em chốt căn B2-12A...` (để sale biết click vào thấy format đẹp hơn raw)
- Cột 3: Y nguyên (đã đúng)

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E03 — Rich card không action (16 row)

**BEFORE**

- Cột 2: "rich" (raw string xấu)
- Cột 3: Generic card best-effort

**AFTER**

- Cột 2: Trích `title` hoặc `description` của card (tiết kiệm cho sale, không hiện chữ "rich")
- Cột 3: Y nguyên

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E04 — Tin đã thu hồi

**BEFORE**

- Cột 2: (preview của tin còn lại)
- Cột 3: Italic xám "tin nhắn (đã thu hồi)"

**AFTER**

- Cột 2: Nếu tin recall là tin cuối → hiện "🔂 Tin nhắn đã thu hồi" (xám italic). Inbound + outbound đều show — để sale biết KH vừa thu hồi gì đó (tránh sốc khi mở chat thấy mất tin).
- Cột 3: 🔂Thu hồi: Italic xám và dấu gạch ngang tại tin nhắn đã bị thu hồi

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → 🔂 Dùng icon này cho thu hồi. _____

---

#### E05 — Reply / Trả lời

**BEFORE**

- Cột 2: (preview của tin trả lời)
- Cột 3: Quote card trên + nội dung tin trả lời

**AFTER**

- Cột 2: "↩️ Trả lời: {trích nội dung tin trả lời 40 char}" — báo cho sale biết đây là reply, không phải tin mới đứng riêng
- Cột 3: Y nguyên

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

### 4.2 Media

#### E06 — Ảnh đơn

**BEFORE**

- Cột 2: "📷 Hình ảnh" (OK)
- Cột 3: `<img>` click → modal preview

**AFTER**

- Cột 2: Nếu có caption → "📷 {caption 40 char}". Không có caption → "📷 Hình ảnh"
- Cột 3: Y nguyên + bổ sung loading skeleton trong khi ảnh tải

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E07 — Album multi-image

**BEFORE**

- Cột 2: "📷 Hình ảnh" (giống ảnh đơn, không phân biệt)
- Cột 3: Render N ảnh riêng lẻ liên tục

**AFTER**

- Cột 2: "🖼️ Bộ ảnh (3)" — số trong ngoặc là `albumTotal`
- Cột 3: Grid 2×N hoặc 3×N tùy số ảnh. Click ảnh nào → modal lightbox với arrow next/prev qua các ảnh trong album.

```
   ┌───────┬───────┐
   │  ảnh1 │  ảnh2 │
   ├───────┼───────┤
   │  ảnh3 │  ảnh4 │
   └───────┴───────┘
```

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → Có nút Tiến Lùi hoặc bấm nút qua trái, qua phải. lên xuống để chuyển tiếp và lùi lại các ảnh. Tới đầu hoặc tới cuối là kết thúc chứ ko xem quay vòng tròn.

---

#### E08 — Video

**BEFORE**

- Cột 2: "🎥 Video" (OK)
- Cột 3: Thumbnail + play overlay

**AFTER**

- Cột 2: "🎥 Video ({duration})" — vd "🎥 Video (0:42)" — nếu lấy được duration. Không lấy được → "🎥 Video"
- Cột 3: Y nguyên

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix →  Video play tại thumbnail popup chứ ko mở tab mới. Fix cái này nhé

---

#### E09 — File / tài liệu

**BEFORE**

- Cột 2: "📎 File"
- Cột 3: File card icon + tên + size + download

**AFTER**

- Cột 2: "📎 {tên file rút gọn 30 char}.{ext}" — vd "📎 Bao gia GREEN....pdf". Sale liếc thấy tên file ngay không phải mở.
- Cột 3: Y nguyên + bổ sung **icon riêng theo extension**: 📄 doc/pdf, 📊 xlsx, 🎵 audio, 🎬 video file, 📦 zip, 📎 fallback.

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E10 — Voice / tin thoại

**BEFORE**

- Cột 2: "🎤 Voice"
- Cột 3: Play button + link "Nghe"

**AFTER**

- Cột 2: "🎤 Tin thoại (0:08)" — kèm duration
- Cột 3: Inline audio player có waveform giả + nút play/pause + thanh progress + duration. KHÔNG mở external link.

```
   ┌─────────────────────────┐
   │ ▶  ▁▂▅█▆▃▁▂▅█▃  0:08    │
   └─────────────────────────┘
```

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E11 — Audio (alias voice)

**BEFORE**

- Cột 2: "🎤 Voice" (cùng E10)
- Cột 3: Tương tự voice

**AFTER**

- Render giống hệt E10 — code path merge `voice` + `audio` chung renderer (chỉ khác type detection lúc ingest).

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E12 — Sticker

**BEFORE**

- Cột 2: "🎴 Sticker" (OK)
- Cột 3: CSS sprite animated hoặc static

**AFTER**

- Cột 2: Y nguyên
- Cột 3: Y nguyên + bổ sung **fallback** "Sticker không tải được" khi metadata API fail (không hiện nguyên ô trống)

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E13 — GIF

**BEFORE**

- Cột 2: "🎞️ GIF"
- Cột 3: `<img>` animated

**AFTER**

- Cột 2: Y nguyên
- Cột 3: Y nguyên + bổ sung tooltip "Click để play/pause" cho GIF lớn (tiết kiệm CPU laptop sale)

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

### 4.3 Cuộc gọi (6 variant — anh check kỹ)

#### E14 — Cuộc gọi đến đã nghe (KH gọi, sale bắt)

**BEFORE**

- Cột 2: "📞 Cuộc gọi (2:35)" (chung chung)
- Cột 3: Call card generic, không phân biệt direction

**AFTER**

- Cột 2: "📞 Cuộc gọi đến · 2:35" (đen)
- Cột 3:

```
   [av]  ┌──────────────────────────────┐
         │ ☎️  Cuộc gọi đến             │
         │     2 phút 35 giây           │
         │                              │
         │ 15:08                    ❤️ 1│
         └──────────────────────────────┘
```

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E15 — Cuộc gọi đi đã nghe (sale gọi, KH bắt)

**BEFORE**

- Cột 2: "📞 Cuộc gọi (2:35)"
- Cột 3: Generic

**AFTER**

- Cột 2: "Bạn: 📞 Cuộc gọi đi · 2:35" (đen)
- Cột 3:

```
              ┌──────────────────────────────┐
              │ 📞  Cuộc gọi đi              │
              │     2 phút 35 giây           │
              │                              │
              │ 15:08 ✓✓                    │
              └──────────────────────────────┘
```

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E16 — Cuộc gọi video đã nghe (cả 2 phía)

**BEFORE**

- Cột 2: "📞 Cuộc gọi (2:35)" (không phân biệt video)
- Cột 3: Generic

**AFTER**

- Cột 2 inbound: "📹 Gọi video đến · 2:35"
- Cột 2 outbound: "Bạn: 📹 Gọi video đi · 2:35"
- Cột 3: Cùng layout E14/15 nhưng đổi icon ☎️ → 📹

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E17 — Cuộc gọi đến nhỡ ⚠️ (KH gọi, sale KHÔNG BẮT)

> **Đây là trạng thái sale CẦN ALERT** — KH đã chủ động gọi, sale lỡ mất → có nguy cơ mất khách.

**BEFORE**

- Cột 2: "❌ Cuộc gọi nhỡ"
- Cột 3: Generic missed card

**AFTER**

- Cột 2: **"📞 Cuộc gọi nhỡ" — màu ĐỎ #dc2626 + bold**
- Cột 3:

```
   [av]  ┌──────────────────────────────┐
         │ 📞  Cuộc gọi nhỡ              │ ← icon + chữ đỏ
         │     KH đã gọi nhưng bạn      │
         │     chưa bắt máy             │
         │ ─────────────────────────────│
         │ 15:08            [Gọi lại →] │ ← nút action
         └──────────────────────────────┘
```

+ Có thể bổ sung **badge "⚠️ Chưa gọi lại"** ở cột 2 nếu sau X giờ chưa có tin/cuộc gọi từ sale.

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E18 — Cuộc gọi đi không trả lời (sale gọi, KH không bắt)

**BEFORE**

- Cột 2: "❌ Cuộc gọi không trả lời"
- Cột 3: Generic

**AFTER**

- Cột 2: "Bạn: 📞 KH không trả lời" — màu **xám #6b7280** (không alert, sale đã biết)
- Cột 3:

```
              ┌──────────────────────────────┐
              │ 📞  Đã gọi — không trả lời  │
              │     KH chưa bắt máy          │
              │ ─────────────────────────────│
              │ 15:08 ✓        [Gọi lại →]   │
              └──────────────────────────────┘
```

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E19 — Cuộc gọi video nhỡ (cả 2 chiều)

**BEFORE**

- Cột 2: "❌ Cuộc gọi nhỡ" (không phân biệt video)
- Cột 3: Generic

**AFTER**

- Cột 2 inbound: "📹 Video nhỡ" (đỏ) — quan trọng tương đương E17
- Cột 2 outbound: "Bạn: 📹 Video không trả lời" (xám)
- Cột 3: Cùng layout E17/18 đổi icon 📞 → 📹

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

### 4.4 Liên kết / Vị trí

#### E20 — Link có preview (Facebook / Maps / Youtube / ...) — **GAP G1 fix**

**BEFORE**

- Cột 2: "👤 Danh thiếp" ❌ SAI semantic — đây là chia sẻ link, không phải danh thiếp
- Cột 3: Generic card

**AFTER**

- Reclassify từ `contact_card` → `link` (logic backend)
- Cột 2: "🔗 {title link rút 35 char}" — vd "🔗 Fenica - Chiến lược an cư..."
- Cột 3:

```
   [av]  ┌──────────────────────────────┐
         │ [thumb] Fenica - Chiến lược  │
         │ 80×80   an cư đã kết nối    │
         │         facebook.com         │
         │                              │
         │ 15:08                        │
         └──────────────────────────────┘
```

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E21 — Danh thiếp profile thực sự (`show.profile`)

**BEFORE**

- Cột 2: "👤 Danh thiếp"
- Cột 3: Contact card

**AFTER**

- Cột 2: "👤 Danh thiếp: {tên}" — vd "👤 Danh thiếp: Anh Thư"
- Cột 3:

```
   ┌──────────────────────────────┐
   │ [av 64px]                    │
   │     Anh Thư                  │
   │     0901 xxx xxx             │
   │                              │
   │ [Lưu vào CRM] [Mở chat]      │ ← 2 action buttons
   └──────────────────────────────┘
```

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E22 — Gợi ý bạn bè (`recommened.user`)

**BEFORE**

- Cột 2: "👤 Danh thiếp" (lẫn với E21)
- Cột 3: Generic

**AFTER**

- Cột 2: "👥 Gợi ý bạn bè: {tên}"
- Cột 3: Layout giống E21 + chip "Gợi ý kết bạn" ở góc.

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E23 — Link auto-unfurl (Zalo chưa từng gửi)

**BEFORE**

- Cột 2: "🔗 Liên kết"
- Cột 3: Card 2-col thumb + meta

**AFTER**

- Render giống E20 (đã reclassify) — code path merge `link` + `contact_card.recommened.link`

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E24 — Vị trí pinned

**BEFORE**

- Cột 2: "📍 Vị trí"
- Cột 3: Google Maps iframe

**AFTER**

- Cột 2: "📍 {địa chỉ ngắn từ description, vd 'Tọa độ (13.97, 108.56)'}"
- Cột 3:

```
   ┌──────────────────────────────┐
   │  [Google Maps thumbnail]     │
   │       (chấm đỏ tâm)          │
   │  ─────────────────────────── │
   │  📍 Chung cư GREEN SKYLINE   │
   │  Q.Cầu Giấy, Hà Nội         │
   │  [Mở trên Google Maps →]    │
   └──────────────────────────────┘
```

Click thumbnail → mở Google Maps tab mới (không iframe full-size trong bubble — tốn perf).

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

### 4.5 Tiền / QR

#### E25 — Chuyển khoản (VietQR) — **GAP G2 + G3 fix**

**BEFORE**

- Cột 2: "bank_transfer" raw (xấu)
- Cột 3: Bank card hoặc fallback link

**AFTER**

- Cột 2 inbound: "💳 Chuyển khoản · {bank}" — vd "💳 Chuyển khoản · MB Bank"
- Cột 2 outbound: "Bạn: 💳 Chuyển khoản · {bank}"
- Cột 3:

```
   ┌────────────────────────────────────┐
   │ [logo MB]    MB BANK               │
   │ ─────────────────────────────────  │
   │ STK: 0789xxxxxxx                   │
   │ Tên: NGUYEN VAN A                  │
   │                                    │
   │ [QR ảnh 160×160]                   │
   │                                    │
   │ Số tiền: 50,000,000đ (nếu có)     │
   │ Nội dung: "GIU CAN B2-12A09"      │
   │                                    │
   │ [Copy STK] [Mở app NH] [Lưu QR]   │
   └────────────────────────────────────┘
```

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E26 — Bank misclassified vào `rich` — **GAP G2 backfill**

**BEFORE**

- Cột 2: trích text "rich" hoặc raw content
- Cột 3: Generic rich card (không phải bank card thật!)

**AFTER**

- Backend reclassify 14 row hiện có → `bank_transfer` (script SQL migrate)
- Render giống E25
- Bổ sung detect rule để tin mới về cũng vào đúng `bank_transfer`

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E27 — QR code (chưa có data thực)

**BEFORE**

- Cột 2: "qr_code" raw
- Cột 3: QR image clickable

**AFTER**

- Cột 2: "🔲 Mã QR"
- Cột 3:

```
   ┌──────────────────────────────┐
   │ 🔲 Mã QR                     │
   │                              │
   │ [QR ảnh 200×200 click able] │
   │                              │
   │ [Tải QR về máy] [Copy nội dung] │
   └──────────────────────────────┘
```

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

### 4.6 Nhắc hẹn

#### E28 — Reminder / system notice

**BEFORE**

- Cột 2: "reminder" raw
- Cột 3: Warning card ⏰ + title

**AFTER**

- Cột 2: "⏰ {trích title 35 char}" — vd "⏰ Anh Thư được mời tham gia nhóm..."
- Cột 3:

```
   ┌──────────────────────────────┐
   │ ⏰ Nhắc hẹn / Thông báo      │ ← header chip vàng tonal
   │ ─────────────────────────────│
   │ Anh Thư được Văn Vỹ Hs       │
   │ Holding mời tham gia nhóm    │
   │ và cần bạn phê duyệt         │
   │                              │
   │ 15:08                        │
   └──────────────────────────────┘
```

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

### 4.7 Bình chọn — 4 action

#### E29 — Tạo poll

**BEFORE**

- Cột 2: "poll"
- Cột 3: Poll card

**AFTER**

- Cột 2: "📊 Tạo bình chọn: {title 30 char}"
- Cột 3:

```
   ┌──────────────────────────────┐
   │ 📊 Bình chọn                 │
   │ "Anh chị thích căn hướng nào?"│
   │ ─────────────────────────────│
   │ ◯ Hướng Đông Nam           5 │
   │ ◯ Hướng Tây Bắc            2 │
   │ ◯ Hướng Đông               1 │
   │ ─────────────────────────────│
   │ 8 phiếu · Đa lựa chọn       │
   │ [Bỏ phiếu →]                │
   └──────────────────────────────┘
```

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E30 — Bỏ phiếu (vote)

**BEFORE**

- Cột 2: "poll"
- Cột 3: Same card

**AFTER**

- Cột 2 inbound: "📊 Đã bình chọn: {option ngắn}"
- Cột 2 outbound: "Bạn: 📊 Đã bình chọn"
- Cột 3: Cùng card E29 + highlight option vừa được vote (chip màu xanh)

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E31 — Cập nhật poll

**BEFORE**

- Cột 2: "poll"
- Cột 3: Same card

**AFTER**

- Cột 2: "📊 Cập nhật bình chọn"
- Cột 3: Card E29 + chip "Đã cập nhật {timestamp}"

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E32 — Đóng poll

**BEFORE**

- Cột 2: "poll"
- Cột 3: Same card

**AFTER**

- Cột 2: "📊 Đã đóng bình chọn"
- Cột 3: Card E29 + badge **"ĐÃ ĐÓNG"** (xám) + disable vote button

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

### 4.8 Ghi chú / Chuyển tiếp (chưa có data thực)

#### E33 — Note / Ghi chú

**BEFORE**

- Cột 2: "note"
- Cột 3: Orange card body

**AFTER**

- Cột 2: "📝 Ghi chú: {trích title 30 char}"
- Cột 3:

```
   ┌──────────────────────────────┐
   │ 📝 Ghi chú                   │ ← header chip cam
   │ ─────────────────────────────│
   │ "Báo giá tháng 5/2026"       │ ← title bold
   │                              │
   │ {body của note với format    │
   │ giữ nguyên bold/italic/màu}  │
   │                              │
   │ 15:08                        │
   └──────────────────────────────┘
```

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

#### E34 — Forwarded / Chuyển tiếp

**BEFORE**

- Cột 2: "forwarded"
- Cột 3: Left-border card

**AFTER**

- Cột 2: "↪️ Chuyển tiếp: {trích 35 char}"
- Cột 3:

```
   ┌──────────────────────────────┐
   │ ↪️ Đã chuyển tiếp           │ ← header chip tím nhạt
   │ ─────────────────────────────│
   │ {nội dung tin gốc}           │
   │                              │
   │ 15:08                        │
   └──────────────────────────────┘
```

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

## 5. Reactions (R01–R10)

**BEFORE**

- Render: 1 cluster nhỏ ở góc dưới phải bubble, hiện emoji + count nếu >1
- Click → bottom sheet xem ai react

**AFTER (bổ sung)**

- Hover (desktop) → tooltip "❤️ KH Anh Tran"
- Click vào emoji của mình → bỏ react luôn (không cần mở picker)
- Cluster max 3 emoji distinct + "+N" nếu nhiều hơn
- Mỗi emoji có **tooltip màu emoji** (❤️ đỏ, 😆 vàng, 👍 xanh) — sale liếc thấy emoji "đắt" (❤️) ngay

| Mã      | Emoji | Hành vi nhanh                               |
| -------- | ----- | -------------------------------------------- |
| R01 ❤️ | Heart | Tin "trúng" — sale flag để follow up     |
| R02 😆   | Haha  | Tin vui — sale có thể đẩy thêm joke    |
| R03 👍   | Like  | Tin được duyệt — sale move tiếp        |
| R04 😮   | Wow   | Tin gây ngạc nhiên                        |
| R05 😭   | Sad   | Tin tiêu cực — sale check tâm trạng KH  |
| R06 😡   | Angry | Tin gây tức — sale cần xử lý ngay ⚠️ |

**Anh chốt:** [ ] ✅ Okie  [ ] ❌ Fix → _____

---

## 6. Sign-off tổng

Anh review xong, đánh dấu **✅ Okie tất cả** ở dưới, hoặc liệt kê các mã cần fix kèm ghi chú.

```
[ ] ✅ Okie TẤT CẢ — em ship theo proposal trên

HOẶC

[ ] ❌ Fix các mã sau:
    - E___ : ghi chú: _____________________
    - E___ : ghi chú: _____________________
    - G___ : ghi chú: _____________________
    - R___ : ghi chú: _____________________
```

---

## 7. Lộ trình implement (sau khi anh chốt)

1. **Backend** — fix detect rule (G1, G2) + migrate 635+14 row cũ qua SQL script.
2. **Frontend cột 2** — bổ sung 8 entry vào `CONTENT_TYPE_LABEL` + thêm switch case riêng cho bank/qr/reminder/poll/location (G3, G4).
3. **Frontend cột 3** — refactor `special-message-renderer.vue` để cover full layout per type (E21 contact card real, E25 bank card, E27 QR, E28-32 reminder/poll polish, E33-34 note/forwarded).
4. **Album grouping (G5)** — gom messages cùng `album_key` trong `MessageThread.vue` thành 1 grid bubble.
5. **Voice ingest audit (G6)** — investigate riêng, không block các bước trên.

Anh OK em ship phần nào trước, em làm phần đó. Khuyến nghị thứ tự: **G1 + G3 (cột 2 label đẹp)** → **E14–E19 (cuộc gọi UI)** → **E25 + G2 (bank card)** → còn lại.

---

## 8. Phiên bản

- **v1.0** — 2026-05-21: Đề xuất ban đầu sau audit registry.
- Update khi anh chốt sign-off section 6, hoặc thay đổi mockup theo feedback.
