import { prisma } from "@saku/db";
import { startBot, shutdown, state } from "./bot";
import { startStatusServer } from "./http";
import { logger } from "./logger";

const port = Number(process.env.BOT_HTTP_PORT ?? 3002);

startStatusServer(() => state, port);

if (!process.env.DATABASE_URL) {
  logger.error("DATABASE_URL belum diisi. Bot tidak bisa menyimpan transaksi.");
}

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled rejection");
});

process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught exception");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info({ signal }, "Menerima sinyal, menutup koneksi...");
    void shutdown().finally(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  });
}

void startBot();
