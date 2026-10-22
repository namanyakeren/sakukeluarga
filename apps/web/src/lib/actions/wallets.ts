"use server";

import { revalidatePath } from "next/cache";
import { prisma, type WalletType } from "@saku/db";
import { parseAmount } from "@saku/shared";
import type { ActionState } from "../action-state";
import { requireUser } from "../auth";

const WALLET_TYPES: WalletType[] = ["CASH", "BANK", "EWALLET", "OTHER"];

function refresh(): void {
  for (const path of ["/dashboard", "/wallets", "/transactions", "/reports"]) {
    revalidatePath(path);
  }
}

function fail(error: string): ActionState {
  return { ok: false, error };
}

export async function saveWalletAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const typeRaw = String(formData.get("type") ?? "CASH") as WalletType;
  const type = WALLET_TYPES.includes(typeRaw) ? typeRaw : "CASH";
  const initialRaw = String(formData.get("initialBalance") ?? "").trim();
  const initialBalance = initialRaw ? parseAmount(initialRaw) : 0;
  const makeDefault = formData.get("makeDefault") === "on";

  if (!name) return fail("Nama dompet wajib diisi.");
  if (initialBalance === null) return fail("Saldo awal tidak valid.");

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { defaultWalletId: true },
  });

  try {
    if (id) {
      const existing = await prisma.wallet.findFirst({
        where: { id, userId: user.id },
        select: { id: true },
      });
      if (!existing) return fail("Dompet tidak ditemukan.");

      await prisma.wallet.update({
        where: { id },
        data: { name, type, initialBalance: BigInt(Math.round(initialBalance)) },
      });

      if (makeDefault) {
        await prisma.user.update({
          where: { id: user.id },
          data: { defaultWalletId: id },
        });
      }
    } else {
      const wallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          name,
          type,
          initialBalance: BigInt(Math.round(initialBalance)),
          sortOrder: 10,
        },
      });

      if (makeDefault || !currentUser?.defaultWalletId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { defaultWalletId: wallet.id },
        });
      }
    }
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return fail("Nama dompet sudah dipakai.");
    }
    throw error;
  }

  refresh();
  return { ok: true, ts: Date.now() };
}

export async function deleteWalletAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "").trim();

  const wallet = await prisma.wallet.findFirst({
    where: { id, userId: user.id },
    select: { id: true, name: true },
  });
  if (!wallet) return fail("Dompet tidak ditemukan.");

  const used = await prisma.transaction.count({
    where: { userId: user.id, OR: [{ walletId: id }, { toWalletId: id }] },
  });
  if (used > 0) {
    return fail(
      `Dompet "${wallet.name}" masih dipakai ${used} transaksi. Pindahkan atau hapus transaksinya dulu.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { id: user.id, defaultWalletId: id },
      data: { defaultWalletId: null },
    });
    await tx.wallet.delete({ where: { id } });
  });

  refresh();
  return { ok: true, ts: Date.now() };
}
