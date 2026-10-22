import type { Metadata } from "next";
import { formatIDR, walletTypeLabel } from "@saku/shared";
import { DeleteButton } from "@/components/delete-button";
import { IconEdit, IconPlus, IconWallet } from "@/components/icons";
import { WalletDialog } from "@/components/wallet-dialog";
import { Badge, EmptyState, PageHeader, StatCard, cn } from "@/components/ui";
import { deleteWalletAction } from "@/lib/actions/wallets";
import { requireUser } from "@/lib/auth";
import { getWalletOverview } from "@/lib/queries";

export const metadata: Metadata = { title: "Dompet" };

const WALLET_ICON: Record<string, string> = {
  CASH: "💵",
  BANK: "🏦",
  EWALLET: "📱",
  OTHER: "👛",
};

export default async function WalletsPage() {
  const user = await requireUser();
  const data = await getWalletOverview(user.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dompet"
        description="Tunai, rekening bank, atau e-wallet. Saldo dihitung otomatis."
      >
        <WalletDialog
          defaultChecked={data.wallets.length === 0}
          trigger={
            <>
              <IconPlus className="h-4 w-4" />
              Tambah dompet
            </>
          }
          triggerClassName="btn-primary"
        />
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="Total saldo"
          value={formatIDR(data.total)}
          tone="primary"
          icon={<IconWallet className="h-4 w-4" />}
          hint={`${data.wallets.length} dompet aktif`}
        />
        <StatCard
          label="Dompet default"
          value={
            data.wallets.find((wallet) => wallet.id === data.defaultWalletId)?.name ??
            "Belum diatur"
          }
          tone="neutral"
          hint="Dipakai saat mencatat via WhatsApp tanpa @dompet"
        />
      </div>

      {data.wallets.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconWallet className="h-5 w-5" />}
            title="Belum ada dompet"
            description="Tambahkan dompet pertamamu, misalnya Cash atau BCA."
            action={
              <WalletDialog
                defaultChecked
                trigger={
                  <>
                    <IconPlus className="h-4 w-4" />
                    Tambah dompet
                  </>
                }
                triggerClassName="btn-primary btn-sm"
              />
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.wallets.map((wallet) => {
            const isDefault = wallet.id === data.defaultWalletId;
            return (
              <div key={wallet.id} className="card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">
                      {WALLET_ICON[wallet.type] ?? "👛"}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{wallet.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {walletTypeLabel(wallet.type)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <WalletDialog
                      existing={{
                        id: wallet.id,
                        name: wallet.name,
                        type: wallet.type,
                        initialBalance: wallet.initialBalance,
                        isDefault,
                      }}
                      trigger={<IconEdit className="h-4 w-4" />}
                      triggerClassName="icon-btn"
                    />
                    <DeleteButton
                      action={deleteWalletAction}
                      value={wallet.id}
                      confirmMessage={`Hapus dompet "${wallet.name}"? Hanya bisa jika belum ada transaksi.`}
                    />
                  </div>
                </div>

                <p
                  className={cn(
                    "mt-5 text-2xl font-bold tracking-tight tabular-nums",
                    wallet.balance < 0 ? "text-rose-700" : "text-slate-900",
                  )}
                >
                  {formatIDR(wallet.balance)}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[11px] text-slate-500">
                    Saldo awal {formatIDR(wallet.initialBalance)}
                  </p>
                  {isDefault ? <Badge tone="primary">Default</Badge> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
