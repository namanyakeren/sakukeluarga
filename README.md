# Saku Keluarga 💸

Pencatat pemasukan & pengeluaran keluarga yang bisa dipakai lewat **WhatsApp**.
Kirim pesan seperti `makan siang 25rb` atau `gaji 8jt`, lalu lihat rekapnya di
dashboard web. Setiap anggota keluarga punya dompet, kategori, dan laporan sendiri;
admin bisa melihat gabungan seluruh keluarga.

Cocok dijalankan di homeserver dengan Docker Compose. Tanpa WhatsApp Business API,
tanpa biaya bulanan.

---

## Daftar isi

- [Fitur](#fitur)
- [Arsitektur](#arsitektur)
- [Menjalankan dengan Docker](#menjalankan-dengan-docker)
- [Login pertama](#login-pertama)
- [Menautkan WhatsApp](#menautkan-whatsapp)
- [Menambah anggota keluarga](#menambah-anggota-keluarga)
- [Pemakaian bot](#pemakaian-bot)
- [Dashboard web](#dashboard-web)
- [Pengembangan lokal](#pengembangan-lokal)
- [Konfigurasi](#konfigurasi)
- [Backup & restore](#backup--restore)
- [Update aplikasi](#update-aplikasi)
- [Keamanan](#keamanan)
- [Troubleshooting](#troubleshooting)
- [Batasan](#batasan)
- [Struktur proyek](#struktur-proyek)

---

## Fitur

- **Input bahasa Indonesia bebas** — `makan siang 25rb`, `bayar listrik 350.000 kemarin`,
  `gaji 8jt`, `1,5jt`, `Rp 25.000`, `@bca`, `#makan`.
- **Perintah tegas** — `/saldo`, `/laporan`, `/transfer`, `/keluar`, `/masuk`, `/undo`,
  `/dompet`, `/kategori`, `/bantuan`.
- **Multi-anggota** — tiap nomor WhatsApp terhubung ke satu akun. Dompet, kategori,
  dan laporan terpisah. Admin bisa memilih tampilan **saya / anggota / semua**.
- **Dompet & saldo otomatis** — tunai, bank, e-wallet. Saldo dihitung dari saldo awal
  + pemasukan − pengeluaran ± transfer.
- **Transfer antar dompet** — tidak dihitung sebagai pemasukan/pengeluaran.
- **Dashboard web** — ringkasan bulan ini, tren 6 bulan, transaksi terbaru,
  grafik kategori, filter, pencarian, pagination, ekspor CSV.
- **Kategori otomatis** — kategori ditebak dari kata kunci catatan, atau pilih manual
  dengan `#tag`. Kategori & dompet bisa diubah dari web.
- **Panel WhatsApp** — status koneksi dan QR code langsung di halaman Pengaturan.
- **Anti-duplikat** — ID pesan WhatsApp disimpan, pesan ulang saat reconnect tidak
  dicatat dua kali.
- **Zona waktu Indonesia** — `Asia/Jakarta` (bisa diganti), sehingga “kemarin”,
  “bulan ini”, dan laporan mengikuti waktu lokal.

---

## Arsitektur

```
WhatsApp ──► apps/wa (Baileys) ──┐
                                 ├──► PostgreSQL ◄── apps/web (Next.js)
Dashboard ──► /api/wa ───────────┘         ▲
                    │                      │
                    └──► apps/wa :3002/status (token)
```

- **`apps/web`** — Next.js 15 (App Router), React 19, Tailwind CSS 4, auth JWT
  di cookie `httpOnly`, server actions untuk CRUD.
- **`apps/wa`** — bot Baileys (WhatsApp Web tidak resmi), parser pesan, balasan otomatis.
- **`packages/db`** — skema Prisma + service bersama (saldo, ringkasan, pencatatan).
- **`packages/shared`** — parser bahasa Indonesia, format Rupiah/tanggal, util tanggal.

Bot menulis langsung ke PostgreSQL lewat `@saku/db`; tidak ada jalur tulis HTTP
tambahan. Server HTTP kecil di bot hanya untuk status/QR dan dilindungi `BOT_TOKEN`.

---

## Menjalankan dengan Docker

### Prasyarat

- Docker Engine + Docker Compose v2 (`docker compose version`).
- Nomor WhatsApp untuk bot. **Sebaiknya nomor terpisah** dari nomor pribadi utama.
- Port `3000` (atau `APP_PORT` lain) bebas di host.

### 1. Siapkan konfigurasi

```bash
cp .env.example .env
```

Buka `.env` dan isi minimal:

```dotenv
POSTGRES_PASSWORD=password-db-yang-kuat-dan-aman-untuk-url

AUTH_SECRET=hasil-openssl-rand-base64-32
BOT_TOKEN=hasil-openssl-rand-hex-24

ADMIN_NAME=Admin
ADMIN_WA_NUMBER=6281234567890
ADMIN_PASSWORD=password-dashboard-yang-kuat
```

Buat nilai acak:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 24      # BOT_TOKEN
```

> **Penting:** `POSTGRES_PASSWORD` ikut dimasukkan ke `DATABASE_URL`, jadi gunakan
> karakter yang aman untuk URL. Hindari `@`, `:`, `/`, `#`, `?`, `&`, dan spasi.
> Huruf, angka, `-`, `_` aman.

`ADMIN_WA_NUMBER` boleh ditulis `08...`, `62...`, atau `+62 ...`; aplikasi
menormalkannya ke format `62...`. Nomor inilah yang dipakai untuk login pertama.

### 2. Jalankan

```bash
docker compose up -d --build
```

Saat container `web` pertama kali start, entrypoint akan:

1. memvalidasi `AUTH_SECRET` dan `ADMIN_PASSWORD` (menolak nilai contoh),
2. menyinkronkan skema database dengan `prisma db push`,
3. membuat akun admin dari `ADMIN_*` jika belum ada.

Cek status:

```bash
docker compose ps
docker compose logs -f web
docker compose logs -f wa
```

Dashboard tersedia di **`http://<ip-homeserver>:3000`**.

> Container `wa` dan `db` **tidak** membuka port ke host. Hanya dashboard yang
> di-publish. Ini disengaja.

---

## Login pertama

1. Buka `http://<ip-homeserver>:3000`.
2. Masuk dengan nomor WhatsApp admin (tanpa `+`, mis. `6281234567890`) dan
   `ADMIN_PASSWORD`.
3. Segera ganti password lewat **Pengaturan → Keamanan**.

> `ADMIN_PASSWORD` hanya dipakai saat akun admin **pertama kali dibuat**.
> Mengubahnya di `.env` setelah itu **tidak** mengubah password akun yang sudah ada —
> gunakan menu Keamanan di dashboard.

---

## Menautkan WhatsApp

1. Buka **Pengaturan → Koneksi WhatsApp**.
2. Tunggu QR muncul (bot perlu beberapa detik untuk terhubung ke WhatsApp Web).
3. Di HP: **WhatsApp → ⋮ → Perangkat tertaut → Tautkan perangkat**, lalu scan QR.
4. Setelah terhubung, panel berubah menjadi “WhatsApp terhubung”.
5. Kirim pesan uji dari nomor yang terdaftar: `makan siang 25rb`.

QR berganti otomatis setiap beberapa detik; panel memuat ulang tiap 6 detik.
Sesi disimpan di volume Docker `wa-auth`, jadi tidak perlu scan ulang setiap restart.

Jika bot logout (mis. perangkat dihapus dari HP), kredensial lama dihapus otomatis
dan QR baru akan muncul di panel.

> Jika QR tidak muncul, cek `docker compose logs -f wa` dan pastikan `BOT_TOKEN`
> sama di container `web` dan `wa` (keduanya membaca `.env` yang sama).

---

## Menambah anggota keluarga

1. Login sebagai admin.
2. Buka **Pengaturan → Anggota keluarga → Tambah**.
3. Isi nama, nomor WhatsApp, password awal (minimal 8 karakter), dan peran.
4. Anggota bisa login ke dashboard dengan nomor + password tersebut.
5. Saat anggota mengirim pesan dari nomor itu, transaksi otomatis masuk ke akunnya.

Anggota hanya melihat datanya sendiri. Admin bisa memakai pemilih cakupan
(**Saya / nama anggota / Semua**) di Dashboard, Transaksi, dan Laporan.

Nomor yang belum terdaftar akan mendapat balasan sopan berisi instruksi menghubungi
admin (dibatasi sekali per 10 menit agar tidak spam).

---

## Pemakaian bot

Bot hanya memproses **chat pribadi** (`@s.whatsapp.net`), bukan grup, dan mengabaikan
pesan yang dikirim oleh dirinya sendiri.

### Pesan bebas

```text
makan siang 25rb
gaji 8jt
bayar listrik 350.000 kemarin
beli kopi 15rb @bca #makan
2 hari lalu bensin 50k
tanggal 5 jajan 20rb
+bonus 500rb
-bayar servis motor 150rb
```

Format nominal yang dikenali: `25rb`, `25k`, `1,5jt`, `1.5jt`, `25.000`, `Rp 25.000`.
Awalan `+` memaksa pemasukan, `-` memaksa pengeluaran.

Kata kerja pengeluaran (`bayar`, `beli`, `jajan`, dll.) diprioritaskan di atas kata
benda pemasukan, sehingga `bayar gaji ART 1,5jt` tetap dicatat sebagai pengeluaran.

Tanggal yang didukung: `kemarin`, `N hari lalu`, `minggu lalu`, `hari ini`,
`tanggal N`, atau tanpa keterangan (hari ini).

Tag opsional:

- `@nama-dompet` — pilih dompet, mis. `@bca`, `@gopay`. Tanpa tag, dipakai dompet default.
- `#nama-kategori` — pilih kategori, mis. `#makan`, `#transport`.

Kalau tag dompet salah ketik, bot menolak dan menampilkan daftar dompet — bukan
diam-diam mencatat ke dompet default.

### Perintah

| Perintah | Fungsi |
| --- | --- |
| `/saldo` | Saldo tiap dompet + total |
| `/laporan` | Ringkasan bulan ini + top 5 pengeluaran |
| `/laporan 2026-09` | Ringkasan bulan tertentu |
| `/laporan 9` | Bulan September tahun ini |
| `/transfer 100rb @bca @gopay` | Transfer antar dompet |
| `/keluar 25rb makan siang` | Paksa catat pengeluaran |
| `/masuk 8jt gaji` | Paksa catat pemasukan |
| `/undo` | Batalkan transaksi terakhir (maks. 24 jam) |
| `/dompet` | Daftar dompet & saldo |
| `/kategori` | Daftar kategori |
| `/bantuan` | Bantuan |

Transfer hanya memengaruhi saldo dompet dan **tidak** masuk laporan pemasukan/pengeluaran.

---

## Dashboard web

| Halaman | Isi |
| --- | --- |
| **Dashboard** | Ringkasan bulan ini, tren 6 bulan, grafik pengeluaran, transaksi terbaru |
| **Transaksi** | Filter bulan/jenis/dompet/kategori/pencarian, tambah/ubah/hapus, transfer |
| **Laporan** | Pemasukan, pengeluaran, selisih, rasio tabungan, kategori, tren, ekspor CSV |
| **Dompet** | Tambah/ubah dompet, saldo awal, dompet default, arsip/hapus |
| **Kategori** | Kategori pemasukan/pengeluaran, emoji, kata kunci, urutan |
| **Pengaturan** | Profil, nomor WA, password, anggota, status/QR WhatsApp |

Ekspor CSV mengikuti filter laporan yang sedang aktif dan menyertakan nama anggota,
sehingga admin bisa mengekspor data gabungan.

Semua nominal disimpan sebagai **integer Rupiah** (`BigInt`), tanpa desimal.

---

## Pengembangan lokal

Butuh Node.js **20.9+** (disarankan 22) dan PostgreSQL.

### 1. Install dependensi

```bash
npm install
npm run db:generate
```

### 2. Jalankan PostgreSQL

Contoh cepat dengan Docker:

```bash
docker run -d --name saku-db \
  -e POSTGRES_USER=saku \
  -e POSTGRES_PASSWORD=saku \
  -e POSTGRES_DB=saku \
  -p 5432:5432 \
  postgres:16-alpine
```

Atau pakai PostgreSQL yang sudah ada.

### 3. Siapkan environment

```bash
cp .env.example .env
# edit .env, lalu aktifkan DATABASE_URL untuk lokal:
# DATABASE_URL=postgresql://saku:saku@localhost:5432/saku?schema=public
set -a; . ./.env; set +a
export WA_BOT_URL="http://localhost:3002"
export WA_AUTH_DIR="$PWD/apps/wa/data"
```

`npm run db:push` membaca `DATABASE_URL` dari environment, jadi pastikan variabel
tersebut sudah di-export di shell yang sama.

### 4. Siapkan database & admin

```bash
npm run db:push
npm run bootstrap
```

### 5. Jalankan web dan bot

Di dua terminal terpisah (keduanya dengan environment yang sama):

```bash
npm run dev        # dashboard: http://localhost:3000
npm run dev:wa     # bot WhatsApp
```

Saat pertama kali jalan, QR juga tercetak di terminal bot. Status HTTP bot ada di
`http://localhost:3002/health`.

### Perintah berguna

| Perintah | Fungsi |
| --- | --- |
| `npm test` | Tes parser bahasa Indonesia |
| `npm run typecheck` | Typecheck seluruh workspace |
| `npm run build` | Build dashboard produksi |
| `npm run db:push` | Sinkronkan skema Prisma ke database |
| `npm run db:studio` | Buka Prisma Studio |
| `npm run bootstrap` | Buat akun admin dari `ADMIN_*` jika belum ada |

---

## Konfigurasi

| Variabel | Wajib | Default | Keterangan |
| --- | --- | --- | --- |
| `POSTGRES_USER` | ya | `saku` | User database (Docker) |
| `POSTGRES_PASSWORD` | ya | — | Password database; harus aman untuk URL |
| `POSTGRES_DB` | ya | `saku` | Nama database |
| `APP_PORT` | tidak | `3000` | Port dashboard di host |
| `AUTH_SECRET` | ya | — | Kunci JWT; min. 32 karakter acak |
| `APP_TIMEZONE` | tidak | `Asia/Jakarta` | Zona waktu aplikasi |
| `COOKIE_SECURE` | tidak | `0` | Set `1` jika diakses via HTTPS |
| `ADMIN_NAME` | tidak | `Admin` | Nama admin pertama |
| `ADMIN_WA_NUMBER` | ya* | — | Nomor WA admin pertama |
| `ADMIN_PASSWORD` | ya* | — | Password admin pertama (min. 8 karakter) |
| `BOT_TOKEN` | ya | — | Token internal dashboard ↔ bot |
| `LOG_LEVEL` | tidak | `info` | Level log bot |
| `DATABASE_URL` | ya** | — | Diisi otomatis oleh compose |
| `WA_BOT_URL` | tidak | `http://wa:3002` | Alamat status bot dari web |
| `WA_AUTH_DIR` | tidak | `/data/auth` | Lokasi sesi WhatsApp |

\* Diperlukan saat pertama kali membuat admin.
\** Untuk pengembangan lokal di luar Docker.

Jangan commit file `.env`. File itu sudah ada di `.gitignore`.

---

## Backup & restore

Data utama ada di volume `db-data`. Backup rutin sangat disarankan.

### Backup

```bash
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  > saku-backup-$(date +%F).sql
```

Simpan file backup di luar server (mis. NAS atau cloud storage).

### Restore

```bash
docker compose stop web wa
cat saku-backup-2026-10-22.sql | docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose start web wa
```

Sesi WhatsApp ada di volume `wa-auth`. Kalau volume ini hilang, cukup scan QR lagi —
tidak ada data transaksi yang hilang.

Untuk menghapus semua data (termasuk sesi WA):

```bash
docker compose down -v
```

> Perintah di atas **menghapus volume** dan tidak bisa dibatalkan.

---

## Update aplikasi

```bash
# salin versi baru ke folder proyek, lalu:
docker compose up -d --build
```

Container `web` menjalankan `prisma db push` setiap start, jadi perubahan skema
otomatis diterapkan.

> Proyek ini **tidak memakai file migrasi**. `prisma db push` bisa menghapus kolom
> atau data jika skema berubah secara destruktif. **Backup dulu** sebelum update
> yang mengubah `schema.prisma`.

---

## Keamanan

- Dashboard sebaiknya hanya diakses dari LAN, VPN (mis. Tailscale/WireGuard), atau
  di belakang reverse proxy HTTPS.
- Jika memakai HTTPS, set `COOKIE_SECURE=1`.
- Jangan pernah membuka port `3002` (status bot) atau `5432` (Postgres) ke internet.
  Compose sudah tidak mem-publish keduanya.
- Gunakan `AUTH_SECRET`, `BOT_TOKEN`, dan password yang benar-benar acak.
- Ganti `ADMIN_PASSWORD` sebelum container pertama kali dijalankan. Entrypoint
  menolak nilai contoh dari `.env.example`.
- Batasi akses fisik ke homeserver dan file `.env`.
- Bot memakai **Baileys**, implementasi WhatsApp Web tidak resmi. Ada risiko nomor
  diblokir WhatsApp. Gunakan nomor cadangan, bukan nomor utama.
- Login dashboard belum memiliki rate limiting bawaan. Jika dashboard terbuka ke
  internet, tambahkan rate limit di reverse proxy (mis. Caddy/Nginx/Traefik).
- Hapus anggota berarti menghapus seluruh transaksi, dompet, dan kategorinya
  (cascade). Lakukan backup sebelum menghapus.

---

## Troubleshooting

**Dashboard menolak start: “AUTH_SECRET masih memakai nilai contoh”**
Ganti `AUTH_SECRET` di `.env` dengan hasil `openssl rand -base64 32`, lalu
`docker compose up -d`.

**Login gagal padahal password benar**
Pastikan memakai nomor WhatsApp yang benar (format `62...`), dan ingat bahwa mengubah
`ADMIN_PASSWORD` di `.env` tidak mengubah akun yang sudah ada. Gunakan
**Pengaturan → Keamanan** setelah login.

**Bot tidak muncul / QR tidak ada**
```bash
docker compose ps
docker compose logs -f wa
```
Pastikan `BOT_TOKEN` terisi dan sama untuk `web` dan `wa`. Panel akan menampilkan
“Bot belum bisa dihubungi” jika container `wa` mati.

**Bot terputus terus**
Cek log. Jika tertulis `loggedOut`, sesi dihapus dan QR baru muncul — scan ulang.
Jika hanya koneksi terputus, bot mencoba reconnect otomatis tiap 3 detik.

**Pesan masuk tapi tidak dicatat**
- Nomor pengirim harus terdaftar di **Pengaturan → Anggota keluarga**.
- Hanya chat pribadi yang diproses; pesan grup diabaikan.
- Cek `docker compose logs -f wa` untuk error parsing atau database.

**Tanggal/laporan bergeser**
Samakan `APP_TIMEZONE` dan `TZ` container (compose sudah menyetel keduanya dari
`APP_TIMEZONE`). Restart setelah mengubahnya.

**Port 3000 sudah dipakai**
Ubah `APP_PORT` di `.env`, lalu `docker compose up -d`.

**Database tidak bisa diakses**
Pastikan `POSTGRES_PASSWORD` tidak mengandung karakter yang merusak URL. Jika baru
mengubahnya setelah volume dibuat, password lama tetap tersimpan di Postgres —
ubah lewat `ALTER USER` atau hapus volume (data hilang).

---

## Batasan

- Satu instance = satu keluarga. Belum ada organisasi/tenant terpisah.
- Satu sesi WhatsApp per instance.
- Bot hanya membaca teks dan caption gambar/video; belum ada OCR struk atau voice note.
- Belum ada transaksi berulang, anggaran/budget, utang-piutang, atau multi-mata uang.
- Transfer tidak masuk laporan pemasukan/pengeluaran (hanya mengubah saldo dompet).
- `/undo` hanya untuk transaksi terakhir dan maksimal 24 jam; selebihnya hapus via web.
- `prisma db push` tanpa migrasi: nyaman untuk pengembangan, tetapi perubahan skema
  destruktif harus direncanakan dan di-backup.
- Belum ada notifikasi otomatis (mis. pengingat mencatat atau peringatan budget).

---

## Struktur proyek

```
.
├── apps
│   ├── web                 # Dashboard Next.js
│   │   ├── src/app         # Halaman & API route
│   │   ├── src/components  # UI, dialog, chart, panel WA
│   │   └── src/lib         # Auth, query, server actions
│   └── wa                  # Bot WhatsApp (Baileys)
│       └── src             # Koneksi, parser handler, HTTP status
├── packages
│   ├── db                  # Prisma schema, client, service
│   │   ├── prisma
│   │   └── scripts         # bootstrap admin
│   └── shared              # Parser, format Rupiah, tanggal, default kategori
├── docker-compose.yml
├── .env.example
└── package.json            # npm workspaces
```

---

Dibuat untuk pemakaian pribadi/keluarga. Silakan modifikasi sesuai kebutuhan. 🙌
# sakukeluarga
