# Plan sync mới — diễn giải dễ hiểu

## 🎯 Tình hình hiện tại (vấn đề)

Anh có 2 trang trong CRM:

* **Trang "Khách hàng"** — danh sách KH, bấm ▸ thấy "nick nào đang chăm KH này"
* **Trang "Bạn bè Zalo"** — danh sách bạn bè của 1 nick CRM

Thực ra 2 trang này **đọc chung 1 cuốn sổ** trong database (bảng `friends`). Nhưng:

### Vấn đề 1: Mỗi trang đọc sổ theo 1 cách khác nhau

Như 2 nhân viên đọc cùng cuốn sổ nhưng:

* Nhân viên A chỉ ghi ra 10 cột
* Nhân viên B chỉ ghi ra 12 cột

Khi thêm cột mới phải nhớ sửa cả 2 chỗ. Nếu quên → 2 trang hiển thị data **khác nhau** dù cùng KH.

### Vấn đề 2: Sổ ít khi được cập nhật từ Zalo thật

Hiện tại để CRM biết KH đổi tên trên Zalo (ví dụ KH đổi avatar, đổi tên gợi nhớ), anh phải:

* Vào trang "Bạn bè Zalo"
* Bấm nút "↻ Đồng bộ Zalo"
* Đợi nó pull về

→ Mệt + dễ quên + nhiều nhân viên không biết bấm

### Vấn đề 3: Có 5 "đường ống" sync, mỗi đường làm 1 việc khác

| Đường ống | Chạy khi nào                             | Lấy gì                                     |
| ------------- | ------------------------------------------ | -------------------------------------------- |
| 1             | Có event từ Zalo (ai đó accept friend) | Chỉ trạng thái kết bạn                  |
| 2             | Có tin nhắn đến                        | Tự tạo Friend row + cập nhật tên/avatar |
| 3             | User bấm nút "Đồng bộ"                | Full pull danh sách bạn bè                |
| 4             | Khi nick kết nối + bấm nút             | Labels + tên gợi nhớ                      |
| 5             | Sau khi CRM gửi friend request            | Đánh dấu "đang chờ"                     |

→ Có **2 chỗ chết** (dead code) ghi cùng 1 event 2 lần, gây loạn log.
→ Đổi tên trên Zalo thật: KHÔNG có đường ống nào tự bắt được.

---

## 💡 Giải pháp (Approach B)

Tưởng tượng anh thuê thêm **1 nhân viên** tên là `friend-sync-service`, làm những việc sau:

### 1. Mỗi 15 phút, nhân viên này tự đi:

* Mở từng nick Zalo đang online
* Hỏi Zalo: "Cho tôi xem hết bạn bè của nick này"
* So sánh từng bạn với sổ CRM
* **Chỉ ghi lại những gì đã đổi** (ví dụ KH đổi avatar → ghi avatar mới)
* **Chỉ báo cho màn hình** khi thật sự có thay đổi (tiết kiệm, không spam tín hiệu)

### 2. Đồng thời có 1 "loa truyền tin" socket:

Khi có 1 Friend đổi:

* Backend bật loa: "Friend này vừa đổi field X = giá trị Y"
* Trang "Khách hàng" + trang "Bạn bè Zalo" đều nghe loa → tự cập nhật ô đó **không cần reload**

→ User đang xem mà KH bên kia đổi tên → 1-2 giây sau ô tên đổi luôn trên màn hình.

### 3. Cuốn sổ chung

Tạo 1 file `friend-serializer.ts` ghi rõ "khi đọc bảng friends thì luôn lấy đủ N cột này". Cả trang Khách hàng và trang Bạn bè đều dùng chung file này. **Không còn drift nữa.**

### 4. Nút "Đồng bộ Zalo" vẫn giữ

* Đổi tên thành "↻ Làm mới ngay"
* Khi user bấm: ép sync ngay lập tức (không đợi 15 phút)
* Có "khoá 5 giây": bấm liên tục 5 phát thì chỉ 1 phát chạy, 4 phát kia bị từ chối (chống spam)

### 5. "Tất cả nick" mode

Trang Bạn bè hiện chỉ xem được 1 nick mỗi lần. Sửa để xem được **tất cả nick** mà user có quyền — như xem 1 bảng tổng.

---

## 🗂️ Cụ thể: tạo những gì, sửa những gì

### 4 file MỚI

