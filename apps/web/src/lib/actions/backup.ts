"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "../action-state";
import { requireAdmin } from "../auth";
import {
  createBackupFile,
  deleteBackupFile,
  restoreBackupFile,
  saveUploadedBackup,
} from "../backup";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui.";
}

function refresh(): void {
  revalidatePath("/", "layout");
}

export async function createBackupAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  try {
    const backup = await createBackupFile();
    refresh();
    return {
      ok: true,
      message: `Backup berhasil dibuat: ${backup.name} (${Math.round(backup.size / 1024)} KB).`,
    };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

export async function restoreBackupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  try {
    let name = String(formData.get("name") ?? "").trim();

    const upload = formData.get("file");
    if (upload instanceof File && upload.size > 0) {
      name = await saveUploadedBackup(upload);
    }

    if (!name) {
      return { ok: false, error: "Pilih backup yang ingin dipulihkan atau unggah file." };
    }

    const result = await restoreBackupFile(name);
    refresh();

    return {
      ok: true,
      message: `Database dipulihkan dari ${result.restored}. Backup pengaman dibuat: ${result.safetyBackup}.`,
    };
  } catch (error) {
    refresh();
    return { ok: false, error: messageOf(error) };
  }
}

export async function deleteBackupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  try {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, error: "Nama backup tidak valid." };

    await deleteBackupFile(name);
    refresh();
    return { ok: true, message: `Backup ${name} dihapus.` };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}
