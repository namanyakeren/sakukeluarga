import { createServer } from "node:http";
import type { BotState } from "./bot";

function json(
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

/** Server kecil agar dashboard bisa membaca status & QR bot. */
export function startStatusServer(getState: () => BotState, port: number): void {
  const server = createServer((req, res) => {
    const url = req.url ?? "/";

    if (url === "/health") {
      json(res, 200, { ok: true });
      return;
    }

    if (url === "/status") {
      const expected = process.env.BOT_TOKEN?.trim();
      if (!expected) {
        json(res, 500, { error: "BOT_TOKEN belum dikonfigurasi" });
        return;
      }
      if (req.headers["x-bot-token"] !== expected) {
        json(res, 401, { error: "unauthorized" });
        return;
      }
      json(res, 200, getState());
      return;
    }

    json(res, 404, { error: "not found" });
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[http] Status bot tersedia di port ${port}`);
  });

  server.on("error", (error) => {
    console.error("[http] Gagal membuka port status:", error);
  });
}
