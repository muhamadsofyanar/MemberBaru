# 1.3.0 · app.rizqhub.id

- Tambah server lisensi software dan halaman admin/member.
- Tambah masa berlaku, domain activation, suspend dan reset.
- Tambah rilis versi, API update dan unduhan terlindungi.
- Tambah ekspor SQLite dan impor PostgreSQL dari Starter 0.1.
- Pertahankan password scrypt lama, gunakan bcrypt untuk password baru.
- Sesuaikan Coolify ke port 8000 dan private storage /data/private.
- Tolak path absolut Windows pada storage.

# CHANGELOG

## 1.2.0

**Tanggal rilis (rencana): 14 September 2026**

> Rilis ini menambahkan **katalog produk satuan digital** (ebook, template ZIP, kursus LMS satuan, bundel), **kupon diskon** (persen/fixed, kuota, periode, batas produk), **entitlement-based access** (ASSET/COURSE/PLAN), **pembelian tanpa paket membership**, **invoice + unggah bukti transfer user-side**, dan **maintenance cron kedaluwarsa order PENDING + lepas reservasi kupon orphan**. Kompatibel balik 100% dengan data 1.1.0 tanpa hapus/ubah tabel lama. Tipe order legacy (planId tidak null & items=0) dan order legacy=true tetap berjalan lewat jalur 1.1.0.

### Fitur Baru

- **Katalog Publik & Produk Satuan**
  - Route `/products` katalog produk grup per tipe (EBOOK, TEMPLATE, COURSE, MEMBERSHIP, BUNDLE)
  - Landing page `/products/[slug]` — thumbnail, komponen bundel, fitur, FAQ, CTA checkout
  - Navbar utama + footer link ke `/products`
- **5 Tipe Produk**
  - `EBOOK` (wajib file PDF, validasi signature `%PDF-`)
  - `TEMPLATE` (wajib file ZIP, validasi local file header 0x504B0304/0506/0708)
  - `COURSE` (satu Kursus LMS; course.isPublished harus true sebelum bisa diterbitkan)
  - `MEMBERSHIP` (satu Plan; plan.isActive harus true sebelum bisa diterbitkan; legacyPlanId unique)
  - `BUNDLE` (min 2 anggota non-BUNDLE status PUBLISHED, anggota unik, tidak self-refer, tidak nested)
- **Bump Offer** saat checkout: produk opsional cross-sell setelah produk utama (1 bump per order)
- **Kupon Diskon**
  - Jenis `PERCENT` (0–100%) atau `FIXED` (rupiah)
  - `maxUses` (optional, kuota global termasuk reservasi PENDING)
  - `startAt` / `endAt` jadwal aktif
  - `CouponProduct` restrict hanya bisa dipakai pada produk tertentu (kosong = berlaku ke semua PUBLISHED)
  - Reservasi atomic `CouponReservation` saat buat order PENDING; `usedAt` terisi saat approve/PAID; maintenance melepas reservasi jika order EXPIRED
- **Checkout Baru**
  - `/products/[slug]/checkout` halaman (wajib login via `requireUser()`)
  - Preview order via `POST /api/checkout/preview` (validasi kupon, hitung diskon alokasi, subtotal, net per item)
  - Buat order via `POST /api/orders/product` dengan **`idempotencyKey` UUID client-side** (UNIQUE constraint, pengulangan request idempoten = return order existing)
  - Transaksi **Serializable (Postgres)** + 3x retry loop deteksi serial failure 40001 / P2034
- **Invoice User Side**
  - `/dashboard/invoices` list semua invoice user
  - `/dashboard/invoices/[id]` detail ringkasan item/subtotal/diskon/grand, rekening transfer, unggah bukti, status
  - `POST /api/orders/[id]/proof` user upload bukti 2 MiB via base64 `paymentProof`; cek signature; `proofSubmittedAt` di-set SEKALI SAJA (submit ulang tidak overwrite); sebelum `expiresAt`
  - Order 1.1.0 (planId not null & tanpa items) tetap lewat jalur approval legacy existing
- **Entitlement & OrderGrant**
  - `OrderGrant` snapshot saat checkout (nama produk, tipe, durasi, grantRefId); tidak berubah walau produk diedit nanti
  - `Entitlement` composite unique key `(userId, kind, grantRefId)` menghindari double-insert saat approve ulang
  - 3 jenis: `ASSET` (file download), `COURSE` (akses LMS), `PLAN` (membership via Plan reference)
- **Download File Privat (ASSET)**
  - `GET /api/products/assets/[assetId]` auth 4 gerbang (owner order PAID / entitlement ASSET / orderGrant ASSET / role ADMIN)
  - `storageKey` UUID, path join relative (absolute / `..` ditolak traversal)
  - Response `Content-Disposition: attachment`, CSP sandbox, `X-Content-Type-Options: nosniff`
- **Produk Saya Dashboard**
  - `/dashboard/products` gabung paket membership aktif (endsAt > now) + semua entitlement (ASSET/COURSE/PLAN)
  - ASSET → direct unduh; COURSE → Buka Kelas Saya; PLAN → Dashboard
- **Perluasan Akses LMS**
  - `/dashboard/courses` **ATAU** `/dashboard/courses/[slug]` / `[lessonId]`: memiliki plan membership AKTIF **ATAU** memiliki entitlement COURSE grantRefId === course.id
