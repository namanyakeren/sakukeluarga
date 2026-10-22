import type { Metadata } from "next";
import Link from "next/link";
import {
  currentMonthKey,
  formatDateID,
  formatIDR,
  monthLabelID,
  parseMonthKey,
  recentMonths,
  utcToDateInput,
} from "@saku/shared";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { DeleteButton } from "@/components/delete-button";
import { IconEdit, IconList, IconPlus, IconSearch } from "@/components/icons";
import { ScopeSelect } from "@/components/scope-select";
import { TransactionDialog } from "@/components/tx-dialog";
import { Badge, EmptyState, PageHeader, SectionCard, cn } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { deleteTransactionAction } from "@/lib/actions/transactions";
import {
  getFilterOptions,
  getTransactionPage,
  getUserOptions,
  resolveScope,
  type TransactionFilters,
} from "@/lib/queries";

export const metadata: Metadata = { title: "Transaksi" };

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildHref(
  base: TransactionFilters,
  overrides: Partial<TransactionFilters & { member?: string }>,
): string {
  const params = new URLSearchParams();
  const merged = { ...base, ...overrides };
  params.set("m", merged.month);
  if (merged.type) params.set("type", merged.type);
  if (merged.walletId) params.set("walletId", merged.walletId);
  if (merged.categoryId) params.set("categoryId", merged.categoryId);
  if (merged.q) params.set("q", merged.q);
  if (overrides.member) params.set("member", overrides.member);
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));
  return `/transactions?${params.toString()}`;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const member = str(params.member);
  const scope = await resolveScope(user, member);

  const monthRaw = str(params.m);
  const month =
    monthRaw === "all" ? "all" : (parseMonthKey(monthRaw) ?? currentMonthKey());
  const type = str(params.type);
  const walletId = str(params.walletId);
  const categoryId = str(params.categoryId);
  const q = str(params.q);
  const page = Math.max(1, Number(str(params.page) ?? "1") || 1);

  const filters: TransactionFilters = {
    month,
    type,
    walletId,
    categoryId,
    q,
    page,
  };

  const [data, filterOptions, selfOptions] = await Promise.all([
    getTransactionPage(scope, filters),
    getFilterOptions(scope),
    getUserOptions(user.id),
  ]);

  const todayDate = utcToDateInput(new Date());
  const monthChoices = recentMonths(18);
  const showingAll = scope.selected === "all";
  const hasFilters =
    month !== currentMonthKey() ||
    Boolean(type) ||
    Boolean(walletId) ||
    Boolean(categoryId) ||
    Boolean(q);

  return (
    <div className="space-y-5">
      <PageHeader title="Transaksi" description="Semua pemasukan, pengeluaran, dan transfer.">
        {scope.canSwitch ? (
          <ScopeSelect members={scope.members} selected={scope.selected} />
        ) : null}
        <TransactionDialog
          wallets={selfOptions.wallets}
          categories={selfOptions.categories}
          defaultDate={todayDate}
          trigger={
            <>
              <IconPlus className="h-4 w-4" />
              Catat transaksi
            </>
          }
          triggerClassName="btn-primary"
        />
      </PageHeader>

      <form
        method="get"
        action="/transactions"
        className="card grid grid-cols-2 gap-2 p-3 md:grid-cols-6"
      >
        {member ? <input type="hidden" name="member" value={member} /> : null}

        <AutoSubmitSelect name="m" defaultValue={month} className="input" ariaLabel="Bulan">
          <option value="all">Semua bulan</option>
          {monthChoices.map((key) => (
            <option key={key} value={key}>
              {monthLabelID(key)}
            </option>
          ))}
        </AutoSubmitSelect>

        <AutoSubmitSelect
          name="type"
          defaultValue={type ?? ""}
          className="input"
          ariaLabel="Jenis"
        >
          <option value="">Semua jenis</option>
          <option value="EXPENSE">Pengeluaran</option>
          <option value="INCOME">Pemasukan</option>
          <option value="TRANSFER">Transfer</option>
        </AutoSubmitSelect>

        <AutoSubmitSelect
          name="walletId"
          defaultValue={walletId ?? ""}
          className="input"
          ariaLabel="Dompet"
        >
          <option value="">Semua dompet</option>
          {filterOptions.wallets.map((wallet) => (
            <option key={wallet.id} value={wallet.id}>
              {wallet.name}
              {showingAll ? ` · ${wallet.ownerName}` : ""}
            </option>
          ))}
        </AutoSubmitSelect>

        <AutoSubmitSelect
          name="categoryId"
          defaultValue={categoryId ?? ""}
          className="input"
          ariaLabel="Kategori"
        >
          <option value="">Semua kategori</option>
          {filterOptions.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.emoji} {category.name}
              {showingAll ? ` · ${category.ownerName}` : ""}
            </option>
          ))}
        </AutoSubmitSelect>

        <div className="relative col-span-2 md:col-span-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cari catatan..."
            className="input pl-9"
          />
        </div>

        <button type="submit" className="btn-ghost">
          Terapkan
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-slate-500">
        <span>
          <strong className="text-slate-700">{data.total}</strong> transaksi
        </span>
        <span className="text-emerald-700">
          Masuk {formatIDR(data.income)}
        </span>
        <span className="text-rose-700">
          Keluar {formatIDR(data.expense)}
        </span>
        {hasFilters ? (
          <Link
            href={member ? `/transactions?member=${member}` : "/transactions"}
            className="ml-auto font-semibold text-indigo-600 hover:underline"
          >
            Reset filter
          </Link>
        ) : null}
      </div>

      <SectionCard
        title={month === "all" ? "Semua transaksi" : monthLabelID(month)}
        description={`Halaman ${data.page} dari ${data.pageCount}`}
        bodyClassName="px-0 py-0"
      >
        {data.rows.length === 0 ? (
          <EmptyState
            icon={<IconList className="h-5 w-5" />}
            title="Tidak ada transaksi"
            description="Coba ubah filter, atau catat transaksi baru."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.rows.map((tx) => {
              const income = tx.type === "INCOME";
              const transfer = tx.type === "TRANSFER";
              return (
                <li key={tx.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                  <span
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base",
                      income ? "bg-emerald-50" : transfer ? "bg-sky-50" : "bg-rose-50",
                    )}
                  >
                    {transfer ? "🔄" : (tx.categoryEmoji ?? "📦")}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {tx.note || tx.categoryName || (transfer ? "Transfer" : "Tanpa catatan")}
                      </p>
                      {tx.source === "WA" ? (
                        <Badge tone="primary" className="px-1.5 py-0 text-[10px]">
                          WA
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {formatDateID(new Date(tx.occurredAt))} · {tx.walletName}
                      {transfer && tx.toWalletName ? ` → ${tx.toWalletName}` : ""}
                      {tx.categoryName ? ` · ${tx.categoryName}` : ""}
                      {showingAll ? ` · ${tx.userName}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
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

                    {tx.userId === user.id ? (
                      <div className="flex items-center gap-0.5">
                        <TransactionDialog
                          wallets={selfOptions.wallets}
                          categories={selfOptions.categories}
                          defaultDate={todayDate}
                          existing={{
                            id: tx.id,
                            type: tx.type,
                            amount: tx.amount,
                            walletId: tx.walletId,
                            toWalletId: tx.toWalletId,
                            categoryId: tx.categoryId,
                            note: tx.note,
                            dateInput: tx.dateInput,
                          }}
                          trigger={<IconEdit className="h-3.5 w-3.5" />}
                          triggerClassName="icon-btn h-7 w-7"
                        />
                        <DeleteButton
                          action={deleteTransactionAction}
                          value={tx.id}
                          confirmMessage={`Hapus transaksi ${formatIDR(tx.amount)}?`}
                          className="h-7 w-7"
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {data.pageCount > 1 ? (
        <div className="flex items-center justify-between">
          {data.page > 1 ? (
            <Link
              href={buildHref(filters, { page: data.page - 1, member })}
              className="btn-ghost btn-sm"
            >
              ← Sebelumnya
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-slate-500">
            {data.page} / {data.pageCount}
          </span>
          {data.page < data.pageCount ? (
            <Link
              href={buildHref(filters, { page: data.page + 1, member })}
              className="btn-ghost btn-sm"
            >
              Berikutnya →
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}
