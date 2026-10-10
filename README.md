# RIZQHUB Membership 1.3.0

Untuk upgrade app.rizqhub.id, ikuti [UPGRADE-APP-RIZQHUB.md](UPGRADE-APP-RIZQHUB.md). Port terbaru **8000**, private storage **/data/private**, database **PostgreSQL**. Petunjuk lama di bawah menggambarkan paket sebelum penyesuaian.

# RizqHub Membership 1.1.0

Next.js + PostgreSQL + Prisma. Pembayaran dan pencairan komisi menggunakan transfer bank manual.

## Fitur

- Registrasi, login/logout, profil, ganti password, reset password email (SMTP), pencabutan sesi lama setelah perubahan password, aktif/nonaktif akun member oleh admin.
- Admin membuat/mengedit/mengarsipkan paket, harga, masa aktif, komisi, dan manfaat. Riwayat pembelian dipertahankan. Harga/durasi/persentase pesanan baru disimpan saat checkout.
- Membership aktif setelah pembayaran disetujui; perpanjangan paket sama dimulai setelah akhir masa aktif, paket berbeda dapat aktif bersamaan.
- Admin mengelola kursus, modul, materi, urutan, video YouTube/Vimeo, pratinjau gratis, status terbit, dan akses per paket. Perubahan mempertahankan ID materi dan progres. Penghapusan materi menghapus progres terkait setelah konfirmasi.
- Member melihat kelas, materi, dan progres; pratinjau tersedia setelah login tanpa paket. Konten berbayar diperiksa pada server.
- Affiliate: tautan referral, komisi, pengajuan seluruh saldo tersedia, persetujuan/penolakan admin, pencatatan referensi transfer dan status lunas. Satu pengajuan berjalan per member; komisi dikunci selama pengajuan dan dilepas bila ditolak.
- Bukti transfer diakses lewat endpoint admin, pembatasan percobaan login/reset, pemeriksaan origin, transaksi pembayaran/pencairan, endpoint kesehatan.

## Jalankan lokal

Prasyarat Node.js 22+, PostgreSQL 16. Salin `.env.example` menjadi `.env`; gunakan host `localhost` pada DATABASE_URL untuk database lokal. Isi AUTH_SECRET acak minimal 32 karakter, ADMIN_EMAIL, ADMIN_PASSWORD minimal 12 karakter (maksimal 72 byte), dan NEXT_PUBLIC_APP_URL sesuai alamat yang dibuka.

```bash
npm ci
npm run db:push
npm run db:seed
npm run dev
```

Buka http://localhost:8000. Set NEXT_PUBLIC_APP_URL ke nilai tersebut untuk lokal. Login admin dengan kredensial dari `.env`.

## Deploy dan upgrade

Baca **DEPLOY.md** sebelum mengganti versi yang sudah memiliki data. Docker Compose memakai volume database yang persisten; jangan hapus volume saat upgrade.

## Pengujian

```bash
npm test
npm run lint
npm run build
```

`tests/integration.mjs` adalah skenario HTTP terhadap database uji sekali pakai yang sudah diseed, bukan database produksi. Lihat `VALIDATION.md` untuk hasil dan batas pengujian.

## Integrasi eksternal

SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD dan SMTP_FROM digunakan untuk reset password. Tautan berlaku 30 menit dan hanya dapat digunakan sekali. Jika SMTP belum diisi, halaman menjelaskan bahwa reset email belum tersedia. Tidak ada password/token yang ditampilkan pada respons API.

Starsender bersifat opsional untuk status pembayaran. Isi variabel STARSENDER; sesuaikan payload `lib/notify.ts` dengan akun/provider. Pengiriman gagal dicatat tanpa membatalkan pembayaran yang telah disetujui; belum ada antrean retry otomatis.

## Batas cakupan

Paket ini melengkapi fitur yang disepakati pada kode sumber. Tidak mencakup payment gateway otomatis, transfer bank otomatis, affiliate multilevel, kuis/sertifikat, atau SaaS multitenant. Tidak ada deploy ke akun/domain pengguna yang dilakukan dari paket ini.
