#!/usr/bin/env python3
"""Đóng gói BẢN CÀI TRẮNG của ZONO Agentic AI: mã nguồn + skill + bộ cài, KHÔNG kèm dữ liệu / khóa / DNA của doanh nghiệp nào.

  python3 scripts/package-blank.py --out <thư mục> [--pg-runtime <thư mục runtime/pgsql của Windows>]

Tạo 2 file zip:
  ZONO-Agentic-AI-Mac-Trang-<ngày>.zip      cài bằng CAI-DAT-MAC.command (PostgreSQL cài qua Homebrew)
  ZONO-Agentic-AI-Windows-Trang-<ngày>.zip  cài bằng INSTALL.cmd; cần --pg-runtime (PostgreSQL 17 Windows đóng gói sẵn:
                                            thư mục có bin/pg_ctl.exe, lib, share — lấy từ runtime/pgsql của một bản cài Windows)

Nguồn là các tệp git đang theo dõi ở HEAD (kèm thay đổi chưa commit của tệp đã theo dõi), nên không thể lọt .env, data/, node_modules.
Bỏ thêm phần riêng của ZONO: các skill trong ZONO_SKILLS và `config/zono-workspace.json`. Máy cài chạy SEED_MODE=fresh.
"""
import argparse
import hashlib
import os
import stat
import subprocess
import sys
import zipfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOP = "ZONO-Agentic-AI"
# Phần riêng của ZONO không đưa vào bản trắng (đường dẫn tương đối, dấu /)
# Skill viết riêng cho thương hiệu / sản phẩm của ZONO (DNA, quy tắc phòng, kịch bản bán khóa ABS, SEO zono.vn, Autovis…)
ZONO_SKILLS = ("zono-dna", "phong-marketing", "zono-seo-workflow", "zono-landing-builder", "lead-qualifier-zono", "abs-sales-agent",
               "follow-up-sequence-abs", "ntk-seo-writer", "autovis-script")
DROP_PREFIX = tuple(f"assets/claude/skills/{k}/" for k in ZONO_SKILLS) + ("config/zono-workspace.json", ".claude/", ".github/")
# Phải KHÔNG có trong gói — kiểm lại sau khi nén
FORBIDDEN = (".env", "data/dotaka.db", "services/zl-crm/backend/.env", "config/zono-workspace.json", "HANDOFF.md", "PACKAGE-INFO.json")
FORBIDDEN_PREFIX = ("data/brain/", "data/creative/", "data/uploads/", "data/publishing/", "data/assistant/", "data/backups/", "_restore/",
                    "services/zl-crm/data/", "services/video-ai/", "node_modules/") + tuple(f"assets/claude/skills/{k}/" for k in ZONO_SKILLS)
MAC_ONLY = {"CAI-DAT-MAC.command", "CHAY-ZONO.command"}
WIN_ONLY = {"INSTALL.cmd", "start-zono.cmd", "scripts/install-windows.ps1"}
EXECUTABLE = MAC_ONLY | {"scripts/bootstrap.mjs"}
WIN_CRLF = {"INSTALL.cmd", "start-zono.cmd"}
WIN_BOM_CRLF = {"scripts/install-windows.ps1"}
STORED_SUFFIX = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".mp3", ".woff2", ".zip", ".gz")


