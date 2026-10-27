# Panduan Deploy Saku Keluarga

Panduan lengkap menjalankan **Saku Keluarga** di homeserver memakai Docker Compose.
Disusun agar bisa diikuti dari awal sampai operasional sehari-hari.

- **Target:** homeserver Linux (Ubuntu/Debian), diakses dari jaringan rumah.
- **Arsitektur:** 3 container — `db` (Postgres), `web` (dashboard), `wa` (bot WhatsApp).
- **Data:** disimpan di volume Docker `db-data` dan `wa-auth`.

> Panduan ini memakai contoh:
> - Folder proyek: `/opt/saku-keluarga`
> - IP server: `192.168.1.10`
> - Port dashboard: `3000`
>
> Ganti nilai tersebut sesuai kondisi kamu.

---

## Daftar isi

1. [Persiapan server](#1-persiapan-server)
2. [Menyalin proyek](#2-menyalin-proyek)
3. [Membuat file .env](#3-membuat-file-env)
4. [Build dan jalankan](#4-build-dan-jalankan)
5. [Verifikasi](#5-verifikasi)
6. [Login pertama](#6-login-pertama)
7. [Menautkan WhatsApp](#7-menautkan-whatsapp)
8. [Menambah anggota keluarga](#8-menambah-anggota-keluarga)
9. [Akses dari luar rumah](#9-akses-dari-luar-rumah)
10. [Operasional harian](#10-operasional-harian)
11. [Backup dan restore](#11-backup-dan-restore)
12. [Update aplikasi](#12-update-aplikasi)
13. [Pindah server](#13-pindah-server)
14. [Troubleshooting](#14-troubleshooting)
15. [Checklist keamanan](#15-checklist-keamanan)
16. [Ringkasan perintah](#16-ringkasan-perintah)

---

## 1. Persiapan server

### Kebutuhan minimum

| Komponen | Rekomendasi |
| --- | --- |
| RAM | 2 GB (1 GB bisa, tetapi build Next.js rawan kehabisan memori) |
| Disk | 5 GB kosong |
| CPU | 1–2 core |
| OS | Linux 64-bit (Ubuntu/Debian, Raspberry Pi OS 64-bit) |
| Jaringan | IP statis atau DHCP reservation di router |

> Jika RAM hanya 1 GB, tambahkan swap 2 GB sebelum build:
>
> ```bash
> sudo fallocate -l 2G /swapfile
> sudo chmod 600 /swapfile
> sudo mkswap /swapfile
> sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

### Raspberry Pi / ARM64

Project ini mendukung Raspberry Pi **64-bit** (ARM64/aarch64). Beberapa hal yang
wajib dicek sebelum build:

```bash
uname -m
# harus: aarch64
```

Kalau hasilnya `armv7l`, kamu memakai OS 32-bit. Node.js 22, Prisma, dan binary
Next.js modern tidak didukung di arsitektur itu. Install ulang Raspberry Pi OS
**64-bit** (Lite juga cukup) atau Debian arm64.

- **RAM:** 2 GB disarankan. Pi dengan 1 GB sebaiknya memakai swap 2 GB (lihat di
  atas) karena build Next.js dan Prisma bisa kehabisan memori.
- **Build di Pi:** jangan build image di komputer x64 lalu menyalinnya ke Pi.
  Docker akan memilih image dasar `arm64` dan Next.js akan memasang
  `@next/swc-linux-arm64-gnu` secara otomatis. Build langsung di Pi (atau gunakan
  `docker buildx` multi-arch).
- **Jangan tambahkan SWC khusus x64:** `package.json` tidak boleh memuat
  `@next/swc-linux-x64-gnu`; dependensi itu membuat `npm ci` gagal dengan
  `EBADPLATFORM` di ARM64.
- **OpenSSL:** image `node:22-bookworm-slim` sudah menyediakan OpenSSL 3 yang
  dibutuhkan Prisma. Tidak perlu install manual.
- **Waktu build:** Pi 4/5 bisa memakan 10–30 menit pada build pertama. Pantau
  dengan `docker compose build --progress plain web`.
- **Penyimpanan:** gunakan SSD/USB 3.0 bila memungkinkan; build dan database
  lebih nyaman daripada microSD kelas lambat.

### Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

docker --version
docker compose version
```

Pastikan Docker Compose versi **v2** (`docker compose`, bukan `docker-compose`).

### Cek waktu server

Waktu yang benar penting untuk tanggal transaksi dan laporan.

```bash
timedatectl
```

Set timezone jika perlu:

```bash
sudo timedatectl set-timezone Asia/Jakarta
```

### Firewall (opsional)

Kalau memakai UFW dan dashboard hanya untuk LAN:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 3000 proto tcp
sudo ufw enable
```

Jangan buka port `5432` (Postgres) atau `3002` (status bot) ke jaringan luar.

---

## 2. Menyalin proyek

### Dari komputer lain via rsync

Jalankan dari komputer tempat proyek berada:

```bash
rsync -av \
  --exclude node_modules \
  --exclude .next \
  --exclude .env \
  /path/ke/project/ user@192.168.1.10:/opt/saku-keluarga/
```

Perhatikan **garis miring di akhir sumber** (`/path/ke/project/`) agar isi folder
tersalin, termasuk file tersembunyi seperti `.env.example`.

### Jika proyek sudah di Git

```bash
git clone <url-repo> /opt/saku-keluarga
```

### Masuk ke server

```bash
ssh user@192.168.1.10
cd /opt/saku-keluarga
ls -la
```

Pastikan terlihat:

```text
docker-compose.yml
package.json
apps/
packages/
.env.example
```

> `.env.example` diawali titik sehingga **tersembunyi**. `ls` biasa tidak
> menampilkannya; gunakan `ls -la`.

---

## 3. Membuat file `.env`

`.env.example` adalah contoh. File yang benar-benar dipakai adalah `.env`.

```bash
cd /opt/saku-keluarga

# Kalau .env.example ada:
cp .env.example .env

# Kalau tidak ada, buat langsung:
nano .env
```

### Buat nilai acak

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 24      # BOT_TOKEN
openssl rand -hex 16      # POSTGRES_PASSWORD
```

### Isi `.env`

```dotenv
# ─── Database ────────────────────────────────────────────────────────────────
POSTGRES_USER=saku
POSTGRES_PASSWORD=hasil_openssl_hex_16
POSTGRES_DB=saku

# ─── Dashboard ───────────────────────────────────────────────────────────────
APP_PORT=3000
APP_TIMEZONE=Asia/Jakarta
COOKIE_SECURE=0

AUTH_SECRET=hasil_openssl_rand_base64_32

# ─── Admin pertama ───────────────────────────────────────────────────────────
ADMIN_NAME=Admin
ADMIN_WA_NUMBER=6281234567890
ADMIN_PASSWORD=password-dashboard-yang-kuat

# ─── Bot WhatsApp ────────────────────────────────────────────────────────────
BOT_TOKEN=hasil_openssl_rand_hex_24

# ─── Opsional ────────────────────────────────────────────────────────────────
LOG_LEVEL=info
```

### Aturan penting

| Aturan | Alasan |
| --- | --- |
| `POSTGRES_PASSWORD` minimal 12 karakter dan aman untuk URL | Nilainya dimasukkan ke `DATABASE_URL`. Hindari `@ : / # ? &` dan spasi. |
| `AUTH_SECRET` minimal 32 karakter | Dipakai untuk menandatangani cookie login. Entrypoint menolak yang lebih pendek. |
| `BOT_TOKEN` minimal 24 karakter dan sama untuk `web` dan `wa` | Keduanya membaca `.env` yang sama. |
| `ADMIN_NAME` harus unik | Nama bisa dipakai untuk login selain nomor WhatsApp. |
| `ADMIN_WA_NUMBER` boleh `08...` atau `62...` | Aplikasi menormalkannya ke format `62...`. |
| `ADMIN_PASSWORD` minimal 8 karakter (12+ disarankan) | Dipakai saat akun admin pertama dibuat. Entrypoint memberi peringatan jika < 12. |
| Jangan pakai nilai contoh | Entrypoint menolak `POSTGRES_PASSWORD`, `AUTH_SECRET`, dan `ADMIN_PASSWORD` contoh. |

Amankan file:

```bash
chmod 600 .env
```

> `.env` tidak ikut Git (sudah ada di `.gitignore`). Jangan pernah membagikannya.

---

## 4. Build dan jalankan

```bash
cd /opt/saku-keluarga
docker compose up -d --build
```

Build pertama bisa memakan waktu **3–10 menit** tergantung server.

Saat container `web` pertama kali start, entrypoint otomatis:

1. Memvalidasi `POSTGRES_PASSWORD` (minimal 12 karakter, aman untuk URL),
   `AUTH_SECRET` (minimal 32 karakter), dan menolak nilai contoh.
2. Menyinkronkan skema database (`prisma db push`).
3. Membuat akun admin dari `ADMIN_*` jika belum ada.

Jika salah satu validasi gagal, container berhenti dengan pesan yang menjelaskan
variabel mana yang perlu diperbaiki. Perbaiki `.env`, lalu jalankan
`docker compose up -d` lagi.

Cek container:

```bash
docker compose ps
```

Yang diharapkan:

```text
NAME                       SERVICE   STATUS
saku-keluarga-db-1         db        running (healthy)
saku-keluarga-web-1        web       running (healthy)
saku-keluarga-wa-1         wa        running (healthy)
```

Kalau ada yang `exited` atau `restarting`, lihat log:

```bash
docker compose logs --tail=100 web
docker compose logs --tail=100 db
docker compose logs --tail=100 wa
```

Ikuti log secara langsung:

```bash
docker compose logs -f wa
```

Tekan `Ctrl+C` untuk berhenti mengikuti log (container tetap jalan).

---

## 5. Verifikasi

### Health dashboard

```bash
curl -s http://localhost:3000/api/health
```

Harus menghasilkan:

```json
{"ok":true}
```

Jika `{"ok":false,"error":"database"}`, database belum siap atau kredensial salah.
Cek:

```bash
docker compose logs --tail=100 db
```

### Health bot

```bash
docker compose exec wa node -e \
  "fetch('http://127.0.0.1:3002/health').then(r=>r.text()).then(console.log)"
```

Harus menghasilkan:

```json
{"ok":true}
```

### Buka dashboard

Dari browser di jaringan rumah:

```text
http://192.168.1.10:3000
```

---

## 6. Login pertama

Gunakan **salah satu**:

- **Nomor WhatsApp:** sesuai `ADMIN_WA_NUMBER`, mis. `6281234567890`
- **Nama admin:** sesuai `ADMIN_NAME`, mis. `Admin`
- **Password:** sesuai `ADMIN_PASSWORD`

Setelah berhasil masuk:

1. Buka **Pengaturan → Keamanan**.
2. Ganti password admin.
3. Simpan password baru di password manager.

> `ADMIN_PASSWORD` di `.env` hanya dipakai saat akun admin **pertama kali dibuat**.
> Mengubahnya setelah itu tidak mengubah password akun yang sudah ada.
> Gunakan menu **Keamanan** di dashboard.

Login dibatasi **5 kegagalan per nama/nomor** dan **20 kegagalan per IP** dalam
15 menit. Jika terkena limit, tunggu sampai jendela waktu berakhir atau restart
container `web` (hitungan disimpan di memori). Jika memakai reverse proxy, pastikan
header `X-Forwarded-For` diteruskan.

---

## 7. Menautkan WhatsApp

1. Login sebagai admin.
2. Buka **Pengaturan → Koneksi WhatsApp**.
3. Tunggu QR muncul. Bot perlu beberapa detik untuk terhubung ke WhatsApp Web.
4. Di HP: **WhatsApp → ⋮ → Perangkat tertaut → Tautkan perangkat**.
5. Scan QR.
6. Panel akan berubah menjadi **“WhatsApp terhubung”**.
7. Kirim pesan uji dari nomor yang terdaftar:

```text
makan siang 25rb
```

Balasan bot akan muncul, dan transaksi tampil di dashboard.

### Catatan

- Gunakan **nomor cadangan**, bukan nomor pribadi utama.
- Sesi disimpan di volume `wa-auth`; tidak perlu scan ulang setiap restart.
- QR berganti otomatis. Panel memuat ulang tiap 6 detik.
- Jika bot logout (perangkat dihapus dari HP), sesi lama dihapus dan QR baru muncul.
- Bot hanya memproses **chat pribadi** (`@s.whatsapp.net`, `@lid`, `@c.us`),
  bukan grup. Self-chat didukung, dan balasan bot tidak diproses ulang.
- Nomor pengirim harus terdaftar sebagai anggota.

### Kalau QR tidak muncul

```bash
docker compose ps
docker compose logs --tail=100 wa
```

Pastikan:

- Container `wa` berjalan.
- `BOT_TOKEN` terisi di `.env`.
- `web` dan `wa` memakai `.env` yang sama.
- Jam server benar.

---

## 8. Menambah anggota keluarga

1. Login sebagai admin.
2. Buka **Pengaturan → Anggota keluarga → Tambah**.
3. Isi:
   - Nama (**harus unik**, bisa dipakai untuk login)
   - Nomor WhatsApp
   - Password awal (minimal 8 karakter)
   - Peran: `Anggota` atau `Admin`
4. Anggota login ke dashboard dengan nomor WhatsApp **atau** nama + password.
5. Saat anggota mengirim WhatsApp dari nomornya, transaksi masuk ke akunnya.

Anggota hanya melihat datanya sendiri. Admin bisa memilih cakupan
**Saya / nama anggota / Semua** di Dashboard, Transaksi, dan Laporan. Default
admin adalah **Semua anggota**; kartu total saldo mengikuti cakupan tersebut,
sedangkan daftar **Dompet saya** tetap milik akun yang login.

---

## 9. Akses dari luar rumah

### Opsi A — Tailscale (paling aman, direkomendasikan)

Tanpa membuka port ke internet:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Install Tailscale juga di HP/laptop yang akan mengakses. Buka dashboard lewat IP
Tailscale server, mis. `http://100.x.y.z:3000`.

### Opsi B — Reverse proxy + HTTPS

Cocok jika ingin memakai domain. Jangan expose port dashboard langsung ke internet.

**1. Bind dashboard ke localhost**

Ubah bagian `ports` di `docker-compose.yml`:

```yaml
ports:
  - "127.0.0.1:${APP_PORT:-3000}:3000"
```

**2. Pasang reverse proxy**

Contoh dengan Caddy (`/etc/caddy/Caddyfile`):

```caddyfile
saku.contoh.com {
    reverse_proxy 127.0.0.1:3000
}
```

**3. Aktifkan cookie secure**

Di `.env`:

```dotenv
COOKIE_SECURE=1
```

**4. Restart**

```bash
docker compose up -d
```

Pastikan DNS domain mengarah ke IP publik rumah dan port 80/443 sudah diteruskan
dengan benar. Aplikasi sudah punya rate limit login in-memory (5 kegagalan per
nama/nomor dan 20 per IP dalam 15 menit), tetapi tetap tambahkan rate limit di
reverse proxy sebagai lapisan kedua. Teruskan header `X-Forwarded-For` agar
pembatasan per IP bekerja.

---


## 10. Operasional harian

### Cek status

```bash
cd /opt/saku-keluarga
docker compose ps
```

### Lihat log

```bash
docker compose logs --tail=100 web
docker compose logs --tail=100 wa
docker compose logs --tail=100 db

# mengikuti log secara langsung
docker compose logs -f wa
```

Compose sudah membatasi log tiap service ke 10 MB × 3 file (`json-file`), jadi
disk tidak akan penuh karena log bot yang panjang. Isi pesan WhatsApp hanya
tercatat jika `LOG_LEVEL=debug`.

### Restart

```bash
docker compose restart
```

Atau satu service:

```bash
docker compose restart wa
```

### Stop tanpa menghapus data

```bash
docker compose down
```

Data tetap ada di volume `db-data` dan `wa-auth`.

### Start lagi

```bash
docker compose up -d
```

> **Jangan** memakai `docker compose down -v` kecuali benar-benar ingin menghapus
> database dan sesi WhatsApp.

### Cek pemakaian resource

```bash
docker stats
```

### Masuk ke database (hati-hati)

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Keluar dengan `\q`.

---

## 11. Backup dan restore

Data utama ada di volume `db-data`. Backup rutin sangat disarankan.

### Backup manual

```bash
cd /opt/saku-keluarga
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  > ~/saku-backup-$(date +%F).sql
```

Simpan file hasil backup di mesin lain (NAS, laptop, atau cloud storage).

### Backup otomatis harian (cron)

Buat folder backup:

```bash
sudo mkdir -p /mnt/backup/saku
sudo chown $USER:$USER /mnt/backup/saku
```

Buka crontab:

```bash
crontab -e
```

Tambahkan (perhatikan `\%` pada `date`):

```cron
0 2 * * * cd /opt/saku-keluarga && docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' > /mnt/backup/saku/saku-$(date +\%F).sql

30 2 * * * find /mnt/backup/saku -name 'saku-*.sql' -mtime +30 -delete
```

Baris kedua menghapus backup lebih dari 30 hari.

### Restore

```bash
cd /opt/saku-keluarga

# hentikan aplikasi agar tidak ada penulisan saat restore
docker compose stop web wa

cat ~/saku-backup-2026-10-22.sql | docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

docker compose start web wa
```

Dump dibuat dengan `--clean --if-exists`, sehingga objek lama akan ditimpa.

### Uji restore

Lakukan uji restore ke database terpisah secara berkala. Backup yang belum pernah
diuji belum bisa dipastikan berhasil.

### Sesi WhatsApp

Sesi ada di volume `wa-auth`. Kalau volume hilang, cukup scan QR lagi — data
transaksi tidak terpengaruh.

---

## 12. Update aplikasi

Selalu backup dulu:

```bash
cd /opt/saku-keluarga
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  > ~/saku-sebelum-update-$(date +%F).sql
```

Salin versi baru proyek ke folder yang sama, lalu:

```bash
docker compose up -d --build
```

Cek:

```bash
docker compose ps
docker compose logs --tail=100 web
curl -s http://localhost:3000/api/health
```

### Peringatan skema

Proyek ini memakai `prisma db push`, **bukan file migrasi**. Perubahan skema yang
destruktif bisa menghapus kolom atau data. Selalu backup sebelum update yang
mengubah `packages/db/prisma/schema.prisma`.

---

## 13. Pindah server

### Di server lama

1. Backup database:

```bash
cd /opt/saku-keluarga
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  > ~/saku-pindah-server.sql
```

2. Salin ke server baru:

```bash
scp ~/saku-pindah-server.sql user@server-baru:/tmp/
```

3. Salin proyek dan `.env` (jangan lupa file tersembunyi):

```bash
rsync -av \
  --exclude node_modules \
  --exclude .next \
  /path/ke/project/ user@server-baru:/opt/saku-keluarga/
```

### Di server baru

1. Install Docker.
2. Jalankan database saja:

```bash
cd /opt/saku-keluarga
docker compose up -d db
```

3. Restore:

```bash
cat /tmp/saku-pindah-server.sql | docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

4. Jalankan semua service:

```bash
docker compose up -d --build
```

5. Scan QR WhatsApp lagi (kecuali volume `wa-auth` ikut dipindahkan).
6. Uji login dan kirim pesan WhatsApp.

---

## 14. Troubleshooting

### `web` langsung berhenti

```bash
docker compose logs --tail=100 web
```

Penyebab umum:

- `AUTH_SECRET` masih nilai contoh atau kurang dari 32 karakter.
- `POSTGRES_PASSWORD` masih nilai contoh, kurang dari 12 karakter, atau
  mengandung karakter yang merusak `DATABASE_URL`.
- `ADMIN_PASSWORD` masih nilai contoh.
- Database belum siap.

### Health database gagal

```bash
curl -s http://localhost:3000/api/health
docker compose logs --tail=100 db
```

Pastikan `POSTGRES_*` di `.env` konsisten. Jika password diubah setelah volume
database dibuat, password lama masih tersimpan di Postgres.

### Login gagal

- Pastikan nomor memakai format `62...`, atau gunakan nama unik yang terdaftar.
- Jika muncul “Terlalu banyak percobaan login”, tunggu 15 menit atau restart
  container `web`. Hitungan rate limit disimpan di memori.
- Ingat: `ADMIN_PASSWORD` hanya berlaku saat admin pertama dibuat.
- Kalau masih sempat login, ubah lewat **Pengaturan → Keamanan**.
- Kalau benar-benar terkunci, restore backup atau buat ulang instance (data hilang).

### QR WhatsApp tidak muncul

```bash
docker compose ps
docker compose logs --tail=100 wa
```

- Pastikan container `wa` hidup.
- Pastikan `BOT_TOKEN` terisi.
- Restart bot:

```bash
docker compose restart wa
```

### Bot terputus terus

Cek log. Jika tertulis `loggedOut`, sesi dihapus dan QR baru muncul — scan ulang.
Jika hanya koneksi terputus, bot mencoba reconnect otomatis tiap 3 detik.

### Pesan masuk tetapi tidak dicatat

- Nomor pengirim harus terdaftar di **Pengaturan → Anggota keluarga**.
- Hanya chat pribadi yang diproses; grup diabaikan.
- Cek `docker compose logs --tail=100 wa`.

### Tanggal atau laporan bergeser

Samakan `APP_TIMEZONE` dan timezone server, lalu restart:

```bash
sudo timedatectl set-timezone Asia/Jakarta
# pastikan APP_TIMEZONE=Asia/Jakarta di .env
docker compose up -d
```

### Port 3000 sudah dipakai

Ubah `APP_PORT` di `.env`:

```dotenv
APP_PORT=3001
```

Lalu:

```bash
docker compose up -d
```

Akses di `http://192.168.1.10:3001`.

### Build kehabisan memori

Tambahkan swap (lihat bagian [Persiapan server](#1-persiapan-server)) atau build
di mesin lain dengan **arsitektur yang sama** (ARM64 untuk Raspberry Pi) lalu
salin image. Jangan memakai image hasil build x64 di Pi. Untuk homeserver kecil,
swap biasanya cukup.

### Build gagal di Raspberry Pi (`EBADPLATFORM` / arsitektur)

- Cek `uname -m`; harus `aarch64`. Raspberry Pi OS 32-bit (`armv7l`) tidak didukung.
- Pastikan `package.json` tidak memuat `@next/swc-linux-x64-gnu` atau paket SWC
  khusus x64 lain. Project ini mengandalkan dependensi opsional Next.js yang
  otomatis memilih `linux-arm64` saat `npm ci` di Pi.
- Jika lockfile atau `node_modules` berasal dari mesin x64, hapus `node_modules`
  dan jalankan `npm ci` ulang di Pi (atau build ulang image tanpa cache:
  `docker compose build --no-cache web`).
- Jangan menyalin image hasil build x64 ke Pi. Build di Pi atau gunakan buildx
  multi-arch.
- Jika build berhenti dengan `Killed`/kehabisan memori, tambahkan swap.

---

## 15. Checklist keamanan

- [ ] `AUTH_SECRET` (32+), `BOT_TOKEN` (24+), `POSTGRES_PASSWORD` (12+), dan
      `ADMIN_PASSWORD` sudah diganti dengan nilai acak.
- [ ] `ADMIN_NAME` unik dan tidak bentrok dengan anggota lain.
- [ ] Password admin sudah diubah lewat dashboard.
- [ ] `.env` memiliki permission `600` dan tidak dibagikan.
- [ ] Rate limit reverse proxy aktif jika dashboard terbuka ke internet.
- [ ] Dashboard hanya diakses via LAN, Tailscale, atau HTTPS.
- [ ] Port `5432` dan `3002` tidak terbuka ke internet.
- [ ] `COOKIE_SECURE=1` jika memakai HTTPS.
- [ ] Bot memakai nomor WhatsApp cadangan.
- [ ] Backup otomatis berjalan dan pernah diuji restore.
- [ ] `docker compose down` tidak pernah memakai `-v` tanpa sengaja.
- [ ] Timezone server dan `APP_TIMEZONE` sama.

---

## 16. Ringkasan perintah

### Deploy pertama

```bash
# di server
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# salin proyek ke /opt/saku-keluarga, lalu
cd /opt/saku-keluarga
cp .env.example .env
nano .env

docker compose up -d --build
docker compose ps
curl -s http://localhost:3000/api/health
```

### Harian

```bash
cd /opt/saku-keluarga

docker compose ps                    # status
docker compose logs -f wa            # log bot
docker compose restart               # restart semua
docker compose down                  # stop, data aman
docker compose up -d                 # start lagi
```

### Backup

```bash
cd /opt/saku-keluarga
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  > ~/saku-backup-$(date +%F).sql
```

### Update

```bash
cd /opt/saku-keluarga
# backup dulu, lalu salin versi baru
docker compose up -d --build
docker compose ps
```

### Lokasi penting

| Item | Lokasi |
| --- | --- |
| Konfigurasi | `/opt/saku-keluarga/.env` |
| Database | volume Docker `saku-keluarga_db-data` |
| Sesi WhatsApp | volume Docker `saku-keluarga_wa-auth` |
| Kode aplikasi | `/opt/saku-keluarga` |
| Log container | `docker compose logs` |

---

## Lampiran: perintah Docker yang sering dipakai

```bash
# melihat semua container + volume
docker compose ps
docker volume ls

# melihat detail container
docker inspect saku-keluarga-web-1

# restart satu service
docker compose restart web

# build ulang tanpa cache (kalau build bermasalah)
docker compose build --no-cache web
docker compose up -d

# menghapus container yang sudah stop (data tidak terhapus)
docker compose down --remove-orphans

# melihat pemakaian disk Docker
docker system df

# membersihkan image/container lama (hati-hati, jangan pakai --volumes)
docker system prune
```

> `docker system prune --volumes` bisa menghapus volume database. Hindari kecuali
> kamu benar-benar tahu konsekuensinya.

---

Dokumen ini boleh disalin, dicetak, atau diubah sesuai kebutuhan.
Untuk referensi fitur dan pemakaian bot, lihat [`README.md`](README.md).
