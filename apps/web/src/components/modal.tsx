"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconClose } from "./icons";
import { cn } from "./ui";

const ModalContext = createContext<{ close: () => void }>({ close: () => {} });

export function useModal() {
  return useContext(ModalContext);
}

export function Modal({
  trigger,
  title,
  description,
  children,
  triggerClassName,
  triggerLabel,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    dialogRef.current?.close();
    setOpen(false);
  }, []);

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => {
          dialogRef.current?.showModal();
          setOpen(true);
        }}
      >
        {trigger}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className={cn(
          "m-auto w-[calc(100vw-2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm",
          !open && "hidden",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            ) : null}
          </div>
          <button type="button" className="icon-btn -mr-1 -mt-1" onClick={close} aria-label="Tutup">
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        <ModalContext.Provider value={{ close }}>
          <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
        </ModalContext.Provider>
      </dialog>
    </>
  );
}
