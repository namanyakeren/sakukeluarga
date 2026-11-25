/**
 * Satu sumber versi aplikasi. Naikkan APP_VERSION setiap rilis dan catat
 * perubahannya di CHANGELOG.md.
 */
export const APP_VERSION = "0.2.0";
export const APP_VERSION_LABEL = `v${APP_VERSION}`;

export interface AppVersionEntry {
  version: string;
  date: string;
  note: string;
}

/** Riwayat rilis, terbaru di atas. */
export const APP_VERSION_HISTORY: AppVersionEntry[] = [
  {
    version: "0.2.0",
    date: "2026-11-25",
    note: "Token listrik, galon air, dan gas LPG masuk pengeluaran penginput; analisa pemakaian; versi aplikasi.",
  },
  {
    version: "0.1.0",
    date: "2026-10-22",
    note: "Rilis pertama: catat transaksi lewat WhatsApp dan dashboard web.",
  },
];
