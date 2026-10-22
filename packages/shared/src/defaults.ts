import type { TxType, WalletType } from "./types";
import type { ParsedTransaction } from "./parse";

export interface DefaultCategory {
  name: string;
  type: "INCOME" | "EXPENSE";
  emoji: string;
  keywords: string[];
}

/** Kategori awal untuk setiap pengguna baru. */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Pemasukan
  {
    name: "Gaji",
    type: "INCOME",
    emoji: "💼",
    keywords: ["gaji", "gajian", "upah", "payroll", "thr", "tunjangan", "honor", "komisi"],
  },
  {
    name: "Bonus",
    type: "INCOME",
    emoji: "🎁",
    keywords: ["bonus", "hadiah", "angpao", "sokongan"],
  },
  {
    name: "Usaha",
    type: "INCOME",
    emoji: "🏪",
    keywords: ["jual", "terjual", "omzet", "dagang", "usaha", "laba", "untung", "fee"],
  },
  {
    name: "Investasi",
    type: "INCOME",
    emoji: "📈",
    keywords: ["dividen", "bunga", "investasi", "reksadana", "saham", "crypto", "deposito"],
  },
  {
    name: "Pemasukan Lain",
    type: "INCOME",
    emoji: "💰",
    keywords: ["masuk", "pemasukan", "pendapatan", "refund", "cashback", "dapat", "diterima"],
  },

  // Pengeluaran
  {
    name: "Makan & Minum",
    type: "EXPENSE",
    emoji: "🍜",
    keywords: [
      "makan",
      "minum",
      "jajan",
      "kopi",
      "restoran",
      "warung",
      "food",
      "gofood",
      "grabfood",
      "boba",
      "nasi",
      "sarapan",
      "cafe",
      "kafe",
    ],
  },
  {
    name: "Transport",
    type: "EXPENSE",
    emoji: "🛵",
    keywords: ["bensin", "transport", "ojek", "gojek", "grab", "parkir", "tol", "tiket", "service", "bengkel", "bus", "kereta"],
  },
  {
    name: "Belanja",
    type: "EXPENSE",
    emoji: "🛒",
    keywords: ["belanja", "indomaret", "alfamart", "groceries", "sayur", "pasar", "supermarket", "beli"],
  },
  {
    name: "Tagihan",
    type: "EXPENSE",
    emoji: "🧾",
    keywords: ["tagihan", "listrik", "air", "internet", "pulsa", "kos", "sewa", "langganan", "netflix", "spotify", "iuran", "wifi"],
  },
  {
    name: "Kesehatan",
    type: "EXPENSE",
    emoji: "💊",
    keywords: ["obat", "dokter", "rumah sakit", "klinik", "vitamin", "apotek", "bpjs"],
  },
  {
    name: "Pendidikan",
    type: "EXPENSE",
    emoji: "📚",
    keywords: ["buku", "sekolah", "kursus", "kuliah", "spp", "seragam", "les"],
  },
  {
    name: "Hiburan",
    type: "EXPENSE",
    emoji: "🎬",
    keywords: ["nonton", "bioskop", "game", "liburan", "jalan-jalan", "hibur", "konser", "wisata"],
  },
  {
    name: "Rumah",
    type: "EXPENSE",
    emoji: "🏠",
    keywords: ["sabun", "cuci", "perabot", "renovasi", "dapur", "galon", "gas"],
  },
  {
    name: "Cicilan",
    type: "EXPENSE",
    emoji: "🏦",
    keywords: ["cicilan", "kredit", "utang", "pinjaman", "angsuran", "paylater"],
  },
  {
    name: "Donasi",
    type: "EXPENSE",
    emoji: "🤝",
    keywords: ["donasi", "sedekah", "zakat", "infaq", "sumbangan"],
  },
  {
    name: "Pengeluaran Lain",
    type: "EXPENSE",
    emoji: "📦",
    keywords: ["keluar", "pengeluaran", "lainnya", "lain"],
  },
];

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  CASH: "Tunai",
  BANK: "Bank",
  EWALLET: "E-Wallet",
  OTHER: "Lainnya",
};

export const TX_TYPE_LABELS: Record<TxType, string> = {
  INCOME: "Pemasukan",
  EXPENSE: "Pengeluaran",
  TRANSFER: "Transfer",
};

export interface IncomingTransaction extends ParsedTransaction {
  source: "WA" | "WEB";
}