| Tên file                           | Vai trò                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `friend-serializer.ts`            | **Cuốn sổ chung** — định nghĩa "đọc Friend lấy những cột nào" |
| `friend-sync-service.ts`          | **Nhân viên sync** — biết cách lấy từ Zalo SDK rồi ghi vào DB    |
| `friend-sync-cron.ts`             | **Cái đồng hồ báo thức** — cứ 15 phút gọi nhân viên sync      |
| `use-friend-socket.ts` (frontend) | **Cái radio** — ngồi nghe loa socket để cập nhật màn hình        |

### 9 file SỬA (chỉnh chỗ nhỏ)

* `friend-routes.ts` — đổi sang dùng cuốn sổ chung + thêm route "Tất cả nick"
* `zalo-listener-factory.ts` — **xoá 7 dòng code chết** (dòng 418-424) + thêm bật loa khi có event
* `zalo-pool.ts` — khi nick mới kết nối → tự gọi nhân viên sync lần đầu
* `contact-aggregate.ts` — khi tin nhắn đến gây đổi Friend → bật loa
* `contact-aggregate-display.ts` — đổi sang đọc cuốn sổ chung
* `app.ts` — bật đồng hồ báo thức 15 phút lúc khởi động
* `FriendsView.vue` — gắn radio nghe loa + đổi label nút + xử lý "Tất cả nick"
* `ContactsView.vue` — gắn radio nghe loa, tự refresh child row khi có patch
* (file thứ 9 nhỏ, cùng nhóm trên)

 **Tổng** : 4 mới + 9 sửa = 13 file. Vừa tầm, không phá đại tu.

---

## ⚙️ Cách chạy 15 phút (cron) — diễn giải kỹ

Câu hỏi anh có thể thắc mắc: "Mỗi 15 phút quét hết 50 nick thì có nặng không?"

Em chọn **kiểu xếp hàng** (sequential):

```
00:00 → nick 1 sync (~5s) → nghỉ 200ms → nick 2 sync (~5s) → nghỉ 200ms → ...
        → nick 50 xong khoảng 00:04
00:15 → lặp lại
```

* 50 nick × 5 giây + 50 × 200ms = ~4 phút mỗi chu kỳ
* Vừa với khung 15 phút, còn dư 11 phút nghỉ
* **Không** đẻ 50 nhân viên cùng lúc (sợ Zalo cấm rate-limit) → 1 nhân viên làm tuần tự, an toàn

Lý do  **chỉ emit khi có thay đổi** : 50 nick × 500 bạn = 25,000 bạn cần check. Nhưng đa số phiên cron sẽ thấy **0 thay đổi** (KH ít đổi tên/avatar mỗi 15 phút). → Cron chạy âm thầm, không spam loa.

---

## 🧪 Test (kiểm thử)

Backend dùng **Vitest** (đã có sẵn). Em viết 36 ca test trong 5 file test:

* Test nhân viên sync chạy đúng trong các tình huống lỗi
* Test cron không bị overlap chu kỳ
* Test cuốn sổ chung không bể format cũ (regression)
* Test "Tất cả nick" lọc đúng theo quyền user
* Test khi tin nhắn đến → bật loa đúng

Frontend chưa có test framework → **defer** (để dành làm sau). Manual test list em ghi trong plan.

---

## ⏱️ Tốn bao lâu

* **Người làm tay** : 3-5 ngày
* **Claude Code làm** : ~60-90 phút thật (vì AI viết nhanh)
* Chia 3 lanes làm song song (worktree) → có thể giảm còn ~2 ngày người

---

## 🚫 Những thứ KHÔNG làm trong PR này (defer)

| Việc                                  | Lý do defer                                                  |
| -------------------------------------- | ------------------------------------------------------------- |
| Outbox pattern (kiến trúc to)        | Quá thừa cho quy mô hiện tại                             |
| Track từng field "đã sync khi nào" | Đợi xem cron 15 phút có hợp lý không rồi tối ưu sau |
| Tự động dồn KH "Unknown"           | Đã có UI "💡 Gợi ý KH Cha" — dùng cái có             |
| Frontend Vitest setup                  | Để dành 1 PR riêng                                        |
| Sync nhóm chat                        | Scope chỉ 1-1, nhóm để riêng                             |
| Webhook ra ngoài tổ chức            | Hiện chỉ trong nội bộ, đủ rồi                          |

