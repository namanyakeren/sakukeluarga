import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Brand } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-8 flex items-center gap-3">
          <Brand className="h-11 w-11 rounded-2xl" />
          <div>
            <p className="text-lg font-bold text-slate-900">Saku Keluarga</p>
            <p className="text-xs text-slate-500">Keuangan rapi, cukup dari WhatsApp.</p>
          </div>
        </div>

        <div className="card p-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Masuk ke dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gunakan nomor WhatsApp atau nama pengguna yang sudah didaftarkan.
          </p>
          <div className="mt-5">
            <LoginForm />
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] text-slate-400">
          Data tersimpan di homeserver kamu sendiri.
        </p>
      </main>
    </div>
  );
}
