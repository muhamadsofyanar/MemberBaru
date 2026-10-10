# RIZQHUB Membership 1.3.0

Untuk upgrade app.rizqhub.id, ikuti [UPGRADE-APP-RIZQHUB.md](UPGRADE-APP-RIZQHUB.md). Port terbaru **8000**, private storage **/data/private**, database **PostgreSQL**. Petunjuk lama di bawah menggambarkan paket sebelum penyesuaian.

# Instalasi, upgrade, dan operasional

## Upgrade ke 1.2.0 (dari 1.1.0 — **WAJIB dibaca sebelum deploy 1.2.0**)

> **URUTAN KERJA PRODUKSI**: BACKUP dulu (DB + storage private) → apply SQL `prisma/upgrade/1.2.0.sql` VIA `psql` — JANGAN pakai `prisma db push` di produksi, sebab push tidak menjalankan **data migration** (pemindahan data order/plan lama ke model baru Product, OrderItem, OrderGrant, Entitlement). Setelah SQL sukses, baru deploy kode + prisma generate + prisma seed (idempoten).

### Ringkasan checklist upgrade 1.2.0 (produksi)

- [x] **Backup database Postgres** (dump format custom `.Fc`)
- [x] **Backup folder storage/private** (berisi asset produk + bukti transfer lama)
- [x] **Jalankan SQL upgrade aditif** `prisma/upgrade/1.2.0.sql` via psql terhadap database produksi
- [x] Deploy kode 1.2.0 (Coolify / git push)
- [x] Deploy otomatis akan menjalankan `prisma generate` (build script) dan skema client
- [x] Jalankan **sekali** `npx prisma db seed` (atau via container shell) → idempoten: upsert `order_expiry_hours = 24`, Product MEMBERSHIP legacy per Plan, sample ebook DRAFT
- [x] **Setup cron 1×/jam** `node scripts/maintenance.mjs` → expire PENDING expired + lepas reservasi kupon orphan
- [x] Asap hijau: login admin → /admin/products ada 3 Product MEMBERSHIP legacy (nama tiap paket) → uji buat ebook → upload PDF → buka /products di browser → checkout → upload bukti → approve → /dashboard/products ada entitlement ASSET → unduh file sukses

---

## Detail langkah demi langkah upgrade 1.2.0

### 1. Backup database (Docker Compose — produksi)

```bash
cd /path/to/compose
TS=$(date +%Y%m%d-%H%M%S)
docker compose exec -T postgres pg_dump -U postgres -d rizqhub -Fc > "backup-rizqhub-1.2.0-pre-${TS}.dump"
# simpan backup ke server luar / object storage terpisah
```

Uji restore ke database staging KOSONG (wajib sebelum produksi):

```bash
# buat DB restore test dulu
docker compose exec -T postgres createdb -U postgres rizqhub_restore_120 || true
docker compose exec -T postgres pg_restore -U postgres -d rizqhub_restore_120 --no-owner < "backup-rizqhub-1.2.0-pre-${TS}.dump"
```

### 2. Backup storage private (asset PDF/ZIP + bukti transfer)

```bash
cd /path/to/compose/volumes   # atau dimana folder storage/private di-mount
TS=$(date +%Y%m%d-%H%M%S)
tar -czf "storage-private-1.2.0-pre-${TS}.tar.gz" storage/private/
```

### 3. **APPLY SQL VIA PSQL** — JANGAN PAKAI `prisma db push`

File upgrade: `prisma/upgrade/1.2.0.sql`. Isi file ini **ADITIF SEMUA** (CREATE TABLE, ALTER TABLE ADD COLUMN, CREATE INDEX, INSERT … ON CONFLICT DO NOTHING, UPDATE idempoten). Tidak ada DROP kolom/tabel.

Cara menjalankan dari host (Docker Compose):

```bash
# pastikan file tersedia di container atau copy dulu:
docker compose cp prisma/upgrade/1.2.0.sql postgres:/tmp/1.2.0.sql
docker compose exec -T postgres psql -U postgres -d rizqhub -v ON_ERROR_STOP=1 -f /tmp/1.2.0.sql
```

Atau dari luar (psql client installed):

```bash
psql "postgresql://user:pass@host:5432/rizqhub" -v ON_ERROR_STOP=1 -f prisma/upgrade/1.2.0.sql
```

Jika error (misal constraint conflict):
1. **JANGAN LANJUT DEPLOY 1.2.0** sebelum error SQL diselesaikan
2. Restore backup DB dan backup storage → kembali ke 1.1.0 stabil
3. Kirim error ke tim engineering untuk dianalisis

### 4. Deploy kode 1.2.0 + prisma generate + seed

Build script di `package.json` sudah menjalankan `prisma generate && next build`.
Setelah deploy aplikasi hidup, jalankan **seed 1x** (idempoten):

```bash
# dalam container aplikasi (Coolify / Docker)
node --import tsx prisma/seed.ts
```

Seed 1.2.0 menjalankan:
- `upsert Setting.order_expiry_hours = 24`
- `upsert Product MEMBERSHIP legacy` per Plan (unique `legacyPlanId`) — paket lama muncul di admin produk & katalog
- sample produk ebook DRAFT dengan harga contoh (untuk uji upload PDF / publish; aman untuk dihapus)

### 5. Setup cron maintenance (ORDER EXPIRED + coupon reservation release)

**REKOMENDASI: setiap 1 JAM (bisa 5–10 menit gap di awal order trial).** Contoh crontab:

