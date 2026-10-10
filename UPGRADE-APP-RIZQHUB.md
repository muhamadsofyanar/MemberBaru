# Upgrade app.rizqhub.id: Starter 0.1 ke Membership 1.3.0

Paket ini mengembangkan ZIP membership-main-coolify-fixed yang Anda berikan. Stack berubah dari Python/SQLite menjadi Next.js/PostgreSQL. Ini bukan patch langsung untuk app.db. Jangan menghapus volume aplikasi awal.

## Fitur
Paket dasar memiliki membership bertempo, LMS, katalog dan bundel, kupon, checkout transfer manual dan bukti pembayaran, affiliate dan pencairan, pengelolaan member, serta reset password SMTP. Tambahan: penerbitan lisensi software setelah pembayaran disetujui, daftar domain, batas aktivasi, suspend, kedaluwarsa UTC, reset aktivasi, riwayat versi software, API kompatibel Starter, halaman lisensi member, dan migrasi SQLite. Pembayaran tetap manual.

## Pemasangan dan migrasi aman
1. Backup seluruh /data container Python saat aplikasi dihentikan sementara. Simpan app.db dan files/. Snapshot harus konsisten. Jangan menghapus database lama.
2. Pada komputer dengan Python 3.12, jalankan `python scripts/export-starter.py /path/snapshot-data /path/starter-export.json`. Hasil berisi hash password, email dan license key. Simpan privat, jangan commit Git.
3. Buat resource baru di Coolify menggunakan kode ini. Isi root repository dengan isi folder membership-main (Dockerfile dan package.json langsung di root). Gunakan subdomain staging yang DNS-nya sudah Anda siapkan. Jangan langsung mengganti resource Python.
4. Buat PostgreSQL baru, contoh versi 16. DATABASE_URL memakai host internal yang bisa diakses container. SQLite dan MySQL tidak kompatibel.
5. Build pack Dockerfile, port 8000, health check /api/health, volume baru /data writable UID 1001. PRIVATE_STORAGE_DIR=/data/private. Volume Python memakai UID 10001; jangan langsung menempelkan volume lama.
6. Environment wajib: DATABASE_URL, AUTH_SECRET (acak minimal 32 karakter, tetap sama saat redeploy), NEXT_PUBLIC_APP_URL=https://domain-staging-anda, PRIVATE_STORAGE_DIR=/data/private. Jika memakai Compose, isi POSTGRES_PASSWORD, AUTH_SECRET dan NEXT_PUBLIC_APP_URL; PostgreSQL internal otomatis disediakan. DATABASE_URL contoh ada di .env.example.
7. Startup menjalankan prisma db push TANPA --accept-data-loss. Ini praktis untuk MVP. Bila ada peringatan kehilangan data, hentikan dan buat migrasi yang ditinjau; jangan menambahkan --accept-data-loss.
8. Salin starter-export.json secara privat ke container baru. Jalankan `npm run starter:import -- /data/starter-export.json` melalui terminal container. Tujuan harus belum mempunyai produk/pesanan/lisensi. Impor sekali. Akun lama tetap dapat login menggunakan password scrypt. Jangan menjalankan db:seed sebelum impor karena membuat produk demo. Jika berhasil, hapus salinan ekspor dari container; simpan backup privat.
9. Bila tidak memindahkan data: isi ADMIN_EMAIL dan ADMIN_PASSWORD (minimal 12 karakter, maksimal 72 byte), lalu jalankan `npm run admin:init`. Membuat admin saja, tanpa produk demo. Tidak mengubah password akun existing.
10. Uji login, unduhan, pembelian, lisensi, domain dan suspend di staging. Setelah lulus, pindahkan domain https://app.rizqhub.id ke resource baru, atur NEXT_PUBLIC_APP_URL=https://app.rizqhub.id, lalu redeploy. Lepaskan domain dari resource lama supaya proxy tidak berbenturan. Simpan resource lama untuk rollback.
11. Login ulang. Sesi lama tidak diimpor. /member mengarah ke /dashboard. Menu admin baru: Lisensi & Update. Menu member: Lisensi Saya.

## Produk software dan rilis
Buat produk TEMPLATE untuk software melalui Kelola Produk (enum belum memiliki tipe SOFTWARE). Upload asset ZIP. Pada Lisensi & Update pilih asset dan versi x.y.z, lalu Terbitkan versi. Ini mengaktifkan licenseEnabled. Pembelian berikutnya yang disetujui menerbitkan satu key per produk per pesanan. Bundle mengikuti productId item, bukan semua komponen bundle. Tidak menerbitkan lisensi retroaktif untuk pembelian sebelum licenseEnabled aktif; semua key Starter diimpor.
Rilis yang dipublikasikan bersifat immutable per pasangan produk/versi. API memilih versi semver tertinggi. ZIP hanya disimpan dan dikirim, tidak diekstrak atau dijalankan server.

## API server-to-server
POST JSON: /api/activate, /api/validate, /api/deactivate, /api/update, /api/download.
Payload: {"license_key":"KEY","domain":"customer.example"}; untuk update tambahkan current_version.
Respons update: version, has_update, sha256, download_endpoint. Endpoint download memakai POST dengan key dan domain. Simpan key pada backend pelanggan.
Rate limit per key; aktivasi memakai transaksi serializable dan retry konflik. Domain adalah identifier yang dilaporkan klien, bukan pembuktian kepemilikan DNS. SHA-256 menjaga integritas, bukan tanda tangan digital. Pemasangan update masih manual, belum ada updater otomatis dan rollback.

## Batas migrasi
Starter tidak menyimpan tanggal transaksi, nama lengkap atau snapshot harga. Importer memakai nama dari email, harga produk saat ekspor, waktu impor, dan invoice STARTER-. Admin existing dengan email sama mempertahankan password tujuan. Sesi dan rate limit tidak dipindahkan. Hanya file versi terakhir tersedia untuk impor. File diimpor privat, data berada dalam satu transaksi. Importer menolak tujuan yang sudah memiliki produk/pesanan/lisensi; tidak bisa dijalankan berulang atau menggabungkan data aktif.

## Rollback
Resource Python tetap utuh sebelum cutover. Setelah cutover, transaksi baru PostgreSQL tidak otomatis masuk SQLite. Catat perubahan baru sebelum rollback. Jangan menjalankan kedua aplikasi untuk menerima pembelian sekaligus selama perpindahan.

## Validasi
Lihat VALIDATION-UPGRADE.md. Paket belum dideploy ke VPS Anda.
