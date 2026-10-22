const formatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

/** Rp25.000 / -Rp1.500.000 */
export function formatIDR(value: number | bigint): string {
  const n = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isFinite(n)) return "Rp0";
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}Rp${formatter.format(Math.abs(rounded))}`;
}

/** 25.000 */
export function formatNumberID(value: number | bigint): string {
  const n = typeof value === "bigint" ? Number(value) : value;
  return formatter.format(Math.round(n));
}

/** Rp1,2 jt — untuk ruang sempit di chart */
export function formatCompactIDR(value: number | bigint): string {
  const n = typeof value === "bigint" ? Number(value) : value;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}Rp${trim(abs / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${sign}Rp${trim(abs / 1_000_000)} jt`;
  if (abs >= 10_000) return `${sign}Rp${trim(abs / 1_000)} rb`;
  return formatIDR(n);
}

function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "").replace(".", ",");
}

/** 25rb / 1,5jt / 25.000 / Rp 25.000 → 25000 */
export function parseAmount(input: string): number | null {
  const candidates = findAmountCandidates(input);
  if (candidates.length === 0) return null;
  const best = candidates.sort((a, b) => b.score - a.score || a.index - b.index)[0];
  return best.value;
}

export const UNIT_MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  rb: 1_000,
  rbu: 1_000,
  ribu: 1_000,
  ribuan: 1_000,
  jt: 1_000_000,
  juta: 1_000_000,
  jutaan: 1_000_000,
  mio: 1_000_000,
  m: 1_000_000,
};

const AMOUNT_PATTERN =
  "(?:\\brp\\.?\\s*)?(\\d{1,3}(?:[.,]\\d{3})+|\\d+(?:[.,]\\d+)?)\\s*(jt|juta|jutaan|ribu|ribuan|rb|rbu|k|mio|m)?(?![a-zA-Z0-9])";

export interface AmountCandidate {
  raw: string;
  value: number;
  score: number;
  index: number;
  length: number;
  unit?: string;
}

export function findAmountCandidates(text: string): AmountCandidate[] {
  const re = new RegExp(AMOUNT_PATTERN, "gi");
  const out: AmountCandidate[] = [];
  for (const match of text.matchAll(re)) {
    const raw = match[0];
    const numberPart = match[1];
    const unit = match[2]?.toLowerCase();
    const value = toRupiah(numberPart, unit);
    if (value === null) continue;
    let score = 0;
    if (unit) score += 4;
    if (/rp/i.test(raw)) score += 5;
    if (/^\d{1,3}(?:[.,]\d{3})+$/.test(numberPart)) score += 3;
    out.push({
      raw,
      value,
      score,
      index: match.index ?? 0,
      length: raw.length,
      unit,
    });
  }
  return out;
}

export function toRupiah(numberPart: string, unit?: string): number | null {
  let s = numberPart.trim();
  if (!s) return null;

  const isGrouped = /^\d{1,3}(?:[.,]\d{3})+$/.test(s);

  if (isGrouped) {
    // 25.000 atau 25,000 → pemisah ribuan
    s = s.replace(/[.,]/g, "");
  } else {
    // 1,5 → 1.5 (desimal gaya Indonesia)
    s = s.replace(",", ".");
  }

  const base = Number(s);
  if (!Number.isFinite(base)) return null;

  const multiplier = unit ? (UNIT_MULTIPLIERS[unit] ?? 1) : 1;
  const value = base * multiplier;

  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}
