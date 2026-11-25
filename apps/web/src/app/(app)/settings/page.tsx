import type { Metadata } from "next";
import Link from "next/link";
import {
  APP_TZ,
  APP_VERSION_HISTORY,
  APP_VERSION_LABEL,
  formatNumberID,
  formatWaNumber,
} from "@saku/shared";
import { BackupPanel } from "@/components/backup-panel";
import { DeleteButton } from "@/components/delete-button";
import { IconLock, IconPlus, IconTerminal, IconUsers } from "@/components/icons";
import {
  AddMemberDialog,
  MemberRoleForm,
  ResetPasswordDialog,
} from "@/components/member-manager";
import { PasswordForm, ProfileForm } from "@/components/settings-forms";
import { WaStatusPanel, WhatsappHint } from "@/components/wa-panel";
import { Avatar, Badge, PageHeader, SectionCard } from "@/components/ui";
import { deleteMemberAction } from "@/lib/actions/members";
import { requireUser } from "@/lib/auth";
import { listBackups } from "@/lib/backup";
import { getSettingsData } from "@/lib/queries";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [data, backups] = await Promise.all([
    getSettingsData(user),
    user.role === "ADMIN" ? listBackups() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pengaturan"
        description="Profil, anggota keluarga, dan koneksi WhatsApp."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Profil" description="Nama dan nomor WhatsApp kamu">
          <ProfileForm name={user.name} waNumber={user.waNumber} />
        </SectionCard>

        <SectionCard title="Keamanan" description="Password untuk masuk dashboard">
          <PasswordForm />
        </SectionCard>
      </div>

      <div id="whatsapp">
        <SectionCard
          title="Koneksi WhatsApp"
          description="Status bot dan cara menautkan perangkat"
        >
          <div className="space-y-4">
            <WaStatusPanel />
            <WhatsappHint />
          </div>
        </SectionCard>
      </div>

      {user.role === "ADMIN" ? (
        <>
          <SectionCard
            title="Log aplikasi"
            description="Semua error dan notifikasi dari dashboard web dan bot WhatsApp"
            action={
              <Link href="/logs" className="btn-ghost btn-sm">
                <IconTerminal className="h-3.5 w-3.5" />
                Buka log
              </Link>
            }
          >
            <p className="text-xs leading-relaxed text-slate-600">
              Halaman log menampilkan catatan terbaru dari container{" "}
              <code className="rounded bg-slate-100 px-1">web</code> dan{" "}
              <code className="rounded bg-slate-100 px-1">wa</code>, lengkap dengan
              level, waktu, dan detail error. Bisa difilter berdasarkan sumber, level,
              atau kata kunci.
            </p>
          </SectionCard>

          <SectionCard
            title="Backup & restore database"
            description="Buat salinan database atau pulihkan dari backup tanpa masuk ke server"
          >
            <BackupPanel backups={backups} />
          </SectionCard>
        </>
      ) : null}

      {user.role === "ADMIN" ? (
        <SectionCard
          title="Anggota keluarga"
          description="Setiap anggota punya dompet dan laporan sendiri"
          action={
            <AddMemberDialog
              trigger={
                <>
                  <IconPlus className="h-4 w-4" />
                  Tambah
                </>
              }
            />
          }
          bodyClassName="px-0 py-0"
        >
          <ul className="divide-y divide-slate-100">
            {data.members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Avatar name={member.name} />

                <div className="min-w-[7rem] flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {member.name}
                    </p>
                    {member.id === user.id ? <Badge tone="primary">Kamu</Badge> : null}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {formatWaNumber(member.waNumber)}
                  </p>
                </div>

                <MemberRoleForm
                  userId={member.id}
                  role={member.role}
                  disabled={member.id === user.id}
                />

                <ResetPasswordDialog
                  userId={member.id}
                  name={member.name}
                  trigger={<IconLock className="h-3.5 w-3.5" />}
                />

                {member.id !== user.id ? (
                  <DeleteButton
                    action={deleteMemberAction}
                    nameField="userId"
                    value={member.id}
                    label={`Hapus ${member.name}`}
                    confirmMessage={`Hapus ${member.name} beserta SELURUH transaksi, dompet, dan kategorinya? Tindakan ini tidak bisa dibatalkan.`}
                  />
                ) : (
                  <span className="h-7 w-7" />
                )}
              </li>
            ))}
          </ul>

          {data.members.length <= 1 ? (
            <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
              Belum ada anggota lain. Tambahkan pasangan atau anggota keluarga agar bisa
              mencatat dari nomor WhatsApp masing-masing.
            </p>
          ) : null}
        </SectionCard>
      ) : (
        <SectionCard title="Anggota keluarga" description="Hanya admin yang bisa mengelola">
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
            <IconUsers className="mt-0.5 h-4 w-4 text-slate-400" />
            <p className="text-xs text-slate-600">
              Minta admin keluarga untuk menambah atau mengubah anggota.
            </p>
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Contoh pesan WhatsApp" description="Bot menerima bahasa bebas">
          <ul className="space-y-2 text-xs text-slate-600">
            {[
              "makan siang 25rb",
              "gaji 8jt",
              "bayar listrik 350.000 kemarin",
              "beli kopi 15rb @bca #makan",
              "/transfer 100rb @bca @gopay",
              "/listrik 1234,5 50 1284,5 150rb",
              "/galon 2 20rb · /gas 1 25rb",
              "/saldo · /laporan · /undo",
            ].map((example) => (
              <li
                key={example}
                className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700"
              >
                {example}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Informasi sistem" description="Konfigurasi aktif">
          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Versi aplikasi</dt>
              <dd className="flex items-center gap-1.5">
                <Badge tone="primary">{APP_VERSION_LABEL}</Badge>
                <span className="text-slate-500">
                  rilis ke-{APP_VERSION_HISTORY.length}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Zona waktu</dt>
              <dd className="font-semibold text-slate-800">{APP_TZ}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Dompet</dt>
              <dd className="font-semibold text-slate-800">
                {formatNumberID(data.walletCount)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Kategori</dt>
              <dd className="font-semibold text-slate-800">
                {formatNumberID(data.categoryCount)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Peran kamu</dt>
              <dd>
                <Badge tone={user.role === "ADMIN" ? "primary" : "neutral"}>
                  {user.role === "ADMIN" ? "Admin" : "Anggota"}
                </Badge>
              </dd>
            </div>
          </dl>
        </SectionCard>
      </div>
    </div>
  );
}
