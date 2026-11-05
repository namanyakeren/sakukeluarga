import fs from "node:fs/promises";
import path from "node:path";

const LOG_DIR = process.env.LOG_DIR?.trim() || "/logs";

/** Batas pembacaan dari ekor file agar polling tetap ringan. */
const TAIL_BYTES = 1024 * 1024;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export type LogSource = "web" | "wa";

const FILES: Record<LogSource, string> = {
  web: "web.log",
  wa: "wa.log",
};

const LEVEL_NAMES: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

const MIN_LEVELS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

export interface LogEntry {
  id: string;
  time: number;
  level: number;
  levelName: string;
  source: LogSource;
  msg: string;
  details?: string;
}

export interface LogFileInfo {
  source: LogSource;
  file: string;
  size: number;
  updatedAt: number | null;
}

export interface LogResult {
  entries: LogEntry[];
  files: LogFileInfo[];
  generatedAt: number;
}

export interface LogQuery {
  source?: string;
  level?: string;
  q?: string;
  limit?: number;
}

function levelName(level: number): string {
  if (LEVEL_NAMES[level]) return LEVEL_NAMES[level];
  if (level >= 60) return "fatal";
  if (level >= 50) return "error";
  if (level >= 40) return "warn";
  if (level >= 30) return "info";
  if (level >= 20) return "debug";
  return "trace";
}

function isSource(value: unknown): value is LogSource {
  return value === "web" || value === "wa";
}

async function readTail(file: string): Promise<string> {
  const handle = await fs.open(file, "r");
  try {
    const stat = await handle.stat();
    if (stat.size === 0) return "";

    const start = Math.max(0, stat.size - TAIL_BYTES);
    const length = stat.size - start;
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, start);

    let text = buffer.subarray(0, bytesRead).toString("utf8");
    if (start > 0) {
      const firstBreak = text.indexOf("\n");
      text = firstBreak >= 0 ? text.slice(firstBreak + 1) : "";
    }
    return text;
  } finally {
    await handle.close();
  }
}

function extractDetails(record: Record<string, unknown>): string | undefined {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (["level", "time", "msg", "pid", "hostname", "service"].includes(key)) {
      continue;
    }
    rest[key] = value;
  }
  if (Object.keys(rest).length === 0) return undefined;

  try {
    const text = JSON.stringify(
      rest,
      (_key, value: unknown) => {
        // Baileys sering menyertakan Buffer biner; cukup tampilkan ukurannya.
        if (
          value &&
          typeof value === "object" &&
          (value as { type?: string }).type === "Buffer" &&
          Array.isArray((value as { data?: unknown[] }).data)
        ) {
          return `<Buffer ${(value as { data: unknown[] }).data.length} bytes>`;
        }
        if (typeof value === "string" && value.length > 1000) {
          return `${value.slice(0, 1000)}…`;
        }
        return value;
      },
      2,
    );
    return text.length > 4000 ? `${text.slice(0, 4000)}\n…` : text;
  } catch {
    return undefined;
  }
}

function parseLines(
  text: string,
  source: LogSource,
  fileLabel: string,
  entries: LogEntry[],
): void {
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    let record: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(line) as unknown;
      if (parsed && typeof parsed === "object") {
        record = parsed as Record<string, unknown>;
      }
    } catch {
      // Baris non-JSON (mis. output library) tetap ditampilkan.
    }

    if (!record) {
      entries.push({
        id: `${source}-${fileLabel}-${index}`,
        time: 0,
        level: 30,
        levelName: "info",
        source,
        msg: line,
      });
      continue;
    }

    const level = typeof record.level === "number" ? record.level : 30;
    const time =
      typeof record.time === "number"
        ? record.time
        : typeof record.time === "string"
          ? Date.parse(record.time) || 0
          : 0;
    const msg =
      typeof record.msg === "string"
        ? record.msg
        : typeof record.message === "string"
          ? record.message
          : line;

    entries.push({
      id: `${source}-${fileLabel}-${index}`,
      time,
      level,
      levelName: levelName(level),
      source,
      msg,
      details: extractDetails(record),
    });
  }
}

async function collect(
  source: LogSource,
  files: LogFileInfo[],
  entries: LogEntry[],
): Promise<void> {
  const base = FILES[source];

  // File aktif berisi log terbaru, lalu file rotasi .1, .2, ...
  for (let index = 0; index < 10; index += 1) {
    const name = index === 0 ? base : `${base}.${index}`;
    const fullPath = path.join(LOG_DIR, name);

    try {
      const stat = await fs.stat(fullPath);
      if (!stat.isFile()) continue;

      files.push({
        source,
        file: name,
        size: stat.size,
        updatedAt: stat.mtimeMs,
      });

      if (stat.size > 0) {
        const text = await readTail(fullPath);
        parseLines(text, source, name, entries);
      }
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") continue;
      throw error;
    }
  }
}

export async function readLogs(query: LogQuery = {}): Promise<LogResult> {
  const source = isSource(query.source) ? query.source : "all";
  const requestedLevel = String(query.level ?? "all").toLowerCase();
  const minLevel = MIN_LEVELS[requestedLevel] ?? 0;
  const search = String(query.q ?? "").trim().toLowerCase();
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(query.limit) || DEFAULT_LIMIT),
  );

  const entries: LogEntry[] = [];
  const files: LogFileInfo[] = [];
  const sources: LogSource[] = source === "all" ? ["web", "wa"] : [source];

  for (const item of sources) {
    await collect(item, files, entries);
  }

  let filtered = entries;
  if (minLevel > 0) {
    filtered = filtered.filter((entry) => entry.level >= minLevel);
  }
  if (search) {
    filtered = filtered.filter(
      (entry) =>
        entry.msg.toLowerCase().includes(search) ||
        (entry.details?.toLowerCase().includes(search) ?? false),
    );
  }

  filtered.sort((a, b) => b.time - a.time);
  if (filtered.length > limit) filtered = filtered.slice(0, limit);

  return { entries: filtered, files, generatedAt: Date.now() };
}
