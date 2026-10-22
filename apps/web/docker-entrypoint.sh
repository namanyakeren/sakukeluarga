#!/bin/sh
set -e

cd /app

# ── Validasi konfigurasi penting ──────────────────────────────────────────────
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
  echo "[entrypoint] Peringatan: AUTH_SECRET kurang dari 32 karakter. Sebaiknya gunakan: openssl rand -base64 32" >&2
fi

if [ -n "${ADMIN_PASSWORD:-}" ] && [ "${ADMIN_PASSWORD}" = "password-pertama-yang-kuat" ]; then
  echo "[entrypoint] ADMIN_PASSWORD masih memakai nilai contoh dari .env.example." >&2
  echo "[entrypoint] Ganti dulu dengan password yang kuat sebelum menjalankan container." >&2
  exit 1
fi

if [ -z "${BOT_TOKEN:-}" ] || [ "${BOT_TOKEN}" = "ganti-dengan-token-acak" ]; then
  echo "[entrypoint] Peringatan: BOT_TOKEN belum diganti. Panel status/QR WhatsApp di dashboard tidak akan bisa terhubung ke bot." >&2
fi

echo "[entrypoint] Menyinkronkan skema database..."
./node_modules/.bin/prisma db push --schema packages/db/prisma/schema.prisma --skip-generate

echo "[entrypoint] Memastikan akun admin tersedia..."
./node_modules/.bin/tsx packages/db/scripts/bootstrap.ts

cd /app/apps/web
exec "$@"
