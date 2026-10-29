import type { Category, Transaction, Wallet } from "@prisma/client";
import {
  DEFAULT_CATEGORIES,
  guessCategory,
  normalizeWaNumber,
  type TxKind,
  type TxSource,
} from "@saku/shared";
import { prisma } from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// Pengguna
// ─────────────────────────────────────────────────────────────────────────────

export interface NewUserInput {
  name: string;
  waNumber: string;
  passwordHash: string;
  role?: "ADMIN" | "MEMBER";
}

export async function createUserWithDefaults(input: NewUserInput) {
  const waNumber = normalizeWaNumber(input.waNumber);
  if (!waNumber) throw new Error("Nomor WhatsApp tidak valid");

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name.trim() || "Tanpa Nama",
        waNumber,
        passwordHash: input.passwordHash,
        role: input.role ?? "MEMBER",
      },
    });

    await tx.category.createMany({
      data: DEFAULT_CATEGORIES.map((category, index) => ({
        userId: user.id,
        name: category.name,
        type: category.type,
        emoji: category.emoji,
        keywords: category.keywords,
        sortOrder: index,
      })),
    });

    const cash = await tx.wallet.create({
      data: {
        userId: user.id,
        name: "Cash",
        type: "CASH",
        sortOrder: 0,
      },
    });

    return tx.user.update({
      where: { id: user.id },
      data: { defaultWalletId: cash.id },
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Saldo dompet
// ─────────────────────────────────────────────────────────────────────────────

export interface WalletBalance {
  id: string;
  name: string;
  type: Wallet["type"];
  initialBalance: number;
  balance: number;
}

export interface BalancesResult {
  wallets: WalletBalance[];
  total: number;
}

export async function getWalletBalancesForUsers(
  userIds: string[],
): Promise<BalancesResult> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return { wallets: [], total: 0 };

  const wallets = await prisma.wallet.findMany({
    where: { userId: { in: ids }, archived: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const walletIds = wallets.map((wallet) => wallet.id);
  if (walletIds.length === 0) return { wallets: [], total: 0 };

  // Dihitung berdasarkan kepemilikan dompet, bukan userId transaksi, supaya
  // transfer antar anggota tetap menambah saldo dompet penerima.
  const [incomes, expenses, transfersOut, transfersIn] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["walletId"],
      where: { walletId: { in: walletIds }, type: "INCOME" },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["walletId"],
      where: { walletId: { in: walletIds }, type: "EXPENSE" },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["walletId"],
      where: { walletId: { in: walletIds }, type: "TRANSFER" },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["toWalletId"],
      where: { toWalletId: { in: walletIds }, type: "TRANSFER" },
      _sum: { amount: true },
    }),
  ]);

  const inMap = new Map(incomes.map((row) => [row.walletId, Number(row._sum.amount ?? 0)]));
  const outMap = new Map(expenses.map((row) => [row.walletId, Number(row._sum.amount ?? 0)]));
  const tfOutMap = new Map(transfersOut.map((row) => [row.walletId, Number(row._sum.amount ?? 0)]));
  const tfInMap = new Map(
    transfersIn
      .filter((row) => row.toWalletId)
      .map((row) => [row.toWalletId as string, Number(row._sum.amount ?? 0)]),
  );

  const result: WalletBalance[] = wallets.map((wallet) => {
    const initial = Number(wallet.initialBalance);
    const balance =
      initial +
      (inMap.get(wallet.id) ?? 0) -
      (outMap.get(wallet.id) ?? 0) -
      (tfOutMap.get(wallet.id) ?? 0) +
      (tfInMap.get(wallet.id) ?? 0);
    return {
      id: wallet.id,
      name: wallet.name,
      type: wallet.type,
      initialBalance: initial,
      balance,
    };
  });

  return {
    wallets: result,
    total: result.reduce((sum, wallet) => sum + wallet.balance, 0),
  };
}

