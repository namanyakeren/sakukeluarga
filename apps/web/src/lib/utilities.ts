import { listUtilityPurchases, type UtilityPurchaseView } from "@saku/db";
import {
  monthKey,
  monthLabelID,
  parseMonthKey,
  utcToDateInput,
  type UtilityKind,
} from "@saku/shared";

export interface UtilityRow extends UtilityPurchaseView {
  monthKey: string;
  dateInput: string;
  pricePerUnit: number;
  days: number | null;
}

export interface UtilityMonthRow {
  key: string;
  label: string;
  count: number;
  quantity: number;
  price: number;
  pricePerUnit: number;
}

export interface UtilityData {
  kind: UtilityKind;
  rows: UtilityRow[];
  months: { key: string; label: string }[];
  monthly: UtilityMonthRow[];
  selectedMonth: string;
  summary: {
    count: number;
    totalQuantity: number;
    totalPrice: number;
    avgPricePerUnit: number;
    last: UtilityRow | null;
    avgDaysBetween: number | null;
    perDay: number | null;
    costPerDay: number | null;
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function getUtilityData(
  kind: UtilityKind,
  monthParam?: string,
): Promise<UtilityData> {
  const purchases = (await listUtilityPurchases()).filter(
    (purchase) => purchase.kind === kind,
  );

  const rowsAsc: UtilityRow[] = [];
  let previous: UtilityPurchaseView | null = null;

  for (const item of purchases) {
    const days = previous
      ? Math.max(
          0,
          Math.round(
            (item.purchasedAt.getTime() - previous.purchasedAt.getTime()) / 86_400_000,
          ),
        )
      : null;

    rowsAsc.push({
      ...item,
      monthKey: monthKey(item.purchasedAt),
      dateInput: utcToDateInput(item.purchasedAt),
      pricePerUnit: item.quantity > 0 ? item.price / item.quantity : 0,
      days,
    });
    previous = item;
  }

  const monthlyMap = new Map<string, { count: number; quantity: number; price: number }>();
  for (const row of rowsAsc) {
    const current = monthlyMap.get(row.monthKey) ?? { count: 0, quantity: 0, price: 0 };
    current.count += 1;
    current.quantity += row.quantity;
    current.price += row.price;
    monthlyMap.set(row.monthKey, current);
  }

  const monthly: UtilityMonthRow[] = [...monthlyMap.entries()]
    .map(([key, value]) => {
      const quantity = round2(value.quantity);
      return {
        key,
        label: monthLabelID(key),
        count: value.count,
        quantity,
        price: value.price,
        pricePerUnit: quantity > 0 ? value.price / quantity : 0,
      };
    })
    .sort((a, b) => b.key.localeCompare(a.key));

  const selectedMonth = parseMonthKey(monthParam) ?? "all";
  const allRows =
    selectedMonth === "all"
      ? rowsAsc
      : rowsAsc.filter((row) => row.monthKey === selectedMonth);
  const rows = [...allRows].reverse();

  const totalQuantity = round2(allRows.reduce((sum, row) => sum + row.quantity, 0));
  const totalPrice = allRows.reduce((sum, row) => sum + row.price, 0);

  // Analisa pemakaian memakai seluruh riwayat, bukan hanya bulan terpilih.
  const first = rowsAsc[0] ?? null;
  const last = rowsAsc[rowsAsc.length - 1] ?? null;
  const spanDays =
    first && last ? (last.purchasedAt.getTime() - first.purchasedAt.getTime()) / 86_400_000 : 0;
  const allQuantity = round2(rowsAsc.reduce((sum, row) => sum + row.quantity, 0));
  const allPrice = rowsAsc.reduce((sum, row) => sum + row.price, 0);

  return {
    kind,
    rows,
    months: monthly.map(({ key, label }) => ({ key, label })),
    monthly,
    selectedMonth,
    summary: {
      count: allRows.length,
      totalQuantity,
      totalPrice,
      avgPricePerUnit: totalQuantity > 0 ? totalPrice / totalQuantity : 0,
      last,
      avgDaysBetween:
        rowsAsc.length > 1 ? Math.round(spanDays / (rowsAsc.length - 1)) : null,
      perDay: spanDays >= 1 ? round2(allQuantity / spanDays) : null,
      costPerDay: spanDays >= 1 ? Math.round(allPrice / spanDays) : null,
    },
  };
}
