import type { WASocket } from "@whiskeysockets/baileys";
import { logger } from "./logger";

function envNumber(name: string, fallback: number, min = 0): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw < min) return fallback;
  return Math.round(raw);
}

function randomBetween(min: number, max: number): number {
  if (max <= min) return min;
  return Math.round(min + Math.random() * (max - min));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Konfigurasi perlindungan anti-blokir WhatsApp
// ─────────────────────────────────────────────────────────────────────────────

/** Jeda minimum sebelum bot mengirim balasan (ms). */
const SEND_MIN_DELAY_MS = envNumber("WA_SEND_MIN_DELAY_MS", 900, 0);
/** Jeda maksimum sebelum bot mengirim balasan (ms). */
const SEND_MAX_DELAY_MS = Math.max(
  SEND_MIN_DELAY_MS,
  envNumber("WA_SEND_MAX_DELAY_MS", 2600, 0),
);
/** Maksimum pesan keluar per menit. */
const MINUTE_LIMIT = envNumber("WA_MINUTE_MESSAGE_LIMIT", 15, 1);
/** Maksimum pesan keluar per 24 jam. */
const DAILY_LIMIT = envNumber("WA_DAILY_MESSAGE_LIMIT", 1000, 1);
/** Balasan untuk pesan non-teks ditahan selama ini per nomor (ms). */
const NON_TEXT_COOLDOWN_MS = envNumber(
  "WA_NON_TEXT_COOLDOWN_MS",
  30 * 60 * 1000,
  0,
);
/** Durasi indikator "sedang mengetik" (ms). */
const TYPING_MIN_MS = envNumber("WA_TYPING_MIN_MS", 700, 0);
const TYPING_MAX_MS = Math.max(
  TYPING_MIN_MS,
  envNumber("WA_TYPING_MAX_MS", 2200, 0),
);

const DAY_MS = 24 * 60 * 60 * 1000;

/** Waktu kirim pesan keluar, dipakai untuk rate limit 1 menit & 24 jam. */
const sentTimes: number[] = [];
/** Nomor yang sudah diberi tahu bahwa bot hanya membaca teks. */
const nonTextNoticeAt = new Map<string, number>();

function prune(now: number): void {
  const cutoff = now - DAY_MS;
  while (sentTimes.length > 0 && sentTimes[0] < cutoff) sentTimes.shift();
}

function countWithin(now: number, windowMs: number): number {
  let count = 0;
  for (let index = sentTimes.length - 1; index >= 0; index -= 1) {
    if (sentTimes[index] < now - windowMs) break;
    count += 1;
  }
  return count;
}

/**
 * Menunggu sampai kuota per menit tersedia. Mengembalikan false jika kuota
 * harian sudah habis (pesan tidak dikirim agar nomor tidak berisiko diblokir).
 */
async function waitForSlot(): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const now = Date.now();
    prune(now);

    if (sentTimes.length >= DAILY_LIMIT) {
      logger.warn(
        { limit: DAILY_LIMIT },
        "Kuota pesan harian tercapai. Pesan balasan ditahan sampai besok.",
      );
      return false;
    }

    if (countWithin(now, 60_000) < MINUTE_LIMIT) return true;

    const oldestInWindow = sentTimes.find((time) => time >= now - 60_000) ?? now;
    const waitMs = Math.max(1000, oldestInWindow + 60_000 - now + 250);
    logger.info(
      { waitMs, limit: MINUTE_LIMIT },
      "Kuota pesan per menit tercapai, menunggu sebelum mengirim",
    );
    await sleep(waitMs);
  }

  const now = Date.now();
  return countWithin(now, 60_000) < MINUTE_LIMIT;
}

async function setPresence(
  socket: WASocket,
  jid: string,
  state: "composing" | "paused",
): Promise<void> {
  try {
    await socket.sendPresenceUpdate(state, jid);
  } catch (error) {
    logger.debug({ err: error, jid }, "Gagal mengirim status presence");
  }
}

async function deliver(socket: WASocket, jid: string, text: string): Promise<string | null> {
  if (!(await waitForSlot())) return null;

  // Jeda acak sebelum membalas supaya pola kirim tidak seperti mesin.
  await sleep(randomBetween(SEND_MIN_DELAY_MS, SEND_MAX_DELAY_MS));

  // Tampilkan indikator mengetik, durasinya menyesuaikan panjang pesan.
  await setPresence(socket, jid, "composing");
  const typingMs = Math.min(
    TYPING_MAX_MS,
    Math.max(TYPING_MIN_MS, text.length * 28 + randomBetween(150, 650)),
  );
  await sleep(typingMs);
  await setPresence(socket, jid, "paused");

  const sent = await socket.sendMessage(jid, { text });
  sentTimes.push(Date.now());
  prune(Date.now());

  logger.debug(
    { jid, chars: text.length, minuteCount: countWithin(Date.now(), 60_000) },
    "Pesan keluar terkirim",
  );

  return sent?.key?.id ?? null;
}

// Antrean global: semua pesan keluar dikirim berurutan, tidak bersamaan.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Mengirim teks dengan perlindungan anti-blokir: antrean berurutan, jeda
 * acak, indikator mengetik, dan kuota per menit/hari.
 *
 * @returns ID pesan WhatsApp, atau null bila pesan ditahan karena kuota.
 */
export function enqueueText(
  socket: WASocket,
  jid: string,
  text: string,
): Promise<string | null> {
  const task = queue.then(() => deliver(socket, jid, text));
  queue = task.catch(() => undefined);
  return task;
}

/**
 * Membatasi balasan "bot hanya membaca teks" agar tidak dikirim berulang kali
 * ke nomor yang sama. Mengembalikan true jika balasan boleh dikirim.
 */
export function shouldReplyNonText(jid: string): boolean {
  const now = Date.now();
  const last = nonTextNoticeAt.get(jid) ?? 0;
  if (now - last < NON_TEXT_COOLDOWN_MS) return false;

  nonTextNoticeAt.set(jid, now);
  // Bersihkan entri lama supaya map tidak tumbuh terus.
  if (nonTextNoticeAt.size > 500) {
    for (const [key, time] of nonTextNoticeAt) {
      if (now - time > NON_TEXT_COOLDOWN_MS) nonTextNoticeAt.delete(key);
    }
  }
  return true;
}

/** Ringkasan konfigurasi untuk log saat bot mulai. */
export function antiBanConfig() {
  return {
    sendDelayMs: [SEND_MIN_DELAY_MS, SEND_MAX_DELAY_MS],
    minuteLimit: MINUTE_LIMIT,
    dailyLimit: DAILY_LIMIT,
    nonTextCooldownMs: NON_TEXT_COOLDOWN_MS,
  };
}
