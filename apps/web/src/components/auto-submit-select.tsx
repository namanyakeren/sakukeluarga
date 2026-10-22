"use client";

import type { ReactNode } from "react";

/** Select yang langsung mengirim form GET saat nilainya berubah. */
export function AutoSubmitSelect({
  name,
  defaultValue,
  children,
  className,
  ariaLabel,
}: {
  name: string;
  defaultValue: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      aria-label={ariaLabel}
      className={className}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      {children}
    </select>
  );
}
