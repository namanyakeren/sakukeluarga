import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@saku/db";

export const BACKUP_DIR = process.env.BACKUP_DIR?.trim() || "/backups";

const ALLOWED_EXTENSION = /\.(dump|backup|sql)$/i;
const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

export type BackupKind = "custom" | "plain";

export interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
  kind: BackupKind;
}

export interface BackupInfo {
  name: string;
  size: number;
  createdAt: string;
}

interface DbConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

function dbConfig(): DbConfig {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) throw new Error("DATABASE_URL belum diisi.");

  const url = new URL(raw);
  return {
    host: url.hostname || "db",
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
  };
}

function run(command: string, args: string[]): Promise<CommandResult> {
  const config = dbConfig();

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: {
        ...process.env,
        PGPASSWORD: config.password,
        PGCONNECT_TIMEOUT: "15",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < 8000) stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 8000) stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new Error(
          `Gagal menjalankan ${command}: ${error.message}. Pastikan PostgreSQL client terpasang di image web.`,
        ),
      );
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function connectionArgs(config: DbConfig): string[] {
  return ["-h", config.host, "-p", config.port, "-U", config.user, "-d", config.database];
}

function commandError(command: string, result: CommandResult): string {
  const detail = result.stderr.trim() || result.stdout.trim() || "tanpa detail";
  return `${command} gagal (kode ${result.code}): ${detail.slice(0, 1500)}`;
}

function timestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "")
    .replace("T", "-");
}

function kindOf(name: string): BackupKind {
  return name.toLowerCase().endsWith(".sql") ? "plain" : "custom";
}

export async function ensureBackupDir(): Promise<void> {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

/** Membuat backup baru dengan pg_dump (format custom). */
export async function createBackupFile(prefix = "saku"): Promise<BackupInfo> {
  await ensureBackupDir();

  const name = `${prefix}-${timestamp()}.dump`;
  const file = path.join(BACKUP_DIR, name);
  const config = dbConfig();

  const result = await run("pg_dump", [
    ...connectionArgs(config),
    "--format=custom",
    "--no-owner",
    "--no-acl",
    "--file",
    file,
  ]);

  if (result.code !== 0) {
    await fs.rm(file, { force: true }).catch(() => undefined);
    throw new Error(commandError("pg_dump", result));
  }

  const stat = await fs.stat(file);
  // File dump kosong berarti pg_dump gagal diam-diam; jangan ditawarkan.
  if (stat.size === 0) {
    await fs.rm(file, { force: true }).catch(() => undefined);
    throw new Error("Backup gagal: file hasil dump kosong.");
  }

  return {
    name,
    size: stat.size,
    createdAt: stat.mtime.toISOString(),
  };
}

/** Daftar file backup yang tersedia di volume /backups. */
export async function listBackups(): Promise<BackupFile[]> {
  await ensureBackupDir();

  let names: string[];
  try {
    names = await fs.readdir(BACKUP_DIR);
  } catch {
    return [];
  }

  const files: BackupFile[] = [];
  for (const name of names) {
    if (!ALLOWED_EXTENSION.test(name)) continue;

    try {
      const stat = await fs.stat(path.join(BACKUP_DIR, name));
      if (!stat.isFile()) continue;
      files.push({
        name,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        kind: kindOf(name),
      });
    } catch {
      // file hilang saat dibaca; lewati
    }
  }

  files.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return files;
}

/** Validasi nama backup agar tidak bisa keluar dari folder /backups. */
export function resolveBackupPath(name: string): string {
  const clean = String(name ?? "").trim();
  if (!clean || clean !== path.basename(clean) || clean.includes("..")) {
    throw new Error("Nama file backup tidak valid.");
  }
  if (!ALLOWED_EXTENSION.test(clean)) {
    throw new Error("Format backup harus .dump, .backup, atau .sql.");
  }
  return path.join(BACKUP_DIR, clean);
}

export async function deleteBackupFile(name: string): Promise<void> {
  const file = resolveBackupPath(name);
  await fs.rm(file, { force: true });
}

/**
 * Menyimpan file backup yang diunggah pengguna. Nama asli dipertahankan
 * (dibersihkan) dengan prefiks waktu supaya tidak menimpa backup lain.
 */
export async function saveUploadedBackup(file: File): Promise<string> {
  await ensureBackupDir();

  if (!file || typeof file.size !== "number" || file.size === 0) {
    throw new Error("File backup kosong atau tidak terbaca.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Ukuran file backup maksimal 60 MB.");
  }

  const original = path.basename(file.name || "upload.dump");
  if (!ALLOWED_EXTENSION.test(original)) {
    throw new Error("Format file harus .dump, .backup, atau .sql.");
  }

  const safe = original.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const name = `upload-${timestamp()}-${safe}`;
  const target = path.join(BACKUP_DIR, name);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Cek sederhana: dump custom selalu diawali "PGDMP".
  const isPlain = name.toLowerCase().endsWith(".sql");
  if (!isPlain && buffer.subarray(0, 5).toString("ascii") !== "PGDMP") {
    throw new Error(
      "File bukan dump PostgreSQL format custom yang valid. Gunakan hasil pg_dump -Fc atau file .sql.",
    );
  }

  await fs.writeFile(target, buffer);
  return name;
}

/**
 * Mengembalikan database dari file backup. Sebelum restore, backup pengaman
 * dibuat otomatis. Koneksi Prisma ditutup sementara agar tidak mengganggu
 * proses DROP/CREATE tabel.
 */
export async function restoreBackupFile(name: string): Promise<{
  safetyBackup: string;
  restored: string;
}> {
  const file = resolveBackupPath(name);

  const stat = await fs.stat(file).catch(() => null);
  if (!stat || !stat.isFile() || stat.size === 0) {
    throw new Error("File backup tidak ditemukan atau kosong.");
  }

  const safety = await createBackupFile("pre-restore");
  const config = dbConfig();

  await prisma.$disconnect();

  try {
    const result = file.toLowerCase().endsWith(".sql")
      ? await run("psql", [
          ...connectionArgs(config),
          "-v",
          "ON_ERROR_STOP=1",
          "--single-transaction",
          "-f",
          file,
        ])
      : await run("pg_restore", [
          ...connectionArgs(config),
          "--clean",
          "--if-exists",
          "--no-owner",
          "--no-acl",
          "--single-transaction",
          file,
        ]);

    if (result.code !== 0) {
      throw new Error(commandError(file.endsWith(".sql") ? "psql" : "pg_restore", result));
    }
  } finally {
    await prisma.$connect().catch(() => undefined);
  }

  return { safetyBackup: safety.name, restored: name };
}
