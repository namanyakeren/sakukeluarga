import {
  prisma,
  getCategoryTotals,
  getSummary,
  getWalletBalances,
  getWalletBalancesForUsers,
  type Prisma,
} from "@saku/db";
import {
  currentMonthKey,
  monthKey,
  monthRange,
  recentMonths,
  shortMonthID,
  utcToDateInput,
  type TxKind,
} from "@saku/shared";
import type { SessionUser } from "./auth";

export const PAGE_SIZE = 20;

export interface MemberInfo {
  id: string;
  name: string;
  waNumber: string;
  role: string;
}

export interface Scope {
  userIds: string[];
  selected: string;
  members: MemberInfo[];
  canSwitch: boolean;
}

export async function listMembers(): Promise<MemberInfo[]> {
  return prisma.user.findMany({
    select: { id: true, name: true, waNumber: true, role: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function resolveScope(
  user: SessionUser,
  memberParam?: string,
): Promise<Scope> {
  if (user.role !== "ADMIN") {
    return { userIds: [user.id], selected: user.id, members: [], canSwitch: false };
  }

  const members = await listMembers();
  const ids = members.map((member) => member.id);

  if (memberParam && ids.includes(memberParam)) {
    return { userIds: [memberParam], selected: memberParam, members, canSwitch: true };
  }
  return { userIds: ids, selected: "all", members, canSwitch: true };
}

export interface TrendPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
}

export async function getMonthlyTrend(
  userIds: string[],
  months: string[] = recentMonths(6),
): Promise<TrendPoint[]> {
  const start = monthRange(months[months.length - 1]).start;
  const end = monthRange(months[0]).end;

  const rows = await prisma.transaction.findMany({
    where: {
      userId: { in: userIds },
      type: { in: ["INCOME", "EXPENSE"] },
      occurredAt: { gte: start, lt: end },
    },
    select: { type: true, amount: true, occurredAt: true },
  });

  const buckets = new Map(months.map((key) => [key, { income: 0, expense: 0 }]));
  for (const row of rows) {
    const bucket = buckets.get(monthKey(row.occurredAt));
    if (!bucket) continue;
    const value = Number(row.amount);
    if (row.type === "INCOME") bucket.income += value;
    else bucket.expense += value;
  }

  return months.map((key) => ({
    key,
    label: shortMonthID(key),
    income: buckets.get(key)?.income ?? 0,
    expense: buckets.get(key)?.expense ?? 0,
  }));
}

export interface WalletOption {
  id: string;
  name: string;
  type: string;
  ownerId: string;
  ownerName: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  type: string;
  emoji: string;
  ownerId: string;
  ownerName: string;
}

export async function getFilterOptions(scope: Scope) {
  const [wallets, categories] = await Promise.all([
    prisma.wallet.findMany({
      where: { userId: { in: scope.userIds }, archived: false },
      include: { user: { select: { name: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.category.findMany({
      where: { userId: { in: scope.userIds }, type: { in: ["INCOME", "EXPENSE"] } },
      include: { user: { select: { name: true } } },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  return {
    wallets: wallets.map<WalletOption>((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      type: wallet.type,
      ownerId: wallet.userId,
      ownerName: wallet.user.name,
    })),
    categories: categories.map<CategoryOption>((category) => ({
      id: category.id,
      name: category.name,
      type: category.type,
      emoji: category.emoji,
      ownerId: category.userId,
      ownerName: category.user.name,
    })),
  };
}

export async function getUserOptions(userId: string): Promise<{
  wallets: WalletOption[];
  categories: CategoryOption[];
}> {
  const scope: Scope = {
    userIds: [userId],
    selected: userId,
    members: [],
    canSwitch: false,
  };
  return getFilterOptions(scope);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export interface RecentTransaction {
  id: string;
  type: string;
  amount: number;
  note: string;
  occurredAt: string;
  walletName: string;
  toWalletName: string | null;
  transferIn: boolean;
  categoryName: string | null;
  categoryEmoji: string | null;
  userName: string;
  source: string;
  isMine: boolean;
}

function scopeTransactionWhere(scope: Scope): Prisma.TransactionWhereInput {
  return {
    OR: [
      { userId: { in: scope.userIds } },
      { type: "TRANSFER", toWallet: { userId: { in: scope.userIds } } },
    ],
  };
}

export async function getDashboardData(user: SessionUser, scope: Scope) {
  const months = recentMonths(6);
  const month = months[0];
  const range = monthRange(month);

  const ownScopeOnly =
    scope.userIds.length === 1 && scope.userIds[0] === user.id;

  const [summary, balances, scopeBalances, categories, recentRows, trend] =
    await Promise.all([
      getSummary(scope.userIds, range.start, range.end),
      getWalletBalances(user.id),
      ownScopeOnly ? null : getWalletBalancesForUsers(scope.userIds),
      getCategoryTotals(scope.userIds, range.start, range.end, "EXPENSE"),
      prisma.transaction.findMany({
        where: scopeTransactionWhere(scope),
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: 8,
        include: {
          wallet: { select: { name: true } },
          toWallet: { select: { name: true, userId: true } },
          category: { select: { name: true, emoji: true } },
          user: { select: { name: true } },
        },
      }),
      getMonthlyTrend(scope.userIds, months),
    ]);

  const recent: RecentTransaction[] = recentRows.map((row) => ({
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    note: row.note,
    occurredAt: row.occurredAt.toISOString(),
    walletName: row.wallet.name,
    toWalletName: row.toWallet?.name ?? null,
    transferIn:
      row.type === "TRANSFER" &&
      Boolean(row.toWallet && scope.userIds.includes(row.toWallet.userId)) &&
      !scope.userIds.includes(row.userId),
    categoryName: row.category?.name ?? null,
    categoryEmoji: row.category?.emoji ?? null,
    userName: row.user.name,
    source: row.source,
    isMine: row.userId === user.id,
  }));

  return {
    month,
    summary,
    balances,
    scopeBalances: scopeBalances ?? balances,
    categories: categories.filter((category) => category.total > 0),
    recent,
    trend,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaksi
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionFilters {
  month: string;
  type?: string;
  walletId?: string;
  categoryId?: string;
  q?: string;
  page: number;
}

export interface TxRow {
  id: string;
  userId: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  note: string;
  occurredAt: string;
  dateInput: string;
  walletId: string;
  walletName: string;
  transferIn: boolean;
  crossMember: boolean;
  toWalletId: string | null;
  toWalletName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryEmoji: string | null;
  source: string;
  userName: string;
}

function buildWhere(scope: Scope, filters: Omit<TransactionFilters, "page">): Prisma.TransactionWhereInput {
  const conditions: Prisma.TransactionWhereInput[] = [scopeTransactionWhere(scope)];

  if (filters.month && filters.month !== "all") {
    const range = monthRange(filters.month);
    conditions.push({ occurredAt: { gte: range.start, lt: range.end } });
  }

  if (filters.type === "INCOME" || filters.type === "EXPENSE" || filters.type === "TRANSFER") {
    conditions.push({ type: filters.type });
  }

  if (filters.walletId) {
    conditions.push({ OR: [{ walletId: filters.walletId }, { toWalletId: filters.walletId }] });
  }

  if (filters.categoryId) {
    conditions.push({ categoryId: filters.categoryId });
  }

  if (filters.q?.trim()) {
    conditions.push({ note: { contains: filters.q.trim(), mode: "insensitive" } });
  }

  return { AND: conditions };
}

interface TxWithRelations {
  id: string;
  userId: string;
  type: string;
  amount: bigint;
  note: string;
  occurredAt: Date;
  source: string;
  walletId: string;
  wallet: { name: string };
  toWalletId: string | null;
  toWallet: { name: string; userId: string } | null;
  categoryId: string | null;
  category: { name: string; emoji: string } | null;
  user: { name: string };
}

function mapTxRow(row: TxWithRelations, scope: Scope): TxRow {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as TxRow["type"],
    amount: Number(row.amount),
    note: row.note,
    occurredAt: row.occurredAt.toISOString(),
    dateInput: utcToDateInput(row.occurredAt),
    walletId: row.walletId,
    walletName: row.wallet.name,
    transferIn:
      row.type === "TRANSFER" &&
      Boolean(row.toWallet && scope.userIds.includes(row.toWallet.userId)) &&
      !scope.userIds.includes(row.userId),
    crossMember:
      row.type === "TRANSFER" &&
      Boolean(row.toWallet && row.toWallet.userId !== row.userId),
    toWalletId: row.toWalletId,
    toWalletName: row.toWallet?.name ?? null,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    categoryEmoji: row.category?.emoji ?? null,
    source: row.source,
    userName: row.user.name,
  };
}

const TX_INCLUDE = {
  wallet: { select: { name: true } },
  toWallet: { select: { name: true, userId: true } },
  category: { select: { name: true, emoji: true } },
  user: { select: { name: true } },
  // userId ikut terambil otomatis
} satisfies Prisma.TransactionInclude;

export async function getTransactionPage(scope: Scope, filters: TransactionFilters) {
  const where = buildWhere(scope, filters);
  const skip = Math.max(0, (filters.page - 1) * PAGE_SIZE);

  const [total, rows, totals] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: TX_INCLUDE,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: PAGE_SIZE,
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where,
      _sum: { amount: true },
    }),
  ]);

  const income = Number(totals.find((row) => row.type === "INCOME")?._sum.amount ?? 0);
  const expense = Number(totals.find((row) => row.type === "EXPENSE")?._sum.amount ?? 0);

  return {
    rows: rows.map((row) => mapTxRow(row as TxWithRelations, scope)),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    income,
    expense,
  };
}

export async function getTransactionsForExport(
  scope: Scope,
  filters: Omit<TransactionFilters, "page">,
): Promise<TxRow[]> {
  const where = buildWhere(scope, filters);
  const rows = await prisma.transaction.findMany({
    where,
    include: TX_INCLUDE,
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 5000,
  });
  return rows.map((row) => mapTxRow(row as TxWithRelations, scope));
}

// ─────────────────────────────────────────────────────────────────────────────
// Laporan
// ─────────────────────────────────────────────────────────────────────────────

export async function getReportData(scope: Scope, month: string) {
  const range = monthRange(month);
  const months = recentMonths(6, range.start);

  const [summary, expenseCategories, incomeCategories, trend, transactionCount] =
    await Promise.all([
      getSummary(scope.userIds, range.start, range.end),
      getCategoryTotals(scope.userIds, range.start, range.end, "EXPENSE"),
      getCategoryTotals(scope.userIds, range.start, range.end, "INCOME"),
      getMonthlyTrend(scope.userIds, months),
      prisma.transaction.count({
        where: {
          userId: { in: scope.userIds },
          type: { in: ["INCOME", "EXPENSE"] },
          occurredAt: { gte: range.start, lt: range.end },
        },
      }),
    ]);

  return {
    month: range.key,
    summary,
    expenseCategories: expenseCategories.filter((item) => item.total > 0),
    incomeCategories: incomeCategories.filter((item) => item.total > 0),
    trend,
    transactionCount,
    topExpenses: expenseCategories.filter((item) => item.total > 0).slice(0, 5),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dompet & kategori
// ─────────────────────────────────────────────────────────────────────────────

export async function getWalletOverview(userId: string) {
  const [balances, record] = await Promise.all([
    getWalletBalances(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { defaultWalletId: true },
    }),
  ]);
  return { ...balances, defaultWalletId: record?.defaultWalletId ?? null };
}

export async function getCategoriesWithUsage(userId: string) {
  return prisma.category.findMany({
    where: { userId },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    include: { _count: { select: { transactions: true } } },
  });
}

export async function getSettingsData(user: SessionUser) {
  const [members, wallets, categories] = await Promise.all([
    listMembers(),
    prisma.wallet.count({ where: { userId: user.id } }),
    prisma.category.count({ where: { userId: user.id } }),
  ]);

  return { members, walletCount: wallets, categoryCount: categories };
}

export type { TxKind };
export { currentMonthKey };
