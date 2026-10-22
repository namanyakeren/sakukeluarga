import { prisma } from "@saku/db";
import { startBot, shutdown, state } from "./bot";
import { startStatusServer } from "./http";

const port = Number(process.env.BOT_HTTP_PORT ?? 3002);

startStatusServer(() => state, port);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum diisi. Bot tidak bisa menyimpan transaksi.");
}

process.on("unhandledRejection", (reason) => {
  console.error("[process] Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[process] Uncaught exception:", error);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`[process] Menerima ${signal}, menutup koneksi...`);
    void shutdown().finally(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  });
}

void startBot();
