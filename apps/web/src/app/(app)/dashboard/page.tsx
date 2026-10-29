import type { Metadata } from "next";
import Link from "next/link";
import {
  formatDateID,
  formatIDR,
  monthLabelID,
  partsInTz,
  utcToDateInput,
  walletTypeLabel,
} from "@saku/shared";
import { CategoryBars, TrendChart } from "@/components/charts";
import {
  IconArrowDown,
  IconArrowUp,
  IconChart,
  IconList,
  IconPlus,
  IconSwap,
  IconWallet,
} from "@/components/icons";
import { ScopeSelect } from "@/components/scope-select";
import { TransactionDialog } from "@/components/tx-dialog";
import {
  Avatar,
  Badge,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  cn,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDashboardData, getUserOptions, resolveScope } from "@/lib/queries";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(): string {
  const hour = partsInTz(new Date()).hour;
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 19) return "Selamat sore";
  return "Selamat malam";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const scope = await resolveScope(user, params.member);

  const [data, options] = await Promise.all([
    getDashboardData(user, scope),
    getUserOptions(user.id),
  ]);

  const today = new Date();
  const todayLabel = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(today);

  const firstName = user.name.split(" ")[0];
  const netTone = data.summary.net >= 0 ? "text-emerald-700" : "text-rose-700";
  const scopeLabel =
    scope.selected === "all"
      ? "Semua anggota"
      : scope.selected === user.id
        ? "Saya"
        : (scope.members.find((member) => member.id === scope.selected)?.name ?? "Saya");

  return (
    <div className="space-y-5">
      <PageHeader title={`${greeting()}, ${firstName}`} description={todayLabel}>
        {scope.canSwitch ? (
          <ScopeSelect members={scope.members} selected={scope.selected} />
        ) : null}
        <Link href="/reports" className="btn-ghost">
          <IconChart className="h-4 w-4" />
          Laporan
        </Link>
        <TransactionDialog
          wallets={options.wallets}
          categories={options.categories}
          defaultDate={utcToDateInput(today)}
          trigger={
            <>
              <IconPlus className="h-4 w-4" />
              Catat transaksi
            </>
          }
          triggerClassName="btn-primary"
        />
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Pemasukan · ${monthLabelID(data.month)}`}
          value={formatIDR(data.summary.income)}
          icon={<IconArrowUp className="h-4 w-4" />}
          tone="income"
          hint={scopeLabel}
        />
        <StatCard
          label={`Pengeluaran · ${monthLabelID(data.month)}`}
          value={formatIDR(data.summary.expense)}
          icon={<IconArrowDown className="h-4 w-4" />}
          tone="expense"
          hint={scopeLabel}
        />
        <StatCard
          label="Selisih bulan ini"
          value={
            <span className={netTone}>
              {data.summary.net >= 0 ? "+" : "−"}
              {formatIDR(Math.abs(data.summary.net))}
            </span>
          }
          icon={<IconChart className="h-4 w-4" />}
          tone="primary"
          hint={data.summary.net >= 0 ? "Surplus" : "Defisit"}
        />
        <StatCard
          label="Total saldo dompet"
          value={formatIDR(data.scopeBalances.total)}
          icon={<IconWallet className="h-4 w-4" />}
          tone="neutral"
          hint={`${data.scopeBalances.wallets.length} dompet aktif · ${scopeLabel}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Arus kas 6 bulan"
          description="Perbandingan pemasukan dan pengeluaran"
          className="lg:col-span-2"
        >
          <TrendChart data={data.trend} />
        </SectionCard>

        <SectionCard
          title="Pengeluaran per kategori"
          description={monthLabelID(data.month)}
          action={
            <Link href="/reports" className="text-xs font-semibold text-indigo-600 hover:underline">
              Detail
            </Link>
          }
        >
          <CategoryBars
            items={data.categories.map((category) => ({
              name: category.name,
              emoji: category.emoji,
              total: category.total,
            }))}
            tone="expense"
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Transaksi terbaru"
          description={scope.selected === "all" ? "Semua anggota keluarga" : undefined}
          className="lg:col-span-2"
          action={
            <Link
              href="/transactions"
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Lihat semua
            </Link>
          }
          bodyClassName="px-0 py-0"
        >
          {data.recent.length === 0 ? (
            <EmptyState
              icon={<IconList className="h-5 w-5" />}
              title="Belum ada transaksi"
              description="Catat lewat WhatsApp atau tombol Catat transaksi."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recent.map((tx) => {
                const income = tx.type === "INCOME";
                const transfer = tx.type === "TRANSFER";
                return (
                  <li key={tx.id} className="flex items-center gap-3 px-5 py-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base",
                        income
                          ? "bg-emerald-50"
                          : transfer
                            ? "bg-sky-50"
                            : "bg-rose-50",
                      )}
                    >
                      {transfer ? "🔄" : (tx.categoryEmoji ?? "📦")}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {tx.note || tx.categoryName || "Tanpa catatan"}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {formatDateID(new Date(tx.occurredAt))} ·{" "}
                        {transfer && tx.toWalletName
                          ? `${tx.walletName} → ${tx.toWalletName}${tx.transferIn ? " (masuk)" : ""}`
                          : tx.walletName}
                        {tx.categoryName ? ` · ${tx.categoryName}` : ""}
                        {scope.selected === "all" ? ` · ${tx.userName}` : ""}
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          income
                            ? "text-emerald-700"
                            : transfer
                              ? "text-sky-700"
                              : "text-slate-900",
                        )}
                      >
                        {income ? "+" : ""}
                        {formatIDR(tx.amount)}
                      </p>
                      {tx.source === "WA" ? (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          WhatsApp
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Dompet saya"
          description="Saldo terkini"
          action={
            <Link
              href="/wallets"
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Kelola
            </Link>
          }
          bodyClassName="px-0 py-0"
        >
          {data.balances.wallets.length === 0 ? (
            <EmptyState
              icon={<IconWallet className="h-5 w-5" />}
              title="Belum punya dompet"
              description="Tambahkan dompet tunai atau bank."
              action={
                <Link href="/wallets" className="btn-primary btn-sm">
                  Tambah dompet
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.balances.wallets.map((wallet) => (
                <li key={wallet.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    {wallet.type === "BANK" ? (
                      "🏦"
                    ) : wallet.type === "EWALLET" ? (
                      "📱"
                    ) : wallet.type === "CASH" ? (
                      "💵"
                    ) : (
                      "👛"
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{wallet.name}</p>
                    <p className="text-[11px] text-slate-500">{walletTypeLabel(wallet.type)}</p>
                  </div>
                  <p
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      wallet.balance < 0 ? "text-rose-700" : "text-slate-900",
                    )}
                  >
                    {formatIDR(wallet.balance)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="card flex flex-col gap-3 border-dashed p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <IconSwap className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Lebih cepat lewat WhatsApp</p>
            <p className="text-xs text-slate-500">
              Kirim “makan siang 25rb” ke nomor bot. Transaksi langsung masuk ke sini.
            </p>
          </div>
        </div>
        <Link href="/settings#whatsapp" className="btn-ghost shrink-0">
          Hubungkan WhatsApp
        </Link>
      </div>
    </div>
  );
}
