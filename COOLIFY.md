# RIZQHUB Membership 1.3.0

Untuk upgrade app.rizqhub.id, ikuti [UPGRADE-APP-RIZQHUB.md](UPGRADE-APP-RIZQHUB.md). Port terbaru **8000**, private storage **/data/private**, database **PostgreSQL**. Petunjuk lama di bawah menggambarkan paket sebelum penyesuaian.

# Deploy ke Coolify

## 1. Konfigurasi resource

- Pilih build pack **Docker Compose**.
- Compose file: `/docker-compose.yml`.
- Arahkan domain ke service `app` dengan port internal `8000`.
- Jangan arahkan domain ke service `postgres`.

## 2. Environment variables wajib

```env
POSTGRES_PASSWORD=ganti-dengan-password-database-yang-kuat
AUTH_SECRET=ganti-dengan-string-acak-minimal-32-karakter
NEXT_PUBLIC_APP_URL=https://domain-anda.com
ADMIN_EMAIL=admin@domain-anda.com
ADMIN_PASSWORD=ganti-dengan-password-minimal-12-karakter
```

`NEXT_PUBLIC_APP_URL` harus menggunakan domain final, memakai `https://`, dan tanpa garis miring di akhir.

Variabel SMTP dan Starsender boleh dikosongkan jika fiturnya belum digunakan.

## 3. Setelah deployment

Pastikan service berikut tampil:

- `postgres`: `healthy`
- `app`: `healthy`

Buka endpoint berikut:

```text
https://domain-anda.com/api/health
```

Respons yang benar:

```json
{"status":"ok"}
```

## 4. Maintenance berkala

Tambahkan scheduled task atau cron setiap satu jam pada service `app`:

```bash
node scripts/maintenance.mjs
```

Maintenance sengaja dipisahkan dari startup. Dengan begitu, kegagalan pekerjaan berkala tidak menyebabkan web server berhenti dan tidak memunculkan pesan `no available server` pada proxy.

## 5. Jika aplikasi belum sehat

Buka runtime logs service `app`. Cari kegagalan `prisma db push`, koneksi PostgreSQL, atau environment variable. Deployment log yang hanya menampilkan `Container ... Started` belum membuktikan proses Next.js di dalam container sudah sehat.
