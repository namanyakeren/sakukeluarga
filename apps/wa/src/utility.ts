import type { User } from "@saku/db";
import { recordUtilityPurchase } from "@saku/db";
import {
  UTILITY_META,
  formatDateID,
  formatIDR,
  formatQuantity,
  parseAmount,
  parseQuantity,
  type UtilityKind,
} from "@saku/shared";
import { looksLikeDate, parseDateToken } from "./electricity";

export function utilityHelp(kind: UtilityKind): string {
  const meta = UTILITY_META[kind];
  return [
    `${meta.emoji} *Catat ${meta.label.toLowerCase()}*`,
    "",
    "Format:",
    `/${meta.command} <jumlah ${meta.unit}> <total harga> [tanggal] [catatan]`,
    "",
    "Contoh:",
    `• /${meta.command} 2 20rb`,
    `• /${meta.command} 1 25rb 2026-11-05 ${meta.label.toLowerCase()} dapur`,
    "",
    "Tanggal boleh YYYY-MM-DD atau DD-MM-YYYY. Jika kosong, dipakai hari ini.",
    "Harga otomatis tercatat sebagai pengeluaranmu di dompet default.",
  ].join("\n");
}

export async function handleUtility(
  user: User,
  rest: string,
  raw: string,
  kind: UtilityKind,
): Promise<string> {
  const meta = UTILITY_META[kind];
  const parts = rest.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return utilityHelp(kind);

  const quantity = parseQuantity(parts[0]);
  const price = parseAmount(parts[1]);

  if (quantity === null) {
    return [
      `❌ Jumlah ${meta.unit} tidak valid.`,
      `Contoh: /${meta.command} 2 20rb`,
    ].join("\n");
  }
  if (!price) {
    return `❌ Harga tidak valid. Contoh: /${meta.command} ${parts[0]} 20rb`;
  }

  let purchasedAt = new Date();
  let noteParts = parts.slice(2);
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

  const result = await recordUtilityPurchase({
    kind,
    purchasedAt,
    quantity,
    price,
    note,
    source: "WA",
    rawMessage: raw,
    createdByUserId: user.id,
    createdByName: user.name,
  });

  if (!result.ok) return `❌ ${result.error}`;

  const purchase = result.purchase;
  const pricePerUnit = purchase.quantity > 0 ? purchase.price / purchase.quantity : 0;

  return [
    `${meta.emoji} *${meta.label} tercatat*`,
    "",
    `Jumlah: *${formatQuantity(purchase.quantity)} ${meta.unit}*`,
    `Harga: *${formatIDR(purchase.price)}* (${formatIDR(pricePerUnit)}/${meta.unit})`,
    `Tanggal: ${formatDateID(purchase.purchasedAt)}`,
    purchase.note ? `Catatan: ${purchase.note}` : null,
    "",
    `💸 Masuk pengeluaranmu: *${formatIDR(purchase.price)}*`,
    "Lihat rekap di menu *Gas & Galon* pada dashboard.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}
