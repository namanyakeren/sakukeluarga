import type { User } from "@saku/db";
import {
  getCategoryTotals,
  getSummary,
  getWalletBalances,
  prisma,
  recordTransaction,
  recordTransfer,
} from "@saku/db";
import {
  currentMonthKey,
  extractTags,
  formatDateID,
  formatIDR,
  monthKey,
  monthLabelID,
  monthRange,
  parseAmount,
  parseMessage,
  walletTypeLabel,
  type TxKind,
} from "@saku/shared";
import type { WAMessage, WASocket } from "@whiskeysockets/baileys";
import { logger } from "./logger";

const UNREGISTERED_COOLDOWN_MS = 10 * 60 * 1000;
const unregisteredNotified = new Map<string, number>();

const UNREGISTERED_REPLY = [
  "👋 Nomor ini belum terdaftar di *Saku Keluarga*.",
  "",
  "Minta admin keluarga menambahkan nomor kamu di dashboard:",
  "*Pengaturan → Anggota Keluarga → Tambah anggota*.",
].join("\n");

const HELP_TEXT = [
  "*Saku Keluarga* 👋",
  "Catat transaksi cukup dengan mengetik, contoh:",
  "",
  "• makan siang 25rb",
  "• gaji 8jt",
  "• bayar listrik 350.000 kemarin",
  "• beli kopi 15rb @bca #makan",
  "",
  "*Perintah*",
  "/saldo — saldo tiap dompet",
  "/laporan — ringkasan bulan ini",
  "/laporan 2026-09 — ringkasan bulan lain",
  "/undo — batalkan transaksi terakhir",
  "/transfer 100rb @bca @gopay",
  "/dompet — daftar dompet",
  "/kategori — daftar kategori",
  "/bantuan — bantuan ini",
  "",
  "*Tag opsional*",
  "@nama-dompet → pilih dompet",
  "#nama-kategori → pilih kategori",
  "",
  "Tanggal: tambahkan _kemarin_, _3 hari lalu_, atau _tanggal 5_.",
].join("\n");

function extractText(message: WAMessage): string | null {
  let content = message.message;
  if (!content) return null;
  if (content.ephemeralMessage) {
    content = content.ephemeralMessage.message;
  }
  if (content?.viewOnceMessage) {
    content = content.viewOnceMessage.message;
  }
  if (!content) return null;
  return (
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    content.buttonsResponseMessage?.selectedDisplayText ??
    content.listResponseMessage?.title ??
    null
  );
}

function isGreeting(text: string): boolean {
  return /^(halo|hallo|hai|hi|hello|p|test|tes|assalamu|salam|pagi|siang|sore|malam)\b/i.test(
    text.trim(),
  );
}

function txReply(
  result: Extract<Awaited<ReturnType<typeof recordTransaction>>, { ok: true }>,
  kind: TxKind,
): string {
  const { transaction, category, wallet } = result;
  const title = kind === "INCOME" ? "💰 *Pemasukan tercatat*" : "💸 *Pengeluaran tercatat*";
  const lines = [
    title,
    "",
    `*${formatIDR(transaction.amount)}*  ${category ? `${category.emoji} ${category.name}` : "Tanpa kategori"}`,
    `👛 ${wallet.name}`,
    transaction.note ? `📝 ${transaction.note}` : null,
    `📅 ${formatDateID(transaction.occurredAt)}`,
    "",
    `Saldo ${wallet.name}: *${formatIDR(wallet.balance)}*`,
    "_Ketik /undo kalau ada yang salah._",
  ].filter((line): line is string => Boolean(line));
  return lines.join("\n");
}

const lidToPhoneMap = new Map<string, string>();

export function registerLidPhone(lid: string, jidOrPhone: string): void {
  const cleanLid = lid.split("@")[0].split(":")[0].replace(/\D/g, "");
  const cleanPhone = jidOrPhone.split("@")[0].split(":")[0].replace(/\D/g, "");
  if (cleanLid && cleanPhone) {
    lidToPhoneMap.set(cleanLid, cleanPhone);
  }
}

