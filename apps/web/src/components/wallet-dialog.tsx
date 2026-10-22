"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { formatIDR, parseAmount, walletTypeLabel, type WalletType } from "@saku/shared";
import { initialActionState } from "@/lib/action-state";
import { saveWalletAction } from "@/lib/actions/wallets";
import { Modal, useModal } from "./modal";

const TYPES: WalletType[] = ["CASH", "BANK", "EWALLET", "OTHER"];

export interface WalletFormValue {
  id: string;
  name: string;
  type: string;
  initialBalance: number;
  isDefault: boolean;
}

export function WalletDialog({
  existing,
  trigger,
  triggerClassName,
  triggerLabel,
  defaultChecked = false,
}: {
  existing?: WalletFormValue;
  trigger: React.ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  defaultChecked?: boolean;
}) {
  return (
    <Modal
      trigger={trigger}
      triggerClassName={triggerClassName}
      triggerLabel={triggerLabel ?? (existing ? "Ubah dompet" : "Tambah dompet")}
      title={existing ? "Ubah dompet" : "Tambah dompet"}
      description="Dompet bisa berupa tunai, rekening bank, atau e-wallet."
    >
      <WalletForm existing={existing} defaultChecked={defaultChecked} />
    </Modal>
  );
}

function WalletForm({
  existing,
  defaultChecked,
}: {
  existing?: WalletFormValue;
  defaultChecked: boolean;
}) {
  const router = useRouter();
  const { close } = useModal();
  const [state, formAction, pending] = useActionState(saveWalletAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.ts) {
      close();
      router.refresh();
    }
  }, [state.ok, state.ts, close, router]);

  const parsed = parseAmount(String(existing?.initialBalance ?? ""));

  return (
    <form action={formAction} className="space-y-4">
      {existing ? <input type="hidden" name="id" value={existing.id} /> : null}

      <div>
        <label className="label" htmlFor="wallet-name">
          Nama dompet
        </label>
        <input
          id="wallet-name"
          name="name"
          className="input"
          placeholder="cth: BCA, GoPay, Dompet Tunai"
          defaultValue={existing?.name ?? ""}
          maxLength={40}
          autoFocus
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="wallet-type">
            Jenis
          </label>
          <select
            id="wallet-type"
            name="type"
            className="input"
            defaultValue={existing?.type ?? "CASH"}
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {walletTypeLabel(type)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="wallet-initial">
            Saldo awal
          </label>
          <input
            id="wallet-initial"
            name="initialBalance"
            className="input tabular-nums"
            inputMode="text"
            placeholder="cth: 500rb"
            defaultValue={
              existing && existing.initialBalance !== 0
                ? String(existing.initialBalance)
                : ""
            }
          />
          <p className="mt-1 h-4 text-[11px] text-slate-500">
            {parsed ? formatIDR(parsed) : "Kosongkan jika 0"}
          </p>
        </div>
      </div>

      <label className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
        <input
          type="checkbox"
          name="makeDefault"
          defaultChecked={existing?.isDefault ?? defaultChecked}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-xs text-slate-600">
          <strong className="font-semibold text-slate-800">Jadikan dompet default</strong>
          <br />
          Dipakai saat mencatat lewat WhatsApp tanpa menyebut nama dompet.
        </span>
      </label>

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
          {pending ? "Menyimpan..." : existing ? "Simpan perubahan" : "Tambah dompet"}
        </button>
      </div>
    </form>
  );
}
