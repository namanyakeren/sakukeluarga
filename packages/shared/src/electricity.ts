/** Nilai pembacaan meter dan pembelian token listrik. */
export interface ElectricityReadings {
  kwhBefore: number;
  kwhAmount: number;
  kwhAfter: number;
}

export interface ElectricityValues extends ElectricityReadings {
  price: number;
}

export type ElectricityValidation =
  | { ok: true; pricePerKwh: number }
  | { ok: false; error: string };

const MAX_KWH = 100_000_000;
const MAX_PRICE = 1_000_000_000_000;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Membaca angka kWh yang ditulis bebas: `1234,5`, `1234.5`, `1.234,5`,
 * atau `1234,5 kWh`.
 */
export function parseKwh(input: string | number | null | undefined): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? round2(input) : null;
  }

  let text = String(input ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/kwh$/i, "");
  if (!text) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      // Format Indonesia: 1.234,5
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      // Format Inggris: 1,234.5
      text = text.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    const parts = text.split(",");
    if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2) {
      text = parts.join(".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (lastDot >= 0) {
    const parts = text.split(".");
    if (!(parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2)) {
      text = text.replace(/\./g, "");
    }
  }

  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? round2(value) : null;
}

/** 1234.5 → "1.234,5" */
export function formatKwh(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Selisih antara kWh setelah dan kWh sebelum + kWh yang didapat.
 * Nilai 0 berarti pembacaan meter konsisten.
 */
export function electricityMismatch(values: ElectricityReadings): number {
  return round2(values.kwhAfter - (values.kwhBefore + values.kwhAmount));
}

export function validateElectricity(values: ElectricityValues): ElectricityValidation {
  const { kwhBefore, kwhAmount, kwhAfter, price } = values;

  if (![kwhBefore, kwhAmount, kwhAfter, price].every((value) => Number.isFinite(value))) {
    return { ok: false, error: "Angka kWh atau harga tidak valid." };
  }
  if (kwhBefore < 0) {
    return { ok: false, error: "kWh sebelum tidak boleh negatif." };
  }
  if (kwhAfter < 0) {
    return { ok: false, error: "kWh setelah tidak boleh negatif." };
  }
  if (kwhAmount <= 0) {
    return { ok: false, error: "kWh yang didapat harus lebih dari 0." };
  }
  if (kwhBefore > MAX_KWH || kwhAfter > MAX_KWH || kwhAmount > MAX_KWH) {
    return { ok: false, error: "Nilai kWh terlalu besar." };
  }
  if (kwhAfter < kwhBefore) {
    return {
      ok: false,
      error: "kWh setelah tidak boleh lebih kecil dari kWh sebelum.",
    };
  }
  if (price <= 0) {
    return { ok: false, error: "Harga token harus lebih dari 0." };
  }
  if (price > MAX_PRICE) {
    return { ok: false, error: "Harga token terlalu besar." };
  }

  return { ok: true, pricePerKwh: round2(price / kwhAmount) };
}

/** Alias netral untuk angka desimal: kWh, jumlah galon, atau tabung gas. */
export const parseDecimal = parseKwh;
export const formatDecimal = formatKwh;
