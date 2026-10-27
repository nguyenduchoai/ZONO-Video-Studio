# Hướng dẫn viết prompt để Claude tự tạo Conductor Prompts

> Pipeline: Brainstorm → Plan → Cook
> Chuẩn: ClaudeKit agents + skills (KHÔNG dùng gstack)
> Áp dụng cho bất kỳ dự án nào, với ý tưởng và tính năng mới

---

## Cách dùng

Khi bạn có **dự án mới** hoặc **ý tưởng tính năng mới**, paste meta-prompt dưới đây vào Claude Code, điền vào các chỗ `[...]`, Claude sẽ tự động sinh ra file `plans/conductor-prompts.md` đầy đủ cho tất cả workspace.

---

## Meta-Prompt (copy và điền vào)

```
Tôi muốn bạn tạo file `plans/conductor-prompts.md` cho dự án này theo chuẩn ClaudeKit pipeline: Brainstorm → Plan → Cook.

## Thông tin dự án

**Tên dự án:** [Tên dự án, ví dụ: ZaloCRM, SaaS Dashboard, E-commerce Platform]

**Mô tả ngắn:** [1-2 câu mô tả dự án, stack công nghệ đang dùng]
- Ví dụ: "CRM tích hợp Zalo, stack NestJS + Vue 3 + PostgreSQL + Prisma. MVP đã hoàn thành gồm: auth, chat, contact pipeline."

**Tech stack:**
- Backend: [NestJS / FastAPI / Django / Express...]
- Frontend: [Vue 3 / React / Next.js...]
- Database: [PostgreSQL / MongoDB / MySQL...]
- ORM/ODM: [Prisma / TypeORM / Mongoose...]

**File plan chính:** [đường dẫn, ví dụ: plans/sprint-plan.md | plans/roadmap.md | CLAUDE.md]

## Danh sách tính năng / sprint cần implement song song

[Liệt kê từng tính năng theo format sau — mỗi dòng là 1 workspace:]

| STT | Tên tính năng | Branch | Mô tả ngắn | File ownership (backend/frontend/schema) |
|-----|---------------|--------|------------|------------------------------------------|
| 1   | [Tên]         | feat/[slug] | [Mô tả 1 câu] | backend: [path], frontend: [path], schema: [model mới] |
| 2   | ...           | ...    | ...        | ... |

## Yêu cầu khi tạo file conductor-prompts.md

1. Tạo đủ 3 phase cho MỖI workspace: BRAINSTORM, PLAN, COOK
2. Mỗi prompt phải:
   - Chỉ rõ file plan cần đọc
   - Dùng đúng skill ClaudeKit: `/ck:brainstorm`, `/ck:plan --hard`, `/ck:cook [path] --auto`
   - Có file ownership rõ ràng để các workspace không conflict nhau
   - Chỉ commit lên branch riêng, KHÔNG commit lên main/dev
3. Cuối file thêm: thứ tự chạy khuyến nghị (sprint nào độc lập chạy trước, sprint nào phụ thuộc chạy sau)
4. Lưu ra `plans/conductor-prompts.md`
5. KHÔNG implement code, chỉ tạo file prompt

Hãy bắt đầu bằng cách đọc `[file plan chính]` và các file liên quan để hiểu rõ codebase trước khi viết prompts.
```

---

## Ví dụ điền hoàn chỉnh — Dự án mới hoàn toàn

