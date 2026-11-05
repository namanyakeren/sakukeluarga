import fs from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";
import pino from "pino";

const LEVEL = (process.env.LOG_LEVEL?.trim() || "info") as pino.Level;
const LOG_DIR = process.env.WA_LOG_DIR?.trim() || "/logs";
const LOG_FILE = path.join(LOG_DIR, "wa.log");
const MAX_BYTES = Math.max(64 * 1024, Number(process.env.LOG_MAX_BYTES ?? 5 * 1024 * 1024));
const MAX_FILES = Math.max(1, Number(process.env.LOG_MAX_FILES ?? 3));

/**
 * Stream file sederhana dengan rotasi ukuran. File aktif bernama `wa.log`,
 * file lama menjadi `wa.log.1`, `wa.log.2`, dst. Tujuannya supaya log tidak
 * tumbuh tanpa batas di volume Docker.
 */
class RotatingFileStream extends Writable {
  private fd: number | null = null;
  private size = 0;

  constructor(
    private readonly file: string,
    private readonly maxBytes: number,
    private readonly maxFiles: number,
  ) {
    super();
    this.open();
  }

  private open(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      this.fd = fs.openSync(this.file, "a");
      this.size = fs.fstatSync(this.fd).size;
    } catch (error) {
      this.fd = null;
      process.stderr.write(
        `[logger] File log nonaktif (${this.file}): ${(error as Error).message}\n`,
      );
    }
  }

  private rotate(): void {
    try {
      if (this.fd !== null) fs.closeSync(this.fd);
    } catch {
      // abaikan
    }
    this.fd = null;

    for (let index = this.maxFiles - 1; index >= 1; index -= 1) {
      const from = index === 1 ? this.file : `${this.file}.${index - 1}`;
      const to = `${this.file}.${index}`;
      try {
        if (fs.existsSync(from)) fs.renameSync(from, to);
      } catch {
        // abaikan kegagalan rotasi; log tetap ditulis ke file aktif
      }
    }

    this.open();
  }

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    try {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (this.fd === null) this.open();
      if (this.fd === null) {
        callback();
        return;
      }
      if (this.size > 0 && this.size + buffer.length > this.maxBytes) {
        this.rotate();
      }
      if (this.fd !== null) {
        fs.writeSync(this.fd, buffer);
        this.size += buffer.length;
      }
    } catch {
      // Jangan sampai kegagalan menulis log menjatuhkan bot.
    }
    callback();
  }
}

const streams: pino.StreamEntry[] = [
  { level: LEVEL, stream: pino.destination({ dest: 1, sync: false }) },
];

try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.accessSync(LOG_DIR, fs.constants.W_OK);
  streams.push({
    level: LEVEL,
    stream: new RotatingFileStream(LOG_FILE, MAX_BYTES, MAX_FILES),
  });
} catch (error) {
  process.stderr.write(
    `[logger] Tidak bisa menulis ${LOG_FILE}: ${(error as Error).message}. Log hanya ke stdout.\n`,
  );
}

export const logger = pino(
  {
    level: LEVEL,
    base: { service: "wa" },
  },
  pino.multistream(streams),
);
