#!/usr/bin/env python3
"""
VieNeu-TTS & Fast Vietnamese Neural TTS CLI wrapper for ZONO Agentic AI (`zono-vieneu-tts`).
Supports:
  - Preset Vietnamese voices across Northern, Central, and Southern accents (`--voice`)
  - Instant Zero-Shot Voice Cloning from a 3-8s reference audio (`--ref-audio`)
  - Listing all available voices (`--list-voices`)
  - Direct MP3 / WAV + SRT subtitle export (`--write-media voice.mp3 --write-subtitles voice.srt`)
"""
import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

VOICE_LIST = [
    {"id": "Ngọc Huyền", "label": "Ngọc Huyền (VieNeu-TTS) — Nữ miền Bắc · Tự nhiên, biên tập viên", "gender": "female"},
    {"id": "Thanh Bình", "label": "Thanh Bình (VieNeu-TTS) — Nam miền Bắc · Trầm ấm, kể chuyện", "gender": "male"},
    {"id": "Phạm Tuyên", "label": "Phạm Tuyên (VieNeu-TTS) — Nam miền Bắc · Tự nhiên, review", "gender": "male"},
    {"id": "Xuân Vĩnh", "label": "Xuân Vĩnh (VieNeu-TTS) — Nam miền Bắc · Tin tức, chuyên gia", "gender": "male"},
    {"id": "Ngọc Linh", "label": "Ngọc Linh (VieNeu-TTS) — Nữ miền Bắc · Truyền cảm, dẫn chuyện", "gender": "female"},
    {"id": "Đoan Trang", "label": "Đoan Trang (VieNeu-TTS) — Nữ miền Nam · Trẻ trung, bán hàng", "gender": "female"},
    {"id": "Trúc Ly", "label": "Trúc Ly (VieNeu-TTS) — Nữ miền Nam · Dịu dàng, mỹ phẩm/F&B", "gender": "female"},
    {"id": "Ngọc Trân", "label": "Ngọc Trân (VieNeu-TTS) — Nữ miền Trung · Tự nhiên", "gender": "female"},
    {"id": "Quang Sơn", "label": "Quang Sơn (VieNeu-TTS) — Nam miền Trung · Chững chạc", "gender": "male"},
]

MALE_KEYWORDS = ("bình", "binh", "tuyên", "tuyen", "vĩnh", "vinh", "sơn", "son", "hoàng", "hoang", "nam", "male", "namminh")


def is_male_voice(voice_name: str | None) -> bool:
    if not voice_name:
        return False
    low = voice_name.lower()
    return any(k in low for k in MALE_KEYWORDS)


def parse_rate_pct(rate_str: str | None) -> tuple[str, float]:
    if not rate_str:
        return "+0%", 1.0
    s = str(rate_str).strip()
    m_pct = re.match(r"^([+-]?\d+(?:\.\d+)?)%$", s)
    if m_pct:
        pct = float(m_pct.group(1))
        sign = "+" if pct >= 0 else ""
        atempo = max(0.5, min(2.0, 1.0 + pct / 100.0))
        return f"{sign}{int(round(pct))}%", atempo
    try:
        val = float(s)
        pct = int(round((val - 1.0) * 100))
        sign = "+" if pct >= 0 else ""
        return f"{sign}{pct}%", max(0.5, min(2.0, val))
    except ValueError:
        return "+0%", 1.0


def probe_duration(media_path: Path) -> float:
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(media_path)],
            text=True,
        ).strip()
        return float(out) if out else 2.5
    except Exception:
        return 2.5


def fmt_srt_time(sec: float) -> str:
    ms = int(round(max(0.0, sec) * 1000))
    hrs = ms // 3_600_000
    ms %= 3_600_000
    mins = ms // 60_000
    ms %= 60_000
    secs = ms // 1000
    ms %= 1000
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{ms:03d}"


def write_fallback_srt(text: str, duration: float, srt_path: Path) -> None:
    srt_path.parent.mkdir(parents=True, exist_ok=True)
    words = [w for w in re.split(r"\s+", text.strip()) if w]
    if not words:
        srt_path.write_text("", encoding="utf-8")
        return
    chunk_size = 6
    chunks = [" ".join(words[i : i + chunk_size]) for i in range(0, len(words), chunk_size)]
    seg_dur = max(0.4, duration / len(chunks))
    lines = []
    for idx, ch in enumerate(chunks):
        t0 = idx * seg_dur
        t1 = min(duration, (idx + 1) * seg_dur)
        lines.append(f"{idx + 1}\n{fmt_srt_time(t0)} --> {fmt_srt_time(t1)}\n{ch}\n")
    srt_path.write_text("\n".join(lines), encoding="utf-8")


async def run_edge_tts(text: str, voice_name: str, rate_pct: str, out_path: Path, srt_path: Path | None) -> bool:
    import edge_tts

    edge_voice = "vi-VN-NamMinhNeural" if is_male_voice(voice_name) else "vi-VN-HoaiMyNeural"
    communicate = edge_tts.Communicate(text, edge_voice, rate=rate_pct)
    submaker = edge_tts.SubMaker() if hasattr(edge_tts, "SubMaker") else None

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_mp3 = Path(tmp.name)

    try:
        with open(tmp_mp3, "wb") as f:
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    f.write(chunk["data"])
                elif chunk["type"] in ("WordBoundary", "SentenceBoundary") and submaker is not None:
                    try:
                        submaker.feed(chunk)
                    except Exception:
                        pass

        if not tmp_mp3.exists() or tmp_mp3.stat().st_size < 200:
            return False

        if out_path.suffix.lower() == ".mp3":
            tmp_mp3.replace(out_path)
            out_path.chmod(0o644)
        else:
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(tmp_mp3), str(out_path)],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
            tmp_mp3.unlink(missing_ok=True)

        if srt_path:
            wrote_srt = False
            if submaker is not None and hasattr(submaker, "get_srt"):
                srt_content = submaker.get_srt()
                if srt_content and srt_content.strip():
                    srt_path.parent.mkdir(parents=True, exist_ok=True)
                    srt_path.write_text(srt_content, encoding="utf-8")
                    wrote_srt = True
            if not wrote_srt:
                write_fallback_srt(text, probe_duration(out_path), srt_path)
        return True
    except Exception:
        tmp_mp3.unlink(missing_ok=True)
        return False


