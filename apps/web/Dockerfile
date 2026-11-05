# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app

# PostgreSQL 16 client (pg_dump/pg_restore/psql) dari PGDG agar cocok dengan
# server Postgres 16. Repo bawaan Debian bookworm hanya menyediakan versi 15.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl gnupg \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-16 \
  && apt-get purge -y --auto-remove curl gnupg \
  && rm -rf /var/lib/apt/lists/*

# ─── Dependensi (cache-friendly) ─────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/wa/package.json apps/wa/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm config set registry http://registry.npmjs.org/ \
  && npm install --no-audit --no-fund --maxsockets=4

# ─── Build Next.js ───────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
RUN npx prisma generate --schema packages/db/prisma/schema.prisma
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace @saku/web

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder /app ./
COPY apps/web/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && chown -R node:node /app

USER node
WORKDIR /app/apps/web
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "log-runner.cjs"]
