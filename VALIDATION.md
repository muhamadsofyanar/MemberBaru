# Hasil verifikasi

## 1.2.0 — Tambahan rilis ini (September 2026)

- `tsc --noEmit`: pemeriksaan tipe TypeScript strict strictNullChecks **exit 0**
- `npm test`: **40/40 pemeriksaan lulus** (penambahan 4 file baru `pricing.test.ts`, `catalog.test.ts`, `access.test.ts`, `order-approval.test.ts` — 26 kasus baru; 14 existing 1.1.0 dipertahankan). Total 40 pass, 0 fail.
  - pricing: roundDiscountAllocation deterministic, totalDisc + totalNet = subtotal tepat, diskon maks subtotal-1, allocateCommission floor, plan dedup Set uniqueness
  - catalog: EBOOK/TEMPLATE wajib asset, validateProductForPublish rules, normalizeProductInput name/desc/harga/clamp 0–100 affiliate, slugifyProduct deterministik jika seed diberikan, PRODUCT_ASSET_REQUIRED enum sesuai
  - access/file-store: resolvePrivateStoragePath tolak absolute / `..` traversal; PDF `%PDF-` signature, ZIP PK 0304/0506/0708 signature wajib (extension+mime saja tidak cukup); cap 50 MiB file size sebelum write disk
  - order-approval: approveOnce 409 untuk double approve (updateMany count=0), legacy vs branch `legacy? || planId!=null && items=0` vs new items>0, composite unique Entitlement anti double-insert, isConflict() detect P2034 & 40001 serial failure Postgres & Prisma
- `npm run build`: build Next.js **exit 0** (prisma generate + next build)
- `prisma validate` (terakhir T1): schema 1.2.0 **valid**; 9 model baru (Product, ProductAsset, BundleItem, ProductBump, Coupon, CouponProduct, CouponReservation, OrderItem, OrderGrant, Entitlement) + 5 enum baru (ProductType/Status/DiscountType/OrderItemSource/GrantKind) + Order/Plan/Course/User tambahan fields — relation backlink valid tanpa enum namespace error.
- Jalur approve order 1.1.0 **legacy=true ATAU planId!=null && items.length==0** tidak berubah (flow existing 1.1.0 Membership + Commission 1:1 per Plan) mempertahankan kompatibilitas balik 100% data lama tanpa transformasi wajib.
- Migration SQL `prisma/upgrade/1.2.0.sql` aditif SEMUA: tidak ada DROP kolom/tabel. Data migration legacy Plan→Product MEMBERSHIP dan Order→OrderItem snapshot idempoten (ON CONFLICT DO NOTHING / UPDATE WHERE NULL).

### Dokumen tambahan 1.2.0

- `CHANGELOG.md` (baru): perubahan 1.2.0 lengkap + rollback step 1.2.0 → 1.1.0
- `DEPLOY.md` (diperbarui): langkah backup DB pg_dump + storage tar, apply psql 1.2.0.sql BUKAN prisma db push, npm install + prisma generate, seed idempoten, cron node scripts/maintenance.mjs 1×/jam, rollback restore backup + step restore tar.

## Batas verifikasi (1.2.0 + 1.1.0 umum)

> Bagian ini dicatat sebagai **Unverified** dan **placeholder credentials** pada rilis ini:
>
> - **SMTP Nodemailer** (SMTP_HOST/PORT/USER/PASS/FROM) → kredensial asli TIDAK disertakan dalam repo / ZIP; integrasi reset password & notifikasi email **belum diverifikasi end-to-end** dalam lingkungan ini. Setelah diisi user pada `.env`, jalankan test manual reset password dan pastikan email sampai.
> - **Starsender WhatsApp Gateway** (STARSENDER_APIKEY + WA_NUMBERID) → credentials placeholder; notifikasi WA order/invoice **belum diverifikasi** end-to-end.
> - **Midtrans / Payment Gateway otomatis** → Belum diimplementasi pada rilis 1.2.0. Flow pembayaran saat ini **manual verifikasi bukti transfer admin approve**.
> - Concurrency Serializable load test → Unit test `isConflict()` dan Serializable constant PRISMA_SERIALIZABLE + 3× retry loop di `buildAndSaveOrder` sudah mencakup mekanisme deteksi failure serial, tetapi pengujian beban >100 concurrent checkout pada Postgres 16 produksi **tidak dijalankan** di lingkungan verifikasi lokal.
> - Docker / Coolify deployment hidup (port 3000 HTTPS domain real) + Lighthouse UI visual lintas browser → Belum diverifikasi dalam lingkungan ini.

