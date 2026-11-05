import { getSessionUser } from "@/lib/auth";
import { readLogs } from "@/lib/logs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  try {
    const result = await readLogs({
      source: url.searchParams.get("source") ?? undefined,
      level: url.searchParams.get("level") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 0) || undefined,
    });
    return Response.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Gagal membaca log.",
        entries: [],
        files: [],
        generatedAt: Date.now(),
      },
      { status: 500 },
    );
  }
}
