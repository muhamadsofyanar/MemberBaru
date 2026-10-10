# Validasi upgrade 1.3.0

Dijalankan di lingkungan pengembangan, 10 Oktober 2026:
- Prisma generate: berhasil, termasuk relasi foreign key lisensi dan rilis.
- TypeScript tsc --noEmit: berhasil.
- npm test: 45 tes lulus, 0 gagal. Mencakup pemeriksaan paket dasar, pembatasan path, kompatibilitas password scrypt dan bcrypt, normalisasi domain, dan perbandingan semver tanpa downgrade.
- npm run build: berhasil untuk production Next.js.
- Exporter SQLite: diuji dengan fixture, file ZIP, checksum SHA-256 dan permission file hasil 0600; berhasil.
- Perbaikan paket dasar: path absolut Windows/backslash ditolak, tidak hanya path Unix.

Belum dijalankan:
- Build image Docker dan deployment pada VPS/Coolify Anda.
- Importer terhadap PostgreSQL hidup; skrip sudah lolos TypeScript, bukan bukti migrasi penuh berhasil.
- Integrasi HTTP pembelian/pembayaran/aktivasi concurrent pada PostgreSQL hidup.
- UI browser terhadap database staging.
- Pengiriman SMTP dan WhatsApp.

Uji staging wajib sebelum cutover: login admin/member, unduhan, persetujuan order, penerbitan key, batas domain dengan request paralel, suspend/expired, reset aktivasi, cek versi dan unduh ZIP. Jangan menganggap sukses compile sebagai bukti seluruh workflow production teruji.