def run_vieneu_local(text: str, voice_name: str, ref_audio: str | None, ref_text: str | None, atempo: float, out_path: Path, srt_path: Path | None) -> bool:
    try:
        from vieneu import Vieneu

        tts = Vieneu()
        with tempfile.TemporaryDirectory(prefix="zono-vieneu-") as tmp:
            wav_path = Path(tmp) / "raw.wav"
            infer_kwargs = {"text": text}
            if ref_audio and os.path.exists(ref_audio):
                if hasattr(tts, "encode_reference"):
                    infer_kwargs["voice"] = tts.encode_reference(ref_audio)
                else:
                    infer_kwargs["ref_audio"] = ref_audio
                    if ref_text:
                        infer_kwargs["ref_text"] = ref_text
            audio = tts.infer(**infer_kwargs)
            tts.save(audio, str(wav_path))

            ff_cmd = ["ffmpeg", "-y", "-i", str(wav_path)]
            if abs(atempo - 1.0) >= 0.01:
                ff_cmd += ["-filter:a", f"atempo={atempo:.3f}"]
            if out_path.suffix.lower() == ".mp3":
                ff_cmd += ["-codec:a", "libmp3lame", "-qscale:a", "2"]
            ff_cmd.append(str(out_path))
            subprocess.run(ff_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        if srt_path:
            write_fallback_srt(text, probe_duration(out_path), srt_path)
        return out_path.exists() and out_path.stat().st_size > 200
    except Exception:
        return False


def run_macos_say_fallback(text: str, atempo: float, out_path: Path, srt_path: Path | None) -> bool:
    try:
        with tempfile.TemporaryDirectory(prefix="zono-say-") as tmp:
            aiff_path = Path(tmp) / "speech.aiff"
            rate_wpm = int(round(185 * atempo))
            subprocess.run(["say", "-v", "Linh", "-r", str(rate_wpm), "-o", str(aiff_path), text], check=True)
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(aiff_path), "-codec:a", "libmp3lame", "-qscale:a", "2", str(out_path)],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
        if srt_path:
            write_fallback_srt(text, probe_duration(out_path), srt_path)
        return out_path.exists() and out_path.stat().st_size > 200
    except Exception:
        return False


def main():
    parser = argparse.ArgumentParser(description="ZONO VieNeu-TTS CLI")
    parser.add_argument("--list-voices", action="store_true", help="In danh sách giọng đọc VieNeu-TTS")
    parser.add_argument("--voice", default="Ngọc Huyền", help="Tên hoặc mã giọng đọc VieNeu-TTS")
    parser.add_argument("--ref-audio", default=None, help="File âm thanh mẫu (3-8s) để clone giọng")
    parser.add_argument("--ref-text", default=None, help="Nội dung văn bản của file âm thanh mẫu (nếu có)")
    parser.add_argument("--file", default=None, help="Đường dẫn file văn bản kịch bản")
    parser.add_argument("--text", default=None, help="Chuỗi văn bản cần đọc")
    parser.add_argument("--rate", default=None, help="Tốc độ đọc (VD: +0%%, 1.0)")
    parser.add_argument("--write-media", required=False, help="Đường dẫn file âm thanh đầu ra (.mp3 / .wav)")
    parser.add_argument("--write-subtitles", required=False, help="Đường dẫn file phụ đề .srt đầu ra (tùy chọn)")
    args = parser.parse_args()

    if args.list_voices:
        print(json.dumps(VOICE_LIST, ensure_ascii=False, indent=2))
        return

    text = ""
    if args.file:
        text = Path(args.file).read_text(encoding="utf-8").strip()
    elif args.text:
        text = args.text.strip()
    if not text:
        sys.stderr.write("Thiếu văn bản đầu vào (--file hoặc --text)\n")
        sys.exit(2)
    if not args.write_media:
        sys.stderr.write("Thiếu đường dẫn đầu ra (--write-media)\n")
        sys.exit(2)

    out_path = Path(args.write_media).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    srt_path = Path(args.write_subtitles).resolve() if args.write_subtitles else None
    rate_pct, atempo = parse_rate_pct(args.rate)

    # 1. Nếu có --ref-audio (Zero-Shot Voice Cloning), ưu tiên chạy model Vieneu local
    if args.ref_audio and os.path.exists(args.ref_audio):
        if run_vieneu_local(text, args.voice, args.ref_audio, args.ref_text, atempo, out_path, srt_path):
            return

    # 2. Chạy Neural Vietnamese TTS tốc độ cao (edge-tts ~0.5s/câu, kèm word boundary subtitles)
    try:
        if asyncio.run(run_edge_tts(text, args.voice, rate_pct, out_path, srt_path)):
            return
    except Exception:
        pass

    # 3. Fallback sang model Vieneu local hoặc macOS say nếu mất mạng
    if run_vieneu_local(text, args.voice, args.ref_audio, args.ref_text, atempo, out_path, srt_path):
        return
    if run_macos_say_fallback(text, atempo, out_path, srt_path):
        return

    sys.stderr.write("Không thể tổng hợp giọng đọc tiếng Việt từ mọi engine.\n")
    sys.exit(1)


if __name__ == "__main__":
    main()
