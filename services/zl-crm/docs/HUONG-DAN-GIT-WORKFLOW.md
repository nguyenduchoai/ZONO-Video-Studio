# Hướng dẫn Git workflow — hsholding fork

> Tài liệu nội bộ cho HS Holding khi phát triển song song với upstream `dmman16pn/ZaloCRM`.
> Đọc khi: setup máy mới, chuẩn bị push code, đóng góp ngược upstream, sync update từ Dương Minh Mẫn.

---

## 📋 Cấu trúc remote + branches hiện tại

### Hai remote

| Remote | URL | Quyền | Mục đích |
|---|---|---|---|
| `fork` | `https://github.com/hsholding/ZaloCRM.git` | ✅ read + write | Push toàn bộ work của HS Holding |
| `origin` | `https://github.com/dmman16pn/ZaloCRM.git` | 🔒 chỉ read | Fetch updates từ dmman16pn về |

### Ba branches trên fork

| Branch | Vai trò | Khi nào dùng |
|---|---|---|
| **`main`** (default) | Core stable, production | Deploy + push các fix/feature đã ổn định |
| `upstream-mirror` | Read-only mirror của `origin/main` | Để review diff trước khi merge upstream về core |
| `feat/ui-phase5` | WIP popup edit + alias sync | Đang phát triển, chưa merge vào main |

### Tag restore

`stable-2026-05-18` → bản chốt ổn định ngày 18/05/2026 (v3.1.2 + Phase 6 + flicker fix). Restore bất cứ lúc nào:

```bash
git fetch fork --tags
git checkout stable-2026-05-18
```

---

## 🚀 Phát triển code hàng ngày (push lên đâu?)

**Luôn push lên `fork` (= `hsholding/ZaloCRM`)**. KHÔNG bao giờ push vào `origin` (dmman16pn) — không có quyền write.

### Cách 1: Test nhanh, sửa nhỏ → push thẳng main

```bash
git checkout main
git pull fork main                    # đảm bảo main mới nhất
# ... sửa code, commit ...
git push fork main                    # push thẳng nếu đã test docker xong
```

### Cách 2: Feature lớn, cần test riêng → branch + merge khi ổn

```bash
git checkout main
git pull fork main
git checkout -b feat/abc              # branch mới từ main

# Code + commit local — test thoải mái:
docker compose up -d --build
docker compose logs -f app

# Push branch lên fork để backup giữa chừng (optional):
git push fork feat/abc

# Khi feature đã ổn, merge vào main:
git checkout main
git merge feat/abc                    # hoặc squash merge
git push fork main
git branch -d feat/abc                # xoá branch local
git push fork --delete feat/abc       # xoá branch trên fork
```

### Cách 3: Tag bản ổn định để backup

```bash
git checkout main
git tag -a stable-YYYY-MM-DD -m "Mô tả ngắn: [feature/fix] có gì"
git push fork stable-YYYY-MM-DD
```

Sau này restore: `git checkout stable-YYYY-MM-DD`.

---

## 🔼 Đóng góp ngược lên upstream dmman16pn (Pull Request)

Dương Minh Mẫn phải tự click merge — anh không tự push vào repo của họ được.

### Khi nào nên PR ngược upstream?

| Loại work | Có nên PR? |
|---|---|
| Fix bug chung (ai cũng cần) | ✅ Nên — Dương Minh Mẫn + community được lợi |
| Performance fix (vd flicker fix) | ✅ Nên |
| Refactor code core có lợi ích chung | ✅ Nên |
| Tính năng nội bộ HS Holding (vd Phase 6 scoring) | ❌ Giữ riêng trên fork |
| Custom UI theo brand HS | ❌ Giữ riêng |
| Sửa hard-code business logic của HS | ❌ Giữ riêng |

### Cách tạo PR (qua GitHub web)

1. Push lên fork: `git push fork main` (hoặc `feat/xxx`)
2. Mở **https://github.com/hsholding/ZaloCRM**
3. GitHub tự hiện banner *"Contribute"* → click *"Open pull request"*
4. Chọn:
   - **base repository**: `dmman16pn/ZaloCRM` — branch: `main`
   - **head repository**: `hsholding/ZaloCRM` — branch: `main` (hoặc `feat/abc`)
5. Viết:
   - **Title** ngắn gọn (vd `fix(chat): triệt để flicker cột 2 hội thoại`)
   - **Description** có: lý do, root cause, screenshot test, breaking changes (nếu có)
6. Click *"Create pull request"*
7. Đợi Dương Minh Mẫn review → merge / request changes / close

### Tip: PR từ feature branch focused — review nhẹ hơn

Thay vì PR cả `main` (có cả Phase 6 + custom HS), tạo branch riêng chỉ chứa commits muốn share:

```bash
# Tạo branch contrib mới từ upstream-mirror (sạch, chưa có HS work)
git checkout -b contrib/fix-chat-flicker upstream-mirror

# Cherry-pick chỉ commit muốn đóng góp:
git cherry-pick 8f50e1e

# Push lên fork:
git push fork contrib/fix-chat-flicker

# Vào GitHub → tạo PR từ contrib/fix-chat-flicker → dmman16pn:main
```

Dương Minh Mẫn review nhẹ hơn, dễ merge hơn vì branch chỉ chứa commit liên quan.

---

## 🔽 Sync update từ dmman16pn về fork

Khi Dương Minh Mẫn release version mới (v3.1.3, v3.2…) hoặc fix bug quan trọng. Quy trình **fetch → review → merge**.

### Bước 1: Fetch (không động vào main)

```bash
git fetch origin                          # lấy commits mới từ Dương Minh Mẫn
# KHÔNG merge tự động — chỉ download
```

