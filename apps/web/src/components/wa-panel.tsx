"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTimeID, formatWaNumber } from "@saku/shared";
import { IconChat, IconCheck, IconRefresh } from "./icons";
import { cn } from "./ui";

interface WaStatus {
  configured: boolean;
  reachable: boolean;
  connected: boolean;
  qrDataUrl: string | null;
  me: string | null;
  lastMessageAt: string | null;
}

export function WaStatusPanel() {
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/wa", { cache: "no-store" });
      if (!response.ok) throw new Error("gagal");
      const data = (await response.json()) as WaStatus;
      setStatus(data);
    } catch {
      setStatus({
        configured: true,
        reachable: false,
        connected: false,
        qrDataUrl: null,
        me: null,
        lastMessageAt: null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 6000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading) {
    return <p className="text-xs text-slate-500">Memeriksa status bot...</p>;
  }

  if (!status) return null;

  if (!status.configured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <strong className="font-semibold">Konfigurasi belum lengkap.</strong>
        <br />
        Isi <code className="rounded bg-white/70 px-1">BOT_TOKEN</code> di file{" "}
        <code className="rounded bg-white/70 px-1">.env</code>, lalu jalankan ulang{" "}
        <code className="rounded bg-white/70 px-1">docker compose up -d</code>.
      </div>
    );
  }

  if (!status.reachable) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <strong className="font-semibold">Bot belum bisa dihubungi.</strong>
        <br />
        Pastikan container <code className="rounded bg-white/70 px-1">wa</code> berjalan:
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-[11px] text-slate-100">
          docker compose logs -f wa
        </pre>
      </div>
    );
  }

  if (status.connected) {
    const phone = status.me?.split("@")[0]?.split(":")[0] ?? "";
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white">
            <IconCheck className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-900">WhatsApp terhubung</p>
            <p className="mt-0.5 text-xs text-emerald-800">
              {phone ? formatWaNumber(phone) : "Perangkat tertaut"}
              {status.lastMessageAt
                ? ` · pesan terakhir ${formatDateTimeID(new Date(status.lastMessageAt))}`
                : ""}
            </p>
            <p className="mt-2 text-xs text-emerald-800">
              Coba kirim <strong>“makan siang 25rb”</strong> ke nomor bot.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="icon-btn" title="Muat ulang">
            <IconRefresh className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <strong className="font-semibold">Perangkat belum tertaut.</strong> Scan QR di bawah
        dari WhatsApp di HP.
      </div>

      {status.qrDataUrl ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={status.qrDataUrl}
            alt="QR untuk menautkan WhatsApp"
            className="h-56 w-56 rounded-lg border border-slate-200 bg-white p-2"
          />
          <ol className="space-y-2 text-xs text-slate-600">
            <li>1. Buka WhatsApp di HP.</li>
            <li>2. Ketuk menu ⋮ → <strong>Perangkat tertaut</strong>.</li>
            <li>3. Ketuk <strong>Tautkan perangkat</strong>.</li>
            <li>4. Arahkan kamera ke QR ini.</li>
            <li className="text-slate-400">QR berganti otomatis setiap beberapa detik.</li>
          </ol>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Menunggu QR dari bot...</p>
      )}

      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <span className={cn("h-2 w-2 rounded-full", "bg-amber-400")} />
        Menunggu koneksi
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline"
        >
          <IconRefresh className="h-3.5 w-3.5" /> Muat ulang
        </button>
      </div>
    </div>
  );
}

export function WhatsappHint() {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600">
      <IconChat className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <p>
        Nomor bot sebaiknya nomor terpisah dari nomor pribadi. Jika belum punya, kamu bisa
        memakai nomor cadangan — bot ini tidak memerlukan WhatsApp Business API.
      </p>
    </div>
  );
}
