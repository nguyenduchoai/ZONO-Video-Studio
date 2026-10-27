# Conductor Prompts — gstack Pipeline

> Pipeline: 7 Phase (Think → Plan → Build → Review → Test → Ship → Reflect)
> Mỗi workspace trong Conductor paste prompt vào ô "Starting prompt"
> Chuẩn: gstack agent (KHÔNG dùng ClaudeKit)

---

## Cấu trúc 6 Workspace

| Workspace | Branch | Sprint |
|-----------|--------|--------|
| 1 | `feat/ai-assistant` | S1: AI Assistant |
| 2 | `feat/workflow-automation` | S2: Workflow Automation |
| 3 | `feat/advanced-analytics` | S3: Advanced Analytics |
| 4 | `feat/contact-intelligence` | S4: Contact Intelligence |
| 5 | `feat/mobile-pwa` | S5: Mobile API + PWA |
| 6 | `feat/integration-hub` | S6: Integration Hub |

---

## Prompt cho từng Workspace

### Workspace 1 — S1: AI Assistant

```
Đọc file plans/sprint-plan.md, phần Sprint S1: AI Assistant.
Thực hiện đầy đủ theo 7 phase:
  Phase 1 — THINK:      /office-hours
  Phase 2 — PLAN:       /plan-ceo-review + /plan-eng-review + /plan-design-review
  Phase 3 — BUILD:      Triển khai theo plan đã lock
  Phase 4 — REVIEW:     /review
  Phase 5 — TEST:       /qa
  Phase 6 — SHIP:       /ship
  Phase 7 — REFLECT:    /retro
```

### Workspace 2 — S2: Workflow Automation

```
Đọc file plans/sprint-plan.md, phần Sprint S2: Workflow Automation.
Thực hiện đầy đủ theo 7 phase:
  Phase 1 — THINK:      /office-hours
  Phase 2 — PLAN:       /plan-ceo-review + /plan-eng-review + /plan-design-review
  Phase 3 — BUILD:      Triển khai theo plan đã lock
  Phase 4 — REVIEW:     /review
  Phase 5 — TEST:       /qa
  Phase 6 — SHIP:       /ship
  Phase 7 — REFLECT:    /retro
```

### Workspace 3 — S3: Advanced Analytics

```
Đọc file plans/sprint-plan.md, phần Sprint S3: Advanced Analytics.
Thực hiện đầy đủ theo 7 phase:
  Phase 1 — THINK:      /office-hours
  Phase 2 — PLAN:       /plan-ceo-review + /plan-eng-review + /plan-design-review
  Phase 3 — BUILD:      Triển khai theo plan đã lock
  Phase 4 — REVIEW:     /review
  Phase 5 — TEST:       /qa
  Phase 6 — SHIP:       /ship
  Phase 7 — REFLECT:    /retro
```

### Workspace 4 — S4: Contact Intelligence

```
Đọc file plans/sprint-plan.md, phần Sprint S4: Contact Intelligence.
Thực hiện đầy đủ theo 7 phase:
  Phase 1 — THINK:      /office-hours
  Phase 2 — PLAN:       /plan-ceo-review + /plan-eng-review + /plan-design-review
  Phase 3 — BUILD:      Triển khai theo plan đã lock
  Phase 4 — REVIEW:     /review
  Phase 5 — TEST:       /qa
  Phase 6 — SHIP:       /ship
  Phase 7 — REFLECT:    /retro
```

### Workspace 5 — S5: Mobile API + PWA

```
Đọc file plans/sprint-plan.md, phần Sprint S5: Mobile API + PWA.
Thực hiện đầy đủ theo 7 phase:
  Phase 1 — THINK:      /office-hours
  Phase 2 — PLAN:       /plan-ceo-review + /plan-eng-review + /plan-design-review
  Phase 3 — BUILD:      Triển khai theo plan đã lock
  Phase 4 — REVIEW:     /review
  Phase 5 — TEST:       /qa
  Phase 6 — SHIP:       /ship
  Phase 7 — REFLECT:    /retro
```

### Workspace 6 — S6: Integration Hub

```
Đọc file plans/sprint-plan.md, phần Sprint S6: Integration Hub.
Thực hiện đầy đủ theo 7 phase:
  Phase 1 — THINK:      /office-hours
  Phase 2 — PLAN:       /plan-ceo-review + /plan-eng-review + /plan-design-review
  Phase 3 — BUILD:      Triển khai theo plan đã lock
  Phase 4 — REVIEW:     /review
  Phase 5 — TEST:       /qa
  Phase 6 — SHIP:       /ship
  Phase 7 — REFLECT:    /retro
```

---

## Thứ tự merge khuyến nghị

```
S4 (Contact Intelligence)    ← Không phụ thuộc gì, chạy đầu tiên
  ↓
S3 (Advanced Analytics)      ← Dùng lead score từ S4
  ↓
S2 (Workflow Automation)     ← Dùng templates, có thể trigger analytics
  ↓
S1 (AI Assistant)            ← Có thể dùng templates từ S2
  ↓
S5 (Mobile PWA)              ← Cần tất cả features đã có
  ↓
S6 (Integration Hub)         ← Cuối cùng, kết nối với bên ngoài
```

---

## Checklist trước khi chạy

- [ ] PostgreSQL dev đang chạy (`docker-compose -f docker-compose.dev.yml up -d`)
- [ ] Backend `.env` có đầy đủ config
- [ ] `npm install` đã chạy cho cả backend và frontend
- [ ] Conductor đã cài và kết nối repo
- [ ] Mỗi sprint độc lập, không sửa cùng file
