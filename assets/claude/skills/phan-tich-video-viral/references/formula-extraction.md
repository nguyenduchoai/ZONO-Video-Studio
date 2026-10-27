# Formula Extraction — Claude Tự Tổng Hợp Công Thức

## Claude làm gì khi subcommand `formula`

1. Thu thập kết quả analyze của tất cả video trong conversation (hoặc user paste thêm)
2. Hỏi: niche kênh đích là gì?
3. Tổng hợp công thức theo framework bên dưới
4. Transpose sang niche đích
5. Sinh 3 concept video mẫu
6. Nhắc: có thể dùng `veo3` để biến concept thành storyboard

---

## Framework Tổng Hợp

Chỉ giữ pattern xuất hiện ≥ 60% số video đã analyze.

### A. HOOK FORMULA — TOP 3

Với mỗi hook type hay xuất hiện:

```
Hook #N: [tên kiểu]
Tần suất: X/N video
Visual 3s đầu: [mô tả]
Audio 3s đầu: [mô tả]
Template lời: "[...fill-in-the-blank...]"
Tâm lý hoạt động: [1 câu]
```

### B. STORY STRUCTURE BLUEPRINT

```
Act 1 [0–X%]: [function] + [kỹ thuật hay dùng]
Act 2 [X–Y%]: [function] + [tension mechanism]
Act 3 [Y–100%]: [payoff type] + [closing technique]
Tỉ lệ: Act1 __% | Act2 __% | Act3 __%
```

### C. EMOTIONAL ARC CHUẨN

```
[LOW]──(emotion)──[MID-PEAK]──(dip?)──[FINAL-PEAK]──[END]
```
Cảm xúc dominant top 3:

### D. AUDIO BLUEPRINT

```
[0–Hook]:   [audio state]
[Hook]:     [beat drop / nhạc thay đổi thế nào]
[Mid]:      [audio state]
[Climax]:   [audio state]
[Outro]:    [audio state]
```
SFX hay xuất hiện nhất:

### E. VISUAL LANGUAGE KIT

| Shot Type | Xuất hiện khi | Mục đích |
|-----------|--------------|----------|
| ... | ... | ... |

- Transition hay nhất: [loại + khi nào]
- Color grading pattern: [mô tả]
- Text overlay rules: [khi nào, style gì]

### F. VIRAL EQUATION

```
VIRAL = [Hook] + [Structure] + [Audio Peak] + [Emotional Trigger] + [Payoff]
```
Mỗi biến: 1 câu giải thích.

### G. NỀN TẢNG PHỔ QUÁT (không phụ thuộc niche)

Những yếu tố xuất hiện trong MỌI video viral bất kể chủ đề:
- ...

---

## Transpose Sang Niche Đích

Sau khi tổng hợp công thức, Claude tự tạo bảng mapping:

| Yếu tố | Công thức gốc | → Niche đích |
|--------|--------------|-------------|
| Hook visual | ... | ... |
| Hook copy template | ... | ... |
| Act 1 setup | ... | ... |
| Tension mechanism | ... | ... |
| Emotional trigger | ... | ... |
| Audio peak | ... | ... |
| Payoff/resolution | ... | ... |
| Viral trigger | ... | ... |

---

## 3 Concept Video Mẫu

Claude tự sinh 3 concept cho niche đích, mỗi concept gồm:

```
CONCEPT #N: [tiêu đề]
Hook 3s: visual "[mô tả]" + audio "[mô tả]" + lời "[câu mở]"
Act 1: [1 câu]
Act 2: [1 câu — tension là gì]
Act 3: [1 câu — payoff là gì]
Emotional journey: [LOW → PEAK → RESOLUTION]
Viral trigger chính: [tên trigger + lý do]
```