---

## 📝 1 TODO ghi lại cho sau

**"Per-field syncedAt + adaptive cron"** — sau khi chạy 1 thời gian, nếu thấy cron 15 phút đa số là vô ích (0 thay đổi), thì tối ưu: chỉ refresh field nào đã cũ. Phải có dashboard monitoring trước mới làm được.

---

## 🎁 Kết quả user cuối thấy gì?

**Trước:**

> Sale mở CRM, thấy KH tên "Anh Tuấn", trong khi KH đã đổi avatar trên Zalo 1 tuần trước. Sale không biết. Phải bấm nút "Đồng bộ Zalo" → đợi 30s → mới thấy.

**Sau:**

> Sale mở CRM, mọi thông tin Zalo (tên, avatar, alias) tự cập nhật **trễ tối đa 15 phút** so với Zalo thật. Không cần bấm nút. Khi đồng nghiệp đổi status KH ở tab khác → tab mình thấy đổi ngay trong **1-2 giây** qua loa socket.

**Trang "Khách hàng" và "Bạn bè Zalo"** giờ đảm bảo show **cùng data** vì đọc chung 1 cuốn sổ — không drift, không lệch.

---

Anh muốn em làm gì tiếp?

* (A) Implement luôn theo plan này
* (B) Sửa thêm 1-2 phần của plan trước khi implement
* (C) Hỏi /codex để có second opinion về kiến trúc trước khi code

Vậy những trường hiện tại liên quan tới Trạng thái KH CRM, Score, Nick Chăm, KH nhắn cuối, Sale nhắn cuối, thời gian nhắn , đếm số tin in và tin out , tags crm, tag zalo,... các trường mở rộng như tỉnh, quận, nguồn, sinh nhật, ... các trường hệ thống global id, username ,... hoạt động, ghi chú, lịch hẹn, time linekh,
sẽ lưu ở đâu quản lý như thế nào? 2 tab friend và contact dùng các tham số này ra sao, mô tả dễ hiểu gióng vừa rồi nhé

Em mô tả lại bằng "2 cuốn sổ + mấy cuốn sổ phụ" cho dễ hình dung. Ví dụ: tưởng tượng anh đang quản lý 1 phòng sale truyền thống thời chưa có CRM.

---

# 📚 2 cuốn sổ chính + sổ phụ

## Cuốn 1: HỒ SƠ KH (bảng `contacts` — "KH Cha")

 **Như hồ sơ kế toán** : 1 trang = 1 con người. Lưu những thứ  **thuộc về người đó** , không liên quan nick nào đang chăm.

## Cuốn 2: PHIẾU CHĂM SÓC (bảng `friends` — "KH Con")

 **Như tập phiếu chăm sóc** : 1 phiếu = 1 cặp  **(nick CRM × Zalo identity)** .

* 1 KH có nhiều nick chăm → nhiều phiếu
* 1 KH có 2 Zalo identity (đổi nick) → cũng nhiều phiếu

> **Quan trọng** : Cùng 1 KH, mỗi nick CRM nhìn từ 1 góc khác nhau. Tên gợi nhớ "Anh Tuấn VIP" mà nick A đặt thì nick B không thấy. Vì thế cần phiếu RIÊNG cho từng cặp.

---

# 🗂️ Field anh hỏi nằm ở đâu?

## Nhóm 1: TRẠNG THÁI & SCORE — "Cả 2 sổ đều có, ý nghĩa khác nhau"

| Field                                                                         | Hồ sơ KH (Contact)                                                           | Phiếu chăm (Friend)               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------- |
| **Trạng thái KH CRM**                                                 | `statusId` (legacy + tổng hợp hiển thị)                                  | `statusId` mỗi phiếu (per-pair) |
| **Lead Score (điểm tiềm năng)**                                     | `leadScore` aggregate = MAX của các phiếu                                 | `leadScore` riêng từng phiếu   |
| **Score breakdown** (4 chiều: gắn kết/ý định/phù hợp/tốc độ) | `aggregateBreakdown` (copy từ phiếu cao nhất)                             | `scoreBreakdown` chi tiết        |
| **Đình trệ (stuck)**                                                 | `stuckSinceAggregate` = chỉ stuck khi **TẤT CẢ** phiếu đều stuck | `stuckSince` per-pair             |

