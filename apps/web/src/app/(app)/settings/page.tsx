import type { Metadata } from "next";
import { APP_TZ, formatNumberID, formatWaNumber } from "@saku/shared";
import { DeleteButton } from "@/components/delete-button";
import { IconLock, IconPlus, IconUsers } from "@/components/icons";
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
import { getSettingsData } from "@/lib/queries";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const user = await requireUser();
  const data = await getSettingsData(user);

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

          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            Backup database:{" "}
            <code className="text-slate-700">
              docker compose exec -T db pg_dump -U $POSTGRES_USER $POSTGRES_DB &gt; backup.sql
            </code>
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
