---
name: phan-tich-video-viral
description: "Phân tích video viral — rút công thức hook/cấu trúc/âm thanh/cảm xúc — sinh Veo 3 storyboard. Input: transcript, mô tả, hoặc kết quả từ Gemini. Claude tự thực hiện toàn bộ phân tích."
argument-hint: "[analyze|formula|veo3] [nội dung hoặc chủ đề]"
metadata:
  author: user
  version: "2.0.0"
---
# Phân Tích Video Viral

Claude đọc skill này và TỰ THỰC HIỆN phân tích trong conversation.
Không sinh prompt để copy — Claude là người làm.

`<args>`$ARGUMENTS`</args>`

## Input Claude chấp nhận

| Loại input             | Cách cung cấp                                            |
| ----------------------- | ---------------------------------------------------------- |
| **File video**    | Upload trực tiếp — Claude Opus 4.7 đọc được native |
| **Transcript**    | Paste transcript YouTube / auto-caption                    |
| **URL YouTube**   | Claude đọc metadata + hỏi thêm nếu cần               |
| **Mô tả video** | Mô tả bằng lời nếu không có file                    |

> **Khuyến nghị:** Dùng **Claude Opus 4.7** để upload video file trực tiếp
> và phân tích hình ảnh, âm thanh, lời thoại, hiệu ứng cùng lúc.

## Subcommands

| Subcommand  | Claude tự làm gì                                                                         |
| ----------- | ------------------------------------------------------------------------------------------- |
| `analyze` | Phân tích scene + 8D scoring →`references/analysis-framework.md`                       |
| `formula` | Tổng hợp công thức từ nhiều video đã analyze →`references/formula-extraction.md` |
| `veo3`    | Sinh storyboard + Veo 3 prompts →`references/veo3-output.md`                             |

## Routing

1. Parse subcommand từ `$ARGUMENTS`
2. Hỏi user cung cấp input nếu chưa có
3. Load `references/{subcommand}.md` để thực thi
4. Không có subcommand → hỏi user muốn bắt đầu từ đâu

## Viral Formula Library

Tham khảo sẵn: `references/viral-formulas.md`
