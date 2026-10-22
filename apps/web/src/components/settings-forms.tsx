"use client";

import { useActionState, useEffect, useRef } from "react";
import { initialActionState } from "@/lib/action-state";
import {
  changePasswordAction,
  updateProfileAction,
} from "@/lib/actions/members";

function Success({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
      {children}
    </p>
  );
}

export function ProfileForm({ name, waNumber }: { name: string; waNumber: string }) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="profile-name">
          Nama
        </label>
        <input
          id="profile-name"
          name="name"
          className="input"
          defaultValue={name}
          maxLength={60}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="profile-wa">
          Nomor WhatsApp
        </label>
        <input
          id="profile-wa"
          name="waNumber"
          type="tel"
          className="input"
          defaultValue={waNumber}
          required
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Bot memakai nomor ini untuk mengenali pesanmu. Ganti jika kamu berganti nomor.
        </p>
      </div>

      {state.error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {state.error}
        </p>
      ) : null}
      <Success show={state.ok}>Profil tersimpan.</Success>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan profil"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok, state.ts]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="current-password">
          Password saat ini
        </label>
        <input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className="input"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="new-password">
          Password baru
        </label>
        <input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          className="input"
          minLength={8}
          required
        />
        <p className="mt-1 text-[11px] text-slate-500">Minimal 8 karakter.</p>
      </div>

      {state.error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {state.error}
        </p>
      ) : null}
      <Success show={state.ok}>Password diperbarui.</Success>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Menyimpan..." : "Ganti password"}
      </button>
    </form>
  );
}
