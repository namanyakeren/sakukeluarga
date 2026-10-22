import type { Metadata } from "next";
import { formatNumberID } from "@saku/shared";
import { CategoryDialog } from "@/components/category-dialog";
import { DeleteButton } from "@/components/delete-button";
import { IconEdit, IconPlus, IconTag } from "@/components/icons";
import { Badge, EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { deleteCategoryAction } from "@/lib/actions/categories";
import { requireUser } from "@/lib/auth";
import { getCategoriesWithUsage } from "@/lib/queries";

export const metadata: Metadata = { title: "Kategori" };

export default async function CategoriesPage() {
  const user = await requireUser();
  const categories = await getCategoriesWithUsage(user.id);

  const expenses = categories.filter((category) => category.type === "EXPENSE");
  const incomes = categories.filter((category) => category.type === "INCOME");

  const renderList = (items: typeof categories, type: "EXPENSE" | "INCOME") => (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((category) => (
        <div
          key={category.id}
          className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-lg">
            {category.emoji}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{category.name}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {formatNumberID(category._count.transactions)} transaksi
            </p>
            {category.keywords.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {category.keywords.slice(0, 4).map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                  >
                    {keyword}
                  </span>
                ))}
                {category.keywords.length > 4 ? (
                  <span className="text-[10px] text-slate-400">
                    +{category.keywords.length - 4}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-0.5 opacity-60 transition group-hover:opacity-100">
            <CategoryDialog
              existing={{
                id: category.id,
                name: category.name,
                type: category.type,
                emoji: category.emoji,
                keywords: category.keywords,
              }}
              defaultType={type}
              trigger={<IconEdit className="h-4 w-4" />}
              triggerClassName="icon-btn"
            />
            <DeleteButton
              action={deleteCategoryAction}
              value={category.id}
              confirmMessage={`Hapus kategori "${category.name}"? Transaksi lama akan menjadi "Tanpa kategori".`}
            />
          </div>
        </div>
      ))}

      {items.length === 0 ? (
        <div className="sm:col-span-2 xl:col-span-3">
          <EmptyState
            icon={<IconTag className="h-5 w-5" />}
            title="Belum ada kategori"
            action={
              <CategoryDialog
                defaultType={type}
                trigger={
                  <>
                    <IconPlus className="h-4 w-4" />
                    Tambah kategori
                  </>
                }
                triggerClassName="btn-primary btn-sm"
              />
            }
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kategori"
        description="Kategori membantu laporan dan tebakan otomatis dari WhatsApp."
      >
        <CategoryDialog
          trigger={
            <>
              <IconPlus className="h-4 w-4" />
              Tambah kategori
            </>
          }
          triggerClassName="btn-primary"
        />
      </PageHeader>

      <SectionCard
        title="Pengeluaran"
        description="Kategori untuk uang keluar"
        action={<Badge tone="expense">{expenses.length} kategori</Badge>}
      >
        {renderList(expenses, "EXPENSE")}
      </SectionCard>

      <SectionCard
        title="Pemasukan"
        description="Kategori untuk uang masuk"
        action={<Badge tone="income">{incomes.length} kategori</Badge>}
      >
        {renderList(incomes, "INCOME")}
      </SectionCard>

      <p className="px-1 text-[11px] text-slate-500">
        Tips: tambahkan kata kunci yang sering kamu pakai di WhatsApp, misalnya “gofood”
        atau “bensin”, agar kategori terisi otomatis.
      </p>
    </div>
  );
}
