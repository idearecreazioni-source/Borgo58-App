import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// REVISIONE DELL'11/11/2026, punto 38: la compilazione delle schede guarda il tetto di spesa PRIMA di chiamare il modello.
const f = readFileSync(new URL("../../supabase/functions/schede-prodotto/index.ts", import.meta.url), "utf8");
const l = readFileSync(new URL("../../supabase/functions/leggi-foto/index.ts", import.meta.url), "utf8");

describe("schede-prodotto: il tetto si guarda prima di spendere", () => {
  it("chiede spesa_ai_del_mese (riservata al titolare) e si ferma se blocca", () => {
    expect(f).toContain('supabase.rpc("spesa_ai_del_mese")');
    expect(f).toContain("statoSpesa?.blocca");
    expect(f).toContain('errore(\n      429,\n      "tetto"');
  });

  it("il controllo sta PRIMA della chiamata al modello", () => {
    expect(f.indexOf('rpc("spesa_ai_del_mese")')).toBeLessThan(f.indexOf("anthropic.messages.create"));
  });

  it("anche la lettura delle foto lo guarda prima di spendere (già così: non deve sparire)", () => {
    expect(l.indexOf('rpc("spesa_ai_del_mese")')).toBeGreaterThan(-1);
    expect(l.indexOf('rpc("spesa_ai_del_mese")')).toBeLessThan(l.indexOf("messages.create"));
  });
});
