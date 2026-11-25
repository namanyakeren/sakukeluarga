import { prisma } from "./client";
import { recordTransaction } from "./services";
import type { TxSource } from "@saku/shared";

/**
 * Catatan listrik/galon/gas otomatis dicatat sebagai pengeluaran milik
 * penginput. Helper ini menjaga transaksi tetap sinkron saat catatan diubah
 * atau dihapus.
 */

export interface UtilityExpenseInput {
  userId: string;
  amount: number;
  note: string;
  occurredAt: Date;
  source: TxSource;
  categoryHint: string;
  rawMessage?: string | null;
}

export type UtilityExpenseResult =
  | { ok: true; transactionId: string }
  | { ok: false; error: string };

export async function createUtilityExpense(
  input: UtilityExpenseInput,
): Promise<UtilityExpenseResult> {
  const result = await recordTransaction({
    userId: input.userId,
    kind: "EXPENSE",
    amount: input.amount,
    note: input.note,
    occurredAt: input.occurredAt,
    categoryHint: input.categoryHint,
    source: input.source,
    rawMessage: input.rawMessage ?? null,
  });
  if (!result.ok) return result;
  return { ok: true, transactionId: result.transaction.id };
}

/** Perbarui pengeluaran terkait; buat baru bila catatan lama belum punya. */
export async function updateUtilityExpense(
  transactionId: string | null,
  input: UtilityExpenseInput,
): Promise<UtilityExpenseResult> {
  if (!transactionId) return createUtilityExpense(input);

  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      amount: BigInt(Math.round(input.amount)),
      note: input.note.slice(0, 240),
      occurredAt: input.occurredAt,
    },
  });
  return { ok: true, transactionId };
}

export async function deleteUtilityExpense(
  transactionId: string | null,
): Promise<void> {
  if (!transactionId) return;
  await prisma.transaction.deleteMany({ where: { id: transactionId } });
}
