import { currentMonthKey, formatDateID, parseMonthKey, txTypeLabel } from "@saku/shared";
import { getSessionUser } from "@/lib/auth";
import { getTransactionsForExport, resolveScope } from "@/lib/queries";

function str(value: string | null): string | undefined {
  return value ?? undefined;
}

function csvCell(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const scope = await resolveScope(user, str(url.searchParams.get("member")));

  const month = url.searchParams.get("m");
  const filters = {
    month: parseMonthKey(month) ?? currentMonthKey(),
    type: str(url.searchParams.get("type")),
    walletId: str(url.searchParams.get("walletId")),
    categoryId: str(url.searchParams.get("categoryId")),
    q: str(url.searchParams.get("q")),
  };

  const rows = await getTransactionsForExport(scope, filters);

  const header = [
    "Tanggal",
    "Jenis",
    "Dompet",
    "Dompet Tujuan",
    "Kategori",
    "Catatan",
    "Nominal",
    "Sumber",
    "Anggota",
  ];

  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        formatDateID(new Date(row.occurredAt)),
        txTypeLabel(row.type),
        row.walletName,
        row.toWalletName ?? "",
        row.categoryName ?? "",
        row.note,
        row.amount,
        row.source,
        row.userName,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const csv = `\uFEFF${lines.join("\r\n")}\r\n`;

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="saku-${filters.month}.csv"`,
      "cache-control": "no-store",
    },
  });
}
