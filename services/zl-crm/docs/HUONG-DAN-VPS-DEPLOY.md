# Hướng dẫn deploy ZaloCRM lên VPS — Resource sizing

> Số liệu đo trực tiếp từ container production (`docker stats`, `docker images`, `docker system df -v`) tại **2026-05-19** trên main HEAD `c318a22` (sau khi merge ui-phase5 + inbox-triage + appointments).
> Đọc khi: chọn gói VPS, plan storage, capacity planning, debug performance.

---

## 📋 Tóm tắt nhanh

| Trạng thái | Disk | RAM | CPU |
|---|---:|---:|---:|
| **Cài đặt ban đầu** (image + DB rỗng) | ~3 GB | — | — |
| **Idle** (no traffic) | — | **~290 MB** | <1% |
| **Light traffic** (5 sale active) | +30 GB/năm | 600–1000 MB | 5–10% (1 vCPU) |
| **Heavy** (15 sale + 30 nick realtime) | +150 GB/năm | 1.2–1.8 GB | 30–60% (2–3 vCPU peak) |

**Sweet spot khuyến nghị cho production:** **2–4 vCPU / 4 GB RAM / 80 GB SSD**

---

## 1️⃣ Disk — Lúc cài đặt

| Thành phần | Size |
|---|---:|
| Docker image `zalocrm-app` (Node 20 + frontend bundle + backend dist + node_modules ~580 MB) | **1.18 GB** |
| Image `postgres:16-alpine` | 395 MB |
| Image `minio/minio:latest` | 241 MB |
| Image `prodrigestivill/postgres-backup-local` | 665 MB |
| **Tổng images** | **~2.5 GB** |
| Source code (clone về, có .git) | ~17 MB |
| **Disk khởi tạo** | **~3 GB** |

## 2️⃣ Disk — Tăng theo thời gian

| Khoản | 5 sale · ~5K msg/tháng | 15 sale · ~30K msg/tháng |
|---|---:|---:|
| Postgres data (messages, contacts, scoring, auto-tags) | +50–150 MB/tháng | +300–800 MB/tháng |
| Minio attachments (ảnh, voice, file Zalo) | +1–3 GB/tháng | +5–15 GB/tháng |
| Postgres backups (7 daily + 4 weekly + 3 monthly) | ~2–3 GB rolling | ~10–15 GB rolling |
| Docker logs + tmpfs | ~500 MB | ~1 GB |
| **Tổng năm đầu** | **~30 GB** | **~150 GB** |

> ⚠ **Minio phình nhanh nhất** (60–80% tổng disk). Khi vượt 50 GB → tách `minio_data` volume sang block storage riêng hoặc thay bằng S3-compatible cloud (Cloudflare R2, Backblaze B2).

## 3️⃣ RAM — Đã đo idle

```
zalo-crm-app    (Node/Fastify)        ~130 MB
zalo-crm-db     (Postgres)            ~80 MB
zalo-crm-minio  (object storage)      ~75 MB
zalo-crm-backup (cron pg_dump)        ~5 MB
─────────────────────────────────────────────
                Tổng idle:            ~290 MB
```

## 4️⃣ RAM — Khi vận hành

| Container | Idle | Light traffic | Heavy (15 sale + 30 nick) |
|---|---:|---:|---:|
| `app` (Fastify + Zalo socket + worker) | 130 MB | 250–400 MB | 500–800 MB |
| `db` (Postgres + 50 conn pool, shared_buffers 128MB) | 80 MB | 200–350 MB | 400–600 MB |
| `minio` | 75 MB | 100–200 MB | 200–400 MB |
| `backup` | 5 MB | 5 MB | 50 MB (lúc dump) |
| **Tổng** | **~290 MB** | **~600–1000 MB** | **~1.2–1.8 GB** |

## 5️⃣ CPU

| Tình huống | CPU |
|---|---|
| Idle (dashboard, không chat realtime) | <1% |
| 5 sale chat đồng thời, Zalo socket realtime | 5–10% (1 vCPU) |
| 15 sale + 30 nick realtime + auto-tag cron đang chạy | 30–60% (2–3 vCPU peak) |
| Cron daily backup (`pg_dump`) | 10–30% spike trong 1–5 phút |

---

## 🎯 Khuyến nghị VPS theo quy mô

| Quy mô | vCPU | RAM | SSD | Bandwidth | Provider tham khảo |
|---|---:|---:|---:|---|---|
| **Test / staging / 1–3 sale** | 2 | 2 GB | 40 GB | 1 TB | Vultr/DO $12, Hetzner CX22 €4.5 |
| **Production · 5–10 sale** ⭐ | 2–4 | 4 GB | 80 GB | 2 TB | DO $24, Hetzner CX32 €7 |
| **Production · 10–20 sale** | 4 | 8 GB | 160 GB | 5 TB | DO $48, Hetzner CX42 €15 |
| **Scale · >20 sale + heavy media** | 6–8 | 16 GB | 320 GB | 10 TB | DO $96, Hetzner CX52 €27 |

---

## ⚠ Note vận hành không thấy trong số đo

1. **Mỗi Zalo nick realtime giữ ~30–60 MB RAM** trong Node app (socket + cache). Nếu >30 nick, cân nhắc tách worker process hoặc tăng RAM.
2. **Redis chưa bật** (profile `redis` trong `docker-compose.yml`). Bật từ >10 sale để giảm tải Postgres — thêm ~70 MB RAM, `--maxmemory 64mb`.
3. **Backup giữ 14 bản** (7 daily + 4 weekly + 3 monthly). Nếu DB 1 GB → backup chiếm ~14 GB. Giảm `BACKUP_KEEP_*` nếu disk hẹp.
4. **Network egress** (gửi Zalo + media): 5–50 GB/tháng/active sale. Check bandwidth limit của provider.
5. **Postgres tuning** (đã set trong compose): `shared_buffers=128MB`, `effective_cache_size=256MB`, `max_connections=50` — đủ cho 5–15 sale. Tăng khi scale.

## 🛠 Các lệnh đo lại

```bash
# Image size
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# Container CPU/RAM live
docker stats --no-stream

# Volume size
docker system df -v

# Postgres size
docker exec zalo-crm-db psql -U crmuser -d zalocrm -c "SELECT pg_size_pretty(pg_database_size('zalocrm'));"

# Minio size
docker exec zalo-crm-minio du -sh /data
```

---

**Last measured:** 2026-05-19 · Host VPS test: 20 vCPU / 15.55 GB RAM. Repeat measurement định kỳ khi scale up team hoặc volume data tăng đáng kể.
