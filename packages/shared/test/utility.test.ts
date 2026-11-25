import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isUtilityKind,
  parseQuantity,
  utilityTransactionNote,
  validateUtility,
} from "../src/utility";

describe("galon air & gas LPG", () => {
  it("membaca jumlah desimal", () => {
    assert.equal(parseQuantity("2"), 2);
    assert.equal(parseQuantity("1,5"), 1.5);
    assert.equal(parseQuantity(""), null);
    assert.equal(parseQuantity("dua"), null);
  });

  it("memvalidasi jumlah dan harga", () => {
    const ok = validateUtility({ quantity: 2, price: 20_000 });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.pricePerUnit, 10_000);

    assert.equal(validateUtility({ quantity: 0, price: 20_000 }).ok, false);
    assert.equal(validateUtility({ quantity: 2, price: 0 }).ok, false);
    assert.equal(validateUtility({ quantity: Number.NaN, price: 1 }).ok, false);
  });

  it("menyusun catatan pengeluaran otomatis", () => {
    assert.equal(
      utilityTransactionNote("WATER_GALLON", 2, "dapur"),
      "Galon air 2 galon · dapur",
    );
    assert.equal(utilityTransactionNote("LPG_GAS", 1), "Gas LPG 1 tabung");
  });

  it("hanya menerima jenis yang dikenal", () => {
    assert.equal(isUtilityKind("WATER_GALLON"), true);
    assert.equal(isUtilityKind("LPG_GAS"), true);
    assert.equal(isUtilityKind("LISTRIK"), false);
  });
});
