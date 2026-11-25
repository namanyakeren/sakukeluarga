"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  UTILITY_META,
  formatIDR,
  formatQuantity,
  parseAmount,
  parseQuantity,
  type UtilityKind,
} from "@saku/shared";
import { initialActionState } from "@/lib/action-state";
import { saveUtilityAction } from "@/lib/actions/utilities";
import { Modal, useModal } from "./modal";

export interface UtilityExisting {
  id: string;
  quantity: number;
  price: number;
  note: string;
  dateInput: string;
}

export function UtilityDialog({
  kind,
  defaultDate,
  existing,
  trigger,
  triggerClassName,
  triggerLabel,
}: {
  kind: UtilityKind;
  defaultDate: string;
  existing?: UtilityExisting;
  trigger: React.ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const meta = UTILITY_META[kind];
  return (
    <Modal
      trigger={trigger}
      triggerClassName={triggerClassName}
      triggerLabel={triggerLabel ?? (existing ? `Ubah catatan ${meta.label}` : `Catat ${meta.label}`)}
      title={existing ? `Ubah catatan ${meta.label}` : `Catat ${meta.label}`}
      description={`Isi jumlah ${meta.unit} dan total harga yang dibayar.`}
    >
      <UtilityForm kind={kind} defaultDate={defaultDate} existing={existing} />
    </Modal>
  );
}

function UtilityForm({
  kind,
  defaultDate,
  existing,
}: {
  kind: UtilityKind;
  defaultDate: string;
  existing?: UtilityExisting;
}) {
  const meta = UTILITY_META[kind];
  const router = useRouter();
  const { close } = useModal();
  const [state, formAction, pending] = useActionState(
    saveUtilityAction,
    initialActionState,
  );

  const [quantity, setQuantity] = useState(existing ? String(existing.quantity) : "1");
  const [price, setPrice] = useState(existing ? String(existing.price) : "");

  useEffect(() => {
    if (state.ok && state.ts) {
      close();
      router.refresh();
    }
  }, [state.ok, state.ts, close, router]);

  const quantityValue = parseQuantity(quantity);
  const priceValue = parseAmount(price);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      {existing ? <input type="hidden" name="id" value={existing.id} /> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ut-quantity">
            Jumlah ({meta.unit})
          </label>
          <input
            id="ut-quantity"
            name="quantity"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="input tabular-nums"
            placeholder="cth: 2"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="ut-price">
            Total harga
          </label>
          <input
            id="ut-price"
            name="price"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="input tabular-nums"
            placeholder="cth: 20rb"
            inputMode="text"
            autoComplete="off"
            required
          />
          <p className="mt-1 h-4 text-xs text-slate-500">
            {priceValue && quantityValue
              ? `Sekitar ${formatIDR(priceValue / quantityValue)}/${meta.unit}`
              : priceValue
                ? `Terbaca: ${formatIDR(priceValue)}`
                : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ut-date">
            Tanggal pembelian
          </label>
          <input
            id="ut-date"
            name="purchasedAt"
            type="date"
            className="input"
            defaultValue={existing?.dateInput ?? defaultDate}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="ut-note">
            Catatan
          </label>
          <input
            id="ut-note"
            name="note"
            className="input"
            placeholder={`cth: ${meta.label.toLowerCase()} dapur`}
            defaultValue={existing?.note ?? ""}
            maxLength={240}
          />
        </div>
      </div>

      {quantityValue && priceValue ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {formatQuantity(quantityValue)} {meta.unit} ×{" "}
          {formatIDR(priceValue / quantityValue)} = {formatIDR(priceValue)}
        </p>
      ) : null}

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
