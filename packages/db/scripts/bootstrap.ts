import { hash } from "bcryptjs";
import { isValidWaNumber, normalizeWaNumber } from "@saku/shared";
import { createUserWithDefaults, prisma } from "../src";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDatabase(attempts = 15): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.log(`[bootstrap] Menunggu database... (${attempt}/${attempts})`);
      await sleep(2000);
    }
  }
}

async function main(): Promise<void> {
  const rawNumber = process.env.ADMIN_WA_NUMBER ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() || "Admin";

  if (!rawNumber || !password) {
    console.log(
      "[bootstrap] ADMIN_WA_NUMBER / ADMIN_PASSWORD belum diisi. Tidak ada akun admin yang dibuat.",
    );
    return;
  }

  const waNumber = normalizeWaNumber(rawNumber);
  if (!isValidWaNumber(waNumber)) {
    console.error(`[bootstrap] Nomor admin tidak valid: "${rawNumber}". Gunakan format 62xxxxxxxxxx.`);
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    console.warn("[bootstrap] Peringatan: password admin kurang dari 8 karakter.");
  }

  await waitForDatabase();

  const existing = await prisma.user.findUnique({ where: { waNumber } });
  if (existing) {
    console.log(`[bootstrap] Akun admin ${waNumber} sudah ada. Dilewati.`);
    return;
  }

  const user = await createUserWithDefaults({
    name,
    waNumber,
    passwordHash: await hash(password, 11),
    role: "ADMIN",
  });

  console.log(`[bootstrap] Admin dibuat: ${user.name} (${waNumber}).`);
}

main()
  .catch((error) => {
    console.error("[bootstrap] Gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
