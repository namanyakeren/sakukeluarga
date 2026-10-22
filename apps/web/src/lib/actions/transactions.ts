"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@saku/db";
import { dateInputToUtc, parseAmount } from "@saku/shared";
import type { ActionState } from "../action-state";
import { requireUser } from "../auth";

function refresh(): void {
  for (const path of ["/dashboard", "/transactions", "/reports", "/wallets"]) {
    revalidatePath(path);
  }
}

function fail(error: string): ActionState {
  return { ok: false, error };
}

export async function saveTransactionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();

  if (!["INCOME", "EXPENSE", "TRANSFER"].includes(type)) {
    return fail("Jenis transaksi tidak valid.");
  }
  const txType = type as "INCOME" | "EXPENSE" | "TRANSFER";

  const amount = parseAmount(String(formData.get("amount") ?? ""));
  if (!amount) {
    return fail("Nominal tidak valid. Contoh: 25rb, 25.000, atau 1,5jt.");
  }
  if (amount < 1) return fail("Nominal harus lebih dari 0.");
  if (amount > 1_000_000_000_000) return fail("Nominal terlalu besar.");

  let ownerId = user.id;
  if (id) {
    const existing = await prisma.transaction.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing) return fail("Transaksi tidak ditemukan.");
    if (existing.userId !== user.id) {
      return fail("Kamu hanya bisa mengubah transaksi milik sendiri.");
    }
    ownerId = existing.userId;
  }

  const walletId = String(formData.get("walletId") ?? "").trim();
  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId: ownerId },
    select: { id: true },
  });
  if (!wallet) return fail("Dompet tidak ditemukan.");

  let toWalletId: string | null = null;
  if (txType === "TRANSFER") {
    toWalletId = String(formData.get("toWalletId") ?? "").trim() || null;
    if (!toWalletId) return fail("Pilih dompet tujuan transfer.");
    if (toWalletId === walletId) {
      return fail("Dompet asal dan tujuan tidak boleh sama.");
    }
    const toWallet = await prisma.wallet.findFirst({
      where: { id: toWalletId, userId: ownerId },
      select: { id: true },
    });
    if (!toWallet) return fail("Dompet tujuan tidak ditemukan.");
  }

  let categoryId: string | null = null;
  if (txType !== "TRANSFER") {
    const rawCategory = String(formData.get("categoryId") ?? "").trim();
    if (rawCategory) {
      const category = await prisma.category.findFirst({
        where: { id: rawCategory, userId: ownerId, type: txType },
        select: { id: true },
      });
      if (!category) return fail("Kategori tidak sesuai dengan jenis transaksi.");
      categoryId = category.id;
    }
  }

  const dateRaw = String(formData.get("occurredAt") ?? "").trim();
  const occurredAt = dateRaw ? dateInputToUtc(dateRaw) : new Date();
  if (!occurredAt) return fail("Tanggal tidak valid.");

  const note = String(formData.get("note") ?? "").trim().slice(0, 240);

  const data = {
    walletId,
    toWalletId,
    categoryId,
    type: txType,
    amount: BigInt(amount),
    note,
    occurredAt,
    source: "WEB",
  };

  if (id) {
    await prisma.transaction.update({ where: { id }, data });
  } else {
    await prisma.transaction.create({ data: { ...data, userId: ownerId } });
  }

  refresh();
  return { ok: true, ts: Date.now() };
}

export async function deleteTransactionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "").trim();

  const existing = await prisma.transaction.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!existing) return fail("Transaksi tidak ditemukan.");
  if (existing.userId !== user.id) {
    return fail("Kamu hanya bisa menghapus transaksi milik sendiri.");
  }

  await prisma.transaction.delete({ where: { id } });
  refresh();
  return { ok: true, ts: Date.now() };
}
