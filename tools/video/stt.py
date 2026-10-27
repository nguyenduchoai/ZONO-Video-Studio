#!/usr/bin/env python3
"""Transcribe clips (Vietnamese by default) with faster-whisper.
Prints JSON [{file, language, prob, text}]; with --srt=<dir> also writes <name>.srt subtitles per file.
Audio is decoded with the ffmpeg binary (not PyAV): faster-whisper 1.2.x passes options newer PyAV removed,
and PyAV has no wheels for every Python version — ffmpeg works everywhere."""
import json, os, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel

args = sys.argv[1:]
files = [a for a in args if not a.startswith("--")]
opt = lambda k, d=None: next((a.split("=", 1)[1] for a in args if a.startswith(f"--{k}=")), d)
lang = opt("lang", "vi")
srt_dir = opt("srt")
model = WhisperModel(opt("model", "small"), device="cpu", compute_type="int8")


def load_audio(path: str) -> np.ndarray:
    pcm = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(pcm, dtype=np.float32)


def ts(t: float) -> str:
    h, rem = divmod(int(t * 1000), 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, ms = divmod(rem, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


out = []
for f in files:
    segs, info = model.transcribe(load_audio(f), language=None if lang == "auto" else lang, vad_filter=True)
    segs = list(segs)
    if srt_dir:
        os.makedirs(srt_dir, exist_ok=True)
        name = os.path.splitext(os.path.basename(f))[0]
        with open(os.path.join(srt_dir, f"{name}.srt"), "w", encoding="utf-8") as fh:
            for i, s in enumerate(segs, 1):
                fh.write(f"{i}\n{ts(s.start)} --> {ts(s.end)}\n{s.text.strip()}\n\n")
    out.append({"file": f, "language": info.language, "prob": round(info.language_probability, 2), "text": " ".join(s.text.strip() for s in segs)})
print(json.dumps(out, ensure_ascii=False))
