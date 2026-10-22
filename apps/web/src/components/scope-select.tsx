"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function ScopeSelect({
  members,
  selected,
  label = "Tampilkan",
}: {
  members: { id: string; name: string }[];
  selected: string;
  label?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
      <span className="hidden sm:inline">{label}</span>
      <select
        className="input w-auto min-w-[9rem] py-1.5 text-xs font-semibold text-slate-700"
        value={selected}
        onChange={(event) => {
          const next = new URLSearchParams(params.toString());
          if (event.target.value === "all") next.set("member", "all");
          else next.set("member", event.target.value);
          next.delete("page");
          router.push(`?${next.toString()}`);
        }}
      >
        <option value="all">Semua anggota</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
    </label>
  );
}
