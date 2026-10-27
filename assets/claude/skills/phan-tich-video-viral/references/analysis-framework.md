# Analysis Framework — Claude Tự Phân Tích Scene + 8D Scoring

## Claude làm gì khi subcommand `analyze`

1. Nếu chưa có input → yêu cầu user upload video file (Opus 4.7 đọc native)
   hoặc paste transcript nếu không có file
2. Hỏi: niche kênh của bạn là gì? (để dùng ở bước formula)
3. Xem/đọc video → thực hiện phân tích theo framework bên dưới
4. Xuất kết quả đầy đủ trong conversation
5. Sau khi xong → nhắc: analyze thêm video rồi chạy `formula`

---

## Framework Phân Tích

### PHẦN 1 — Scene-by-Scene

Chia nội dung thành các segment tự nhiên. Với mỗi cảnh:

```
[CẢNH #N | Timestamp: 00:XX–00:XX | Thời lượng: Xs]

HÌNH ẢNH
- Shot type: (ECU/CU/MS/WS/OTS/POV/aerial)
- Góc máy: (eye-level/low/high/Dutch tilt)
- Camera move: (static/dolly-in/dolly-out/pan/handheld/orbit)
- Màu & lighting: (tone, contrast, mood)
- Hiệu ứng: (slow-mo/speed-ramp/glitch/zoom-punch/text-overlay)

ÂM THANH
- Nhạc: (thể loại, tempo, mood, có lời không)
- SFX: (liệt kê từng sound + timing)
- Lời/narration: (quote chính xác, tone, cảm xúc giọng)
- Silence: (có khoảng lặng chủ đích không, ở đâu)
- Dominant: (nhạc / giọng / SFX nổi hơn)

NHÂN VẬT / ĐỐI TƯỢNG
- Ai/cái gì xuất hiện
- Biểu cảm cụ thể
- Hành động / movement
- Text overlay: (nội dung, vị trí, font style, màu)

TRANSITION
- Loại: (hard cut/fade/whip pan/match cut/j-cut/l-cut)
- Sync với audio: (beat/SFX/voice)

CẢM XÚC & MỤC ĐÍCH
- Cảm xúc người xem:
- Narrative function:
- Tại sao không skip cảnh này?
```

---

### PHẦN 2 — Macro Analysis

**A. EMOTIONAL ARC**
```
[0s](emotion)──[Xs](peak)──[Ys](dip?)──[Zs](final peak)──[END]
```

**B. ACT STRUCTURE**
- Act 1 Setup [0–X%]: làm gì, thiết lập gì?
- Act 2 Escalation [X–Y%]: tension build thế nào?
- Act 3 Payoff [Y–100%]: twist/punchline/resolution?
- Có false resolution (Act 2.5) không?

**C. HOOK LAYERS (3 giây đầu)**
- Visual hook: hình ảnh đầu tiên
- Audio hook: âm thanh đầu tiên
- Copy hook: chữ/lời đầu tiên
- Câu hỏi xuất hiện trong đầu người xem sau 3s?

**D. PACING MAP**
- Cuts/phút từng act
- Đoạn nhanh nhất: [timestamp] + lý do
- Đoạn chậm nhất: [timestamp] + lý do (thường là emotional peak)

**E. AUDIO BLUEPRINT**
- Timeline nhạc: build → drop → outro ở đâu?
- Sound signature đặc trưng
- Beat sync moments: nhạc đổi trùng với gì?

**F. VIRAL TRIGGERS**
- Share: cảnh/câu nào? Lý do?
- Comment: cảnh/câu nào tạo tranh luận?
- Rewatch: có hidden detail không?
- Save: thông tin/cảm xúc nào khiến lưu?

---

### PHẦN 3 — 8D Scoring

| Dimension | Tiêu chí | Score | Evidence (timestamp) |
|-----------|----------|-------|----------------------|
| 1. Hook | 3s đầu: pattern interrupt, curiosity gap | /10 | |
| 2. Scene Composition | Lighting, background, visual hierarchy | /10 | |
| 3. Character Presence | Authentic emotion, relatability | /10 | |
| 4. Story Structure | Setup→tension→payoff, pacing | /10 | |
| 5. Audio Engineering | Music choice, SFX timing, AV sync | /10 | |
| 6. Visual Style | Color grade, transitions, text overlay | /10 | |
| 7. Format Optimization | Aspect ratio, duration, captions | /10 | |
| 8. Special Elements | Cultural ref, twist, CTA, shareability | /10 | |
| **TOTAL** | | **/80** | |

**Benchmark:** 60+ = viral cao | 45–59 = tốt | <45 = cần cải thiện

**Top 3 kỹ thuật đáng học nhất:**
1.
2.
3.