export async function handleIncoming(socket: WASocket, message: WAMessage): Promise<void> {
  const jid = message.key.remoteJid;
  const messageId = message.key.id;

  if (!jid || !messageId) return;

  // Hanya proses chat pribadi: @s.whatsapp.net, @lid, atau @c.us (abaikan status, grup, newsletter)
  const isPersonal = jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid") || jid.endsWith("@c.us");
  if (!isPersonal) {
    logger.debug({ jid }, "Bukan chat pribadi, dilewati");
    return;
  }

  // Nomor bot dan LID bot
  const botJid = socket.user?.id ?? "";
  const botNumber = botJid.split("@")[0].split(":")[0].replace(/\D/g, "");
  const botLid = ((socket.user as { lid?: string })?.lid ?? "").split("@")[0].split(":")[0].replace(/\D/g, "");

  if (botLid && botNumber) {
    lidToPhoneMap.set(botLid, botNumber);
  }

  // ID target (angka sebelum @ dan :device)
  const targetId = jid.split("@")[0].split(":")[0].replace(/\D/g, "");

  // Jika pesan memuat senderPn (Phone Number asli dari WhatsApp untuk akun ber-LID), simpan mapping-nya
  const rawSenderPn = (message.key as { senderPn?: string; participantPn?: string }).senderPn ||
    (message.key as { senderPn?: string; participantPn?: string }).participantPn;
  if (rawSenderPn && targetId) {
    registerLidPhone(targetId, String(rawSenderPn));
  }

  // Cek apakah pesan ini chat ke diri sendiri ("Message yourself")
  const isSelfChat = Boolean(
    message.key.fromMe &&
      ((botNumber && targetId === botNumber) || (botLid && targetId === botLid)),
  );

  // Jika pesan dari diri sendiri (fromMe) tapi BUKAN chat ke diri sendiri, abaikan
  if (message.key.fromMe && !isSelfChat) return;

  // Tentukan nomor pengirim (format phone number)
  let fromNumber: string = "";
  if (isSelfChat) {
    fromNumber = botNumber;
  } else if (jid.endsWith("@s.whatsapp.net") || jid.endsWith("@c.us")) {
    fromNumber = targetId;
  } else if (jid.endsWith("@lid")) {
    fromNumber = lidToPhoneMap.get(targetId) || "";
    if (!fromNumber && rawSenderPn) {
      fromNumber = String(rawSenderPn).split("@")[0].split(":")[0].replace(/\D/g, "");
    }
    // Jika WhatsApp tidak menyertakan PN, gunakan targetId langsung sebagai fallback
    if (!fromNumber) {
      fromNumber = targetId;
    }
  }

  const text = extractText(message)?.trim() ?? "";

  logger.info(
    { jid, fromNumber, fromMe: message.key.fromMe, isSelfChat, hasText: Boolean(text), text: text.slice(0, 50) },
    "Pesan WhatsApp masuk diterima",
  );

  // Cek lebih dulu supaya pesan ulang dari WhatsApp (mis. saat reconnect)
  // tidak memicu error unique constraint di log Prisma.
  const existing = await prisma.inboundMessage.findUnique({
    where: { waMessageId: messageId },
    select: { id: true },
  });
  if (existing) {
    logger.debug({ messageId }, "Pesan duplikat, dilewati");
    return;
  }

  let inboundId: string;
  try {
    const inbound = await prisma.inboundMessage.create({
      data: {
        waMessageId: messageId,
        fromNumber,
        text: text.slice(0, 2000),
        status: "RECEIVED",
      },
    });
    inboundId = inbound.id;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      logger.debug({ messageId }, "Pesan duplikat, dilewati");
      return;
    }
    throw error;
  }

  const mark = async (status: string, userId?: string, error?: string) => {
    await prisma.inboundMessage
      .update({
        where: { id: inboundId },
        data: { status, userId: userId ?? null, error: error?.slice(0, 500) ?? null },
      })
      .catch(() => undefined);
  };

  const user = await prisma.user.findUnique({ where: { waNumber: fromNumber } });
  if (!user) {
    const last = unregisteredNotified.get(fromNumber) ?? 0;
    if (Date.now() - last > UNREGISTERED_COOLDOWN_MS) {
      unregisteredNotified.set(fromNumber, Date.now());
      await socket
        .sendMessage(jid, { text: UNREGISTERED_REPLY })
        .catch((error) => logger.warn({ error }, "Gagal mengirim pesan belum terdaftar"));
    }
    await mark("IGNORED");
    return;
  }

  if (!text) {
    await socket
      .sendMessage(jid, {
        text: "Saat ini saya hanya bisa membaca pesan teks. Ketik /bantuan untuk contoh format.",
      })
      .catch(() => undefined);
    await mark("IGNORED", user.id);
    return;
  }

  try {
    const reply = await processMessage(user, text);
    if (reply) {
      await socket.sendMessage(jid, { text: reply });
    }
    await mark("PROCESSED", user.id);
    logger.info({ userId: user.id, command: text.slice(0, 40) }, "Pesan diproses");
  } catch (error) {
    logger.error({ error, userId: user.id }, "Gagal memproses transaksi");
    await mark("FAILED", user.id, (error as Error).message);
    await socket
      .sendMessage(jid, {
        text: "❌ Maaf, terjadi kendala saat menyimpan transaksi. Coba lagi sebentar lagi.",
      })
      .catch(() => undefined);
  }
}

