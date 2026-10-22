import type { TxKind } from "./types";
import { daysInMonth, partsInTz, shiftDays, zonedToUtc } from "./dates";
import { findAmountCandidates, toRupiah } from "./money";

export interface ParsedTransaction {
  kind: TxKind;
  amount: number;
  note: string;
  categoryHint?: string;
  walletHint?: string;
  occurredAt: Date;
}

export type ParseResult =
  | { ok: true; data: ParsedTransaction }
  | {
      ok: false;
      code: "NO_AMOUNT" | "AMOUNT_TOO_SMALL" | "AMOUNT_TOO_LARGE";
      error: string;
    };

const TAG_RE = /#([\p{L}\p{N}_-]+)/gu;
const MENTION_RE = /@([\p{L}\p{N}_.-]+)/gu;

const STRONG_EXPENSE =
  /\b(keluar|pengeluaran|beli|bayar|jajan|tagihan|cicilan|tarik|top\s?up|sedekah|donasi|investasi|nabung)\b/i;
const STRONG_INCOME =
  /\b(masuk|pemasukan|pendapatan|gaji|gajian|upah|honor|bonus|thr|tunjangan|komisi|untung|laba|jual|terjual|refund|cashback|dividen|hadiah|dapat|dapet|diterima|pendapatan)\b/i;

/**
 * Parser pesan bebas berbahasa Indonesia.
 *
 * Contoh yang didukung:
 *   "makan siang 25rb"
 *   "bayar listrik 350.000 kemarin"
 *   "gaji 8jt"
 *   "beli kopi 15,000 @bca #makan"
 *   "2 hari lalu bensin 50k"
 */
export function parseMessage(input: string, now: Date = new Date()): ParseResult {
  const original = (input ?? "").trim();
  if (!original) {
    return { ok: false, code: "NO_AMOUNT", error: "Pesan kosong." };
  }

  const { text: withoutDate, date } = extractDate(original, now);
  const { text: withoutTags, tags, mentions } = extractTags(withoutDate);

  const candidates = findAmountCandidates(withoutTags);
  if (candidates.length === 0) {
    return {
      ok: false,
      code: "NO_AMOUNT",
      error: "Nominal tidak ditemukan.",
    };
  }

  const best = candidates.sort((a, b) => b.score - a.score || a.index - b.index)[0];

  if (best.value < 100) {
    return {
      ok: false,
      code: "AMOUNT_TOO_SMALL",
      error: "Nominal terlalu kecil.",
    };
  }
  if (best.value > 1_000_000_000_000) {
    return {
      ok: false,
      code: "AMOUNT_TOO_LARGE",
      error: "Nominal terlalu besar.",
    };
  }

  const kind = detectKind(withoutTags, original);
  const withoutAmount =
    withoutTags.slice(0, best.index) + " " + withoutTags.slice(best.index + best.length);
  const note = cleanupNote(withoutAmount);

  return {
    ok: true,
    data: {
      kind,
      amount: best.value,
      note,
      categoryHint: tags[0],
      walletHint: mentions[0],
      occurredAt: date,
    },
  };
}

export function extractTags(text: string): {
  text: string;
  tags: string[];
  mentions: string[];
} {
  const tags: string[] = [];
  const mentions: string[] = [];
  let work = text;
  for (const m of text.matchAll(TAG_RE)) {
    if (m[1]) tags.push(m[1].toLowerCase());
  }
  for (const m of text.matchAll(MENTION_RE)) {
    if (m[1]) mentions.push(m[1].toLowerCase());
  }
  work = work.replace(TAG_RE, " ").replace(MENTION_RE, " ");
  return { text: work, tags, mentions };
}

