import type { Metadata } from "next";
import Link from "next/link";
import { LogViewer } from "@/components/log-viewer";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Log Aplikasi" };

export default async function LogsPage() {
  await requireAdmin();

  return (
    <div>
      <PageHeader
        title="Log Aplikasi"
        description="Semua error dan notifikasi dari dashboard web dan bot WhatsApp."
      >
        <Link href="/settings" className="btn-ghost">
          Kembali ke Pengaturan
        </Link>
      </PageHeader>

      <LogViewer />
    </div>
  );
}
