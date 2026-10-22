"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { formatIDR, parseAmount, walletTypeLabel } from "@saku/shared";
import { initialActionState } from "@/lib/action-state";
import { saveTransactionAction } from "@/lib/actions/transactions";
import { Modal, useModal } from "./modal";
import { cn } from "./ui";

export interface TxWallet {
  id: string;
  name: string;
  type: string;
}

export interface TxCategory {
  id: string;
  name: string;
  type: string;
  emoji: string;
}

export interface TxExisting {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  walletId: string;
  toWalletId: string | null;
  categoryId: string | null;
  note: string;
  dateInput: string;
}

const TYPE_OPTIONS = [
  { value: "EXPENSE", label: "Pengeluaran", activeClass: "bg-rose-600 text-white" },
  { value: "INCOME", label: "Pemasukan", activeClass: "bg-emerald-600 text-white" },
  { value: "TRANSFER", label: "Transfer", activeClass: "bg-sky-600 text-white" },
] as const;

type TxTypeValue = (typeof TYPE_OPTIONS)[number]["value"];

export function TransactionDialog({
  wallets,
  categories,
  defaultDate,
  existing,
  trigger,
  triggerClassName,
  triggerLabel,
}: {
  wallets: TxWallet[];
  categories: TxCategory[];
  defaultDate: string;
  existing?: TxExisting;
  trigger: React.ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  return (
    <Modal
      trigger={trigger}
      triggerClassName={triggerClassName}
      triggerLabel={triggerLabel ?? (existing ? "Ubah transaksi" : "Catat transaksi")}
      title={existing ? "Ubah transaksi" : "Catat transaksi"}
      description={
        existing
          ? "Perubahan langsung memengaruhi saldo dompet."
          : "Tulis nominal bebas: 25rb, 25000, atau 1,5jt."
      }
    >
      <TransactionForm
        wallets={wallets}
        categories={categories}
        defaultDate={defaultDate}
        existing={existing}
      />
    </Modal>
  );
}

function TransactionForm({
  wallets,
  categories,
  defaultDate,
  existing,
}: {
  wallets: TxWallet[];
  categories: TxCategory[];
  defaultDate: string;
  existing?: TxExisting;
}) {
  const router = useRouter();
  const { close } = useModal();
  const [state, formAction, pending] = useActionState(
    saveTransactionAction,
    initialActionState,
  );
  const [type, setType] = useState<TxTypeValue>(existing?.type ?? "EXPENSE");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");

  useEffect(() => {
    if (state.ok && state.ts) {
      close();
      router.refresh();
    }
  }, [state.ok, state.ts, close, router]);

  const parsedAmount = parseAmount(amount);
  const filteredCategories = categories.filter((category) => category.type === type);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="type" value={type} />
      {existing ? <input type="hidden" name="id" value={existing.id} /> : null}

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
        {TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setType(option.value)}
            className={cn(
              "rounded-lg px-2 py-1.5 text-xs font-semibold transition",
              type === option.value
                ? option.activeClass
                : "text-slate-600 hover:bg-white/70",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="tx-amount">
          Nominal
        </label>
        <input
          id="tx-amount"
          name="amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="input text-lg font-semibold tabular-nums"
          placeholder="cth: 25rb"
          inputMode="text"
          autoComplete="off"
          autoFocus
          required
        />
        <p className="mt-1 h-4 text-xs text-slate-500">
          {parsedAmount ? `Terbaca: ${formatIDR(parsedAmount)}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="tx-wallet">
            {type === "TRANSFER" ? "Dari dompet" : "Dompet"}
          </label>
          <select
            id="tx-wallet"
            name="walletId"
            className="input"
            defaultValue={existing?.walletId ?? wallets[0]?.id ?? ""}
            required
          >
            {wallets.length === 0 ? <option value="">Belum ada dompet</option> : null}
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name} · {walletTypeLabel(wallet.type)}
              </option>
            ))}
          </select>
        </div>

        {type === "TRANSFER" ? (
          <div>
            <label className="label" htmlFor="tx-to-wallet">
              Ke dompet
            </label>
            <select
              id="tx-to-wallet"
              name="toWalletId"
              className="input"
              defaultValue={existing?.toWalletId ?? wallets[1]?.id ?? ""}
              required
            >
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name} · {walletTypeLabel(wallet.type)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="tx-category">
              Kategori
            </label>
            <select
              key={type}
              id="tx-category"
              name="categoryId"
              className="input"
              defaultValue={
                existing && existing.type === type ? (existing.categoryId ?? "") : ""
              }
            >
              <option value="">Tanpa kategori</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.emoji} {category.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="tx-date">
            Tanggal
          </label>
          <input
            id="tx-date"
            name="occurredAt"
            type="date"
            className="input"
            defaultValue={existing?.dateInput ?? defaultDate}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="tx-note">
            Catatan
          </label>
          <input
            id="tx-note"
            name="note"
            className="input"
            placeholder="cth: makan siang"
            defaultValue={existing?.note ?? ""}
            maxLength={240}
          />
        </div>
      </div>

      {wallets.length === 0 ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Belum ada dompet. Buat dompet dulu di halaman Dompet.
        </p>
      ) : null}

      {state.error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" className="btn-ghost" onClick={close}>
          Batal
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={pending || wallets.length === 0}
        >
          {pending ? "Menyimpan..." : existing ? "Simpan perubahan" : "Simpan"}
        </button>
      </div>
    </form>
  );
}
