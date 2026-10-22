import type { Metadata } from "next";
import Link from "next/link";
import {
  currentMonthKey,
  daysInMonth,
  formatIDR,
  monthLabelID,
  parseMonthKey,
  partsInTz,
  recentMonths,
} from "@saku/shared";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { CategoryBars, TrendChart } from "@/components/charts";
import { IconDownload } from "@/components/icons";
import { ScopeSelect } from "@/components/scope-select";
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getReportData, resolveScope } from "@/lib/queries";

export const metadata: Metadata = { title: "Laporan" };

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const member = str(params.member);
  const scope = await resolveScope(user, member);
  const month = parseMonthKey(str(params.m)) ?? currentMonthKey();
  const report = await getReportData(scope, month);

  const [year, monthNumber] = report.month.split("-").map(Number);
  const totalDays = daysInMonth(year, monthNumber);
  const isCurrentMonth = report.month === currentMonthKey();
  const elapsedDays = isCurrentMonth ? partsInTz(new Date()).day : totalDays;
  const dailyAverage = Math.round(report.summary.expense / Math.max(1, elapsedDays));
  const savingsRate =
    report.summary.income > 0
      ? Math.round((report.summary.net / report.summary.income) * 100)
      : 0;

  const exportParams = new URLSearchParams({ m: report.month });
  if (member) exportParams.set("member", member);

  return (
    <div className="space-y-5">
      <PageHeader title="Laporan" description="Ringkasan dan tren keuangan per bulan.">
        {scope.canSwitch ? (
          <ScopeSelect members={scope.members} selected={scope.selected} />
        ) : null}
        <Link href={`/api/export?${exportParams.toString()}`} className="btn-ghost">
          <IconDownload className="h-4 w-4" />
          Ekspor CSV
        </Link>
      </PageHeader>

      <form method="get" action="/reports" className="card flex flex-wrap items-center gap-3 p-3">
        {member ? <input type="hidden" name="member" value={member} /> : null}
        <span className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Periode
        </span>
        <AutoSubmitSelect name="m" defaultValue={report.month} className="input w-auto">
          {recentMonths(18).map((key) => (
            <option key={key} value={key}>
              {monthLabelID(key)}
            </option>
          ))}
        </AutoSubmitSelect>
        <span className="text-xs text-slate-500">
          {report.transactionCount} transaksi tercatat
        </span>
      </form>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pemasukan"
          value={formatIDR(report.summary.income)}
          tone="income"
          hint={monthLabelID(report.month)}
        />
        <StatCard
          label="Pengeluaran"
          value={formatIDR(report.summary.expense)}
          tone="expense"
          hint={`Rata-rata ${formatIDR(dailyAverage)}/hari`}
        />
        <StatCard
          label="Selisih"
          value={
            <span className={report.summary.net >= 0 ? "text-emerald-700" : "text-rose-700"}>
              {report.summary.net >= 0 ? "+" : "−"}
              {formatIDR(Math.abs(report.summary.net))}
            </span>
          }
          tone="primary"
          hint={report.summary.net >= 0 ? "Surplus" : "Defisit"}
        />
        <StatCard
          label="Rasio tabungan"
          value={`${savingsRate}%`}
          tone="neutral"
          hint={
            report.summary.income > 0
              ? "Dari total pemasukan bulan ini"
              : "Belum ada pemasukan"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Pengeluaran per kategori"
          description={monthLabelID(report.month)}
        >
          <CategoryBars
            items={report.expenseCategories.map((item) => ({
              name: item.name,
              emoji: item.emoji,
              total: item.total,
            }))}
            tone="expense"
          />
        </SectionCard>

        <SectionCard
          title="Pemasukan per kategori"
          description={monthLabelID(report.month)}
        >
          <CategoryBars
            items={report.incomeCategories.map((item) => ({
              name: item.name,
              emoji: item.emoji,
              total: item.total,
            }))}
            tone="income"
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Tren 6 bulan"
          description={`Berakhir ${monthLabelID(report.month)}`}
          className="lg:col-span-2"
        >
          <TrendChart data={report.trend} />
        </SectionCard>

        <SectionCard title="Pengeluaran terbesar" description="Top 5 kategori">
          {report.topExpenses.length === 0 ? (
            <EmptyState title="Belum ada pengeluaran" description="Pada periode ini." />
          ) : (
            <ol className="space-y-3">
              {report.topExpenses.map((item, index) => (
                <li key={item.categoryId ?? item.name} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-600">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-700">
                      {item.emoji} {item.name}
                    </p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-slate-900">
                    {formatIDR(item.total)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
