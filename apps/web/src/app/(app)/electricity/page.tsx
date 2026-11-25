import type { Metadata } from "next";
import {
  formatDateID,
  formatIDR,
  formatKwh,
  monthLabelID,
  utcToDateInput,
} from "@saku/shared";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { DeleteButton } from "@/components/delete-button";
import { ElectricityDialog } from "@/components/electricity-dialog";
import { IconBolt, IconEdit, IconPlus } from "@/components/icons";
import {
  Badge,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { deleteElectricityAction } from "@/lib/actions/electricity";
import { getElectricityData } from "@/lib/electricity";

export const metadata: Metadata = { title: "Listrik" };

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ElectricityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();

  const params = await searchParams;
  const data = await getElectricityData(str(params.m));
  const todayDate = utcToDateInput(new Date());
  const last = data.summary.last;

  const periodLabel =
    data.selectedMonth === "all"
      ? "semua bulan"
      : monthLabelID(data.selectedMonth);

  const monthOptions = [...data.months];
  if (
    data.selectedMonth !== "all" &&
    !monthOptions.some((month) => month.key === data.selectedMonth)
  ) {
    monthOptions.unshift({
      key: data.selectedMonth,
      label: monthLabelID(data.selectedMonth),
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Listrik"
        description="Catatan token listrik bersama seluruh anggota."
      >
        <ElectricityDialog
          defaultDate={todayDate}
          trigger={
            <>
              <IconPlus className="h-4 w-4" />
              Catat token
            </>
          }
          triggerClassName="btn-primary"
        />
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Meter terakhir"
          value={last ? `${formatKwh(last.kwhAfter)} kWh` : "—"}
          tone="primary"
          icon={<IconBolt className="h-4 w-4" />}
          hint={
            last
              ? `${formatDateID(last.purchasedAt)} · ${formatIDR(last.price)}`
              : "Belum ada catatan"
          }
        />
        <StatCard
          label="Total kWh dibeli"
          value={`${formatKwh(data.summary.totalKwh)} kWh`}
          tone="income"
          hint={`${data.summary.count} pembelian · ${periodLabel}`}
        />
        <StatCard
          label="Total biaya"
          value={formatIDR(data.summary.totalPrice)}
          tone="expense"
          hint={`Rata-rata ${formatIDR(data.summary.avgPricePerKwh)}/kWh`}
        />
        <StatCard
          label="Pemakaian per hari"
          value={
            data.summary.perDay === null
              ? "—"
              : `${formatKwh(data.summary.perDay)} kWh/hari`
          }
          tone="neutral"
          hint={
            data.summary.avgDaysBetween === null
              ? "Butuh minimal 2 catatan"
              : `Beli tiap ${data.summary.avgDaysBetween} hari · ${formatIDR(
                  data.summary.costPerDay ?? 0,
                )}/hari`
          }
        />
      </div>

      <form
        method="get"
        action="/electricity"
        className="card flex flex-wrap items-center gap-3 p-3"
      >
        <span className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Periode
        </span>
        <AutoSubmitSelect name="m" defaultValue={data.selectedMonth} className="input w-auto">
          <option value="all">Semua bulan</option>
          {monthOptions.map((month) => (
            <option key={month.key} value={month.key}>
              {month.label}
            </option>
          ))}
        </AutoSubmitSelect>
        <span className="text-xs text-slate-500">
          {data.rows.length} catatan pada periode ini
        </span>
      </form>

      <SectionCard
        title="Rekap bulanan"
        description="Total pembelian token listrik per bulan."
        bodyClassName="px-0 py-0"
      >
        {data.monthly.length === 0 ? (
          <EmptyState
            title="Belum ada rekap"
            description="Rekap muncul setelah ada catatan token listrik."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Bulan</th>
                  <th className="px-3 py-3 font-semibold">Pembelian</th>
                  <th className="px-3 py-3 text-right font-semibold">kWh</th>
                  <th className="px-3 py-3 text-right font-semibold">Biaya</th>
                  <th className="px-5 py-3 text-right font-semibold">Harga/kWh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.monthly.map((month) => (
                  <tr
                    key={month.key}
                    className={
                      month.key === data.selectedMonth ? "bg-indigo-50/50" : undefined
                    }
                  >
                    <td className="px-5 py-3 font-medium text-slate-800">{month.label}</td>
                    <td className="px-3 py-3 text-slate-600">{month.count}×</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                      {formatKwh(month.kwh)} kWh
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                      {formatIDR(month.price)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                      {formatIDR(month.pricePerKwh)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Riwayat pembelian"
        description="Pembacaan meter sebelum dan sesudah top-up."
        bodyClassName="px-5 py-2"
      >
        {data.rows.length === 0 ? (
          <EmptyState
            icon={<IconBolt className="h-5 w-5" />}
            title="Belum ada catatan listrik"
            description="Catat token pertama dari web atau kirim /listrik lewat WhatsApp."
            action={
              <ElectricityDialog
                defaultDate={todayDate}
                trigger={
                  <>
                    <IconPlus className="h-4 w-4" />
                    Catat token
                  </>
                }
                triggerClassName="btn-primary btn-sm"
              />
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.rows.map((row) => {
              const hasMismatch = Math.abs(row.mismatch) >= 0.01;
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 py-4 first:pt-2 last:pb-2 sm:flex-row sm:items-start"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <IconBolt className="h-[18px] w-[18px]" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatDateID(row.purchasedAt)}
                      </p>
                      {hasMismatch ? (
                        <Badge tone="warning">
                          Selisih meter {row.mismatch > 0 ? "+" : "−"}
                          {formatKwh(Math.abs(row.mismatch))} kWh
                        </Badge>
                      ) : (
                        <Badge tone="income">Meter cocok</Badge>
                      )}
                    </div>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {row.note || "Tanpa catatan"} · {row.createdByName ?? "Anggota"} ·{" "}
                      {row.source === "WA" ? "via WhatsApp" : "via web"}
                    </p>

                    <p className="mt-1.5 text-xs text-slate-600">
                      {formatKwh(row.kwhBefore)} →{" "}
                      <span className="font-semibold text-slate-900">
                        {formatKwh(row.kwhAfter)} kWh
                      </span>{" "}
                      <span className="font-medium text-emerald-700">
                        (+{formatKwh(row.kwhAmount)} kWh)
                      </span>
                    </p>

                    {row.usage !== null ? (
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Pemakaian sejak catatan sebelumnya: {formatKwh(row.usage)} kWh
                        {row.days !== null ? ` · ${row.days} hari` : ""}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-slate-900">
                        {formatIDR(row.price)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatIDR(row.pricePerKwh)}/kWh
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <ElectricityDialog
                        defaultDate={todayDate}
                        existing={{
                          id: row.id,
                          kwhBefore: row.kwhBefore,
                          kwhAmount: row.kwhAmount,
                          kwhAfter: row.kwhAfter,
                          price: row.price,
                          note: row.note,
                          dateInput: row.dateInput,
                        }}
                        trigger={<IconEdit className="h-3.5 w-3.5" />}
                        triggerClassName="icon-btn h-7 w-7"
                      />
                      <DeleteButton
                        action={deleteElectricityAction}
                        value={row.id}
                        confirmMessage={`Hapus catatan listrik ${formatDateID(row.purchasedAt)}?`}
                        className="h-7 w-7"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <p className="text-center text-[11px] text-slate-500">
        Setiap catatan token listrik otomatis menjadi pengeluaran milik penginput, jadi ikut
        terhitung di dompet, laporan, dan dashboard.
      </p>
    </div>
  );
}