**Vì sao 2 nơi?** Vì cùng 1 KH có thể "nóng" với nick A (score 85) nhưng "nguội" với nick B (score 20). Phiếu chăm phản ánh thực tế. Hồ sơ KH lấy MAX để manager thấy "KH này có tiềm năng" (qua đường nào đó).

### 2 tab dùng ra sao:

 **Tab Khách hàng** :

* Cột "Trạng thái" hiện trạng thái **cao nhất** trong các phiếu (theo `order`)
* Cột "Score" hiện score **trung bình** các phiếu (theo `computeAggregateDisplay`)
* →  **Góc nhìn manager** : thấy "KH này hot không"

 **Tab Bạn bè Zalo** :

* Hiện trạng thái + score **của riêng phiếu nick đang lọc**
* →  **Góc nhìn sale** : "Tôi (nick này) đang ở đâu với KH này"

---

## Nhóm 2: TIN NHẮN & THỜI GIAN — "Phiếu lưu chi tiết, Hồ sơ tổng hợp"

| Field                                                | Hồ sơ KH (Contact)                                                                                       | Phiếu chăm (Friend)                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **KH nhắn cuối lúc nào**                   | `lastInboundAt` (qua nick nào cũng tính)                                                              | `lastInboundAt` riêng từng phiếu |
| **Sale nhắn cuối lúc nào**                 | `lastOutboundAt` + ai nhắn (`lastOutboundByUserId`) + qua nick nào (`lastOutboundByZaloAccountId`) | `lastOutboundAt` riêng             |
| **Nội dung tin cuối**                        | `lastInboundPreview`, `lastOutboundPreview` (200 ký tự)                                              | Không lưu preview, chỉ ngày giờ  |
| **Tương tác cuối** (reaction, recall, ...) | `lastInteractionAt` + `lastInteractionType` + `lastInteractionPayload`                               | `lastInteractionAt`                 |
| **Đếm tin in**                               | `totalInbound` tổng qua mọi nick                                                                       | `totalInbound` riêng nick này     |
| **Đếm tin out**                              | `totalOutbound` tổng                                                                                    | `totalOutbound` riêng              |
| **First message**                              | (suy từ phiếu cũ nhất)                                                                                 | `firstMessageAt` per-pair           |

 **Ví dụ thực tế** : KH có 3 nick chăm. Tổng KH gửi 50 tin (qua 3 nick: 30+15+5).

* Hồ sơ KH: `totalInbound = 50`
* Phiếu nick A: `totalInbound = 30`
* Phiếu nick B: `totalInbound = 15`
* Phiếu nick C: `totalInbound = 5`

Sale nhìn phiếu của mình → biết riêng mình tương tác bao nhiêu. Manager nhìn hồ sơ → biết tổng độ active.

### 2 tab dùng ra sao:

 **Tab Khách hàng** :

* Cột "Tin cuối từ KH" → đọc `Contact.lastInboundAt + Preview`
* Cột "Tin sale cuối" → đọc `Contact.lastOutboundAt + Preview + by user/nick`
* Cột "Tổng tin (in/out)" → `Contact.totalInbound/Outbound`

 **Tab Bạn bè Zalo** :

* Cột "Tương tác cuối" → đọc `Friend.lastInboundAt` của phiếu hiện tại
* Cột "Tin in/out của nick" → `Friend.totalInbound/Outbound`
* → Sale biết "cá nhân tôi" tương tác bao nhiêu, KHÔNG bị inflate bởi nick khác

---

## Nhóm 3: NICK CHĂM — "Suy ra từ tập phiếu"

 **Lưu ở đâu** : Không có cột riêng. Là **kết quả tính ra** từ tập Friend của KH.

| Cách hỏi                     | Cách tính                                          |
| ------------------------------ | ---------------------------------------------------- |
| "KH này có mấy nick chăm?" | Đếm số phiếu Friend của KH đó                 |
| "Nick nào đã KB?"           | Lọc phiếu `relationshipKind='friend'`            |
| "Nick nào đang chat lạ?"    | Lọc phiếu `relationshipKind='chatting_stranger'` |
| "Nick nào đang chờ KB?"     | Lọc phiếu `relationshipKind='pending_friend'`    |
| "Bao nhiêu nick đã KB?"     | `Contact.acceptedNicksCount` (cache đếm sẵn)    |

