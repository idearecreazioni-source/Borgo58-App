import { describe, it, expect } from "vitest";
import { scadenzaDaSeguire } from "../../src/lib/calcoli/documentiCollegabili";

describe("scadenzaDaSeguire", () => {
  it("un documento collegato a una fattura pagata non è più in scadenza", () => {
    expect(scadenzaDaSeguire({ expiry_date: "2026-10-01", supplier_invoice_id: "f1", fattura: { status: "pagata" } })).toBe(false);
  });
  it("collegato a una fattura da pagare resta in scadenza", () => {
    expect(scadenzaDaSeguire({ expiry_date: "2026-10-01", supplier_invoice_id: "f1", fattura: { status: "da_pagare" } })).toBe(true);
  });
  it("non collegato resta in scadenza", () => {
    expect(scadenzaDaSeguire({ expiry_date: "2026-10-01", fattura: null })).toBe(true);
    expect(scadenzaDaSeguire({ expiry_date: "2026-10-01" })).toBe(true);
  });
  it("senza data di scadenza non c'è niente da seguire", () => {
    expect(scadenzaDaSeguire({ expiry_date: null })).toBe(false);
    expect(scadenzaDaSeguire(null)).toBe(false);
  });
});