async function processMessage(user: User, text: string): Promise<string> {
  if (text.startsWith("/")) return handleCommand(user, text);
  return handleFreeText(user, text);
}

async function handleFreeText(user: User, text: string): Promise<string> {
  if (isGreeting(text) && text.length <= 25) {
    return `Halo ${user.name}! 👋\n\n${HELP_TEXT}`;
  }

  const parsed = parseMessage(text);
  if (!parsed.ok) {
    if (parsed.code === "NO_AMOUNT") {
      return [
        "Hmm, nominalnya belum kebaca. 🤔",
        "",
        "Coba tulis seperti ini:",
        "• makan siang 25rb",
        "• gaji 8jt",
        "• bayar listrik 350.000 kemarin",
        "",
        "Ketik /bantuan untuk daftar lengkap.",
      ].join("\n");
    }
    return `❌ ${parsed.error} Coba tulis nominal yang jelas, misalnya 25rb atau 25.000.`;
  }

  const data = parsed.data;
  const result = await recordTransaction({
    userId: user.id,
    kind: data.kind,
    amount: data.amount,
    note: data.note,
    occurredAt: data.occurredAt,
    walletHint: data.walletHint,
    categoryHint: data.categoryHint,
    source: "WA",
    rawMessage: text,
  });

  if (!result.ok) return `❌ ${result.error}`;
  return txReply(result, data.kind);
}

async function handleCommand(user: User, text: string): Promise<string> {
  const match = /^\/([a-zA-Z]+)(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!match) return HELP_TEXT;

  const command = match[1].toLowerCase();
  const rest = (match[2] ?? "").trim();

  switch (command) {
    case "start":
    case "mulai":
    case "help":
    case "bantuan":
    case "menu":
      return HELP_TEXT;

    case "saldo":
      return handleBalance(user);

    case "laporan":
    case "lapor":
    case "report":
      return handleReport(user, rest);

    case "keluar":
    case "k":
    case "out":
      return handleRecord(user, rest, "EXPENSE", text);

    case "masuk":
    case "m":
    case "in":
      return handleRecord(user, rest, "INCOME", text);

    case "transfer":
    case "tf":
      return handleTransfer(user, rest, text);

    case "undo":
    case "batal":
      return handleUndo(user);

    case "dompet":
    case "wallet":
      return handleWallets(user);

    case "kategori":
    case "category":
      return handleCategories(user);

    default:
      return `Perintah /${command} tidak dikenal.\n\n${HELP_TEXT}`;
  }
}

async function handleRecord(
  user: User,
  rest: string,
  kind: TxKind,
  raw: string,
): Promise<string> {
  const parsed = parseMessage(rest);
  if (!parsed.ok) {
    return [
      `Format: /${kind === "EXPENSE" ? "keluar" : "masuk"} <nominal> <catatan>`,
      "Contoh: ",
      kind === "EXPENSE" ? "/keluar 25rb makan siang" : "/masuk 8jt gaji",
    ].join("\n");
  }

  const data = parsed.data;
  const result = await recordTransaction({
    userId: user.id,
    kind,
    amount: data.amount,
    note: data.note,
    occurredAt: data.occurredAt,
    walletHint: data.walletHint,
    categoryHint: data.categoryHint,
    source: "WA",
    rawMessage: raw,
  });

  if (!result.ok) return `❌ ${result.error}`;
  return txReply(result, kind);
}

