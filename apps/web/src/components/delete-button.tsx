"use client";

import { useActionState, useEffect } from "react";
import type { ActionState } from "@/lib/action-state";
import { initialActionState } from "@/lib/action-state";
import { IconTrash } from "./icons";
import { cn } from "./ui";

export function DeleteButton({
  action,
  value,
  nameField = "id",
  confirmMessage,
  label = "Hapus",
  className,
  children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  value: string;
  nameField?: string;
  confirmMessage: string;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);

  useEffect(() => {
    if (state.error) {
      window.alert(state.error);
    }
  }, [state.error]);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
      className="inline-flex"
    >
      <input type="hidden" name={nameField} value={value} />
      <button
        type="submit"
        className={cn("icon-btn hover:bg-rose-50 hover:text-rose-600", className)}
        aria-label={label}
        title={label}
        disabled={pending}
      >
        {children ?? <IconTrash className="h-4 w-4" />}
      </button>
    </form>
  );
}