- **CRUD Admin UI**
  - **Produk**: `/admin/products` (list tabel: type, assets count, orderItems count, status), `/admin/products/new`, `/admin/products/[id]`
  - **Kupon**: `/admin/coupons` (list: kode, tipe, nilai, terpakai, cadangan, aktif, periode, batas produk), `/admin/coupons/new`, `/admin/coupons/[id]`
  - **Asset produk**: upload via `multipart/form-data` PDF/ZIP ≤ 50 MiB per file (magic bytes signature)
  - Sidebar admin: ditambah **Kelola Produk**, **Kupon Diskon**, **Produk Saya**
  - Sidebar member: ditambah **Produk Saya**, **Invoice**, **Katalog**
- **Maintenance Script**
  - `node scripts/maintenance.mjs` (rekomendasi cron tiap 1 jam):
    - Order `PENDING` dan `expiresAt < now` → status `EXPIRED` (reviewedAt terisi)
    - Hapus `CouponReservation` order EXPIRED
    - Hapus orphan `CouponReservation` yang order.status NOT IN (PENDING, PAID) dan `usedAt` null
- **Seed Baru**
  - `Setting.order_expiry_hours = 24` (default durasi PENDING sebelum expired)
  - **Legacy Product MEMBERSHIP** otomatis dibuat per Plan (unique legacyPlanId) agar paket lama muncul di katalog / admin
  - Contoh ebook DRAFT untuk uji upload asset

### Perubahan Business Logic

- `Order.planId` nullable (SET NULL FK); `Order.amount` nullable (hanya legacy yang isi)
- `Order.expiresAt` = createdAt + order_expiry_hours setting (default 24 jam)
- `Order.idempotencyKey` UNIQUE (request retry aman idempoten)
- `Order.legacy` boolean true = paksa jalur 1.1.0
- Alokasi diskon deterministik `roundDiscountAllocation` proporsional floor, remainder tersebar urut item (jamin sum net+discount = subtotal tepat)
- Komisi per item `allocateCommission` floor (bulat kebawah) agar tidak melebihi penghasilan
- `validateProductForPublish()` otomatis rollback produk ke DRAFT jika publish gagal (harga/EBOOK tanpa file/COURSE tak terbitkan/dll)
- Produk hapus hanya jika belum ada order/entitlement/grant yang mereferensikan (409 Conflict)
- Kupon hapus hanya jika `usedAt === 0` (belum pernah dipakai)
- Approve order double → 409 Conflict (count updated === 0 pada updateMany WHERE PENDING)
- Minimum order Rp1 disemua jalur (diskon maks `subtotal - 1`); order gratis tidak didukung

### Validasi & Keamanan

- **11 acceptance criteria MVP** tercover
- **40 unit tests** lulus (`npm test`): 14 existing (1.1.0) + 26 baru di 4 file baru: `pricing.test.ts` (8), `catalog.test.ts` (6), `access.test.ts` (7), `order-approval.test.ts` (7)
- **`tsc --noEmit` exit 0**, strict mode strictNullChecks aktif
- **`npm run build` exit 0** (prisma generate + next build)
- File upload PDF/ZIP: **tidak percaya extension + mime semata**, signature magic bytes check WAJIB sebelum write disk
- Size cap: asset produk 50 MiB / file; bukti transfer 2 MiB (base64 ± 1.5 MiB raw)
- Path traversal storage: join absolute storage dir + reject key absolute / mengandung `..`
- Serializable transaksi untuk coupon quota reserve + order create dengan retry 3x serial failure

### Batas & Catatan (Lihat VALIDATION.md)

- Integrasi SMTP Nodemailer, Starsender WA, dan Midtrans **belum diverifikasi secara end-to-end** dalam lingkungan ini; tetap placeholder credentials di `.env`. Credentials asli perlu diisi di server produksi.
- Payment gateway otomatis (Midtrans) **belum diimplementasikan pada rilis 1.2.0 ini**; pembayaran tetap verifikasi manual admin (konfirmasi transfer → approve).
- Notifikasi otomatis WhatsApp / email pasca-approve order produk baru 1.2.0 jalur generic `notify.ts` yang sama seperti legacy (bila provider dikonfigurasi).

## Rollback 1.2.0 → 1.1.0

Bila terjadi masalah setelah upgrade 1.2.0 dan ingin kembali ke 1.1.0:

1. **JANGAN** hapus kolom atau tabel baru dari Postgres (berisi order produk baru).
2. Restore backup DB sebelum upgrade (`backup-1.2.0-pre.dump`).
3. Restore backup folder `storage/private/` sebelum upgrade (berisi asset produk 1.2.0).
4. Kembalikan kode aplikasi ke tag rilis 1.1.0 dan deploy ulang.
5. Order 1.2.0 yang dibuat setelah upgrade (items.length > 0) **tidak terbaca di UI 1.1.0**; refer ke SQL rollback `prisma/upgrade/1.2.0.sql` bagian bawah ROLLBACK untuk mengembalikan state planId/amount legacy pada order yang perlu.

## 1.1.0 (sebelumnya)

- Lihat commit / tag `v1.1.0` dan `docs/IMPLEMENTATION.md` untuk fitur registrasi, paket membership, LMS, pencairan affiliate, reset password, dll.
