import fs from "node:fs/promises";
import { getSessionUser } from "@/lib/auth";
import { resolveBackupPath } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const name = new URL(request.url).searchParams.get("name") ?? "";

  try {
    const file = resolveBackupPath(name);
    const data = await fs.readFile(file);

    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="${name}"`,
        "content-length": String(data.byteLength),
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Backup tidak ditemukan." },
      { status: 404 },
    );
  }
}
