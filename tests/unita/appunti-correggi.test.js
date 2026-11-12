import { describe, expect, it } from "vitest";
import { campiCorreggibili, datiCorretti, numeroScritto } from "../../src/lib/calcoli/appunti.js";

// 🔴 «CORREGGI» SUGLI APPUNTI DI MEMO — 12/11/2026, richiesta di Alessio
//    dalla prova sul piano: se MEMO capisce male un pezzo, si cambia quel
//    pezzo invece di ridire tutta la frase.

const chiavi = (dati) => campiCorreggibili(dati).map((c) => c.chiave);

describe("campiCorreggibili", () => {
  it("una voce nuova del piano: gruppo, descrizione, importo, IVA e stato, coi menu giusti", () => {
    const campi = campiCorreggibili({ gruppo: "B", descrizione: "Forno", importo: 1200, aliquota_iva: 22, stato: "stimato" });
    expect(campi.map((c) => c.chiave)).toEqual(["gruppo", "descrizione", "importo", "aliquota_iva", "stato"]);
    const gruppo = campi.find((c) => c.chiave === "gruppo");
    expect(gruppo.tipo).toBe("scelta");
    expect(gruppo.scelte.map((s) => s.valore)).toEqual(["A", "B", "C", "D", "E"]);
    expect(campi.find((c) => c.chiave === "aliquota_iva").valore).toBe("22");
    expect(campi.find((c) => c.chiave === "importo")).toMatchObject({ tipo: "numero", valore: "1200" });
  });

  it("quello che calcola il database non si corregge: nomi, «adesso è», avviso sulle rate", () => {
    const dati = {
      voce_id: "v1", voce_nome: "Forno", importo: 900, prima_stato: "stimato",
      prima_previsto: 1000, prima_nota: "x", avviso_rate: "le rate fanno 1000",
    };
    expect(chiavi(dati)).toEqual(["voce_id", "importo"]);
    expect(campiCorreggibili(dati)[0].tipo).toBe("voce_piano");
  });

  it("collegando una spesa l'importo non si tocca: è quanto ne resta, lo dice il database", () => {
    expect(chiavi({ voce_id: "v1", spesa_id: "s1", spesa_fonte: "cassa", spesa_nome: "x", importo: 50 })).toEqual(["voce_id"]);
  });

  it("identificativi, numeri di catalogo e oggetti restano fuori", () => {
    expect(chiavi({ ingredient_id: "i", prodotto: 3, quanto_ce: 2, alternative: [], dove: "x" })).toEqual(["quanto_ce"]);
  });

  it("date e ore diventano campi data e ora", () => {
    const campi = campiCorreggibili({ data: "2026-11-20", ora: "15:00:00" });
    expect(campi.map((c) => [c.tipo, c.valore])).toEqual([["data", "2026-11-20"], ["ora", "15:00"]]);
  });
});

describe("numeroScritto", () => {
  it("legge i numeri come li scrive Alessio", () => {
    expect(numeroScritto("1.200")).toBe(1200);
    expect(numeroScritto("1.200,50")).toBe(1200.5);
    expect(numeroScritto("12,5")).toBe(12.5);
    expect(numeroScritto("12.5")).toBe(12.5);
    expect(numeroScritto("€ 30")).toBe(30);
    expect(numeroScritto("1,200.50")).toBe(1200.5);
    expect(numeroScritto("-18")).toBe(-18);
    expect(numeroScritto("1e3")).toBeNull();
    expect(numeroScritto("0x10")).toBeNull();
    expect(numeroScritto("trenta")).toBeNull();
    expect(numeroScritto("")).toBeNull();
  });
});

describe("datiCorretti", () => {
  it("cambia il gruppo e tiene tutto il resto, campi di servizio compresi", () => {
    const dati = { gruppo: "B", descrizione: "Forno", importo: 1200, nome_sentito: "forno" };
    const r = datiCorretti(dati, { gruppo: "A", descrizione: "Forno", importo: "1200" });
    expect(r.dati).toEqual({ gruppo: "A", descrizione: "Forno", importo: 1200, nome_sentito: "forno" });
  });

  it("un'altra voce del piano: nuovo id, e via nome e «adesso è» vecchi", () => {
    const dati = { voce_id: "v1", voce: 3, voce_nome: "Forno", stato: "confermato", prima_stato: "stimato", avviso_rate: "x" };
    const r = datiCorretti(dati, { voce_id: "v2", stato: "confermato" });
    expect(r.dati).toEqual({ voce_id: "v2", stato: "confermato" });
  });

  it("l'IVA torna un numero, l'importo all'italiana pure", () => {
    const r = datiCorretti({ importo: 100, aliquota_iva: 22 }, { importo: "1.500,00", aliquota_iva: "10" });
    expect(r.dati).toEqual({ importo: 1500, aliquota_iva: 10 });
  });

  it("un importo che non è un numero si dice prima di partire", () => {
    const r = datiCorretti({ importo: 100 }, { importo: "cento" });
    expect(r.errore).toMatch(/deve essere un numero/);
    expect(r.dati).toBeUndefined();
  });

  it("un campo svuotato si toglie, non si manda vuoto", () => {
    expect(datiCorretti({ nota: "x", importo: 5 }, { nota: "  ", importo: "5" }).dati).toEqual({ importo: 5 });
  });

  it("sì e no restano veri e falsi", () => {
    expect(datiCorretti({ ricorrente: true }, { ricorrente: "no" }).dati).toEqual({ ricorrente: false });
  });
});

describe("Correggi: i casi trovati dalla revisione (ecc:react-reviewer, 12/11)", () => {
  it("un importo tenuto come testo resta un numero, e si rimanda come numero", () => {
    expect(campiCorreggibili({ importo: "25.00" })[0]).toMatchObject({ tipo: "numero", valore: "25,00" });
    expect(datiCorretti({ importo: "25.00" }, { importo: "25,5" }).dati).toEqual({ importo: 25.5 });
  });

  it("un gruppo o un'IVA fuori elenco restano scelti, non diventano il primo del menu", () => {
    const [gruppo, iva] = campiCorreggibili({ gruppo: "b", aliquota_iva: 7 });
    expect(gruppo.scelte[0].valore).toBe("b");
    expect(iva.scelte[0].valore).toBe("7");
  });
});
