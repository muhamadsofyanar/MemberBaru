# RIZQHUB Membership Starter 0.1
Kode baru, tidak menggunakan source Averion. MVP untuk membership produk software, unduhan ZIP, pembayaran manual, lisensi seumur hidup dengan batas domain, dan distribusi rilis terbaru.

## Menjalankan lokal
Python 3.12, tanpa dependency untuk server pengembangan.
Set ADMIN_EMAIL, ADMIN_PASSWORD (minimal 12 karakter), APP_URL, dan DATA_DIR melalui environment. Jalankan `python app.py`; buka http://localhost:8000. Tidak ada kredensial default. Akun admin dibuat hanya jika environment valid; password environment tidak mengganti password akun yang sudah ada.

## Coolify
1. Ekstrak ZIP dan push ke repository private milik Anda.
2. Buat Application dengan build pack Dockerfile. Port 8000.
3. Pilih subdomain baru, misalnya membership.domain-anda, dan aktifkan HTTPS.
4. Environment: APP_URL=https://subdomain-anda, ADMIN_EMAIL=email-admin-anda, ADMIN_PASSWORD=password-baru-minimal-12-karakter, DATA_DIR=/data.
5. Pasang persistent volume ke /data; UID 10001 harus dapat menulis. Jangan memasang volume pada /app.
6. Deploy dan login. Tambahkan produk, unggah ZIP rilis, dan lakukan pembelian uji dengan akun member.
7. Setelah pembayaran benar-benar diverifikasi, admin menyetujui pesanan. Sistem menerbitkan satu lisensi per pesanan secara idempotent.
Backup seluruh /data termasuk SQLite, idealnya ketika aplikasi berhenti atau gunakan SQLite backup API. Data tetap ada saat redeploy jika volume terpasang. Gunakan satu instance aplikasi untuk MVP SQLite ini.

## API pelanggan
POST JSON, Content-Type application/json. Simpan key pada server aplikasi pelanggan, bukan JavaScript publik.
- /api/activate: {"license_key":"KEY","domain":"customer.example"}
- /api/validate: format sama. Domain harus sudah aktif.
- /api/deactivate: format sama. Melepaskan slot domain.
- /api/update: tambahkan "current_version":"1.0.0". Mengembalikan versi terbaru, has_update, SHA-256, download_endpoint.
- /api/download: format sama. Mengembalikan ZIP jika lisensi aktif dan domain aktif.
Lihat client_example.py. API memakai identifier domain yang dilaporkan klien, bukan pembuktian kepemilikan DNS. Key adalah rahasia pembawa akses. Aktivasi dan pembatasan seat memakai transaksi SQLite. Batas API 60 permintaan/menit berdasarkan REMOTE_ADDR, tanpa mempercayai X-Forwarded-For; di balik proxy beberapa pengguna dapat berbagi kuota.

## Cakupan dan batas versi awal
Pembayaran manual; kontak dan instruksi transfer disampaikan admin di luar aplikasi. Paket membership berbasis pembelian produk, bukan langganan waktu. Lisensi lifetime, bisa disuspend, batas seat bisa diatur. Belum ada payment gateway, reset password, email otomatis, MFA, masa berlaku lisensi, maupun release history. Autentikasi belum punya rate limiting login: tambahkan proteksi sebelum peluncuran publik.
Update hanya distribusi ZIP, tidak mengekstrak atau menjalankan source yang diunggah. Klien contoh memeriksa SHA-256 untuk integritas, bukan tanda tangan digital. Instalasi update manual. has_update membandingkan perbedaan versi, bukan urutan semver. Tambahkan manifest bertanda tangan, backup, migrasi, dan pemulihan sebelum menyediakan updater otomatis. PHP/Python source dapat dimodifikasi penerimanya; pemeriksaan lisensi tidak kebal perubahan.
Produk baru dan pesanan merupakan data nyata di instance Anda. Paket ini belum dideploy ke VPS Anda. Tidak ada rahasia dari percakapan atau source vendor dalam paket.
