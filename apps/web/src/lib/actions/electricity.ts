"use server";

import { revalidatePath } from "next/cache";
import {
  deleteElectricityPurchase,
  recordElectricityPurchase,
  updateElectricityPurchase,
} from "@saku/db";
import { dateInputToUtc, parseAmount, parseKwh } from "@saku/shared";
import type { ActionState } from "../action-state";
import { requireUser } from "../auth";

function refresh(): void {
  for (const path of [
    "/electricity",
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

export async function saveElectricityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "").trim();

  const kwhBefore = parseKwh(String(formData.get("kwhBefore") ?? ""));
  if (kwhBefore === null) {
    return fail("kWh sebelum tidak valid. Contoh: 1234,5.");
  }

  const kwhAmount = parseKwh(String(formData.get("kwhAmount") ?? ""));
  if (kwhAmount === null) {
    return fail("kWh yang didapat tidak valid. Contoh: 50.");
  }

  const kwhAfter = parseKwh(String(formData.get("kwhAfter") ?? ""));
  if (kwhAfter === null) {
    return fail("kWh setelah tidak valid. Contoh: 1284,5.");
  }

  const price = parseAmount(String(formData.get("price") ?? ""));
  if (!price) {
    return fail("Harga token tidak valid. Contoh: 150rb atau 150.000.");
  }

  const dateRaw = String(formData.get("purchasedAt") ?? "").trim();
  const purchasedAt = dateRaw ? dateInputToUtc(dateRaw) : new Date();
  if (!purchasedAt) return fail("Tanggal pembelian tidak valid.");

  const note = String(formData.get("note") ?? "").trim().slice(0, 240);

  const input = {
    purchasedAt,
    kwhBefore,
    kwhAmount,
    kwhAfter,
    price,
    note,
  };

  const result = id
    ? await updateElectricityPurchase(id, input)
    : await recordElectricityPurchase({
        ...input,
        source: "WEB",
        createdByUserId: user.id,
        createdByName: user.name,
      });

  if (!result.ok) return fail(result.error);

  refresh();
  return { ok: true, ts: Date.now() };
}

export async function deleteElectricityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return fail("Catatan listrik tidak ditemukan.");

  const result = await deleteElectricityPurchase(id);
  if (!result.ok) return fail(result.error);

  refresh();
  return { ok: true, ts: Date.now() };
}
