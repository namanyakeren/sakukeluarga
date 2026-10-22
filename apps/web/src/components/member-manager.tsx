"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { initialActionState } from "@/lib/action-state";
import {
  createMemberAction,
  resetMemberPasswordAction,
  updateMemberRoleAction,
} from "@/lib/actions/members";
import { Modal, useModal } from "./modal";

export function AddMemberDialog({ trigger }: { trigger: React.ReactNode }) {
  return (
    <Modal
      trigger={trigger}
      triggerClassName="btn-primary"
      triggerLabel="Tambah anggota"
      title="Tambah anggota keluarga"
      description="Anggota baru langsung bisa mencatat lewat nomor WhatsApp-nya."
    >
      <AddMemberForm />
    </Modal>
  );
}

function AddMemberForm() {
  const router = useRouter();
  const { close } = useModal();
  const [state, formAction, pending] = useActionState(
    createMemberAction,
    initialActionState,
  );

  useEffect(() => {
    if (state.ok && state.ts) {
      close();
      router.refresh();
    }
  }, [state.ok, state.ts, close, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="member-name">
          Nama
        </label>
        <input
          id="member-name"
          name="name"
          className="input"
          placeholder="cth: Siti"
          maxLength={60}
          autoFocus
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="member-wa">
          Nomor WhatsApp
        </label>
        <input
          id="member-wa"
          name="waNumber"
          type="tel"
          className="input"
          placeholder="0812 3456 7890"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="member-password">
          Password awal
        </label>
        <input
          id="member-password"
          name="password"
          type="password"
          className="input"
          placeholder="Minimal 8 karakter"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="member-role">
          Peran
        </label>
        <select id="member-role" name="role" className="input" defaultValue="MEMBER">
          <option value="MEMBER">Anggota</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      {state.error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" className="btn-ghost" onClick={close}>
          Batal
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Menyimpan..." : "Tambah anggota"}
        </button>
      </div>
    </form>
  );
}

export function ResetPasswordDialog({
  userId,
  name,
  trigger,
}: {
  userId: string;
  name: string;
  trigger: React.ReactNode;
}) {
  return (
    <Modal
      trigger={trigger}
      triggerClassName="icon-btn h-7 w-7"
      triggerLabel={`Reset password ${name}`}
      title={`Reset password ${name}`}
      description="Anggota perlu login ulang dengan password baru."
    >
      <ResetPasswordForm userId={userId} />
    </Modal>
  );
}

function ResetPasswordForm({ userId }: { userId: string }) {
  const { close } = useModal();
  const [state, formAction, pending] = useActionState(
    resetMemberPasswordAction,
    initialActionState,
  );

  useEffect(() => {
    if (state.ok && state.ts) close();
  }, [state.ok, state.ts, close]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />
      <div>
        <label className="label" htmlFor="reset-password">
          Password baru
        </label>
        <input
          id="reset-password"
          name="password"
          type="password"
          className="input"
          minLength={8}
          autoComplete="new-password"
          autoFocus
          required
        />
        <p className="mt-1 text-[11px] text-slate-500">Minimal 8 karakter.</p>
      </div>

      {state.error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          Password berhasil direset.
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" className="btn-ghost" onClick={close}>
          Tutup
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Menyimpan..." : "Reset password"}
        </button>
      </div>
    </form>
  );
}

export function MemberRoleForm({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateMemberRoleAction,
    initialActionState,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, state.ts, router]);

  useEffect(() => {
    if (state.error) window.alert(state.error);
  }, [state.error]);

  return (
    <form action={formAction} className="flex items-center">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={role}
        disabled={disabled || pending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="input w-auto py-1 pr-7 text-[11px] font-semibold disabled:bg-slate-50 disabled:text-slate-400"
        aria-label="Peran anggota"
      >
        <option value="MEMBER">Anggota</option>
        <option value="ADMIN">Admin</option>
      </select>
    </form>
  );
}
