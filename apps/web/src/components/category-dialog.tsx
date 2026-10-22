"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import type { TxKind } from "@saku/shared";
import { initialActionState } from "@/lib/action-state";
import { saveCategoryAction } from "@/lib/actions/categories";
import { Modal, useModal } from "./modal";

export interface CategoryFormValue {
  id: string;
  name: string;
  type: string;
  emoji: string;
  keywords: string[];
}

export function CategoryDialog({
  existing,
  defaultType = "EXPENSE",
  trigger,
  triggerClassName,
  triggerLabel,
}: {
  existing?: CategoryFormValue;
  defaultType?: TxKind;
  trigger: React.ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  return (
    <Modal
      trigger={trigger}
      triggerClassName={triggerClassName}
      triggerLabel={triggerLabel ?? (existing ? "Ubah kategori" : "Tambah kategori")}
      title={existing ? "Ubah kategori" : "Tambah kategori"}
      description="Kata kunci membantu bot menebak kategori dari pesan WhatsApp."
    >
      <CategoryForm existing={existing} defaultType={defaultType} />
    </Modal>
  );
}

function CategoryForm({
  existing,
  defaultType,
}: {
  existing?: CategoryFormValue;
  defaultType: TxKind;
}) {
  const router = useRouter();
  const { close } = useModal();
  const [state, formAction, pending] = useActionState(saveCategoryAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.ts) {
      close();
      router.refresh();
    }
  }, [state.ok, state.ts, close, router]);

  return (
    <form action={formAction} className="space-y-4">
      {existing ? <input type="hidden" name="id" value={existing.id} /> : null}

      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <div>
          <label className="label" htmlFor="category-emoji">
            Emoji
          </label>
          <input
            id="category-emoji"
            name="emoji"
            className="input text-center text-lg"
            defaultValue={existing?.emoji ?? "🏷️"}
            maxLength={4}
          />
        </div>
        <div>
          <label className="label" htmlFor="category-name">
            Nama kategori
          </label>
          <input
            id="category-name"
            name="name"
            className="input"
            placeholder="cth: Makan & Minum"
            defaultValue={existing?.name ?? ""}
            maxLength={40}
            autoFocus
            required
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="category-type">
          Jenis
        </label>
        <select
          id="category-type"
          name="type"
          className="input"
          defaultValue={existing?.type ?? defaultType}
        >
          <option value="EXPENSE">Pengeluaran</option>
          <option value="INCOME">Pemasukan</option>
        </select>
      </div>

      <div>
        <label className="label" htmlFor="category-keywords">
          Kata kunci
        </label>
        <textarea
          id="category-keywords"
          name="keywords"
          className="input min-h-[72px] resize-y"
          placeholder="makan, minum, jajan, kopi"
          defaultValue={existing?.keywords?.join(", ") ?? ""}
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Pisahkan dengan koma. Bot memakai kata kunci untuk menebak kategori otomatis.
        </p>
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
          {pending ? "Menyimpan..." : existing ? "Simpan perubahan" : "Tambah kategori"}
        </button>
      </div>
    </form>
  );
}
