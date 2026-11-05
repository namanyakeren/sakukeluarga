import type { User } from "@saku/db";
import { recordElectricityPurchase } from "@saku/db";
import {
  dateInputToUtc,
  electricityMismatch,
  formatDateID,
  formatIDR,
  formatKwh,
  parseAmount,
  parseKwh,
} from "@saku/shared";

export const ELECTRICITY_HELP = [
  "⚡ *Catat token listrik*",
  "",
  "Format:",
  "/listrik <kwh sebelum> <kwh didapat> <kwh setelah> <harga> [tanggal] [catatan]",
  "",
  "Contoh:",
  "• /listrik 1234,5 50 1284,5 150rb",
  "• /listrik 1234,5 50 1284,5 150rb 2026-11-05",
  "• /listrik 1234,5 50 1284,5 150rb 05-11-2026 token november",
  "",
  "Tanggal boleh YYYY-MM-DD atau DD-MM-YYYY. Jika kosong, dipakai hari ini.",
  "Data listrik bersifat umum dan tidak masuk ke dompet anggota.",
].join("\n");

function parseDateToken(token: string): Date | null {
  const value = token.trim();
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (dmy) {
    const iso = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    return dateInputToUtc(iso);
  }
  return dateInputToUtc(value);
}

function looksLikeDate(token: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(token) || /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(token)
  );
}

export async function handleElectricity(
  user: User,
  rest: string,
  raw: string,
): Promise<string> {
  const parts = rest.split(/\s+/).filter(Boolean);
  if (parts.length < 4) return ELECTRICITY_HELP;

  const kwhBefore = parseKwh(parts[0]);
  const kwhAmount = parseKwh(parts[1]);
  const kwhAfter = parseKwh(parts[2]);
  const price = parseAmount(parts[3]);

  if (kwhBefore === null || kwhAmount === null || kwhAfter === null) {
    return [
      "❌ Angka kWh tidak valid.",
      "Contoh: /listrik 1234,5 50 1284,5 150rb",
    ].join("\n");
  }
  if (!price) {
    return `❌ Harga tidak valid. Contoh: /listrik ${parts[0]} ${parts[1]} ${parts[2]} 150rb`;
  }

  let purchasedAt = new Date();
  let noteParts = parts.slice(4);
  const firstExtra = noteParts[0];

  if (firstExtra && looksLikeDate(firstExtra)) {
    const parsed = parseDateToken(firstExtra);
    if (!parsed) {
      return "❌ Tanggal tidak valid. Gunakan YYYY-MM-DD atau DD-MM-YYYY.";
    }
    purchasedAt = parsed;
    noteParts = noteParts.slice(1);
  }

  const note = noteParts.join(" ").trim().slice(0, 240);

  const result = await recordElectricityPurchase({
    purchasedAt,
    kwhBefore,
    kwhAmount,
    kwhAfter,
    price,
    note,
    source: "WA",
    rawMessage: raw,
    createdByUserId: user.id,
    createdByName: user.name,
  });

  if (!result.ok) return `❌ ${result.error}`;

  const purchase = result.purchase;
  const pricePerKwh = purchase.kwhAmount > 0 ? purchase.price / purchase.kwhAmount : 0;
  const mismatch = electricityMismatch(purchase);

  return [
    "⚡ *Token listrik tercatat*",
    "",
    `Meter: *${formatKwh(purchase.kwhBefore)} → ${formatKwh(purchase.kwhAfter)} kWh* (+${formatKwh(purchase.kwhAmount)} kWh)`,
    `Harga: *${formatIDR(purchase.price)}* (${formatIDR(pricePerKwh)}/kWh)`,
    `Tanggal: ${formatDateID(purchase.purchasedAt)}`,
    purchase.note ? `Catatan: ${purchase.note}` : null,
    mismatch !== 0
      ? `⚠️ Selisih meter ${mismatch > 0 ? "+" : "−"}${formatKwh(Math.abs(mismatch))} kWh. Cek kembali angka kWh setelah.`
      : null,
    "",
    "Lihat rekap lengkap di menu *Listrik* pada dashboard.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}
