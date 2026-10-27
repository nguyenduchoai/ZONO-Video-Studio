# Conductor Prompts — ZaloCRM

> Thư mục này chứa 2 bộ prompts cho 2 cách tiếp cận khác nhau.
> Chọn 1 trong 2 tùy theo toolchain bạn đang dùng.

---

## Chọn phiên bản phù hợp

| File | Toolchain | Pipeline | Khi nào dùng |
|------|-----------|----------|--------------|
| [`conductor-prompts-gstack.md`](conductor-prompts-gstack.md) | gstack skills | Think → Plan → Build → Review → Test → Ship → Reflect (7 phase) | Dùng gstack `/office-hours`, `/review`, `/qa`, `/ship`, `/retro` |
| [`conductor-prompts-claudekit.md`](conductor-prompts-claudekit.md) | ClaudeKit agents + skills | Brainstorm → Plan → Cook (3 phase) | Dùng ClaudeKit `/ck:brainstorm`, `/ck:plan`, `/ck:cook` |

---

## Tóm tắt so sánh

### gstack — 7 Phase
```
THINK (/office-hours)
  ↓
PLAN (/plan-ceo-review + /plan-eng-review + /plan-design-review)
  ↓
BUILD (implement)
  ↓
REVIEW (/review)
  ↓
TEST (/qa)
  ↓
SHIP (/ship)
  ↓
REFLECT (/retro)
```

### ClaudeKit — 3 Phase
```
BRAINSTORM (/ck:brainstorm)
  → output: plans/sX-name/phase-1-brainstorm.md
  ↓
PLAN (/ck:plan --hard)
  → output: plans/sX-name/plan.md + phase-01-*.md...
  ↓
COOK (/ck:cook path/plan.md --auto)
  → auto-chain: scout → implement → tester → code-reviewer → git-manager
```