def tracked_files() -> list[str]:
    out = subprocess.run(["git", "-c", "core.quotepath=false", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout
    files = [f for f in out.decode("utf-8").split("\0") if f]
    # tệp mới của bộ cài chưa commit vẫn phải có trong gói
    extra = subprocess.run(["git", "-c", "core.quotepath=false", "ls-files", "-z", "-o", "--exclude-standard", "--", *sorted(MAC_ONLY), "CAI-DAT.md", "scripts/package-blank.py"],
                           cwd=ROOT, capture_output=True, check=True).stdout
    files += [f for f in extra.decode("utf-8").split("\0") if f]
    return sorted(set(f for f in files if not f.startswith(DROP_PREFIX) and (ROOT / f).is_file()))


def content(rel: str, windows: bool) -> bytes:
    data = (ROOT / rel).read_bytes()
    if windows and (rel in WIN_CRLF or rel in WIN_BOM_CRLF):
        text = data.decode("utf-8-sig").replace("\r\n", "\n").replace("\n", "\r\n")
        return (b"\xef\xbb\xbf" if rel in WIN_BOM_CRLF else b"") + text.encode("utf-8")
    return data


def build(zip_path: Path, files: list[str], windows: bool, pg_runtime: Path | None) -> dict:
    part = zip_path.with_suffix(".zip.part")
    count = size = 0
    with zipfile.ZipFile(part, "w", zipfile.ZIP_DEFLATED, compresslevel=9, allowZip64=True) as zf:
        def put(arc_rel: str, data: bytes, mode: int) -> None:
            nonlocal count, size
            zi = zipfile.ZipInfo(f"{TOP}/{arc_rel}", date_time=datetime.now().timetuple()[:6])
            zi.external_attr = (stat.S_IFREG | mode) << 16
            zi.create_system = 3  # giữ quyền chạy (chmod +x) khi giải nén trên macOS / Linux
            zi.compress_type = zipfile.ZIP_STORED if arc_rel.lower().endswith(STORED_SUFFIX) else zipfile.ZIP_DEFLATED
            zf.writestr(zi, data)
            count += 1
            size += len(data)

        for rel in files:
            if (windows and rel in MAC_ONLY) or (not windows and rel in WIN_ONLY):
                continue
            put(rel, content(rel, windows), 0o755 if rel in EXECUTABLE else 0o644)
        if windows:
            assert pg_runtime is not None
            for dp, _dns, fns in os.walk(pg_runtime):
                for fn in fns:
                    p = Path(dp) / fn
                    put(f"runtime/pgsql/{p.relative_to(pg_runtime).as_posix()}", p.read_bytes(), 0o644)

    with zipfile.ZipFile(part) as zf:
        bad = zf.testzip()
        names = {n[len(TOP) + 1:] for n in zf.namelist()}
    if bad:
        sys.exit(f"ZIP LỖI tại {bad}")
    leaked = [n for n in names if n in FORBIDDEN or n.startswith(FORBIDDEN_PREFIX)]
    if leaked:
        sys.exit("LỌT dữ liệu vào gói: " + ", ".join(sorted(leaked)[:10]))
    required = ["package.json", "pnpm-lock.yaml", ".env.example", "CAI-DAT.md", "scripts/bootstrap.mjs", "scripts/dev.mjs",
                "services/zl-crm/backend/.env.zono.example", "services/zl-crm/backend/package-lock.json", "apps/api/src/server.ts"]
    required += (["INSTALL.cmd", "start-zono.cmd", "scripts/install-windows.ps1", "runtime/pgsql/bin/pg_ctl.exe", "runtime/pgsql/bin/initdb.exe",
                  "runtime/pgsql/bin/postgres.exe", "runtime/pgsql/bin/psql.exe", "runtime/pgsql/bin/createdb.exe"]
                 if windows else ["CAI-DAT-MAC.command", "CHAY-ZONO.command"])
    missing = [r for r in required if r not in names]
    if missing:
        sys.exit("THIẾU trong gói: " + ", ".join(missing))
    part.replace(zip_path)
    h = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    zip_path.with_name(zip_path.name + ".sha256").write_text(f"{h} *{zip_path.name}\n")
    return {"files": count, "bytes": size, "zip": zip_path.stat().st_size, "sha256": h}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--pg-runtime", help="thư mục runtime/pgsql (PostgreSQL 17 Windows). Bỏ trống = chỉ đóng gói bản Mac")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    files = tracked_files()
    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    print(f"Nguồn: {len(files)} tệp git theo dõi, commit {commit}")
    targets = [("Mac", False, None)]
    if a.pg_runtime:
        pg = Path(a.pg_runtime)
        if not (pg / "bin" / "pg_ctl.exe").exists():
            sys.exit(f"Không thấy {pg / 'bin' / 'pg_ctl.exe'}")
        targets.append(("Windows", True, pg))
    for label, windows, pg in targets:
        z = out / f"ZONO-Agentic-AI-{label}-Trang-{stamp}.zip"
        info = build(z, files, windows, pg)
        print(f"XONG {z.name}: {info['files']} tệp, {info['bytes'] / 1e6:.0f} MB gốc → {info['zip'] / 1e6:.0f} MB · sha256 {info['sha256'][:16]}…")


if __name__ == "__main__":
    main()
