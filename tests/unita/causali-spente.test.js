import { describe, expect, it } from "vitest";
import { causaleSpentaOmonima } from "../../src/lib/calcoli/causali";
import { fraseMovimentoDaCollocare } from "../../src/lib/calcoli/daCollocare";

const elenco = [
  { id: "1", label: "Pulizie", kind: "uscita", active: false },
  { id: "2", label: "Pulizie", kind: "entrata", active: true },
  { id: "3", label: "Gas", kind: "uscita", active: true },
];

describe("causale spenta con lo stesso nome", () => {
  it("la trova con spazi ai bordi", () => {
    expect(causaleSpentaOmonima(elenco, "  Pulizie ", "uscita")?.id).toBe("1");
  });
  it("non la trova se il tipo è diverso o se è accesa", () => {
    expect(causaleSpentaOmonima(elenco, "Pulizie", "sconto_omaggio")).toBeNull();
    expect(causaleSpentaOmonima(elenco, "Gas", "uscita")).toBeNull();
  });
  it("vuoto o nullo non trova niente", () => {
    expect(causaleSpentaOmonima(elenco, "  ", "uscita")).toBeNull();
    expect(causaleSpentaOmonima(null, "Gas", "uscita")).toBeNull();
  });
});

describe("rimuovere un movimento nato da Da collocare", () => {
  it("traduce l'errore di chiave esterna", () => {
    const f = fraseMovimentoDaCollocare({
      message:
        'update or delete on table "cash_movements" violates foreign key constraint "spese_da_collocare_movimento_id_fkey" on table "spese_da_collocare"',
    });
    expect(f).toMatch(/Annulla la collocazione/);
  });
  it("traduce anche la frase generica che il gestionale mette al posto di Postgres", () => {
    const f = fraseMovimentoDaCollocare({
      message: "Il gestionale non ha accettato questo valore: c'è una regola che lo impedisce (spese_da_collocare_movimento_id_fkey).",
    });
    expect(f).toMatch(/Da collocare/);
  });
  it("lascia stare gli altri errori", () => {
    expect(fraseMovimentoDaCollocare({ message: "rete assente" })).toBeNull();
    expect(fraseMovimentoDaCollocare(null)).toBeNull();
  });
});
