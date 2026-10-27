import {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
  type WAMessage,
  type WASocket,
} from "@whiskeysockets/baileys";
import fs from "node:fs";
import path from "node:path";
import qrcode from "qrcode-terminal";
import { logger } from "./logger";
import { handleIncoming, registerLidPhone } from "./messages";

const defaultAuthDir = fs.existsSync("/data")
  ? "/data/auth"
  : path.resolve(__dirname, "../data/auth");
const AUTH_DIR = process.env.WA_AUTH_DIR?.trim() || defaultAuthDir;

export interface BotState {
  connected: boolean;
  qr: string | null;
  me: string | null;
  startedAt: string;
  lastMessageAt: string | null;
}

export const state: BotState = {
  connected: false,
  qr: null,
  me: null,
  startedAt: new Date().toISOString(),
  lastMessageAt: null,
};

let activeSocket: WASocket | null = null;
let connecting = false;
let reconnectTimer: NodeJS.Timeout | null = null;

function scheduleReconnect(delayMs: number): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void startBot();
  }, delayMs);
}

export async function startBot(): Promise<void> {
  if (connecting) return;
  connecting = true;

  try {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    let version: [number, number, number] | undefined;
    try {
      const latest = await fetchLatestBaileysVersion();
      version = latest.version;
      logger.debug({ version }, "Versi WhatsApp Web");
    } catch {
      logger.warn("Gagal mengambil versi WhatsApp terbaru, memakai versi bawaan.");
    }

    const socket = makeWASocket({
      ...(version ? { version } : {}),
      auth: authState,
      logger,
      browser: ["Saku Keluarga", "Chrome", "1.0.0"],
      markOnlineOnConnect: true,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      defaultQueryTimeoutMs: 60_000,
      // Bot tidak menyimpan histori pesan. Pesan lama yang perlu didekripsi
      // ulang (mis. setelah reconnect) tidak akan tersedia; ini pilihan sadar
      // agar penyimpanan tetap ringan. Pesan baru tetap diproses normal.
      getMessage: async (_key) => undefined,
    });

    activeSocket = socket;

    socket.ev.on("creds.update", saveCreds);

    (socket.ev as unknown as { on: (event: string, handler: (data: { lid?: string; jid?: string }) => void) => void }).on(
      "chats.phoneNumberShare",
      ({ lid, jid }: { lid?: string; jid?: string }) => {
        if (lid && jid) {
          registerLidPhone(lid, jid);
        }
      },
    );

    socket.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        state.qr = qr;
        state.connected = false;
        qrcode.generate(qr, { small: true });
        logger.info(
          "Scan QR di atas dengan WhatsApp > Perangkat Tertaut > Tautkan perangkat.",
        );
      }

      if (connection === "open") {
        state.connected = true;
        state.qr = null;
        state.me = socket.user?.id ?? null;
        state.startedAt = new Date().toISOString();
        logger.info({ me: state.me }, "WhatsApp terhubung");
      }

      if (connection === "close") {
        state.connected = false;
        state.qr = null;
        activeSocket = null;

        const statusCode = (
          lastDisconnect?.error as { output?: { statusCode?: number } } | undefined
        )?.output?.statusCode;

        if (statusCode === DisconnectReason.loggedOut) {
          logger.warn(
            "Sesi WhatsApp logout / perangkat dihapus. Menghapus kredensial dan meminta QR baru.",
          );
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch (error) {
            logger.error({ error }, "Gagal menghapus folder sesi");
          }
          scheduleReconnect(3000);
          return;
        }

        logger.warn({ statusCode }, "Koneksi WhatsApp terputus, mencoba menyambung ulang...");
        scheduleReconnect(3000);
      }
    });

    socket.ev.on("messages.upsert", async (update) => {
      if (update.type !== "notify") return;
      for (const message of update.messages as WAMessage[]) {
        try {
          await handleIncoming(socket, message);
          state.lastMessageAt = new Date().toISOString();
        } catch (error) {
          logger.error(
            { error, messageId: message.key?.id },
            "Gagal memproses pesan masuk",
          );
        }
      }
    });
  } catch (error) {
    logger.error({ error }, "Gagal memulai bot, mencoba lagi dalam 5 detik");
    scheduleReconnect(5000);
  } finally {
    connecting = false;
  }
}

export function getSocket(): WASocket | null {
  return activeSocket;
}

export async function shutdown(): Promise<void> {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  try {
    activeSocket?.end(undefined);
  } catch {
    // abaikan
  }
}
