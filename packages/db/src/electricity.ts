import type { ElectricityPurchase } from "@prisma/client";
import {
  validateElectricity,
  type TxSource,
} from "@saku/shared";
import { prisma } from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// Token listrik — data umum, tidak terikat dompet atau akun anggota.
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

export async function recordElectricityPurchase(
  input: ElectricityPurchaseInput,
): Promise<RecordElectricityPurchaseResult> {
  if (!(input.purchasedAt instanceof Date) || Number.isNaN(input.purchasedAt.getTime())) {
    return { ok: false, error: "Tanggal pembelian tidak valid." };
  }

  const validation = validateElectricity(input);
  if (!validation.ok) return validation;

  const row = await prisma.electricityPurchase.create({
    data: {
      ...buildData(input),
      source: input.source ?? "WEB",
      rawMessage: input.rawMessage ? input.rawMessage.slice(0, 1000) : null,
      createdByUserId: input.createdByUserId ?? null,
      createdByName: input.createdByName
        ? input.createdByName.slice(0, 80)
        : null,
    },
  });

  return { ok: true, purchase: toView(row) };
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
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Catatan listrik tidak ditemukan." };

  const row = await prisma.electricityPurchase.update({
    where: { id },
    data: buildData(input),
  });

  return { ok: true, purchase: toView(row) };
}

export async function deleteElectricityPurchase(
  id: string,
): Promise<DeleteElectricityPurchaseResult> {
  const existing = await prisma.electricityPurchase.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Catatan listrik tidak ditemukan." };

  await prisma.electricityPurchase.delete({ where: { id } });
  return { ok: true };
}

/** Semua catatan listrik, urut dari pembelian paling awal. */
export async function listElectricityPurchases(): Promise<ElectricityPurchaseView[]> {
  const rows = await prisma.electricityPurchase.findMany({
    orderBy: [{ purchasedAt: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toView);
}