async function handleTransfer(user: User, rest: string, raw: string): Promise<string> {
  const parsed = parseMessage(rest);
  const { mentions } = extractTags(rest);
  const amount = parseAmount(rest);

  if (!parsed.ok || !amount || mentions.length < 2) {
    return [
      "Format: /transfer <nominal> @dompet-asal @dompet-tujuan",
      "Contoh: /transfer 100rb @bca @gopay",
    ].join("\n");
  }

  const result = await recordTransfer({
    userId: user.id,
    amount,
    fromHint: mentions[0],
    toHint: mentions[1],
    note: parsed.data.note,
    occurredAt: parsed.data.occurredAt,
    source: "WA",
    rawMessage: raw,
  });

  if (!result.ok) return `❌ ${result.error}`;

  return [
    "🔄 *Transfer tercatat*",
    "",
    `*${formatIDR(amount)}*`,
    `${result.from.name} → ${result.to.name}`,
    parsed.data.note ? `📝 ${parsed.data.note}` : null,
    "",
    `Saldo ${result.from.name}: *${formatIDR(result.from.balance)}*`,
    `Saldo ${result.to.name}: *${formatIDR(result.to.balance)}*`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

async function handleBalance(user: User): Promise<string> {
  const { wallets, total } = await getWalletBalances(user.id);
  if (wallets.length === 0) {
    return "Belum ada dompet. Tambahkan dompet lewat dashboard web.";
  }
  const lines = wallets.map(
    (wallet) => `• ${wallet.name} (${walletTypeLabel(wallet.type)}): ${formatIDR(wallet.balance)}`,
  );
  return [`👛 *Saldo Dompet*`, "", ...lines, "", `*Total: ${formatIDR(total)}*`].join("\n");
}

async function handleReport(user: User, arg: string): Promise<string> {
  const month = resolveMonthArg(arg);
  const range = monthRange(month);
  const [summary, expenseCategories] = await Promise.all([
    getSummary([user.id], range.start, range.end),
    getCategoryTotals([user.id], range.start, range.end, "EXPENSE"),
  ]);

  const top = expenseCategories.filter((item) => item.total > 0).slice(0, 5);
  const lines = [
    `📊 *Laporan ${monthLabelID(range.key)}*`,
    "",
    `💰 Pemasukan: *${formatIDR(summary.income)}*`,
    `💸 Pengeluaran: *${formatIDR(summary.expense)}*`,
    `📈 Selisih: *${formatIDR(summary.net)}*`,
  ];

  if (top.length > 0) {
    lines.push("", "*Pengeluaran terbesar*");
    top.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.emoji} ${item.name} — ${formatIDR(item.total)}`);
    });
  }

  lines.push("", "_/laporan 2026-09 untuk bulan lain._");
  return lines.join("\n");
}

function resolveMonthArg(arg: string): string {
  const trimmed = arg.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  const onlyMonth = /^(\d{1,2})$/.exec(trimmed);
  if (onlyMonth) {
    const month = Number(onlyMonth[1]);
    if (month >= 1 && month <= 12) {
      return `${currentMonthKey().slice(0, 4)}-${String(month).padStart(2, "0")}`;
    }
  }
  return monthKey(new Date());
}

async function handleUndo(user: User): Promise<string> {
  const transaction = await prisma.transaction.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { wallet: true, category: true },
  });

  if (!transaction) return "Belum ada transaksi yang bisa dibatalkan.";

  if (Date.now() - transaction.createdAt.getTime() > 24 * 60 * 60 * 1000) {
    return [
      "Transaksi terakhir sudah lebih dari 24 jam, jadi tidak bisa dibatalkan lewat chat.",
      "Silakan hapus lewat dashboard web.",
    ].join("\n");
  }

  await prisma.transaction.delete({ where: { id: transaction.id } });

  return [
    "🗑️ *Transaksi dibatalkan*",
    "",
    `${formatIDR(transaction.amount)} — ${transaction.category?.name ?? "Tanpa kategori"}`,
    transaction.note ? `📝 ${transaction.note}` : null,
    `👛 ${transaction.wallet.name}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

async function handleWallets(user: User): Promise<string> {
  const { wallets, total } = await getWalletBalances(user.id);
  if (wallets.length === 0) return "Belum ada dompet. Tambahkan lewat dashboard web.";
  const lines = wallets.map(
    (wallet) => `• ${wallet.name} (${walletTypeLabel(wallet.type)}) — ${formatIDR(wallet.balance)}`,
  );
  return [
    "👛 *Daftar Dompet*",
    "",
    ...lines,
    "",
    `Total: *${formatIDR(total)}*`,
    "_Tambah/ubah dompet lewat dashboard web._",
  ].join("\n");
}

async function handleCategories(user: User): Promise<string> {
  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
  });

  const expenses = categories.filter((category) => category.type === "EXPENSE");
  const incomes = categories.filter((category) => category.type === "INCOME");

  const format = (items: typeof categories) =>
    items.map((category) => `${category.emoji} ${category.name}`).join("\n");

  return [
    "🏷️ *Daftar Kategori*",
    "",
    "*Pengeluaran*",
    format(expenses) || "-",
    "",
    "*Pemasukan*",
    format(incomes) || "-",
    "",
    "_Gunakan #nama-kategori saat mencatat._",
  ].join("\n");
}
