import type { UtilityPurchase } from "@prisma/client";
import {
  UTILITY_META,
  isUtilityKind,
  utilityTransactionNote,
  validateUtility,
  type TxSource,
  type UtilityKind,
} from "@saku/shared";
import { prisma } from "./client";
import {
  createUtilityExpense,
  deleteUtilityExpense,
  updateUtilityExpense,
} from "./utility-expense";

// ─────────────────────────────────────────────────────────────────────────────
// Galon air & gas LPG — dicatat per jumlah, otomatis jadi pengeluaran penginput.
// ─────────────────────────────────────────────────────────────────────────────

export interface UtilityPurchaseInput {
  kind: UtilityKind;
  purchasedAt: Date;
  quantity: number;
  price: number;
  note?: string;
  source?: TxSource;
  rawMessage?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
}

export interface UtilityPurchaseView {
  id: string;
  kind: UtilityKind;
  purchasedAt: Date;
  quantity: number;
  price: number;
  note: string;
  source: string;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type RecordUtilityPurchaseResult =
  | { ok: true; purchase: UtilityPurchaseView }
  | { ok: false; error: string };

export type DeleteUtilityPurchaseResult =
  | { ok: true }
  | { ok: false; error: string };

function toView(row: UtilityPurchase): UtilityPurchaseView {
  return {
    id: row.id,
    kind: row.kind,
    purchasedAt: row.purchasedAt,
    quantity: Number(row.quantity),
    price: Number(row.price),
    note: row.note,
    source: row.source,
    createdByUserId: row.createdByUserId,
    createdByName: row.createdByName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildData(input: UtilityPurchaseInput) {
  return {
    kind: input.kind,
    purchasedAt: input.purchasedAt,
    quantity: input.quantity,
    price: BigInt(Math.round(input.price)),
    note: (input.note ?? "").trim().slice(0, 240),
  };
}

export async function recordUtilityPurchase(
  input: UtilityPurchaseInput,
): Promise<RecordUtilityPurchaseResult> {
  if (!isUtilityKind(input.kind)) {
    return { ok: false, error: "Jenis catatan tidak dikenal." };
  }
  if (!(input.purchasedAt instanceof Date) || Number.isNaN(input.purchasedAt.getTime())) {
    return { ok: false, error: "Tanggal pembelian tidak valid." };
  }

  const validation = validateUtility(input);
  if (!validation.ok) return validation;

  let transactionId: string | null = null;
  if (input.createdByUserId) {
    const expense = await createUtilityExpense({
      userId: input.createdByUserId,
      amount: input.price,
      note: utilityTransactionNote(input.kind, input.quantity, input.note),
      occurredAt: input.purchasedAt,
      source: input.source ?? "WEB",
      categoryHint: UTILITY_META[input.kind].categoryHint,
      rawMessage: input.rawMessage,
    });
    if (!expense.ok) return expense;
    transactionId = expense.transactionId;
  }

  try {
    const row = await prisma.utilityPurchase.create({
      data: {
        ...buildData(input),
        source: input.source ?? "WEB",
        rawMessage: input.rawMessage ? input.rawMessage.slice(0, 1000) : null,
        transactionId,
        createdByUserId: input.createdByUserId ?? null,
        createdByName: input.createdByName
          ? input.createdByName.slice(0, 80)
          : null,
      },
    });

    return { ok: true, purchase: toView(row) };
  } catch (error) {
    await deleteUtilityExpense(transactionId).catch(() => undefined);
    throw error;
  }
}

export async function updateUtilityPurchase(
  id: string,
  input: UtilityPurchaseInput,
): Promise<RecordUtilityPurchaseResult> {
  if (!isUtilityKind(input.kind)) {
    return { ok: false, error: "Jenis catatan tidak dikenal." };
  }
  if (!(input.purchasedAt instanceof Date) || Number.isNaN(input.purchasedAt.getTime())) {
    return { ok: false, error: "Tanggal pembelian tidak valid." };
  }

  const validation = validateUtility(input);
  if (!validation.ok) return validation;

  const existing = await prisma.utilityPurchase.findUnique({
    where: { id },
    select: {
      id: true,
      transactionId: true,
      createdByUserId: true,
      source: true,
    },
  });
  if (!existing) return { ok: false, error: "Catatan tidak ditemukan." };

  const row = await prisma.utilityPurchase.update({
    where: { id },
    data: buildData(input),
  });

  if (existing.createdByUserId) {
    const expense = await updateUtilityExpense(existing.transactionId, {
      userId: existing.createdByUserId,
      amount: input.price,
      note: utilityTransactionNote(input.kind, input.quantity, input.note),
      occurredAt: input.purchasedAt,
      source: existing.source as TxSource,
      categoryHint: UTILITY_META[input.kind].categoryHint,
      rawMessage: input.rawMessage,
    });
    if (!expense.ok) return expense;

    if (!existing.transactionId) {
      await prisma.utilityPurchase.update({
        where: { id },
        data: { transactionId: expense.transactionId },
      });
    }
  }

  return { ok: true, purchase: toView(row) };
}

export async function deleteUtilityPurchase(
  id: string,
): Promise<DeleteUtilityPurchaseResult> {
  const existing = await prisma.utilityPurchase.findUnique({
    where: { id },
    select: { id: true, transactionId: true },
  });
  if (!existing) return { ok: false, error: "Catatan tidak ditemukan." };

  await prisma.$transaction(async (tx) => {
    await tx.utilityPurchase.delete({ where: { id } });
    if (existing.transactionId) {
      await tx.transaction.deleteMany({ where: { id: existing.transactionId } });
    }
  });

  return { ok: true };
}

/** Semua catatan galon/gas, urut dari pembelian paling awal. */
export async function listUtilityPurchases(): Promise<UtilityPurchaseView[]> {
  const rows = await prisma.utilityPurchase.findMany({
    orderBy: [{ purchasedAt: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toView);
}
