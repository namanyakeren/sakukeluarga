"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { loginAction } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialActionState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="waNumber">
          Nomor WhatsApp
        </label>
        <input
          id="waNumber"
          name="waNumber"
          type="tel"
          inputMode="tel"
          autoComplete="username"
          placeholder="0812 3456 7890"
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
