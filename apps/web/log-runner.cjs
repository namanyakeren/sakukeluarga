/**
 * Menjalankan Next.js sambil menyalin seluruh stdout/stderr ke file log
 * terstruktur (JSON per baris) agar bisa dibaca dari dashboard admin.
 *
 * Log tetap diteruskan ke stdout/stderr supaya `docker compose logs` bekerja.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const LOG_DIR = process.env.WEB_LOG_DIR || "/logs";
const LOG_FILE = path.join(LOG_DIR, "web.log");
const MAX_BYTES = Math.max(64 * 1024, Number(process.env.LOG_MAX_BYTES || 5 * 1024 * 1024));
const MAX_FILES = Math.max(1, Number(process.env.LOG_MAX_FILES || 3));

let fd = null;
let size = 0;

function openFile() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fd = fs.openSync(LOG_FILE, "a");
    size = fs.fstatSync(fd).size;
  } catch (error) {
    fd = null;
    process.stderr.write(`[log-runner] File log nonaktif (${LOG_FILE}): ${error.message}\n`);
  }
}

function rotate() {
  try {
    if (fd !== null) fs.closeSync(fd);
  } catch {
    // abaikan
  }
  fd = null;

  for (let index = MAX_FILES - 1; index >= 1; index -= 1) {
    const from = index === 1 ? LOG_FILE : `${LOG_FILE}.${index - 1}`;
    const to = `${LOG_FILE}.${index}`;
    try {
      if (fs.existsSync(from)) fs.renameSync(from, to);
    } catch {
      // abaikan
    }
  }

  openFile();
}

function append(record) {
  try {
    if (fd === null) openFile();
    if (fd === null) return;

    const buffer = Buffer.from(`${record}\n`);
    if (size > 0 && size + buffer.length > MAX_BYTES) rotate();
    if (fd === null) return;

    fs.writeSync(fd, buffer);
    size += buffer.length;
  } catch {
    // Jangan sampai kegagalan log menghentikan aplikasi.
  }
}

function write(level, message) {
  const text = message.toString();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    append(
      JSON.stringify({
        level,
        time: Date.now(),
        service: "web",
        msg: line,
      }),
    );
  }
}

openFile();
write(30, `[log-runner] Mulai Next.js (log: ${LOG_FILE})`);

const port = process.env.PORT || "3000";
const hostname = process.env.HOSTNAME || "0.0.0.0";

let nextBin;
try {
  nextBin = require.resolve("next/dist/bin/next");
} catch (error) {
  write(50, `[log-runner] Tidak menemukan Next.js: ${error.message}`);
  process.exit(1);
}

const child = spawn(process.execPath, [nextBin, "start", "-p", port, "-H", hostname], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  write(30, chunk);
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
  write(50, chunk);
});

child.on("error", (error) => {
  write(50, `[log-runner] Gagal menjalankan Next.js: ${error.message}`);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    write(30, `[log-runner] Menerima ${signal}, menghentikan web...`);
    try {
      child.kill(signal);
    } catch {
      // abaikan
    }
  });
}

child.on("exit", (code, signal) => {
  write(
    code === 0 ? 30 : 50,
    `[log-runner] Next.js berhenti (code=${code ?? "null"}, signal=${signal ?? "null"})`,
  );
  process.exit(code ?? 1);
});
