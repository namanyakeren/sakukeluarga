"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  electricityMismatch,
  formatIDR,
  formatKwh,
  parseAmount,
  parseKwh,
} from "@saku/shared";
import { initialActionState } from "@/lib/action-state";
import { saveElectricityAction } from "@/lib/actions/electricity";
import { Modal, useModal } from "./modal";
import { cn } from "./ui";

export interface ElectricityExisting {
  id: string;
  kwhBefore: number;
  kwhAmount: number;
  kwhAfter: number;
  price: number;
  note: string;
  dateInput: string;
}

export function ElectricityDialog({
  defaultDate,
  existing,
  trigger,
  triggerClassName,
  triggerLabel,
}: {
  defaultDate: string;
  existing?: ElectricityExisting;
  trigger: React.ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  return (
    <Modal
      trigger={trigger}
      triggerClassName={triggerClassName}
      triggerLabel={triggerLabel ?? (existing ? "Ubah catatan listrik" : "Catat token listrik")}
      title={existing ? "Ubah catatan listrik" : "Catat token listrik"}
      description="Isi pembacaan meter sebelum dan sesudah top-up."
    >
      <ElectricityForm defaultDate={defaultDate} existing={existing} />
    </Modal>
  );
}

function ElectricityForm({
  defaultDate,
  existing,
}: {
  defaultDate: string;
  existing?: ElectricityExisting;
}) {
  const router = useRouter();
  const { close } = useModal();
  const [state, formAction, pending] = useActionState(
    saveElectricityAction,
    initialActionState,
  );

  const [before, setBefore] = useState(existing ? String(existing.kwhBefore) : "");
  const [amount, setAmount] = useState(existing ? String(existing.kwhAmount) : "");
  const [after, setAfter] = useState(existing ? String(existing.kwhAfter) : "");
  const [price, setPrice] = useState(existing ? String(existing.price) : "");

  useEffect(() => {
    if (state.ok && state.ts) {
      close();
      router.refresh();
    }
  }, [state.ok, state.ts, close, router]);

  const beforeValue = parseKwh(before);
  const amountValue = parseKwh(amount);
  const afterValue = parseKwh(after);
  const priceValue = parseAmount(price);
  const expectedAfter =
    beforeValue !== null && amountValue !== null ? beforeValue + amountValue : null;
  const mismatch =
    beforeValue !== null && amountValue !== null && afterValue !== null
      ? electricityMismatch({
          kwhBefore: beforeValue,
          kwhAmount: amountValue,
          kwhAfter: afterValue,
        })
      : null;

  return (
    <form action={formAction} className="space-y-4">
      {existing ? <input type="hidden" name="id" value={existing.id} /> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="el-before">
            kWh sebelum
          </label>
          <input
            id="el-before"
            name="kwhBefore"
            value={before}
            onChange={(event) => setBefore(event.target.value)}
            className="input tabular-nums"
            placeholder="cth: 1234,5"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="el-amount">
            kWh didapat
          </label>
          <input
            id="el-amount"
            name="kwhAmount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="input tabular-nums"
            placeholder="cth: 50"
            inputMode="decimal"
            autoComplete="off"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="el-after">
            kWh setelah
          </label>
          <input
            id="el-after"
            name="kwhAfter"
            value={after}
            onChange={(event) => setAfter(event.target.value)}
            className="input tabular-nums"
            placeholder="cth: 1284,5"
            inputMode="decimal"
            autoComplete="off"
            required
          />
        </div>
      </div>

      <p
        className={cn(
          "rounded-xl px-3 py-2 text-xs",
          mismatch === null
            ? "bg-slate-50 text-slate-500"
            : mismatch === 0
              ? "bg-emerald-50 font-medium text-emerald-700"
              : "bg-amber-50 font-medium text-amber-800",
        )}
      >
        {mismatch === null
          ? "Isi ketiga angka kWh untuk memeriksa kecocokan meter."
          : mismatch === 0 && expectedAfter !== null
            ? `Meter cocok: ${formatKwh(expectedAfter)} kWh.`
            : `Selisih meter ${mismatch > 0 ? "+" : "−"}${formatKwh(Math.abs(mismatch))} kWh dari perkiraan. Tetap bisa disimpan.`}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="el-price">
            Harga token
          </label>
          <input
            id="el-price"
            name="price"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="input tabular-nums"
            placeholder="cth: 150rb"
            inputMode="text"
            autoComplete="off"
            required
          />
          <p className="mt-1 h-4 text-xs text-slate-500">
            {priceValue ? `Terbaca: ${formatIDR(priceValue)}` : ""}
          </p>
        </div>
        <div>
          <label className="label" htmlFor="el-date">
            Tanggal pembelian
          </label>
          <input
            id="el-date"
            name="purchasedAt"
            type="date"
            className="input"
            defaultValue={existing?.dateInput ?? defaultDate}
            required
          />
          <p className="mt-1 h-4 text-xs text-slate-500">
            {priceValue && amountValue
              ? `Sekitar ${formatIDR(priceValue / amountValue)}/kWh`
              : ""}
          </p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="el-note">
          Catatan
        </label>
        <input
          id="el-note"
          name="note"
          className="input"
          placeholder="cth: token November"
          defaultValue={existing?.note ?? ""}
          maxLength={240}
        />
      </div>

      <p className="rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
        Catatan ini otomatis masuk sebagai pengeluaranmu di dompet default dan muncul di
        halaman Transaksi.
      </p>

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
          {pending ? "Menyimpan..." : existing ? "Simpan perubahan" : "Simpan"}
        </button>
      </div>
    </form>
  );
}