export async function getWalletBalances(userId: string): Promise<BalancesResult> {
  return getWalletBalancesForUsers([userId]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ringkasan periode
// ─────────────────────────────────────────────────────────────────────────────

export interface PeriodSummary {
  income: number;
  expense: number;
  net: number;
}

export async function getSummary(
  userIds: string[],
  start: Date,
  end: Date,
): Promise<PeriodSummary> {
  const rows = await prisma.transaction.groupBy({
    by: ["type"],
    where: {
      userId: { in: userIds },
      type: { in: ["INCOME", "EXPENSE"] },
      occurredAt: { gte: start, lt: end },
    },
    _sum: { amount: true },
  });

  const income = Number(rows.find((row) => row.type === "INCOME")?._sum.amount ?? 0);
  const expense = Number(rows.find((row) => row.type === "EXPENSE")?._sum.amount ?? 0);
  return { income, expense, net: income - expense };
}

export interface CategoryTotal {
  categoryId: string | null;
  name: string;
  emoji: string;
  total: number;
}

export async function getCategoryTotals(
  userIds: string[],
  start: Date,
  end: Date,
  kind: TxKind,
): Promise<CategoryTotal[]> {
  const rows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId: { in: userIds },
      type: kind,
      occurredAt: { gte: start, lt: end },
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  const categoryIds = rows
    .map((row) => row.categoryId)
    .filter((id): id is string => Boolean(id));

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
  });
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  return rows.map((row) => {
    const category = row.categoryId ? categoryMap.get(row.categoryId) : undefined;
    return {
      categoryId: row.categoryId,
      name: category?.name ?? "Tanpa kategori",
      emoji: category?.emoji ?? "❔",
      total: Number(row._sum.amount ?? 0),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Pencatatan transaksi (dipakai bot WhatsApp & web)
// ─────────────────────────────────────────────────────────────────────────────

export interface RecordTransactionInput {
  userId: string;
  kind: TxKind;
  amount: number;
  note?: string;
  occurredAt?: Date;
  walletId?: string | null;
  walletHint?: string | null;
  categoryId?: string | null;
  categoryHint?: string | null;
  source: TxSource;
  rawMessage?: string | null;
}

export type RecordTransactionResult =
  | {
      ok: true;
      transaction: Transaction;
      wallet: WalletBalance;
      category: Category | null;
      balances: BalancesResult;
    }
  | { ok: false; error: string };

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchWallet(wallets: Wallet[], hint: string): Wallet | undefined {
  const needle = normalizeName(hint);
  if (!needle) return undefined;
  return (
    wallets.find((wallet) => normalizeName(wallet.name) === needle) ??
    wallets.find((wallet) => normalizeName(wallet.name).includes(needle)) ??
    wallets.find((wallet) => needle.includes(normalizeName(wallet.name)))
  );
}

/**
 * Tag seperti @6281234567890 atau @nama.email adalah mention WhatsApp,
 * bukan penanda dompet. Jangan dianggap salah ketik nama dompet.
 */
function looksLikeContactTag(hint: string): boolean {
  return /^\d{6,}$/.test(hint) || hint.includes(".") || hint.includes("@");
}

async function resolveWallet(
  userId: string,
  walletId?: string | null,
  hint?: string | null,
): Promise<{ ok: true; wallet: Wallet } | { ok: false; error: string }> {
  const wallets = await prisma.wallet.findMany({
    where: { userId, archived: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (walletId) {
    const wallet = wallets.find((item) => item.id === walletId);
    return wallet
      ? { ok: true, wallet }
      : { ok: false, error: "Dompet tidak ditemukan." };
  }

  if (hint) {
    const wallet = matchWallet(wallets, hint);
    if (wallet) return { ok: true, wallet };

    // Jangan diam-diam mencatat ke dompet default saat tag dompet salah ketik.
    if (!looksLikeContactTag(hint)) {
      const choices = wallets.map((item) => item.name).join(", ");
      return {
        ok: false,
        error: `Dompet "@${hint}" tidak ditemukan.${choices ? ` Pilihan: ${choices}.` : ""}`,
      };
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultWalletId: true },
  });
  if (user?.defaultWalletId) {
    const wallet = wallets.find((item) => item.id === user.defaultWalletId);
    if (wallet) return { ok: true, wallet };
  }

  if (wallets.length > 0) return { ok: true, wallet: wallets[0] };

  const created = await prisma.wallet.create({
    data: { userId, name: "Cash", type: "CASH" },
  });
  return { ok: true, wallet: created };
}

async function resolveCategory(
  userId: string,
  kind: TxKind,
  options: { categoryId?: string | null; hint?: string | null; text?: string | null },
): Promise<Category | null> {
  const categories = await prisma.category.findMany({
    where: { userId, type: kind },
    orderBy: { sortOrder: "asc" },
  });

  if (options.categoryId) {
    const found = categories.find((category) => category.id === options.categoryId);
    if (found) return found;
  }

  const hint = options.hint?.trim();
  if (hint) {
    const exact = categories.find(
      (category) => normalizeName(category.name) === normalizeName(hint),
    );
    if (exact) return exact;

    const fromHint = guessCategory(hint, categories, kind);
    if (fromHint) return fromHint;

    const keyword = categories.find((category) =>
      category.keywords.some(
        (item) => normalizeName(item) === normalizeName(hint) || item.includes(hint),
      ),
    );
    if (keyword) return keyword;
  }

  const fromText = options.text ? guessCategory(options.text, categories, kind) : undefined;
  if (fromText) return fromText;

  const fallbackName = kind === "INCOME" ? "Pemasukan Lain" : "Pengeluaran Lain";
  const fallback = categories.find((category) => category.name === fallbackName);
  if (fallback) return fallback;

  return prisma.category.create({
    data: {
      userId,
      name: fallbackName,
      type: kind,
      emoji: kind === "INCOME" ? "💰" : "📦",
      keywords: [],
      sortOrder: 99,
    },
  });
}

export async function recordTransaction(
  input: RecordTransactionInput,
): Promise<RecordTransactionResult> {
  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Nominal harus lebih dari 0." };
  }
  if (amount > 1_000_000_000_000) {
    return { ok: false, error: "Nominal terlalu besar." };
  }

  const walletResult = await resolveWallet(input.userId, input.walletId, input.walletHint);
  if (!walletResult.ok) return walletResult;

  const category = await resolveCategory(input.userId, input.kind, {
    categoryId: input.categoryId,
    hint: input.categoryHint,
    text: input.note,
  });

  const transaction = await prisma.transaction.create({
    data: {
      userId: input.userId,
      walletId: walletResult.wallet.id,
      categoryId: category?.id ?? null,
      type: input.kind,
      amount: BigInt(amount),
      note: (input.note ?? "").slice(0, 240),
      occurredAt: input.occurredAt ?? new Date(),
      source: input.source,
      rawMessage: input.rawMessage?.slice(0, 1000) ?? null,
    },
  });

  const balances = await getWalletBalances(input.userId);
  const wallet =
    balances.wallets.find((item) => item.id === walletResult.wallet.id) ??
    ({
      id: walletResult.wallet.id,
      name: walletResult.wallet.name,
      type: walletResult.wallet.type,
      initialBalance: Number(walletResult.wallet.initialBalance),
      balance: 0,
    } satisfies WalletBalance);

  return { ok: true, transaction, wallet, category, balances };
}

export interface RecordTransferInput {
  userId: string;
  amount: number;
  fromWalletId?: string | null;
  toWalletId?: string | null;
  fromHint?: string | null;
  toHint?: string | null;
  note?: string;
  occurredAt?: Date;
  source: TxSource;
  rawMessage?: string | null;
}

export type RecordTransferResult =
  | { ok: true; transaction: Transaction; from: WalletBalance; to: WalletBalance; balances: BalancesResult }
  | { ok: false; error: string };

export async function recordTransfer(
  input: RecordTransferInput,
): Promise<RecordTransferResult> {
  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Nominal harus lebih dari 0." };
  }

  const fromResult = await resolveWallet(input.userId, input.fromWalletId, input.fromHint);
  if (!fromResult.ok) return fromResult;

  const toResult = await resolveWallet(input.userId, input.toWalletId, input.toHint);
  if (!toResult.ok) return toResult;

  if (fromResult.wallet.id === toResult.wallet.id) {
    return { ok: false, error: "Dompet asal dan tujuan tidak boleh sama." };
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId: input.userId,
      walletId: fromResult.wallet.id,
      toWalletId: toResult.wallet.id,
      categoryId: null,
      type: "TRANSFER",
      amount: BigInt(amount),
      note: (input.note ?? "").slice(0, 240),
      occurredAt: input.occurredAt ?? new Date(),
      source: input.source,
      rawMessage: input.rawMessage?.slice(0, 1000) ?? null,
    },
  });

  const balances = await getWalletBalances(input.userId);
  const find = (id: string): WalletBalance =>
    balances.wallets.find((item) => item.id === id) ?? {
      id,
      name: id,
      type: "OTHER",
      initialBalance: 0,
      balance: 0,
    };

  return {
    ok: true,
    transaction,
    from: find(fromResult.wallet.id),
    to: find(toResult.wallet.id),
    balances,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfer antar anggota keluarga
// ─────────────────────────────────────────────────────────────────────────────

export interface RecordMemberTransferInput {
  userId: string;
  amount: number;
  fromWalletId?: string | null;
  fromHint?: string | null;
  toUserId?: string | null;
  toUserHint?: string | null;
  toWalletId?: string | null;
  toHint?: string | null;
  note?: string;
  occurredAt?: Date;
  source: TxSource;
  rawMessage?: string | null;
}

export type RecordMemberTransferResult =
  | {
      ok: true;
      transaction: Transaction;
      from: WalletBalance;
      to: WalletBalance;
      recipient: { id: string; name: string };
      balances: BalancesResult;
    }
  | { ok: false; error: string };

interface MemberTarget {
  id: string;
  name: string;
  waNumber: string;
}

async function resolveMemberTarget(
  hint: string,
  excludeUserId: string,
): Promise<{ ok: true; member: MemberTarget } | { ok: false; error: string }> {
  const members = await prisma.user.findMany({
    where: { id: { not: excludeUserId } },
    select: { id: true, name: true, waNumber: true },
    orderBy: { createdAt: "asc" },
  });

  if (members.length === 0) {
    return { ok: false, error: "Belum ada anggota lain yang bisa menerima transfer." };
  }

  const digits = normalizeWaNumber(hint);
  const nameKey = normalizeName(hint);

  const byNumber =
    digits.length >= 8 ? members.find((member) => member.waNumber === digits) : undefined;
  if (byNumber) return { ok: true, member: byNumber };

  const exact = members.find((member) => normalizeName(member.name) === nameKey);
  if (exact) return { ok: true, member: exact };

  const partial = members.filter((member) => normalizeName(member.name).includes(nameKey));
  if (partial.length === 1) return { ok: true, member: partial[0] };

  const choices = members.map((member) => `@${member.name}`).join(", ");
  if (partial.length > 1) {
    return {
      ok: false,
      error: `Nama "${hint}" cocok dengan lebih dari satu anggota (${choices}). Tulis nama yang lebih lengkap.`,
    };
  }
  return { ok: false, error: `Anggota "${hint}" tidak ditemukan. Pilihan: ${choices}.` };
}

/**
 * Transfer dari dompet anggota pengirim ke dompet anggota lain.
 * Dicatat sebagai satu baris TRANSFER: saldo dompet asal berkurang dan
 * saldo dompet tujuan bertambah, tanpa dihitung sebagai pemasukan/pengeluaran.
 */
export async function recordMemberTransfer(
  input: RecordMemberTransferInput,
): Promise<RecordMemberTransferResult> {
  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Nominal harus lebih dari 0." };
  }
  if (amount > 1_000_000_000_000) {
    return { ok: false, error: "Nominal terlalu besar." };
  }

  let recipient: MemberTarget;
  if (input.toUserId) {
    const found = await prisma.user.findUnique({
      where: { id: input.toUserId },
      select: { id: true, name: true, waNumber: true },
    });
    if (!found) return { ok: false, error: "Anggota tujuan tidak ditemukan." };
    recipient = found;
  } else {
    const found = await resolveMemberTarget(input.toUserHint ?? "", input.userId);
    if (!found.ok) return found;
    recipient = found.member;
  }

  if (recipient.id === input.userId) {
    return { ok: false, error: "Tidak bisa transfer ke diri sendiri." };
  }

  const fromResult = await resolveWallet(input.userId, input.fromWalletId, input.fromHint);
  if (!fromResult.ok) return fromResult;

  const toResult = await resolveWallet(recipient.id, input.toWalletId, input.toHint);
  if (!toResult.ok) {
    return {
      ok: false,
      error: `Dompet tujuan ${recipient.name} tidak ditemukan. ${toResult.error}`,
    };
  }

  if (fromResult.wallet.id === toResult.wallet.id) {
    return { ok: false, error: "Dompet asal dan tujuan tidak boleh sama." };
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId: input.userId,
      walletId: fromResult.wallet.id,
      toWalletId: toResult.wallet.id,
      categoryId: null,
      type: "TRANSFER",
      amount: BigInt(amount),
      note: (input.note ?? "").slice(0, 240),
      occurredAt: input.occurredAt ?? new Date(),
      source: input.source,
      rawMessage: input.rawMessage?.slice(0, 1000) ?? null,
    },
  });

  const [balances, recipientBalances] = await Promise.all([
    getWalletBalances(input.userId),
    getWalletBalances(recipient.id),
  ]);

  const find = (list: BalancesResult, id: string): WalletBalance =>
    list.wallets.find((item) => item.id === id) ?? {
      id,
      name: id,
      type: "OTHER",
      initialBalance: 0,
      balance: 0,
    };

  return {
    ok: true,
    transaction,
    from: find(balances, fromResult.wallet.id),
    to: find(recipientBalances, toResult.wallet.id),
    recipient: { id: recipient.id, name: recipient.name },
    balances,
  };
}
