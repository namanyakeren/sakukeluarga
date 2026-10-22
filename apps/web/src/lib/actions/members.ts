"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { createUserWithDefaults, prisma, type Role } from "@saku/db";
import { isValidWaNumber, normalizeWaNumber } from "@saku/shared";
import type { ActionState } from "../action-state";
import { requireAdmin, requireUser } from "../auth";

function refresh(): void {
  for (const path of ["/settings", "/dashboard", "/transactions", "/reports"]) {
    revalidatePath(path);
  }
}

function fail(error: string): ActionState {
  return { ok: false, error };
}

export async function createMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const waNumber = normalizeWaNumber(String(formData.get("waNumber") ?? ""));
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "MEMBER");
  const role: Role = roleRaw === "ADMIN" ? "ADMIN" : "MEMBER";

  if (!name) return fail("Nama wajib diisi.");
  if (!isValidWaNumber(waNumber)) {
    return fail("Nomor WhatsApp tidak valid. Contoh: 081234567890.");
  }
  if (password.length < 8) return fail("Password minimal 8 karakter.");

  try {
    await createUserWithDefaults({
      name,
      waNumber,
      passwordHash: await hash(password, 11),
      role,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return fail("Nomor WhatsApp itu sudah terdaftar.");
    }
    throw error;
  }

  refresh();
  return { ok: true, ts: Date.now() };
}

export async function resetMemberPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) return fail("Password minimal 8 karakter.");

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!target) return fail("Anggota tidak ditemukan.");

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hash(password, 11) },
  });

  return { ok: true, ts: Date.now() };
}

export async function updateMemberRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "");
  if (roleRaw !== "ADMIN" && roleRaw !== "MEMBER") {
    return fail("Peran tidak valid.");
  }
  if (userId === admin.id) {
    return fail("Tidak bisa mengubah peran akun sendiri.");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!target) return fail("Anggota tidak ditemukan.");

  await prisma.user.update({
    where: { id: userId },
    data: { role: roleRaw },
  });

  refresh();
  return { ok: true, ts: Date.now() };
}

export async function deleteMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return fail("Anggota tidak ditemukan.");
  if (userId === admin.id) {
    return fail("Kamu tidak bisa menghapus akun sendiri.");
  }

  await prisma.user.delete({ where: { id: userId } });
  refresh();
  return { ok: true, ts: Date.now() };
}

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const waNumber = normalizeWaNumber(String(formData.get("waNumber") ?? ""));

  if (!name) return fail("Nama wajib diisi.");
  if (!isValidWaNumber(waNumber)) {
    return fail("Nomor WhatsApp tidak valid. Contoh: 081234567890.");
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { name, waNumber },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return fail("Nomor WhatsApp itu sudah dipakai anggota lain.");
    }
    throw error;
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, ts: Date.now() };
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!currentPassword) return fail("Masukkan password saat ini.");
  if (newPassword.length < 8) return fail("Password baru minimal 8 karakter.");

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return fail("Akun tidak ditemukan.");

  const { compare } = await import("bcryptjs");
  const valid = await compare(currentPassword, record.passwordHash);
  if (!valid) return fail("Password saat ini salah.");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hash(newPassword, 11) },
  });

  return { ok: true, ts: Date.now() };
}