```
Tôi muốn bạn tạo file `plans/conductor-prompts.md` cho dự án này theo chuẩn ClaudeKit pipeline: Brainstorm → Plan → Cook.

## Thông tin dự án

**Tên dự án:** ShopFlow — Nền tảng quản lý đơn hàng

**Mô tả ngắn:** SaaS quản lý đơn hàng đa kênh (Shopee, Lazada, TikTok Shop).
Stack: NestJS + React + PostgreSQL + Prisma. Chưa có MVP, bắt đầu từ đầu.

**Tech stack:**
- Backend: NestJS
- Frontend: React + TanStack Router
- Database: PostgreSQL
- ORM: Prisma

**File plan chính:** plans/product-plan.md

## Danh sách tính năng cần implement song song

| STT | Tên tính năng | Branch | Mô tả ngắn | File ownership |
|-----|---------------|--------|------------|----------------|
| 1 | Auth & Onboarding | feat/auth | Đăng ký, đăng nhập, multi-tenant org | backend: src/modules/auth/, frontend: src/pages/auth/, schema: User, Org, Session |
| 2 | Order Management | feat/orders | CRUD đơn hàng, trạng thái, filter | backend: src/modules/orders/, frontend: src/pages/orders/, schema: Order, OrderItem |
| 3 | Channel Integration | feat/channels | Kết nối Shopee/Lazada/TikTok API | backend: src/modules/channels/, frontend: src/pages/channels/, schema: Channel, ChannelConfig |
| 4 | Inventory Sync | feat/inventory | Đồng bộ tồn kho thời gian thực | backend: src/modules/inventory/, frontend: src/pages/inventory/, schema: Product, StockLog |

## Yêu cầu khi tạo file conductor-prompts.md

1. Tạo đủ 3 phase cho MỖI workspace: BRAINSTORM, PLAN, COOK
2. Mỗi prompt phải:
   - Chỉ rõ file plan cần đọc
   - Dùng đúng skill ClaudeKit: `/ck:brainstorm`, `/ck:plan --hard`, `/ck:cook [path] --auto`
   - Có file ownership rõ ràng để các workspace không conflict nhau
   - Chỉ commit lên branch riêng, KHÔNG commit lên main/dev
3. Cuối file thêm: thứ tự chạy khuyến nghị
4. Lưu ra `plans/conductor-prompts.md`
5. KHÔNG implement code, chỉ tạo file prompt

Hãy bắt đầu bằng cách đọc `plans/product-plan.md` và README.md để hiểu rõ codebase trước khi viết prompts.
```

---

## Các biến thể hay dùng

### Khi dự án đã có MVP, chỉ thêm tính năng mới
```
**Mô tả ngắn:** "MVP đã hoàn thành gồm: [liệt kê module đã có].
Các sprint dưới đây mở rộng thêm tính năng mới."
```

### Khi chưa có file plan, muốn Claude tự suy context
```
**File plan chính:** KHÔNG CÓ — hãy đọc README.md và CLAUDE.md để hiểu dự án,
sau đó tự suy ra context cho từng sprint dựa trên mô tả tính năng tôi cung cấp.
```

### Khi muốn plan theo phase tuần tự (KHÔNG song song)
```
## Danh sách phase tuần tự (KHÔNG song song)
[Liệt kê các phase phải chạy lần lượt, mỗi phase 1 workspace]

Lưu ý: thứ tự chạy là bắt buộc, phase sau phụ thuộc phase trước.
Tạo thứ tự chạy rõ ràng trong file conductor-prompts.md.
```

### Khi muốn chạy nhanh, bỏ qua brainstorm
```
## Yêu cầu đặc biệt
- Bỏ qua Phase 1 (Brainstorm), chỉ tạo Phase 2 (Plan) và Phase 3 (Cook)
- Dùng `/ck:plan --fast` thay vì `--hard` để bỏ qua research
- Dùng `/ck:cook [path] --fast` để bỏ qua testing step
```

---

## Nguyên tắc Claude áp dụng khi sinh prompt

Claude sẽ tự động đảm bảo mỗi prompt sinh ra tuân theo:

| Skill / Agent | Vai trò | Hard rule |
|---------------|---------|-----------|
| `/ck:brainstorm` | Khám phá giải pháp, đánh giá trade-offs | KHÔNG code trước khi user approve |
| `/ck:plan --hard` | Tạo plan chi tiết, 2 researcher + red-team | KHÔNG implement, chỉ tạo file `.md` |
| `/ck:cook [path] --auto` | Implement toàn bộ theo plan | Scout → code → test → review → commit |
| `scout` | Tìm đúng file trước khi code | Chạy đầu tiên trong Cook, tránh tạo file trùng |
| `tester` | Chạy test | KHÔNG bỏ qua test fail |
| `code-reviewer` | Review code | Chạy trước khi commit |
| `git-manager` | Commit + push | Conventional commit, đúng branch riêng |

---

## Checklist trước khi paste meta-prompt

- [ ] Đã điền tên dự án và mô tả ngắn
- [ ] Đã liệt kê đúng tech stack
- [ ] Đã chỉ rõ file plan chính tồn tại trong dự án
- [ ] Mỗi tính năng có branch riêng dạng `feat/[slug]`
- [ ] File ownership không overlap giữa các workspace
- [ ] Xác định rõ tính năng nào độc lập (chạy song song) và tính năng nào phụ thuộc (chạy sau)

---

## Xem ví dụ thực tế

File đã sinh cho ZaloCRM: `plans/conductor-prompts.md`
