import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { datiInChiaro } from "../../src/lib/calcoli/appunti";

// REVISIONE DELL'11/11/2026, punto 16: prima di approvare si leggono i NOMI di causale, fornitore, prodotto e conto,
// non i loro codici. Il database mette i nomi (voce_nomi_leggibili); la schermata li mostra e nasconde i codici.

describe("datiInChiaro: i nomi al posto dei codici", () => {
  const ID = "3f2c9a10-1111-4222-8333-444455556666";

  it("un movimento di cassa mostra causale, fornitore e conto per nome, e nessun codice", () => {
    const riga = datiInChiaro({
      verso: "uscita",
      importo: 120,
      causale_id: ID,
      causale_nome: "Acquisto merce",
      supplier_id: ID,
      fornitore_nome: "Fornitore Esempio",
      conto_id: ID,
      conto_nome: "Conto principale",
    });
    expect(riga).toContain("causale: Acquisto merce");
    expect(riga).toContain("fornitore: Fornitore Esempio");
    expect(riga).toContain("conto: Conto principale");
    expect(riga).toContain("importo: 120 €");
    expect(riga).not.toContain(ID);
  });

  it("un carico di merce mostra il prodotto per nome", () => {
    const riga = datiInChiaro({ ingredient_id: ID, prodotto_nome: "Farina 00", quantita: 5 });
    expect(riga).toContain("prodotto: Farina 00");
    expect(riga).toContain("quantita: 5");
    expect(riga).not.toContain(ID);
  });
});

describe("migrazione 20261125000004: il database mette i nomi", () => {
  const m = readFileSync(new URL("../../supabase/migrations/20261125000004_prima_di_approvare_si_leggono_i_nomi.sql", import.meta.url), "utf8");

  it("legge causale, fornitore, prodotto e conto dalle loro tabelle e toglie il nome senza codice", () => {
    expect(m).toContain("select c.label into v_nome from cash_causali c");
    expect(m).toContain("select s.name into v_nome from suppliers s");
    expect(m).toContain("select i.name into v_nome from ingredients i");
    expect(m).toContain("select b.nome into v_nome from conti_bancari b");
    expect(m).toContain("v_dati - 'causale_nome'");
  });

  it("si innesta in voce_risolvi_dati in un punto solo, resta chiusa a tutti e si registra", () => {
    expect(m).toContain("voce_nomi_leggibili(v_dati)");
    expect(m).toContain("(ne ha %)");
    expect(m).toContain("revoke all on function voce_nomi_leggibili(jsonb) from public, anon, authenticated;");
    expect(m).not.toMatch(/\bgrant\b/i);
    expect(m).toMatch(/values \('20261125000004', 'prima_di_approvare_si_leggono_i_nomi'\)/);
  });
});

describe("campiCorreggibili: i nomi scritti dal database non si correggono a mano", () => {
  it("causale_nome, fornitore_nome, prodotto_nome e conto_nome non compaiono nel modulo di correzione", async () => {
    const { campiCorreggibili } = await import("../../src/lib/calcoli/appunti");
    const chiavi = campiCorreggibili({
      verso: "uscita",
      causale_nome: "A",
      fornitore_nome: "B",
      prodotto_nome: "C",
      conto_nome: "D",
      nota: "x",
    }).map((c) => c.chiave);
    expect(chiavi).toContain("nota");
    for (const k of ["causale_nome", "fornitore_nome", "prodotto_nome", "conto_nome"]) expect(chiavi).not.toContain(k);
  });
});
