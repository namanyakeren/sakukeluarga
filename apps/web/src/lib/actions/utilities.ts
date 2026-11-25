"use server";

import { revalidatePath } from "next/cache";
import {
  deleteUtilityPurchase,
  recordUtilityPurchase,
  updateUtilityPurchase,
} from "@saku/db";
import {
  dateInputToUtc,
  isUtilityKind,
  parseAmount,
  parseQuantity,
} from "@saku/shared";
import type { ActionState } from "../action-state";
import { requireUser } from "../auth";

function refresh(): void {
  for (const path of [
    "/utilities",
    "/dashboard",
    "/transactions",
    "/reports",
    "/wallets",
  ]) {
    revalidatePath(path);
  }
}

function fail(error: string): ActionState {
  return { ok: false, error };
}

export async function saveUtilityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "").trim();

  const kind = String(formData.get("kind") ?? "").trim();
  if (!isUtilityKind(kind)) return fail("Jenis catatan tidak dikenal.");

  const quantity = parseQuantity(String(formData.get("quantity") ?? ""));
  if (quantity === null) {
    return fail("Jumlah tidak valid. Contoh: 2 atau 1,5.");
  }

  const price = parseAmount(String(formData.get("price") ?? ""));
  if (!price) {
    return fail("Harga tidak valid. Contoh: 20rb atau 20.000.");
  }

  const dateRaw = String(formData.get("purchasedAt") ?? "").trim();
  const purchasedAt = dateRaw ? dateInputToUtc(dateRaw) : new Date();
  if (!purchasedAt) return fail("Tanggal pembelian tidak valid.");

  const note = String(formData.get("note") ?? "").trim().slice(0, 240);

  const input = { kind, purchasedAt, quantity, price, note };

  const result = id
    ? await updateUtilityPurchase(id, input)
    : await recordUtilityPurchase({
        ...input,
        source: "WEB",
        createdByUserId: user.id,
        createdByName: user.name,
      });

  if (!result.ok) return fail(result.error);

  refresh();
  return { ok: true, ts: Date.now() };
}

export async function deleteUtilityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return fail("Catatan tidak ditemukan.");

  const result = await deleteUtilityPurchase(id);
  if (!result.ok) return fail(result.error);

  refresh();
  return { ok: true, ts: Date.now() };
}
