"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import {
  IconChart,
  IconHome,
  IconList,
  IconLogout,
  IconSettings,
  IconTag,
  IconWallet,
} from "@/components/icons";
import { Avatar, Brand, cn } from "@/components/ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: IconHome },
  { href: "/transactions", label: "Transaksi", icon: IconList },
  { href: "/reports", label: "Laporan", icon: IconChart },
  { href: "/wallets", label: "Dompet", icon: IconWallet },
  { href: "/categories", label: "Kategori", icon: IconTag },
  { href: "/settings", label: "Pengaturan", icon: IconSettings },
];

const MOBILE_NAV = [
  { href: "/dashboard", label: "Beranda", icon: IconHome },
  { href: "/transactions", label: "Transaksi", icon: IconList },
  { href: "/reports", label: "Laporan", icon: IconChart },
  { href: "/wallets", label: "Dompet", icon: IconWallet },
  { href: "/settings", label: "Atur", icon: IconSettings },
];

export function Sidebar({ user }: { user: { name: string; role: string } }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <Brand />
          <div>
            <p className="text-sm font-bold leading-tight text-slate-900">Saku Keluarga</p>
            <p className="text-[11px] text-slate-500">Catatan keuangan</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar name={user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-[11px] text-slate-500">
                {user.role === "ADMIN" ? "Admin keluarga" : "Anggota"}
              </p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="icon-btn"
                title="Keluar"
                aria-label="Keluar"
              >
                <IconLogout className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2.5">
          <Brand className="h-8 w-8 rounded-lg" />
          <span className="text-sm font-bold text-slate-900">Saku Keluarga</span>
        </div>
        <div className="flex items-center gap-2">
          <Avatar name={user.name} className="h-8 w-8 text-[11px]" />
          <form action={logoutAction}>
            <button type="submit" className="icon-btn" aria-label="Keluar">
              <IconLogout className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition",
                active ? "text-indigo-600" : "text-slate-500",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
