export const APP_TZ = process.env.APP_TIMEZONE?.trim() || "Asia/Jakarta";

export interface TzParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partsFormatter = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = partsFormatter.get(timeZone);
  if (cached) return cached;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  partsFormatter.set(timeZone, fmt);
  return fmt;
}

export function partsInTz(date: Date, timeZone: string = APP_TZ): TzParts {
  const parts = formatterFor(timeZone).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

function timezoneOffsetMs(date: Date, timeZone: string): number {
  const p = partsInTz(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const floored = Math.floor(date.getTime() / 1000) * 1000;
  return asUtc - floored;
}

/** Buat instant UTC dari komponen waktu lokal (default Asia/Jakarta). */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  timeZone: string = APP_TZ,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  let ts = guess - timezoneOffsetMs(new Date(guess), timeZone);
  ts = guess - timezoneOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "2026-10" */
export function monthKey(date: Date = new Date()): string {
  const p = partsInTz(date);
  return `${p.year}-${pad2(p.month)}`;
}

/** "2026-10-22" untuk <input type="date"> */
export function dateKey(date: Date = new Date()): string {
  const p = partsInTz(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function currentMonthKey(): string {
  return monthKey(new Date());
}

/** Rentang [start, end) untuk bulan "YYYY-MM". */
export function monthRange(key: string): { start: Date; end: Date; key: string } {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) {
    return monthRange(currentMonthKey());
  }
  return {
    start: zonedToUtc(y, m, 1, 0, 0, 0),
    end: zonedToUtc(y, m + 1, 1, 0, 0, 0),
    key: `${y}-${pad2(m)}`,
  };
}

export function parseMonthKey(value: string | undefined | null): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}`;
}

/** "Oktober 2026" */
export function monthLabelID(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(zonedToUtc(y, m, 15, 12, 0, 0, "UTC"));
}

/** "Okt" */
export function shortMonthID(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** "22 Okt 2026" */
export function formatDateID(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: APP_TZ,
  }).format(date);
}

/** "22 Okt, 14:05" */
export function formatDateTimeID(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TZ,
  }).format(date);
}

export function shiftDays(date: Date, days: number): Date {
  const p = partsInTz(date);
  return zonedToUtc(p.year, p.month, p.day + days, p.hour, p.minute, p.second);
}

export function startOfDay(date: Date): Date {
  const p = partsInTz(date);
  return zonedToUtc(p.year, p.month, p.day, 0, 0, 0);
}

/** "2026-10-05" (12:00 waktu lokal, aman untuk laporan harian) */
export function dateInputToUtc(value: string, hour = 12): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value || "").trim());
  if (!m) return null;
  return zonedToUtc(Number(m[1]), Number(m[2]), Number(m[3]), hour, 0, 0);
}

export function utcToDateInput(date: Date): string {
  return dateKey(date);
}

/** Daftar "YYYY-MM" terakhir, terbaru di depan. */
export function recentMonths(count: number, from: Date = new Date()): string[] {
  const p = partsInTz(from);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(p.year, p.month - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`);
  }
  return out;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
