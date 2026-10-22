import QRCode from "qrcode";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface BotStatusResponse {
  connected?: boolean;
  qr?: string | null;
  me?: string | null;
  lastMessageAt?: string | null;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const botUrl = process.env.WA_BOT_URL?.trim();
  const token = process.env.BOT_TOKEN?.trim();

  if (!botUrl || !token) {
    return Response.json({
      configured: false,
      reachable: false,
      connected: false,
      qrDataUrl: null,
      me: null,
      lastMessageAt: null,
    });
  }

  try {
    const response = await fetch(`${botUrl.replace(/\/$/, "")}/status`, {
      headers: { "x-bot-token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });

    if (!response.ok) {
      return Response.json({
        configured: true,
        reachable: false,
        connected: false,
        qrDataUrl: null,
        me: null,
        lastMessageAt: null,
      });
    }

    const data = (await response.json()) as BotStatusResponse;
    const qrDataUrl = data.qr
      ? await QRCode.toDataURL(data.qr, {
          margin: 1,
          width: 300,
          errorCorrectionLevel: "M",
        })
      : null;

    return Response.json({
      configured: true,
      reachable: true,
      connected: Boolean(data.connected),
      qrDataUrl,
      me: data.me ?? null,
      lastMessageAt: data.lastMessageAt ?? null,
    });
  } catch {
    return Response.json({
      configured: true,
      reachable: false,
      connected: false,
      qrDataUrl: null,
      me: null,
      lastMessageAt: null,
    });
  }
}
