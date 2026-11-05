"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDateTimeID } from "@saku/shared";
import type { ActionState } from "@/lib/action-state";
import { initialActionState } from "@/lib/action-state";
import type { BackupFile } from "@/lib/backup";
import {
  createBackupAction,
  deleteBackupAction,
  restoreBackupAction,
} from "@/lib/actions/backup";
import {
  IconDatabase,
  IconDownload,
  IconRefresh,
  IconTrash,
  IconUpload,
} from "./icons";
import { cn } from "./ui";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
        {state.message}
      </p>
    );
  }
  return null;
}

function BackupRow({ backup }: { backup: BackupFile }) {
  const router = useRouter();
  const [restoreState, restoreAction, restoring] = useActionState(
    restoreBackupAction,
    initialActionState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteBackupAction,
    initialActionState,
  );

  useEffect(() => {
    if (restoreState.ok || deleteState.ok) router.refresh();
  }, [restoreState.ok, deleteState.ok, router]);

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <IconDatabase className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[11px] font-semibold text-slate-800">
            {backup.name}
          </p>
          <p className="text-[11px] text-slate-500">
            {formatBytes(backup.size)} · {formatDateTimeID(new Date(backup.createdAt))} ·{" "}
            {backup.kind === "plain" ? "SQL" : "dump"}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <a
            href={`/api/admin/backups?name=${encodeURIComponent(backup.name)}`}
            className="icon-btn"
            title="Unduh backup"
            aria-label={`Unduh ${backup.name}`}
          >
            <IconDownload className="h-4 w-4" />
          </a>

          <form
            action={restoreAction}
            onSubmit={(event) => {
              if (
                !window.confirm(
                  `Pulihkan database dari ${backup.name}?\n\nSeluruh data saat ini akan diganti dengan isi backup. Backup pengaman akan dibuat otomatis sebelum restore.`,
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="name" value={backup.name} />
            <button
              type="submit"
              className="btn-ghost btn-sm"
              disabled={restoring || deleting}
            >
              <IconRefresh className={cn("h-3.5 w-3.5", restoring && "animate-spin")} />
              {restoring ? "Memulihkan..." : "Pulihkan"}
            </button>
          </form>

          <form
            action={deleteAction}
            onSubmit={(event) => {
              if (!window.confirm(`Hapus file backup ${backup.name}?`)) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="name" value={backup.name} />
            <button
              type="submit"
              className="icon-btn hover:bg-rose-50 hover:text-rose-600"
              title="Hapus backup"
              aria-label={`Hapus ${backup.name}`}
              disabled={restoring || deleting}
            >
              <IconTrash className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {restoreState.error || restoreState.message ? (
        <div className="mt-2">
          <Feedback state={restoreState} />
        </div>
      ) : null}
      {deleteState.error || deleteState.message ? (
        <div className="mt-2">
          <Feedback state={deleteState} />
        </div>
      ) : null}
    </li>
  );
}

export function BackupPanel({ backups }: { backups: BackupFile[] }) {
  const router = useRouter();
  const [createState, createAction, creating] = useActionState(
    createBackupAction,
    initialActionState,
  );
  const [uploadState, uploadAction, uploading] = useActionState(
    restoreBackupAction,
    initialActionState,
  );

  useEffect(() => {
    if (createState.ok || uploadState.ok) router.refresh();
  }, [createState.ok, uploadState.ok, router]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
        Restore akan <strong>mengganti seluruh isi database</strong> dengan isi backup.
        Backup pengaman dibuat otomatis sebelum proses restore dijalankan. Bot WhatsApp
        mungkin terputus sebentar saat restore.
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">Buat backup</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Menyimpan salinan database ke volume <code>/backups</code>.
          </p>
          <form action={createAction} className="mt-3 space-y-2">
            <button type="submit" className="btn-primary" disabled={creating}>
              <IconDatabase className={cn("h-4 w-4", creating && "animate-pulse")} />
              {creating ? "Membuat backup..." : "Buat backup sekarang"}
            </button>
            <Feedback state={createState} />
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">Restore dari file</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Unggah file <code>.dump</code> hasil pg_dump atau file <code>.sql</code>.
          </p>
          <form
            action={uploadAction}
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Pulihkan database dari file yang diunggah?\n\nSeluruh data saat ini akan diganti. Backup pengaman dibuat otomatis.",
                )
              ) {
                event.preventDefault();
              }
            }}
            className="mt-3 space-y-2"
          >
            <input
              type="file"
              name="file"
              accept=".dump,.backup,.sql"
              required
              className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-[11px] text-slate-600 file:mr-3 file:cursor-pointer file:rounded-l-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-[11px] file:font-semibold file:text-slate-700"
            />
            <button type="submit" className="btn-danger btn-sm" disabled={uploading}>
              <IconUpload className="h-3.5 w-3.5" />
              {uploading ? "Memulihkan..." : "Unggah & pulihkan"}
            </button>
            <Feedback state={uploadState} />
          </form>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            File backup ({backups.length})
          </p>
        </div>

        {backups.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-500">
            Belum ada backup. Klik “Buat backup sekarang” untuk memulai.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {backups.map((backup) => (
              <BackupRow key={backup.name} backup={backup} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