**Có 3 counter cache** trong Hồ sơ KH (để query nhanh, không phải đếm mỗi lần):

* `acceptedNicksCount` — số nick đã KB
* `pendingNicksCount` — số nick đang chờ
* `chattingNicksCount` — số nick đang chat lạ

→ Cập nhật tự động qua hàm `counterDelta()` mỗi khi 1 phiếu đổi `relationshipKind`.

### 2 tab dùng ra sao:

 **Tab Khách hàng** :

* Cột "Đa nick" hiện badge `🔵 3 nick` nếu `acceptedNicksCount + chattingNicksCount > 1`
* Bấm ▸ expand → thấy danh sách phiếu (mỗi phiếu 1 dòng kèm avatar nick)

 **Tab Bạn bè Zalo** :

* Cả tab này = danh sách phiếu của 1 nick (filter `zaloAccountId`)
* → Tab này CHÍNH LÀ "góc nhìn 1 nick" của data Friend

---

## Nhóm 4: TAG — "2 loại, 3 vị trí lưu"

| Loại tag                              | Lưu ở đâu                                                                       | Ai gắn                     | Ý nghĩa                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- |
| **Tag CRM cấp KH**              | `Contact.tags` (JSON array)                                                       | Sale gắn từ tab KH        | Áp dụng cho KH chung. VD: "vip", "quan_tam_3pn"    |
| **Tag CRM per-nick**             | `Friend.crmTagsPerNick` (JSON array)                                              | Sale gắn từ chat panel    | Riêng cặp nick×KH. VD: "ưu tiên với nick này" |
| **Auto tag** (system)            | `Friend.autoTags` per-phiếu + `Contact.autoTags` UNION                         | Hệ thống tự gắn         | active/stuck/cold/ready/atrisk...                    |
| **Tag Zalo** (label Zalo native) | `Friend.zaloLabels` (JSON array per-phiếu) + bảng `ZaloLabel` (định nghĩa) | Sale gắn trên Zalo native | Label màu của Zalo                                 |

**Vì sao tag CRM có 2 cấp?** Anh ghi memory rồi: cùng KH, nick A muốn gắn "ưu tiên" mà nick B không cần. Nên cần per-pair tag. Còn "vip" là thuộc tính KH, ai cũng thấy → cấp Contact.

### 2 tab dùng ra sao:

 **Tab Khách hàng** :

* Cột "Tag" → `Contact.tags` (cấp KH chung)
* Filter "tag" lọc cả 3 nguồn: `Contact.tags` + `Friend.crmTagsPerNick` + `Friend.zaloLabels` (theo code chat-list anh đã làm)

 **Tab Bạn bè Zalo** :

* Cột "Tag CRM" → `Friend.crmTagsPerNick` của phiếu
* Cột "Label Zalo" → `Friend.zaloLabels` (đọc từ Zalo native qua sync)

---

## Nhóm 5: THÔNG TIN MỞ RỘNG — "Chỉ ở Hồ sơ KH"

Vì những field này thuộc  **con người** , không liên quan đến nick CRM nào. Tất cả ở Contact:

| Loại                      | Field trong `contacts`                                                           |
| -------------------------- | ---------------------------------------------------------------------------------- |
| **Liên hệ**        | `phone`, `phoneNormalized`, `phone2`, `phone3`, `phonesExtra`, `email` |
| **Nguồn**           | `source` (FB/TT/GT/CN/phone_import), `sourceDate`, `firstContactDate`        |
| **Địa chỉ**       | `province`, `district`, `ward`, `addressLine`                              |
| **Nhân khẩu học** | `gender`, `birthYear`, `birthDate`, `occupation`, `incomeRange`          |
| **Mạng xã hội**   | `socialFacebook`, `socialTiktok`                                               |
| **Ngôn ngữ**       | `preferredLang`                                                                  |
| **Compliance**       | `consentStatus`, `consentRevokedAt`, `consentSource`                         |
| **Sale phụ trách** | `assignedUserId` (1 KH = 1 sale chính)                                          |

### 2 tab dùng ra sao:

 **Tab Khách hàng** :

* Hiển thị trực tiếp, edit được trong dialog "Thêm/Sửa KH"
* Filter: `source`, `assignedUser`, `province/district`, `hasZalo`

 **Tab Bạn bè Zalo** :

