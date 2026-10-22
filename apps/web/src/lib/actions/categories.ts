"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@saku/db";
import type { ActionState } from "../action-state";
import { requireUser } from "../auth";

function refresh(): void {
  for (const path of ["/categories", "/transactions", "/dashboard", "/reports"]) {
    revalidatePath(path);
  }
}

function fail(error: string): ActionState {
  return { ok: false, error };
}

function parseKeywords(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,\n]/)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0 && item.length <= 30),
    ),
  ).slice(0, 25);
}

export async function saveCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const type = String(formData.get("type") ?? "").trim();
  const emojiRaw = String(formData.get("emoji") ?? "").trim();
  const emoji = Array.from(emojiRaw)[0] ?? "🏷️";
  const keywords = parseKeywords(String(formData.get("keywords") ?? ""));

  if (!name) return fail("Nama kategori wajib diisi.");
  if (type !== "INCOME" && type !== "EXPENSE") {
    return fail("Jenis kategori tidak valid.");
  }

  try {
    if (id) {
      const existing = await prisma.category.findFirst({
        where: { id, userId: user.id },
        select: { id: true },
      });
      if (!existing) return fail("Kategori tidak ditemukan.");

      await prisma.category.update({
        where: { id },
        data: { name, type, emoji, keywords },
      });
    } else {
      await prisma.category.create({
        data: {
          userId: user.id,
          name,
          type,
          emoji,
          keywords,
          sortOrder: 50,
        },
      });
    }
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return fail("Kategori dengan nama dan jenis itu sudah ada.");
    }
    throw error;
  }

  refresh();
  return { ok: true, ts: Date.now() };
}

export async function deleteCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "").trim();

  const existing = await prisma.category.findFirst({
    where: { id, userId: user.id },
    select: { id: true, name: true },
  });
  if (!existing) return fail("Kategori tidak ditemukan.");

  await prisma.category.delete({ where: { id } });
  refresh();
  return { ok: true, ts: Date.now() };
}
