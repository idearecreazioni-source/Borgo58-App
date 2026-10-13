import { describe, expect, it } from "vitest";
import { contoDelLotto, parolaUscita, righeInOrdine } from "../../src/lib/calcoli/lotti";

// DOVE È FINITO UN LOTTO (N6, 12/10/2026). La regola vera — chi è uscito
// per dove — la prova la verifica della migrazione 20261012000001; qui si
// tengono ferme le parole e l'ordine con cui la schermata le mostra.

describe("le parole di un'uscita", () => {
  it("ogni tipo che il database restituisce ha la sua parola", () => {
    for (const t of ["conto", "produzione", "consumo", "spreco", "reso", "vitto", "rettifica", "senza_movimento", "non_annotato"]) {
      expect(parolaUscita(t)).not.toBe("Uscita");
      expect(parolaUscita(t)).not.toMatch(/_/);
    }
  });
  it("un tipo sconosciuto non compare come codice", () => {
    expect(parolaUscita("qualcosa_di_nuovo")).toBe("Uscita");
  });
});

describe("l'ordine delle righe", () => {
  const righe = [
    { livello: 1, tipo: "consumo", quando: "2026-10-12T10:00:00Z" },
    { livello: 0, tipo: "non_annotato", quando: null },
    { livello: 0, tipo: "conto", quando: "2026-10-12T21:00:00Z" },
    { livello: 0, tipo: "produzione", quando: "2026-10-12T09:00:00Z" },
  ];
  it("prima il lotto chiesto, in ordine di tempo, e il vuoto dichiarato in fondo", () => {
    expect(righeInOrdine(righe).map((r) => `${r.livello}:${r.tipo}`)).toEqual([
      "0:produzione", "0:conto", "0:non_annotato", "1:consumo",
    ]);
  });
  it("il conto del lotto guarda solo il primo livello", () => {
    const c = contoDelLotto([
      { livello: 0, tipo: "conto", quantita: 2 },
      { livello: 0, tipo: "non_annotato", quantita: 3 },
      { livello: 1, tipo: "consumo", quantita: 50 },
    ]);
    expect(c).toEqual({ annotato: 2, nonAnnotato: 3 });
  });
});

import { filtraLotti } from "../../src/lib/calcoli/lotti";

describe("la ricerca fra i lotti", () => {
  const lotti = [
    { id: "1", ingredient: { name: "Calamaro" }, supplier: { name: "Pescheria Mulè" }, supplier_batch_number: "A7-12" },
    { id: "2", ingredient: { name: "Ragù pronto" }, supplier: { name: "Mulino" }, supplier_batch_number: null },
    { id: "3", ingredient: { name: "Farina" }, supplier: null, supplier_batch_number: "X1" },
  ];
  const ids = (t) => filtraLotti(lotti, t).map((l) => l.id);

  it("vuota, restituisce tutto", () => {
    expect(ids("")).toEqual(["1", "2", "3"]);
    expect(ids("   ")).toEqual(["1", "2", "3"]);
  });
  it("cerca nel prodotto, nel fornitore e nel numero di lotto, senza accenti né maiuscole", () => {
    expect(ids("CALAMARO")).toEqual(["1"]);
    expect(ids("ragu")).toEqual(["2"]);
    expect(ids("mule")).toEqual(["1"]);
    expect(ids("a7 12")).toEqual(["1"]);
  });
  it("più parole devono esserci tutte", () => {
    expect(ids("calamaro mulino")).toEqual([]);
    expect(ids("ragu mulino")).toEqual(["2"]);
  });
});
