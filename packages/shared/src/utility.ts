import { formatDecimal } from "./electricity";

export { formatDecimal as formatQuantity, parseDecimal as parseQuantity } from "./electricity";

/** Barang rumah tangga yang dicatat per jumlah: galon air dan tabung gas LPG. */
export type UtilityKind = "WATER_GALLON" | "LPG_GAS";

export const UTILITY_KINDS: UtilityKind[] = ["WATER_GALLON", "LPG_GAS"];

export const UTILITY_META: Record<
  UtilityKind,
  { label: string; emoji: string; unit: string; categoryHint: string; command: string }
> = {
  WATER_GALLON: {
    label: "Galon air",
    emoji: "💧",
    unit: "galon",
    categoryHint: "galon",
    command: "galon",
  },
  LPG_GAS: {
    label: "Gas LPG",
    emoji: "🔥",
    unit: "tabung",
    categoryHint: "gas",
    command: "gas",
  },
};

export function isUtilityKind(value: unknown): value is UtilityKind {
  return value === "WATER_GALLON" || value === "LPG_GAS";
}

export interface UtilityValues {
  quantity: number;
  price: number;
}

export type UtilityValidation =
  | { ok: true; pricePerUnit: number }
  | { ok: false; error: string };

const MAX_QUANTITY = 10_000;
const MAX_PRICE = 1_000_000_000_000;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function validateUtility(values: UtilityValues): UtilityValidation {
  const { quantity, price } = values;

  if (!Number.isFinite(quantity) || !Number.isFinite(price)) {
    return { ok: false, error: "Jumlah atau harga tidak valid." };
  }
  if (quantity <= 0) {
    return { ok: false, error: "Jumlah harus lebih dari 0." };
  }
  if (quantity > MAX_QUANTITY) {
    return { ok: false, error: "Jumlah terlalu besar." };
  }
  if (price <= 0) {
    return { ok: false, error: "Harga harus lebih dari 0." };
  }
  if (price > MAX_PRICE) {
    return { ok: false, error: "Harga terlalu besar." };
  }

  return { ok: true, pricePerUnit: round2(price / quantity) };
}

/** Catatan transaksi pengeluaran yang dibuat otomatis dari catatan galon/gas. */
export function utilityTransactionNote(
  kind: UtilityKind,
  quantity: number,
  note?: string | null,
): string {
  const meta = UTILITY_META[kind];
  const base = `${meta.label} ${formatDecimal(quantity)} ${meta.unit}`;
  const clean = (note ?? "").trim();
  return (clean ? `${base} · ${clean}` : base).slice(0, 240);
}
