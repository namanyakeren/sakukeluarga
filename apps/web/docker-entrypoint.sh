#!/bin/sh
set -e

# ── Validasi konfigurasi penting ──────────────────────────────────────────────
if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  echo "[entrypoint] POSTGRES_PASSWORD belum diisi. Isi di .env (minimal 12 karakter)." >&2
  exit 1
fi

if [ "${POSTGRES_PASSWORD}" = "ganti-password-db-ini" ]; then
  echo "[entrypoint] POSTGRES_PASSWORD masih memakai nilai contoh dari .env.example." >&2
  echo "[entrypoint] Ganti dulu, misalnya dengan: openssl rand -hex 16" >&2
  exit 1
fi

if [ "${#POSTGRES_PASSWORD}" -lt 12 ]; then
  echo "[entrypoint] POSTGRES_PASSWORD minimal 12 karakter. Buat dengan: openssl rand -hex 16" >&2
  exit 1
fi

if printf '%s' "${POSTGRES_PASSWORD}" | grep -q '[[:space:]@:/?#&]'; then
  echo "[entrypoint] POSTGRES_PASSWORD mengandung karakter yang merusak DATABASE_URL." >&2
  echo "[entrypoint] Gunakan hanya huruf, angka, tanda hubung (-), dan garis bawah (_)." >&2
  exit 1
fi

if [ -z "${AUTH_SECRET:-}" ]; then
  echo "[entrypoint] AUTH_SECRET belum diisi. Buat dengan: openssl rand -base64 32" >&2
  exit 1
fi

if [ "${AUTH_SECRET}" = "ganti-dengan-hasil-openssl-rand-base64-32" ]; then
  echo "[entrypoint] AUTH_SECRET masih memakai nilai contoh dari .env.example." >&2
  echo "[entrypoint] Ganti dulu dengan hasil: openssl rand -base64 32" >&2
  exit 1
fi

if [ "${#AUTH_SECRET}" -lt 32 ]; then
  echo "[entrypoint] AUTH_SECRET minimal 32 karakter. Buat dengan: openssl rand -base64 32" >&2
  exit 1
fi

if [ -n "${ADMIN_PASSWORD:-}" ] && [ "${ADMIN_PASSWORD}" = "password-pertama-yang-kuat" ]; then
  echo "[entrypoint] ADMIN_PASSWORD masih memakai nilai contoh dari .env.example." >&2
  echo "[entrypoint] Ganti dulu dengan password yang kuat sebelum menjalankan container." >&2
  exit 1
fi

if [ -n "${ADMIN_PASSWORD:-}" ] && [ "${#ADMIN_PASSWORD}" -lt 12 ]; then
  echo "[entrypoint] Peringatan: ADMIN_PASSWORD kurang dari 12 karakter. Gunakan password yang lebih kuat lewat Pengaturan → Keamanan setelah login." >&2
fi

if [ -z "${BOT_TOKEN:-}" ] || [ "${BOT_TOKEN}" = "ganti-dengan-token-acak" ]; then
  echo "[entrypoint] Peringatan: BOT_TOKEN belum diganti. Panel status/QR WhatsApp di dashboard tidak akan bisa terhubung ke bot." >&2
elif [ "${#BOT_TOKEN}" -lt 24 ]; then
  echo "[entrypoint] Peringatan: BOT_TOKEN kurang dari 24 karakter. Buat dengan: openssl rand -hex 24" >&2
fi

cd /app

echo "[entrypoint] Menyinkronkan skema database..."
./node_modules/.bin/prisma db push --schema packages/db/prisma/schema.prisma --skip-generate

echo "[entrypoint] Memastikan akun admin tersedia..."
./node_modules/.bin/tsx packages/db/scripts/bootstrap.ts

cd /app/apps/web
exec "$@"
