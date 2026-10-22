import { formatCompactIDR, formatIDR } from "@saku/shared";

export interface TrendPointView {
  key: string;
  label: string;
  income: number;
  expense: number;
}

export function TrendChart({ data }: { data: TrendPointView[] }) {
  const max = Math.max(1, ...data.flatMap((point) => [point.income, point.expense]));

  return (
    <div>
      <div className="flex items-end gap-2 sm:gap-4">
        {data.map((point) => {
          const incomeHeight = point.income > 0 ? Math.max(3, (point.income / max) * 100) : 0;
          const expenseHeight = point.expense > 0 ? Math.max(3, (point.expense / max) * 100) : 0;
          return (
            <div key={point.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end justify-center gap-1">
                <div
                  className="w-1/2 max-w-5 rounded-t-md bg-emerald-400/90 transition-all"
                  style={{ height: `${incomeHeight}%` }}
                  title={`Masuk ${point.label}: ${formatIDR(point.income)}`}
                />
                <div
                  className="w-1/2 max-w-5 rounded-t-md bg-rose-400/90 transition-all"
                  style={{ height: `${expenseHeight}%` }}
                  title={`Keluar ${point.label}: ${formatIDR(point.expense)}`}
                />
              </div>
              <span className="truncate text-[11px] font-medium text-slate-500">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Pemasukan
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-400" /> Pengeluaran
        </span>
        <span className="ml-auto text-slate-400">Skala: {formatCompactIDR(max)}</span>
      </div>
    </div>
  );
}

export function CategoryBars({
  items,
  tone,
}: {
  items: { name: string; emoji: string; total: number }[];
  tone: "income" | "expense";
}) {
  const total = items.reduce((sum, item) => sum + item.total, 0);
  const barClass = tone === "income" ? "bg-emerald-500" : "bg-rose-500";
  const amountClass = tone === "income" ? "text-emerald-700" : "text-rose-700";

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-slate-500">
        Belum ada data pada periode ini.
      </p>
    );
  }

  return (
    <ul className="space-y-3.5">
      {items.map((item) => {
        const percent = total > 0 ? Math.round((item.total / total) * 100) : 0;
        return (
          <li key={`${item.name}-${item.total}`}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium text-slate-700">
                <span className="mr-1">{item.emoji}</span>
                {item.name}
              </span>
              <span className={`shrink-0 font-semibold tabular-nums ${amountClass}`}>
                {formatIDR(item.total)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