```cron
2 * * * * cd /path/to/app && /usr/bin/node scripts/maintenance.mjs >> /var/log/rizqhub-maintenance.log 2>&1
```

Apa dilakukan script:
- Set `Order.status='EXPIRED'` WHERE status='PENDING' AND expiresAt < NOW(); reviewAt = NOW()
- Hapus `CouponReservation` order EXPIRED (release quota kembali)
- Hapus orphan `CouponReservation` dimana order.status NOT IN (PENDING,PAID) AND usedAt IS NULL (misal order REJECTED, EXPIRED, batal manual)

---

## Instalasi baru (Coolify) — 1.2.0 fresh install

1. Upload kode ke repo (jangan sertakan `.env`, `node_modules/`, `.next/`, `storage/`)
2. Deploy dengan Docker Compose `docker-compose.yml` di repo (Postgres + Next.js app)
3. Isi **environment variables** lengkap:
   - `AUTH_SECRET` — string acak **MINIMAL 32 karakter**
   - `DATABASE_URL` — postgresql://user:pass@postgres:5432/rizqhub?schema=public
   - `PRIVATE_STORAGE_DIR` — absolute path ke folder storage privat (misalnya `/data/private`); pastikan volume di-mount
   - `NEXT_PUBLIC_APP_URL` — origin domain HTTPS penuh (misal `https://rizqhub.id`), tanpa trailing slash
   - `ADMIN_EMAIL` (opsional) — untuk seed admin default
   - `ADMIN_PASSWORD` (opsional) — default admin pada seed (min 12)
   - SMTP (optional reset password): `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
   - Starsender WA (optional): `STARSENDER_API_URL`, `STARSENDER_API_KEY`, `STARSENDER_DEVICE_ID`
4. HTTPS aktifkan. `NEXT_PUBLIC_APP_URL` WAJIB sama persis domain final.
5. Setelah hidup:
   - Apply skema (instalasi BARU BOLEH gunakan `prisma db push` sekali saja di DB KOSONG):
     ```
     npx prisma db push
     ```
   - Jalankan seed: `node --import tsx prisma/seed.ts`
   - Uji login admin. Buka Pengaturan → isi rekening bank.
   - Akses `/api/health` harus return OK.

### Catatan routing Coolify

- Arahkan domain ke service `app` pada port internal `8000`.
- Compose memakai `expose: 8000`, sehingga port tidak dipublikasikan langsung ke host dan tidak bentrok dengan aplikasi lain.
- Tunggu health check menjadi `healthy`. Endpoint yang diperiksa adalah `/api/health`.
- Maintenance tidak dijalankan saat startup. Jadwalkan `node scripts/maintenance.mjs` sebagai cron terpisah agar kegagalan maintenance tidak mematikan web server.

---

## Rollback 1.2.0 kembali ke 1.1.0

Kapan perlu: terjadi bug kritis / error order setelah upgrade dan tidak bisa ditunggu hotfix.

1. Stop aplikasi / hapus deploy 1.2.0.
2. Restore database dari backup **1.2.0-pre** dibuat sebelum upgrade.
   ```
   pg_restore -U postgres -d rizqhub --clean --no-owner < backup-rizqhub-1.2.0-pre-xxxx.dump
   ```
3. Restore folder `storage/private/` dari backup tarball sebelum upgrade.
4. Deploy ulang kode **tag v1.1.0** lama.
5. Semua order 1.1.0 kembali utuh. Order 1.2.0 yang terlanjur dibuat antara upgrade sampai rollback **hilang** (karena restore backup lama); simpan backup 1.2.0 post-upgrade jika perlu audit manual.

---

## Operasional harian (1.2.0)

- **Pembayaran manual verifikasi admin:** Admin → Pembayaran → bukti transfer → Approve. Reject jika tidak sesuai.
  - *Catatan 1.2.0:* Jalur approve sekarang **menjalankan branch otomatis** jika order legacy=true ATAU planId tidak null dan items kosong → legacy flow lama. Jika items.length ≥ 1 (order produk 1.2.0), approval membuat Entitlement (unique composite) + OrderGrant snapshot + Membership (bila grant PLAN) + Commission (per item affiliatePercent order). Dedupe Plan (Set planSeen) agar tidak 2 Membership sekaligus.
- **Admin Produk:** Tambah produk, unggah PDF/ZIP asset, hubungkan ke Kursus untuk COURSE, hubungkan ke Plan untuk MEMBERSHIP, susun Bundel.
- **Admin Kupon:** Buat kode kupon persen/fixed, set kuota, tanggal aktif, batasi ke produk tertentu atau semua PUBLISHED.
- **Batas harga:** Harga produk minimal Rp1. Total setelah diskon minimal Rp1. Order 0 rupiah tidak didukung.
- **Batas ukuran unggah:** asset produk 50 MiB / file; bukti transfer user 2 MiB.

---

## Backup rutin (produksi rekomendasi)

- **Database:** minimal 1×/hari, simpan offsite ≥ 30 hari. Simpan versi saat deploy baru, sebelum upgrade, dan saat maintenance besar.
- **Storage private (asset + bukti):** sinkronisasi ke object storage (misal S3-compatible) 1×/hari.
- **Cron backup script:**
  ```bash
  #!/bin/bash
  TS=$(date +%Y%m%d-%H%M%S)
  cd /data/rizqhub
  docker compose exec -T postgres pg_dump -U postgres -d rizqhub -Fc | gzip -c > offsite/rizqhub-db-${TS}.dump.gz
  tar -czf "offsite/storage-${TS}.tar.gz" ./storage/private/
  # upload offsite ...
  ```