export function extractDate(text: string, now: Date): { text: string; date: Date } {
  let work = text;
  let date = new Date(now);

  const relativeDays = /\b(\d{1,2})\s+hari\s+(?:yang\s+)?(?:lalu|kemarin)\b/i;
  const relativeMatch = relativeDays.exec(work);
  if (relativeMatch) {
    const n = Number(relativeMatch[1]);
    if (n > 0 && n <= 60) {
      date = shiftDays(now, -n);
      work = work.replace(relativeDays, " ");
    }
  }

  const yesterday = /\b(kemarin|kmrn|kmaren)\b/i;
  if (yesterday.test(work)) {
    date = shiftDays(now, -1);
    work = work.replace(yesterday, " ");
  }

  const lastWeek = /\b(minggu|pekan)\s+lalu\b/i;
  if (lastWeek.test(work)) {
    date = shiftDays(now, -7);
    work = work.replace(lastWeek, " ");
  }

  const today = /\b(hari\s+ini|tadi|barusan|baru\s+aja)\b/i;
  if (today.test(work)) {
    work = work.replace(today, " ");
  }

  const explicitDay = /\b(?:tanggal|tgl|tgal)\s+(\d{1,2})\b/i;
  const explicitMatch = explicitDay.exec(work);
  if (explicitMatch) {
    const day = Number(explicitMatch[1]);
    const p = partsInTz(now);
    if (day >= 1 && day <= 31) {
      let year = p.year;
      let month = p.month;
      let dayInMonth = Math.min(day, daysInMonth(year, month));
      let candidate = zonedToUtc(year, month, dayInMonth, 12, 0, 0);
      // Tanggal yang belum terjadi di bulan ini → anggap bulan lalu.
      if (candidate.getTime() > now.getTime() + 12 * 60 * 60 * 1000) {
        month -= 1;
        if (month < 1) {
          month = 12;
          year -= 1;
        }
        dayInMonth = Math.min(day, daysInMonth(year, month));
        candidate = zonedToUtc(year, month, dayInMonth, 12, 0, 0);
      }
      date = candidate;
      work = work.replace(explicitDay, " ");
    }
  }

  return { text: work, date };
}

function detectKind(work: string, original: string): TxKind {
  const leading = original.trimStart().charAt(0);
  if (leading === "+") return "INCOME";
  if (leading === "-") return "EXPENSE";

  if (/\btransfer\s+masuk\b/i.test(work)) return "INCOME";

  // Kata kerja pengeluaran lebih kuat daripada kata benda pemasukan:
  // "bayar gaji ART 1,5jt" harus tetap pengeluaran.
  if (STRONG_EXPENSE.test(work)) return "EXPENSE";
  if (STRONG_INCOME.test(work)) return "INCOME";
  return "EXPENSE";
}

function cleanupNote(text: string): string {
  const note = text
    .replace(/^\s*(masuk|keluar|pengeluaran|pemasukan|income|expense)\b/i, " ")
    .replace(/\brp\.?(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:,.]+|[\s\-–—:,.]+$/g, "")
    .trim();
  return note.slice(0, 160);
}

export interface CategoryLike {
  id: string;
  name: string;
  emoji?: string;
  keywords?: string[];
  type?: string;
}

/** Cocokkan teks catatan ke kategori berdasarkan kata kunci terpanjang. */
export function guessCategory<T extends CategoryLike>(
  text: string,
  categories: T[],
  kind?: TxKind,
): T | undefined {
  const haystack = ` ${text.toLowerCase()} `;
  let bestScore = 0;
  let best: T | undefined;

  for (const category of categories) {
    if (kind && category.type && category.type !== kind) continue;
    const candidates = [category.name, ...(category.keywords ?? [])];
    for (const rawKeyword of candidates) {
      const keyword = rawKeyword.toLowerCase().trim();
      if (!keyword) continue;
      const matched = keyword.includes(" ")
        ? haystack.includes(` ${keyword} `) || haystack.includes(`${keyword} `)
        : new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(haystack);
      if (matched && keyword.length > bestScore) {
        bestScore = keyword.length;
        best = category;
      }
    }
  }
  return best;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { toRupiah };
