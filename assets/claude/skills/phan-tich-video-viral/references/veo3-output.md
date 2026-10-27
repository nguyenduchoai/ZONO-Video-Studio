# Veo 3 Output — Claude Tự Sinh Storyboard + Veo 3 Prompts

## Claude làm gì khi subcommand `veo3`

1. Lấy công thức từ bước `formula` trong conversation (hoặc dùng `viral-formulas.md` nếu chưa có)
2. Hỏi user nếu thiếu: chủ đề, thời lượng, platform, vibe
3. Tự sinh: Script → Storyboard → Veo 3 prompts từng cảnh → Audio brief → Checklist
4. Xuất toàn bộ trong conversation, sẵn sàng để user copy từng Veo 3 prompt

---

## Input cần có

```
CHỦ ĐỀ: [bắt buộc]
NICHE KÊNH: [bắt buộc]
THỜI LƯỢNG: 15s / 30s / 60s / 3 phút
PLATFORM: YouTube Shorts / TikTok / Reels / YouTube full
VIBE: [cảm xúc chủ đạo]
CÔNG THỨC: [từ bước formula — nếu không có, Claude dùng viral-formulas.md]
```

---

## Bước 1 — Claude Tự Sinh Script

Áp dụng hook formula + act structure từ công thức vào chủ đề mới.
Format script:

```
[HOOK | 0–3s]
Visual: [mô tả ngắn]
Audio: [nhạc/SFX/silence]
Lời/narration: "..."

[ACT 1 — SETUP | 3s–Xs]
Visual: ...
Audio: ...
Lời: "..."

[ACT 2 — ESCALATION | Xs–Ys]
...

[CLIMAX | Ys–Zs]
...

[ACT 3 — PAYOFF | Zs–END]
...
```

---

## Bước 2 — Claude Tự Sinh Storyboard

Với mỗi segment trong script:

```
[CẢNH #N | Timestamp: 00:XX–00:XX | Thời lượng: Xs]
Narrative role: HOOK / SETUP / ESCALATION / CLIMAX / PAYOFF

MÔ TẢ CẢNH: [1–2 câu chuyện gì xảy ra]
NHÂN VẬT: [ai, làm gì, biểu cảm]
BỐI CẢNH: [môi trường, setting]
ÂM THANH:
  - Nhạc: [thể loại, tempo, mood]
  - SFX: [tên + timing]
  - Lời: "[quote]" — tone: [mô tả]
TEXT OVERLAY: [có/không | nội dung | vị trí | style]
TRANSITION RA: [loại]
CẢM XÚC MỤC TIÊU: [người xem cảm thấy gì]
```

---

## Bước 3 — Veo 3 Prompt Từng Cảnh

Format chuẩn mỗi prompt:

```
━━━ VEO 3 — CẢNH #N ━━━
[Shot type], [subject + action cụ thể], [environment/setting],
[lighting mood], [color grade], [camera movement + speed],
[visual style], [emotional atmosphere].

Audio:
- Music: [genre], [mood], [tempo], [mix level]
- SFX: [sound] khi [trigger] lúc [Xs]
- "[Character]" nói: "[dialogue ≤15 chữ]"
- Ambient: [1–2 elements tối đa]

Specs: [duration]s, [9:16 hoặc 16:9], [1080p/4K]
━━━━━━━━━━━━━━━━━━━━━━━
```

**Ví dụ thực tế (niche tình cảm):**
```
━━━ VEO 3 — CẢNH #1 (HOOK | 3s) ━━━
Extreme close-up, đôi mắt cô gái trẻ ngấn lệ, mi run nhẹ,
đèn phố blur bokeh phía sau, warm amber + cool blue split-tonal,
camera static rồi slow push-in 15%, cinematic 35mm grain,
nỗi buồn kìm nén.

Audio:
- Music: lo-fi piano, 68 BPM, melancholic, subtle
- SFX: tiếng giọt mưa lúc 1.5s
- Ambient: tiếng xe xa, mưa nhẹ
- "Narrator" nói: "Có những người ta không giữ được..."

Specs: 3s, 9:16, 1080p
━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Bước 4 — Audio Brief & Checklist

**Audio Brief:**
```
Nhạc: [genre] — [mood] — [BPM] — Arc: [build→drop→outro ở đâu]
SFX timeline:
  [Xs]: [sound] — [trigger]
  [Ys]: [sound] — [trigger]
Narration script: [full text theo timestamp]
```

**Viral Checklist:**
```
□ Hook hoạt động khi TẮT âm thanh?
□ Hook hoạt động khi CHE hình ảnh?
□ Tension rõ ở Act 2?
□ Payoff thỏa mãn kỳ vọng từ hook?
□ Audio peak trùng visual peak?
□ Viral trigger rõ và đúng vị trí?
□ Ending có open loop / watch-more bait?
```

---

## Tips Veo 3

| Vấn đề | Fix |
|--------|-----|
| Dialogue không khớp miệng | Rút còn ≤ 12 chữ |
| Style không nhất quán | Thêm "same visual style as scene 1" |
| Camera drift | Thêm "camera static" hoặc "locked off" |
| Quá nhiều element | 1 action duy nhất per scene |
| Audio out of sync | Chỉ specify music + ambient, bỏ SFX phức tạp |
