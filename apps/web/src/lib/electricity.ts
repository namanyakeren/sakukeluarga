import { listElectricityPurchases, type ElectricityPurchaseView } from "@saku/db";
import {
  electricityMismatch,
  monthKey,
  monthLabelID,
  parseMonthKey,
  utcToDateInput,
} from "@saku/shared";

export interface ElectricityRow extends ElectricityPurchaseView {
  monthKey: string;
  dateInput: string;
  pricePerKwh: number;
  usage: number | null;
  days: number | null;
  mismatch: number;
}

export interface ElectricityMonthRow {
  key: string;
  label: string;
  count: number;
  kwh: number;
  price: number;
  pricePerKwh: number;
}

export interface ElectricityData {
  rows: ElectricityRow[];
  months: { key: string; label: string }[];
  monthly: ElectricityMonthRow[];
  selectedMonth: string;
  summary: {
    count: number;
    totalKwh: number;
    totalPrice: number;
    avgPricePerKwh: number;
    last: ElectricityRow | null;
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function getElectricityData(monthParam?: string): Promise<ElectricityData> {
  const purchases = await listElectricityPurchases();

  const rowsAsc: ElectricityRow[] = [];
  let previous: ElectricityPurchaseView | null = null;

  for (const item of purchases) {
    const usage = previous ? round2(item.kwhBefore - previous.kwhAfter) : null;
    const days = previous
      ? Math.round((item.purchasedAt.getTime() - previous.purchasedAt.getTime()) / 86_400_000)
      : null;

    rowsAsc.push({
      ...item,
      monthKey: monthKey(item.purchasedAt),
      dateInput: utcToDateInput(item.purchasedAt),
      pricePerKwh: item.kwhAmount > 0 ? item.price / item.kwhAmount : 0,
      usage,
      days,
      mismatch: electricityMismatch(item),
    });
    previous = item;
  }

  const monthlyMap = new Map<string, { count: number; kwh: number; price: number }>();
  for (const row of rowsAsc) {
    const current = monthlyMap.get(row.monthKey) ?? { count: 0, kwh: 0, price: 0 };
    current.count += 1;
    current.kwh += row.kwhAmount;
    current.price += row.price;
    monthlyMap.set(row.monthKey, current);
  }

  const monthly: ElectricityMonthRow[] = [...monthlyMap.entries()]
    .map(([key, value]) => {
      const kwh = round2(value.kwh);
      return {
        key,
        label: monthLabelID(key),
        count: value.count,
        kwh,
        price: value.price,
        pricePerKwh: kwh > 0 ? value.price / kwh : 0,
      };
    })
    .sort((a, b) => b.key.localeCompare(a.key));

  const selectedMonth = parseMonthKey(monthParam) ?? "all";
  const allRows =
    selectedMonth === "all"
      ? rowsAsc
      : rowsAsc.filter((row) => row.monthKey === selectedMonth);
  const rows = [...allRows].reverse();

  const totalKwh = round2(allRows.reduce((sum, row) => sum + row.kwhAmount, 0));
  const totalPrice = allRows.reduce((sum, row) => sum + row.price, 0);

  return {
    rows,
    months: monthly.map(({ key, label }) => ({ key, label })),
    monthly,
    selectedMonth,
    summary: {
      count: allRows.length,
      totalKwh,
      totalPrice,
      avgPricePerKwh: totalKwh > 0 ? totalPrice / totalKwh : 0,
      last: allRows.length > 0 ? allRows[allRows.length - 1] : null,
    },
  };
}