### Bước 2: Update `upstream-mirror` để xem diff

```bash
git checkout upstream-mirror
git merge --ff-only origin/main           # mirror = upstream latest (chỉ fast-forward — an toàn)
git push fork upstream-mirror             # backup mirror lên fork

# Xem có gì mới giữa main và upstream-mirror:
git log main..upstream-mirror --oneline   # list commits mới
git diff main..upstream-mirror --stat     # list files thay đổi
git show <commit-hash>                    # đọc chi tiết 1 commit
```

### Bước 3: Quyết định merge vào main

**Cách A — Merge cả batch** (đơn giản, giữ lịch sử upstream):
```bash
git checkout main
git merge upstream-mirror
# Nếu conflict (vd Phase 6 sửa file Dương Minh Mẫn cũng sửa):
# → resolve manually, git add <file>, git commit
git push fork main
```

**Cách B — Cherry-pick từng commit** (kiểm soát chặt):
```bash
git checkout main
git cherry-pick abc1234 def5678          # chỉ lấy commit muốn
git push fork main
```

**Cách C — Bỏ qua commit không phù hợp**:
Nếu Dương Minh Mẫn có commit anh không muốn (vd breaking change, conflict nặng với Phase 6) → dùng cách B (cherry-pick) và bỏ commit đó. Fork sẽ diverge — chỉ sync khi cần.

### Khi nào nên sync upstream?

- ✅ Dương Minh Mẫn announce release mới (v3.1.3, v3.2…)
- ✅ Có security fix quan trọng
- ✅ Anh thấy bug ở upstream đã fix, anh cũng đang bị
- ⏰ Định kỳ mỗi 2-4 tuần để không bị tụt quá xa

---

## 🆘 Setup máy mới (clone repo)

```bash
# Clone fork (default remote name = origin → đổi thành fork cho rõ)
git clone https://github.com/hsholding/ZaloCRM.git
cd ZaloCRM
git remote rename origin fork

# Thêm upstream gốc của Dương Minh Mẫn (read-only)
git remote add origin https://github.com/dmman16pn/ZaloCRM.git

# Verify
git remote -v
# fork    https://github.com/hsholding/ZaloCRM.git (fetch)
# fork    https://github.com/hsholding/ZaloCRM.git (push)
# origin  https://github.com/dmman16pn/ZaloCRM.git (fetch)
# origin  https://github.com/dmman16pn/ZaloCRM.git (push)

# Fetch tags + upstream-mirror branch
git fetch fork --tags
git fetch origin
git checkout upstream-mirror

# Setup env + build
cp .env.example .env
# Sửa .env: JWT_SECRET, ENCRYPTION_KEY, DB_PASSWORD, MINIO_ROOT_PASSWORD
docker compose up -d --build
```

---

## 🎯 Cheat sheet — copy-paste khi cần

```bash
# ========== PHÁT TRIỂN HÀNG NGÀY ==========
git checkout main
git pull fork main                       # latest core
git checkout -b feat/abc                 # branch test riêng
# ... code, commit, test local docker ...
git push fork feat/abc                   # backup lên fork (chưa share upstream)

# Khi feature ổn → merge vào main:
git checkout main
git merge feat/abc
git push fork main

# ========== ĐÓNG GÓP CHO DƯƠNG MINH MẪN ==========
# Cherry-pick commits muốn đóng góp sang branch contrib:
git checkout -b contrib/fix-xxx upstream-mirror
git cherry-pick <hash>
git push fork contrib/fix-xxx
# → Vào https://github.com/hsholding/ZaloCRM → "Contribute" → "Open pull request"
# → Target: dmman16pn/ZaloCRM:main

# ========== LẤY UPDATE TỪ DƯƠNG MINH MẪN ==========
git fetch origin
git checkout upstream-mirror
git merge --ff-only origin/main
git push fork upstream-mirror
# Review:
git log main..upstream-mirror --oneline
git diff main..upstream-mirror --stat
# Merge khi sẵn sàng:
git checkout main
git merge upstream-mirror                # hoặc: git cherry-pick <hash>
git push fork main

# ========== TAG BACKUP ỔN ĐỊNH ==========
git tag -a stable-YYYY-MM-DD -m "Mô tả"
git push fork stable-YYYY-MM-DD

# ========== RESTORE VỀ BẢN ỔN ĐỊNH ==========
git fetch fork --tags
git checkout stable-2026-05-18           # hoặc tag khác
# Tạo branch mới từ tag (nếu muốn code tiếp):
git checkout -b restore-branch stable-2026-05-18
```

---

## ⚠️ Các điều CẤM / cần cẩn thận

| Hành động | Lý do |
|---|---|
| ❌ `git push origin` | Không có quyền — repo của Dương Minh Mẫn |
| ❌ `git push fork main --force` (không có lý do) | Mất history của teammates |
| ❌ Commit secret/`.env` vào git | Lộ password, JWT key, MinIO credentials |
| ⚠️ `git reset --hard` khi có uncommitted changes | Mất work — `git stash` trước |
| ⚠️ Force-push lên branch người khác đang dùng | Họ phải `git reset --hard` lại |
| ⚠️ Merge upstream-mirror vào main mà không review | Có thể kéo theo breaking change |

---

## 🔗 Tham khảo

- **Fork GitHub**: https://github.com/hsholding/ZaloCRM
- **Upstream gốc**: https://github.com/dmman16pn/ZaloCRM
- **README fork**: [../README.md](../README.md)
- **README upstream** (gốc Dương Minh Mẫn): xem phần dưới của README.md (line 175+)
