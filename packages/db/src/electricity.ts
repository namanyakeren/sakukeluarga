import type { ElectricityPurchase } from "@prisma/client";
import {
  formatKwh,
  validateElectricity,
  type TxSource,
} from "@saku/shared";
import { prisma } from "./client";
import {
  createUtilityExpense,
  deleteUtilityExpense,
  updateUtilityExpense,
} from "./utility-expense";

// ─────────────────────────────────────────────────────────────────────────────
// Token listrik — data umum, dan otomatis menjadi pengeluaran penginput.
// ─────────────────────────────────────────────────────────────────────────────

export interface ElectricityPurchaseInput {
  purchasedAt: Date;
  kwhBefore: number;
  kwhAmount: number;
  kwhAfter: number;
  price: number;
  note?: string;
  source?: TxSource;
  rawMessage?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
}

export interface ElectricityPurchaseView {
  id: string;
  purchasedAt: Date;
  kwhBefore: number;
  kwhAmount: number;
  kwhAfter: number;
  price: number;
  note: string;
  source: string;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type RecordElectricityPurchaseResult =
  | { ok: true; purchase: ElectricityPurchaseView }
  | { ok: false; error: string };

export type DeleteElectricityPurchaseResult =
  | { ok: true }
  | { ok: false; error: string };

function toView(row: ElectricityPurchase): ElectricityPurchaseView {
  return {
    id: row.id,
    purchasedAt: row.purchasedAt,
    kwhBefore: Number(row.kwhBefore),
    kwhAmount: Number(row.kwhAmount),
    kwhAfter: Number(row.kwhAfter),
    price: Number(row.price),
    note: row.note,
    source: row.source,
    createdByUserId: row.createdByUserId,
    createdByName: row.createdByName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildData(input: ElectricityPurchaseInput) {
  return {
    purchasedAt: input.purchasedAt,
    kwhBefore: input.kwhBefore,
    kwhAmount: input.kwhAmount,
    kwhAfter: input.kwhAfter,
    price: BigInt(Math.round(input.price)),
    note: (input.note ?? "").trim().slice(0, 240),
  };
}

function expenseNote(input: ElectricityPurchaseInput): string {
  const base = `Token listrik ${formatKwh(input.kwhAmount)} kWh`;
  const note = (input.note ?? "").trim();
  return (note ? `${base} · ${note}` : base).slice(0, 240);
}

export async function recordElectricityPurchase(
  input: ElectricityPurchaseInput,
): Promise<RecordElectricityPurchaseResult> {
  if (!(input.purchasedAt instanceof Date) || Number.isNaN(input.purchasedAt.getTime())) {
    return { ok: false, error: "Tanggal pembelian tidak valid." };
  }

  const validation = validateElectricity(input);
  if (!validation.ok) return validation;

  let transactionId: string | null = null;
  if (input.createdByUserId) {
    const expense = await createUtilityExpense({
      userId: input.createdByUserId,
      amount: input.price,
      note: expenseNote(input),
      occurredAt: input.purchasedAt,
      source: input.source ?? "WEB",
      categoryHint: "listrik",
      rawMessage: input.rawMessage,
    });
    if (!expense.ok) return expense;
    transactionId = expense.transactionId;
  }

  try {
    const row = await prisma.electricityPurchase.create({
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
    // Jangan tinggalkan pengeluaran tanpa catatan listrik bila penyimpanan gagal.
    await deleteUtilityExpense(transactionId).catch(() => undefined);
    throw error;
  }
}

export async function updateElectricityPurchase(
  id: string,
  input: ElectricityPurchaseInput,
): Promise<RecordElectricityPurchaseResult> {
  if (!(input.purchasedAt instanceof Date) || Number.isNaN(input.purchasedAt.getTime())) {
    return { ok: false, error: "Tanggal pembelian tidak valid." };
  }

  const validation = validateElectricity(input);
  if (!validation.ok) return validation;

  const existing = await prisma.electricityPurchase.findUnique({
    where: { id },
    select: {
      id: true,
      transactionId: true,
      createdByUserId: true,
      source: true,
    },
  });
  if (!existing) return { ok: false, error: "Catatan listrik tidak ditemukan." };

  const row = await prisma.electricityPurchase.update({
    where: { id },
    data: buildData(input),
  });

  if (existing.createdByUserId) {
    const expense = await updateUtilityExpense(existing.transactionId, {
      userId: existing.createdByUserId,
      amount: input.price,
      note: expenseNote(input),
      occurredAt: input.purchasedAt,
      source: existing.source as TxSource,
      categoryHint: "listrik",
      rawMessage: input.rawMessage,
    });
    if (!expense.ok) return expense;

    if (!existing.transactionId) {
      await prisma.electricityPurchase.update({
        where: { id },
        data: { transactionId: expense.transactionId },
      });
    }
  }

  return { ok: true, purchase: toView(row) };
}

export async function deleteElectricityPurchase(
  id: string,
): Promise<DeleteElectricityPurchaseResult> {
  const existing = await prisma.electricityPurchase.findUnique({
    where: { id },
    select: { id: true, transactionId: true },
  });
  if (!existing) return { ok: false, error: "Catatan listrik tidak ditemukan." };

  await prisma.$transaction(async (tx) => {
    await tx.electricityPurchase.delete({ where: { id } });
    if (existing.transactionId) {
      await tx.transaction.deleteMany({ where: { id: existing.transactionId } });
    }
  });

  return { ok: true };
}

/** Semua catatan listrik, urut dari pembelian paling awal. */
export async function listElectricityPurchases(): Promise<ElectricityPurchaseView[]> {
  const rows = await prisma.electricityPurchase.findMany({
    orderBy: [{ purchasedAt: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toView);
}