* KHÔNG show các field này (vì là tab "góc nhìn nick", không phải tab "hồ sơ KH")
* Nhưng search box ở Bạn bè vẫn lọc theo `Contact.phone`, `Contact.fullName` qua relation
* Bấm ↗ "KH" trên phiếu → mở Tab Khách hàng cho KH đó

---

## Nhóm 6: ZALO IDENTITY — "Hồ sơ snapshot, Phiếu là chính"

| Field                                                      | Hồ sơ KH (Contact)                              | Phiếu chăm (Friend)                        |
| ---------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| **Zalo UID** (mã định danh per-nick)              | `zaloUid` (legacy, snapshot 1 nick)             | `zaloUidInNick` (chính xác từng phiếu) |
| **Zalo Global ID** (mã chung mọi nick nhìn cùng) | `zaloGlobalId` (snapshot/aggregate)             | `zaloGlobalId` per-phiếu                  |
| **Zalo Username** (handle @abc)                      | `zaloUsername` (snapshot)                       | `zaloUsername` per-phiếu                  |
| **Tên Zalo display**                                | (không có, chỉ có `fullName` CRM)           | `zaloDisplayName` per-phiếu               |
| **Avatar Zalo**                                      | `avatarUrl` (snapshot từ phiếu hoặc CRM set) | `zaloAvatarUrl` per-phiếu                 |
| **Tên gợi nhớ (alias)**                           | (không có)                                      | `aliasInNick` per-phiếu                   |
| **Có Zalo?**                                        | `hasZalo` (bool: true/false/null)               | (suy từ tồn tại phiếu)                   |

**Vì sao lưu cả 2?** Memory anh ghi: per-account UID khác nhau cho cùng person → không thể có "globalId" cấp Contact đáng tin → phải lưu từng phiếu. Contact chỉ giữ snapshot để query nhanh + legacy data.

`computeAggregateDisplay()` sẽ tính khi hiển thị: nếu tất cả phiếu trùng `zaloGlobalId` → Contact hiện chung, khác → hiện "đa N identity".

### 2 tab dùng ra sao:

 **Tab Khách hàng** :

* Cột "Zalo UID/GlobalId/Username (Cha)" → hiện snapshot Contact hoặc "đa N"
* Cột "Zalo UID/GlobalId/Username (Con)" — chỉ thấy khi bấm ▸ expand → phiếu chi tiết
* (Mở/tắt cột qua menu ⚙ Cột)

 **Tab Bạn bè Zalo** :

* Mỗi phiếu hiện đầy đủ `zaloUidInNick`, `aliasInNick`, `zaloDisplayName`, `zaloAvatarUrl` của riêng nó

---

## Nhóm 7: HOẠT ĐỘNG / GHI CHÚ / LỊCH HẸN — "Ở SỔ PHỤ"

Đây không phải ở Contact hay Friend, mà ở các  **bảng phụ riêng** , link qua FK:

### Sổ phụ A: `ActivityLog` (hoạt động / timeline)

* Mỗi dòng = 1 sự kiện (KH gửi tin đầu, sale gắn tag, alias đổi, score recompute, friend_event, ...)
* Có `entityType + entityId` → filter theo `contactId`
* `systemSource` phân biệt user vs hệ thống
* `details` JSON chứa payload tự do

### Sổ phụ B: `Note` (ghi chú)

* 1 KH có nhiều note
* FK `contactId`
* Có `content`, `createdAt`, `createdByUserId`
* Bonus: `Contact.notes` (1 string ngắn) — note nhanh không cần bảng riêng

### Sổ phụ C: `Appointment` (lịch hẹn)

* 1 KH có nhiều lịch hẹn
* FK `contactId`
* Có `scheduledAt`, `status` (scheduled/done/overdue/cancelled), `subject`, `location`
* Bonus: `Contact.nextAppointment` (cache lịch sắp tới gần nhất) + `Contact.totalAppointments` đếm

### Sổ phụ D: `Conversation` + `Message` (chat)

* `Conversation` link tới Contact + ZaloAccount + Friend (qua externalThreadId = zaloUidInNick)
* `Message` thuộc Conversation
* → Là nguồn data thật cho mọi field `lastInbound*`, `lastOutbound*`, `totalInbound`, `totalOutbound` ở Contact và Friend

### 2 tab dùng ra sao:

 **Tab Khách hàng** :

