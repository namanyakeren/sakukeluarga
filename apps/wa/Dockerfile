# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/wa/package.json apps/wa/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm config set registry http://registry.npmjs.org/ && \ 
npm install --no-audit --no-fund --maxsockets=4

COPY . .
RUN npx prisma generate --schema packages/db/prisma/schema.prisma \
  && mkdir -p /data/auth \
  && chown -R node:node /app /data

ENV NODE_ENV=production \
    WA_AUTH_DIR=/data/auth \
    BOT_HTTP_PORT=3002

USER node

EXPOSE 3002

CMD ["./node_modules/.bin/tsx", "apps/wa/src/index.ts"]