## Menjalankan ulang semua verifikasi lokal

```bash
cd membership-main/
# 1. typecheck
npx tsc --noEmit
# 2. prisma schema validate
npx prisma validate
# 3. unit tests 40 kasus
npm test
# 4. build
npm run build
```

## Jalankan integration test (opsional — HANYA DATABASE UJI KOSONG)

Lihat bagian akhir dokumen untuk `RUN_INTEGRATION_TESTS=1`. Jalankan hanya pada DB test dan TEST_BASE_URL bukan server produksi. Jangan run terhadap database transaksi nyata. Data test tidak dibersihkan otomatis; rebuild DB setelah selesai.

---

## 1.1.0 (sebelumnya, baseline verifikasi lolos)

- `npm test`: 14 pemeriksaan lulus (aturan bisnis, validasi LMS, dan struktur deployment).
- `npm run lint`: pemeriksaan tipe TypeScript lulus.
- `npm run build`: build produksi Next.js 15.5.25 lulus; 41 route aplikasi/API tercantum pada build.
- `npm audit --omit=dev`: 0 temuan pada lockfile yang dikemas. Dependency overrides dicatat di package.json; audit ini bukan jaminan bebas seluruh kerentanan.
- `tests/integration.mjs`: 31 pemeriksaan HTTP lulus pada aplikasi hasil build menggunakan PostgreSQL tertanam PGlite sebagai database sekali pakai. Meliputi registrasi/referral, profil, password dan sesi lama, upload/baca bukti, persetujuan berulang, membership/komisi, pencairan/tolak/ajukan ulang/lunas, token reset sekali pakai, penolakan origin lain, dan akses pratinjau vs konten berbayar.
- SQL upgrade diuji dari skema asli dengan contoh member dan order; data dan nilai transaksi tetap ada, kolom snapshot terisi.
- Review kode menutup temuan: bukti transfer via data URL, pratinjau yang sebelumnya tidak berfungsi, dan duplikasi pending order. Editor LMS menerima kembali ID materi dari server setelah menyimpan.

### Batas verifikasi (1.1.0 umum)

PGlite menjalankan mesin PostgreSQL tertanam dengan multiplexing; pengujian ini bukan pengujian beban/concurrency pada PostgreSQL 16 produksi. Docker/Coolify dan domain pengguna belum dijalankan dari lingkungan ini. SMTP, Starsender, dan transfer bank nyata tidak dijalankan. Tidak dilakukan pengujian visual lintas browser.

## Menjalankan ulang integrasi 1.1.0 / base

Hanya gunakan database uji kosong. Buat skema, seed dengan ADMIN_EMAIL=admin@test.invalid dan ADMIN_PASSWORD=test-admin-password-123, lalu jalankan aplikasi pada alamat TEST_BASE_URL. Aplikasi dan skrip harus memakai DATABASE_URL yang sama. Kosongkan kredensial Starsender/SMTP agar pengujian tidak mengirim pesan keluar.

```bash
RUN_INTEGRATION_TESTS=1 TEST_BASE_URL=http://localhost:3000 node tests/integration.mjs
```

Skrip membuat data uji dan tidak membersihkan transaksi secara otomatis; hapus seluruh database uji setelah selesai. Jangan jalankan terhadap database pelanggan.