* Bấm vào tên KH → mở `ContactProfileView` → có tabs  **Hoạt động** ,  **Ghi chú** ,  **Lịch hẹn** , **Hội thoại** — đọc các sổ phụ qua FK
* Cột "Lịch sắp tới" trong list → `Contact.nextAppointment` (cache)
* Cột "Đếm cuộc hẹn" → `Contact.totalAppointments` (cache)

 **Tab Bạn bè Zalo** :

* KHÔNG có tab này (vì là tab nick view)
* Bấm ↗ "KH" → chuyển sang ContactProfileView để xem sổ phụ

---

# 🧭 Tóm tắt "field này ở đâu?"

Bảng cheat-sheet quick lookup:

| Anh hỏi về...                     | Lưu trong...                                                          | Ai tự cập nhật                                                             |
| ----------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Tên KH (fullName)                  | `Contact`                                                            | User sửa tay                                                                 |
| Tên Zalo của KH (zaloDisplayName) | `Friend`                                                             | Tự sync khi tin nhắn đến + cron 15min (plan mới)                         |
| Alias / Tên gợi nhớ              | `Friend.aliasInNick`                                                 | Sync từ Zalo SDK (alias-sync.ts)                                             |
| SĐT                                | `Contact.phone + phoneNormalized`                                    | User sửa tay / import                                                        |
| Trạng thái KH                     | `Friend.statusId` (per-pair) + tính ra `displayStatus` ở Contact | Sale sửa từ chat panel                                                      |
| Score                               | `Friend.leadScore` (per-pair) + `Contact.leadScore` MAX            | Hệ thống tự tính (Lead Scoring Engine)                                    |
| Nick nào chăm                     | Tập `Friend` rows của KH                                           | Tự khi có message / friend_event                                            |
| Tin cuối, đếm tin                | `Friend` per-pair + `Contact` aggregate                            | Tự khi message arrives (`applyContactAggregate`, `applyFriendAggregate`) |
| Tag CRM                             | `Contact.tags` (chung) + `Friend.crmTagsPerNick` (per-pair)        | Sale gắn                                                                     |
| Auto tag                            | `Friend.autoTags` + `Contact.autoTags` UNION                       | Hệ thống (auto-tagger.ts)                                                   |
| Label Zalo                          | `Friend.zaloLabels`                                                  | Sync từ Zalo (labels-routes)                                                 |
| Tỉnh/quận/sinh nhật/nguồn       | `Contact`                                                            | User sửa tay                                                                 |
| Global ID, Username                 | `Friend` (per-pair) + `Contact` snapshot                           | Tự sync khi có data từ Zalo                                                |
| Có Zalo?                           | `Contact.hasZalo`                                                    | Sau khi lookup-by-phone                                                       |
| Hoạt động (activity log)         | `ActivityLog` (sổ phụ)                                             | Mọi action log                                                               |
| Ghi chú                            | `Note` (sổ phụ) + `Contact.notes` (quick)                        | Sale gõ tay                                                                  |
| Lịch hẹn                          | `Appointment` (sổ phụ) + `Contact.nextAppointment` (cache)       | Sale tạo / cron flip overdue                                                 |
| Timeline KH                         | `ActivityLog` filter `entityId=contactId`                          | Auto + user                                                                   |

---

# 🎯 Sau khi plan sync mới chạy thì gì đổi?

 **KHÔNG đổi** : schema 2 bảng giữ nguyên. Mọi field anh kể vẫn ở vị trí cũ.

 **ĐỔI** :

1. Field nào hôm nay phải chờ user bấm "Đồng bộ" → giờ tự refresh mỗi 15 phút (đặc biệt là `zaloDisplayName`, `zaloAvatarUrl`, `aliasInNick`, `zaloLabels`)
2. Khi 1 field đổi → backend bật loa socket → 2 tab (Khách hàng + Bạn bè) tự update ô đó **không cần reload**
3. Cả 2 tab giờ đọc cùng 1 "danh sách cột Friend" (canonical serializer) → không còn drift ô nào hiện ở tab này mà thiếu ở tab kia

→ Anh không phải nhớ "field này ở Contact hay Friend" khi bug — vì giờ đã có **1 file định nghĩa duy nhất** (`friend-serializer.ts`) để xem.

---

Anh muốn em đào sâu vào nhóm nào (ví dụ chi tiết Lead Scoring 4 chiều, hay flow của ActivityLog), hay đi tiếp implement plan?
