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
  const waNumber = normalizeWaNumber(String(formData.get("waNumber") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!isValidWaNumber(waNumber)) {
    return { ok: false, error: "Nomor WhatsApp tidak valid. Contoh: 081234567890." };
  }
  if (!password) {
    return { ok: false, error: "Password wajib diisi." };
  }

  const user = await prisma.user.findUnique({ where: { waNumber } });
  if (!user) {
    return { ok: false, error: "Nomor atau password salah." };
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "Nomor atau password salah." };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
