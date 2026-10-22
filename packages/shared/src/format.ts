import type { TxType, WalletType } from "./types";

/** 0812-3456-7890 / +62 812 3456 7890 / 62812... → 6281234567890 */
export function normalizeWaNumber(input: string): string {
  let digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}

export function isValidWaNumber(input: string): boolean {
  const n = normalizeWaNumber(input);
  return /^62\d{8,13}$/.test(n);
}

/** 6281234567890 → +62 8123-4567-890 */
export function formatWaNumber(input: string): string {
  const n = normalizeWaNumber(input);
  if (!n) return "-";
  if (!n.startsWith("62")) return `+${n}`;
  const rest = n.slice(2);
  const grouped = rest.replace(/(\d{4})(?=\d)/g, "$1-");
  return `+62 ${grouped}`;
}

export function walletTypeLabel(type: string): string {
  const map: Record<WalletType, string> = {
    CASH: "Tunai",
    BANK: "Bank",
    EWALLET: "E-Wallet",
    OTHER: "Lainnya",
  };
  return map[type as WalletType] ?? "Lainnya";
}

export function txTypeLabel(type: string): string {
  const map: Record<TxType, string> = {
    INCOME: "Pemasukan",
    EXPENSE: "Pengeluaran",
    TRANSFER: "Transfer",
  };
  return map[type as TxType] ?? type;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
