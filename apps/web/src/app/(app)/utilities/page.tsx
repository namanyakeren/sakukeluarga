import type { Metadata } from "next";
import Link from "next/link";
import {
  UTILITY_KINDS,
  UTILITY_META,
  formatDateID,
  formatIDR,
  formatQuantity,
  monthLabelID,
  utcToDateInput,
  type UtilityKind,
} from "@saku/shared";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { DeleteButton } from "@/components/delete-button";
import { IconDroplet, IconEdit, IconFlame, IconPlus } from "@/components/icons";
import { UtilityDialog } from "@/components/utility-dialog";
import {
  Badge,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  cn,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { deleteUtilityAction } from "@/lib/actions/utilities";
import { getUtilityData } from "@/lib/utilities";

export const metadata: Metadata = { title: "Gas & Galon" };

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function UtilitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();

  const params = await searchParams;
  const kind: UtilityKind =
    str(params.k) === "LPG_GAS" ? "LPG_GAS" : "WATER_GALLON";
  const data = await getUtilityData(kind, str(params.m));
  const meta = UTILITY_META[kind];
  const todayDate = utcToDateInput(new Date());
  const last = data.summary.last;
  const KindIcon = kind === "LPG_GAS" ? IconFlame : IconDroplet;

  const periodLabel =
    data.selectedMonth === "all" ? "semua bulan" : monthLabelID(data.selectedMonth);

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
        title="Gas & Galon"
        description="Catatan galon air dan gas LPG, otomatis masuk pengeluaran penginput."
      >
        <UtilityDialog
          kind={kind}
          defaultDate={todayDate}
          trigger={
            <>
              <IconPlus className="h-4 w-4" />
              Catat {meta.label.toLowerCase()}
            </>
          }
          triggerClassName="btn-primary"
        />
      </PageHeader>

      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {UTILITY_KINDS.map((item) => {
          const itemMeta = UTILITY_META[item];
          return (
            <Link
              key={item}
              href={`/utilities?k=${item}`}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition",
                item === kind
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:bg-white/70",
              )}
            >
              <span aria-hidden="true">{itemMeta.emoji}</span>
              {itemMeta.label}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pembelian terakhir"
          value={last ? `${formatQuantity(last.quantity)} ${meta.unit}` : "—"}
          tone="primary"
          icon={<KindIcon className="h-4 w-4" />}
          hint={
            last
              ? `${formatDateID(last.purchasedAt)} · ${formatIDR(last.price)}`
              : "Belum ada catatan"
          }
        />
        <StatCard
          label={`Total ${meta.unit}`}
          value={`${formatQuantity(data.summary.totalQuantity)} ${meta.unit}`}
          tone="income"
          hint={`${data.summary.count} pembelian · ${periodLabel}`}
        />
        <StatCard
          label="Total biaya"
          value={formatIDR(data.summary.totalPrice)}
          tone="expense"
          hint={`Rata-rata ${formatIDR(data.summary.avgPricePerUnit)}/${meta.unit}`}
        />
        <StatCard
          label="Rata-rata pemakaian"
          value={
            data.summary.perDay === null
              ? "—"
              : `${formatQuantity(data.summary.perDay)} ${meta.unit}/hari`
          }
          tone="neutral"
          hint={
            data.summary.avgDaysBetween === null
              ? "Butuh minimal 2 catatan"
              : `Beli sekitar ${data.summary.avgDaysBetween} hari sekali · ${formatIDR(
                  data.summary.costPerDay ?? 0,
                )}/hari`
          }
        />
      </div>

      <form
        method="get"
        action="/utilities"
        className="card flex flex-wrap items-center gap-3 p-3"
      >
        <input type="hidden" name="k" value={kind} />
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
        description={`Total ${meta.label.toLowerCase()} per bulan.`}
        bodyClassName="px-0 py-0"
      >
        {data.monthly.length === 0 ? (
          <EmptyState
            title="Belum ada rekap"
            description={`Rekap muncul setelah ada catatan ${meta.label.toLowerCase()}.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Bulan</th>
                  <th className="px-3 py-3 font-semibold">Pembelian</th>
                  <th className="px-3 py-3 text-right font-semibold">Jumlah</th>
                  <th className="px-3 py-3 text-right font-semibold">Biaya</th>
                  <th className="px-5 py-3 text-right font-semibold">Harga/unit</th>
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
                      {formatQuantity(month.quantity)} {meta.unit}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                      {formatIDR(month.price)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                      {formatIDR(month.pricePerUnit)}
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
        description={`Jumlah ${meta.unit} dan harga yang dibayar.`}
        bodyClassName="px-5 py-2"
      >
        {data.rows.length === 0 ? (
          <EmptyState
            icon={<KindIcon className="h-5 w-5" />}
            title={`Belum ada catatan ${meta.label.toLowerCase()}`}
            description={`Catat dari web atau kirim /${meta.command} lewat WhatsApp.`}
            action={
              <UtilityDialog
                kind={kind}
                defaultDate={todayDate}
                trigger={
                  <>
                    <IconPlus className="h-4 w-4" />
                    Catat {meta.label.toLowerCase()}
                  </>
                }
                triggerClassName="btn-primary btn-sm"
              />
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 py-4 first:pt-2 last:pb-2 sm:flex-row sm:items-start"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <KindIcon className="h-[18px] w-[18px]" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDateID(row.purchasedAt)}
                    </p>
                    <Badge tone="neutral">
                      {formatQuantity(row.quantity)} {meta.unit}
                    </Badge>
                  </div>

                  <p className="mt-0.5 text-xs text-slate-500">
                    {row.note || "Tanpa catatan"} · {row.createdByName ?? "Anggota"} ·{" "}
                    {row.source === "WA" ? "via WhatsApp" : "via web"}
                  </p>

                  {row.days !== null ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {row.days} hari sejak pembelian sebelumnya
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-slate-900">
                      {formatIDR(row.price)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatIDR(row.pricePerUnit)}/{meta.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <UtilityDialog
                      kind={kind}
                      defaultDate={todayDate}
                      existing={{
                        id: row.id,
                        quantity: row.quantity,
                        price: row.price,
                        note: row.note,
                        dateInput: row.dateInput,
                      }}
                      trigger={<IconEdit className="h-3.5 w-3.5" />}
                      triggerClassName="icon-btn h-7 w-7"
                    />
                    <DeleteButton
                      action={deleteUtilityAction}
                      value={row.id}
                      confirmMessage={`Hapus catatan ${meta.label.toLowerCase()} ${formatDateID(row.purchasedAt)}? Pengeluarannya juga dihapus.`}
                      className="h-7 w-7"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <p className="text-center text-[11px] text-slate-500">
        Setiap catatan otomatis menjadi pengeluaran milik penginput, jadi ikut terhitung di
        dompet, laporan, dan dashboard.
      </p>
    </div>
  );
}
