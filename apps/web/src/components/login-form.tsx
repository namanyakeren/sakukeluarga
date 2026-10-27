"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { loginAction } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialActionState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="identifier">
          Nomor WhatsApp atau Nama Pengguna
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          placeholder="Contoh: 081234567890 atau Admin"
          className="input"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className="input"
          required
        />
      </div>

      {state.error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Memeriksa..." : "Masuk"}
      </button>
    </form>
  );
}
