import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMessage } from "../src/parse";
import { parseAmount } from "../src/money";
import { dateKey, monthKey, monthRange, zonedToUtc } from "../src/dates";
import { normalizeWaNumber } from "../src/format";

const NOW = new Date("2026-10-22T05:00:00.000Z"); // 12:00 WIB

function parse(text: string) {
  const result = parseMessage(text, NOW);
  assert.equal(result.ok, true, `seharusnya berhasil: ${text}`);
  if (!result.ok) throw new Error("unreachable");
  return result.data;
}

describe("parseMessage — nominal", () => {
  it("membaca singkatan rb / k / jt", () => {
    assert.equal(parse("makan siang 25rb").amount, 25_000);
    assert.equal(parse("bensin 50k").amount, 50_000);
    assert.equal(parse("gaji 8jt").amount, 8_000_000);
    assert.equal(parse("bayar kos 1,5jt").amount, 1_500_000);
    assert.equal(parse("bayar kos 1.500.000").amount, 1_500_000);
    assert.equal(parse("jajan 15,000").amount, 15_000);
    assert.equal(parse("Rp 45.000 parkir").amount, 45_000);
  });

  it("mengabaikan angka lain yang bukan nominal", () => {
    assert.equal(parse("beli 2 kopi 50rb").amount, 50_000);
    assert.equal(parse("makan 2x 25.000").amount, 25_000);
    assert.equal(parse("beli bensin 50.000 2 liter").amount, 50_000);
  });

  it("menolak pesan tanpa nominal", () => {
    const result = parseMessage("makan siang", NOW);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "NO_AMOUNT");
  });

  it("parseAmount untuk form", () => {
    assert.equal(parseAmount("Rp 1.250.000"), 1_250_000);
    assert.equal(parseAmount("25rb"), 25_000);
    assert.equal(parseAmount("2,5jt"), 2_500_000);
    assert.equal(parseAmount(""), null);
  });
});

describe("parseMessage — arah transaksi", () => {
  it("default pengeluaran", () => {
    assert.equal(parse("makan siang 25rb").kind, "EXPENSE");
    assert.equal(parse("25rb").kind, "EXPENSE");
  });

  it("mengenali pemasukan", () => {
    assert.equal(parse("gaji 8jt").kind, "INCOME");
    assert.equal(parse("gajian 7,5jt").kind, "INCOME");
    assert.equal(parse("dapat cashback 20rb").kind, "INCOME");
    assert.equal(parse("transfer masuk 500rb").kind, "INCOME");
    assert.equal(parse("+50rb jual buku").kind, "INCOME");
  });

  it("kata kerja pengeluaran menang atas kata benda pemasukan", () => {
    assert.equal(parse("bayar gaji ART 1,5jt").kind, "EXPENSE");
    assert.equal(parse("beli kado buat hadiah 100rb").kind, "EXPENSE");
  });
});

describe("parseMessage — catatan & tanggal", () => {
  it("membersihkan catatan dari nominal, tag, dan tanggal", () => {
    const tx = parse("kemarin bensin 50rb");
    assert.equal(tx.note, "bensin");
    assert.equal(dateKey(tx.occurredAt), "2026-10-21");
  });

  it("mendukung 'tanggal 5'", () => {
    const tx = parse("tanggal 5 bayar kos 1.200.000");
    assert.equal(tx.amount, 1_200_000);
    assert.equal(parse("tanggal 5 bayar kos 1.200.000").note, "bayar kos");
    assert.equal(dateKey(tx.occurredAt), "2026-10-05");
  });

  it("mendukung '3 hari lalu'", () => {
    const tx = parse("3 hari lalu beli galon 20rb");
    assert.equal(dateKey(tx.occurredAt), "2026-10-19");
    assert.equal(tx.note, "beli galon");
  });

  it("mengambil tag kategori dan mention dompet", () => {
    const tx = parse("beli kopi 15,000 @bca #makan");
    assert.equal(tx.walletHint, "bca");
    assert.equal(tx.categoryHint, "makan");
    assert.equal(tx.note, "beli kopi");
  });

  it("tetap menyimpan catatan saat tidak ada teks lain", () => {
    const tx = parse("25rb");
    assert.equal(tx.note, "");
  });
});

describe("tanggal & nomor WA", () => {
  it("monthRange konsisten dengan zona waktu", () => {
    const { start, end } = monthRange("2026-10");
    assert.equal(start.toISOString(), "2026-09-30T17:00:00.000Z");
    assert.equal(end.toISOString(), "2026-10-31T17:00:00.000Z");
    assert.equal(monthKey(zonedToUtc(2026, 10, 1, 0, 0, 0)), "2026-10");
  });

  it("normalisasi nomor WhatsApp", () => {
    assert.equal(normalizeWaNumber("0812-3456-7890"), "6281234567890");
    assert.equal(normalizeWaNumber("+62 812 3456 7890"), "6281234567890");
    assert.equal(normalizeWaNumber("81234567890"), "6281234567890");
  });
});
