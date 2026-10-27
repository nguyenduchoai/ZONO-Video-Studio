#!/usr/bin/env python3
"""
VieNeu-TTS CLI wrapper for ZONO Agentic AI (`zono-vieneu-tts`).
Supports:
  - Preset Vietnamese voices across Northern, Central, and Southern accents (`--voice`)
  - Instant Zero-Shot Voice Cloning from a 3-8s reference audio (`--ref-audio`)
  - Listing all available voices (`--list-voices`)
  - Direct MP3 / WAV export (`--file script.txt --write-media voice.mp3`)
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

# Mapping of friendly aliases & legacy IDs to VieNeu-TTS preset names/IDs
VOICE_ALIASES = {
    "ngoc-huyen": "Ngọc Huyền",
    "thanh-binh": "Thanh Bình",
    "pham-tuyen": "Phạm Tuyên",
    "xuan-vinh": "Xuân Vĩnh",
    "ngoc-linh": "Ngọc Linh",
    "doan-trang": "Đoan Trang",
    "truc-ly": "Trúc Ly",
    "ngoc-tran": "Ngọc Trân",
    "quang-son": "Quang Sơn",
    "binh": "Binh",
    "tuyen": "Tuyen",
    "vinh": "Vinh",
    "ngoc": "Ngoc",
    "ly": "Ly",
    "doan": "Doan",
    # Compatibility mapping if any old caller passes Edge TTS voice names
    "vi-VN-HoaiMyNeural-Female": "Ngọc Huyền",
    "vi-VN-HoaiMyNeural": "Ngọc Huyền",
    "vi-VN-NamMinhNeural-Male": "Thanh Bình",
    "vi-VN-NamMinhNeural": "Thanh Bình",
}


def resolve_voice(tts, requested: str | None):
    if not requested:
        return None
    target = VOICE_ALIASES.get(requested.strip(), requested.strip())
    target_lower = target.lower()

    try:
        presets = tts.list_preset_voices() or []
    except Exception:
        presets = []

    # presets is typically a list of (description, voice_id) tuples or dicts
    chosen_id = None
    for item in presets:
        if isinstance(item, (tuple, list)) and len(item) >= 2:
            desc, vid = str(item[0]), str(item[1])
        elif isinstance(item, dict):
            vid = str(item.get("id") or item.get("voice_id") or "")
            desc = str(item.get("description") or item.get("name") or vid)
        else:
            desc, vid = str(item), str(item)

        if target_lower == vid.lower() or target_lower in desc.lower():
            chosen_id = vid
            break

    if chosen_id and hasattr(tts, "get_preset_voice"):
        try:
            return tts.get_preset_voice(chosen_id)
        except Exception:
            return chosen_id

    if hasattr(tts, "get_preset_voice"):
        try:
            return tts.get_preset_voice(target)
        except Exception:
            pass
    return target


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
    args = parser.parse_args()

    try:
        from vieneu import Vieneu
    except ImportError:
        sys.stderr.write(
            "Chưa cài thư viện `vieneu` (VieNeu-TTS). Chạy: `pnpm video-ai:install` hoặc `pip install vieneu`.\n"
        )
        sys.exit(2)

    tts = Vieneu()

    if args.list_voices:
        voices = []
        try:
            for item in tts.list_preset_voices() or []:
                if isinstance(item, (tuple, list)) and len(item) >= 2:
                    voices.append({"label": str(item[0]), "id": str(item[1])})
                else:
                    voices.append({"label": str(item), "id": str(item)})
        except Exception as e:
            sys.stderr.write(f"Không lấy được danh sách giọng: {e}\n")
        print(json.dumps(voices, ensure_ascii=False, indent=2))
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

    voice_obj = None
    if args.ref_audio and os.path.exists(args.ref_audio):
        if hasattr(tts, "encode_reference"):
            voice_obj = tts.encode_reference(args.ref_audio)
    else:
        voice_obj = resolve_voice(tts, args.voice)

    with tempfile.TemporaryDirectory(prefix="zono-vieneu-") as tmp:
        wav_path = Path(tmp) / "raw.wav"
        infer_kwargs = {"text": text}
        if voice_obj is not None:
            infer_kwargs["voice"] = voice_obj
        if args.ref_audio and voice_obj is None:
            infer_kwargs["ref_audio"] = args.ref_audio
            if args.ref_text:
                infer_kwargs["ref_text"] = args.ref_text

        audio = tts.infer(**infer_kwargs)
        tts.save(audio, str(wav_path))

        # Parse optional speed/rate adjustment (e.g. "+8%" -> 1.08, "1.05" -> 1.05)
        atempo = 1.0
        if args.rate:
            r = str(args.rate).strip()
            m_pct = re.match(r"^([+-]?\d+(?:\.\d+)?)%$", r)
            if m_pct:
                atempo = max(0.5, min(2.0, 1.0 + float(m_pct.group(1)) / 100.0))
            else:
                try:
                    atempo = max(0.5, min(2.0, float(r)))
                except ValueError:
                    atempo = 1.0

        if out_path.suffix.lower() == ".wav" and abs(atempo - 1.0) < 0.01:
            wav_path.replace(out_path)
        else:
            ff_cmd = ["ffmpeg", "-y", "-i", str(wav_path)]
            if abs(atempo - 1.0) >= 0.01:
                ff_cmd += ["-filter:a", f"atempo={atempo:.3f}"]
            if out_path.suffix.lower() == ".mp3":
                ff_cmd += ["-codec:a", "libmp3lame", "-qscale:a", "2"]
            ff_cmd.append(str(out_path))
            subprocess.run(ff_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


if __name__ == "__main__":
    main()
