"use server";

import { compare } from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@saku/db";
import { isValidWaNumber, normalizeWaNumber } from "@saku/shared";
import type { ActionState } from "../action-state";
import { createSession, destroySession } from "../auth";
import {
  checkRateLimit,
  clearRateLimit,
  recordRateLimitFailure,
} from "../rate-limit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_IDENTIFIER_LIMIT = 5;
const LOGIN_IP_LIMIT = 20;
const LOGIN_ERROR = "Nomor WhatsApp/nama pengguna atau password salah.";

async function getClientIp(): Promise<string | null> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip")?.trim();
  return ip || null;
}

function blockedMessage(retryAfterMs: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  return `Terlalu banyak percobaan login. Coba lagi dalam ${minutes} menit.`;
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const identifier = String(
    formData.get("identifier") ?? formData.get("waNumber") ?? "",
  ).trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier) {
    return { ok: false, error: "Nomor WhatsApp atau nama pengguna wajib diisi." };
  }
  if (!password) {
    return { ok: false, error: "Password wajib diisi." };
  }

  const normalizedWa = normalizeWaNumber(identifier);
  const isWaIdentifier = isValidWaNumber(normalizedWa);
  const canonicalIdentifier = isWaIdentifier
    ? `wa:${normalizedWa}`
    : `name:${identifier.toLocaleLowerCase("id-ID")}`;
  const identifierKey = `login:id:${canonicalIdentifier}`;
  const ip = await getClientIp();
  const ipKey = ip ? `login:ip:${ip}` : null;

  const identifierStatus = checkRateLimit(
    identifierKey,
    LOGIN_IDENTIFIER_LIMIT,
    LOGIN_WINDOW_MS,
  );
  const ipStatus = ipKey
    ? checkRateLimit(ipKey, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS)
    : { blocked: false, retryAfterMs: 0 };

  if (identifierStatus.blocked || ipStatus.blocked) {
    return {
      ok: false,
      error: blockedMessage(
        Math.max(identifierStatus.retryAfterMs, ipStatus.retryAfterMs),
      ),
    };
  }

  const recordFailure = (): ActionState => {
    recordRateLimitFailure(identifierKey, LOGIN_WINDOW_MS);
    if (ipKey) recordRateLimitFailure(ipKey, LOGIN_WINDOW_MS);
    return { ok: false, error: LOGIN_ERROR };
  };

  // 1. Coba cari berdasarkan nomor WhatsApp
  let user = null;

  if (isWaIdentifier) {
    user = await prisma.user.findUnique({ where: { waNumber: normalizedWa } });
  }

  // 2. Jika tidak ditemukan atau identifier adalah username, cari berdasarkan nama (case-insensitive)
  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        name: {
          equals: identifier,
          mode: "insensitive",
        },
      },
    });
  }

  if (!user) {
    return recordFailure();
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    return recordFailure();
  }

  clearRateLimit(identifierKey);
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
