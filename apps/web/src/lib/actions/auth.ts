"use server";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@saku/db";
import { isValidWaNumber, normalizeWaNumber } from "@saku/shared";
import type { ActionState } from "../action-state";
import { createSession, destroySession } from "../auth";

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const identifier = String(
    formData.get("identifier") ?? formData.get("waNumber") ?? "",
  ).trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier) {
    return { ok: false, error: "Nomor WhatsApp atau nama pengguna wajib diisi." };
  }
  if (!password) {
    return { ok: false, error: "Password wajib diisi." };
  }

  // 1. Coba cari berdasarkan nomor WhatsApp
  const normalizedWa = normalizeWaNumber(identifier);
  let user = null;

  if (isValidWaNumber(normalizedWa)) {
    user = await prisma.user.findUnique({ where: { waNumber: normalizedWa } });
  }

  // 2. Jika tidak ditemukan atau identifier adalah username, cari berdasarkan nama (case-insensitive)
  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        name: {
          equals: identifier,
          mode: "insensitive",
        },
      },
    });
  }

  if (!user) {
    return { ok: false, error: "Nomor WhatsApp/nama pengguna atau password salah." };
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "Nomor WhatsApp/nama pengguna atau password salah." };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
