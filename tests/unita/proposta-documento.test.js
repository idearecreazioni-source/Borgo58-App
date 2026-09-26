import { describe, expect, it } from "vitest";
import {
  campiProposti,
  cosaNonHoCapito,
  dateDaDistinguere,
} from "../../src/lib/calcoli/propostaDocumento";

// =====================================================================
// LA PROPOSTA DI UN DOCUMENTO, PROVATA AL CONTRARIO
// =====================================================================
// 10/09/2026, Blocco 4 del mandato notturno.
//
// 🔴 QUELLO CHE QUESTE PROVE SORVEGLIANO NON È CHE I CAMPI SI RIEMPIANO:
//    è che **non si riempiano quando non si sa**. Un valore plausibile
//    messo in una casella vuota è indistinguibile da un valore letto, e chi
//    guarda la scheda compilata non ha modo di sapere quale delle due cose
//    sta guardando.

const SEZIONI = [
  { codice: "contratti", etichetta: "Contratti" },
  { codice: "fatture", etichetta: "Fatture" },
];

describe("i campi che il gestionale propone dopo aver letto", () => {
  it("quello che ha letto finisce nelle caselle giuste", () => {
    const campi = campiProposti(
      {
        nome: "Contratto di locazione",
        tipo: "contratti",
        data: "2026-08-03",
        controparti: "Rossi Immobiliare",
        importo: 24000,
        scadenza: "2032-08-02",
      },
      SEZIONI
    );
    expect(campi.title).toBe("Contratto di locazione");
    expect(campi.doc_type).toBe("contratti");
    expect(campi.document_date).toBe("2026-08-03");
    expect(campi.counterparties).toBe("Rossi Immobiliare");
    expect(campi.amount).toBe("24000");
    expect(campi.expiry_date).toBe("2032-08-02");
  });

  it("🔴 una sezione che non esiste si SCARTA, non si scrive", () => {
    // Le sezioni dell'Archivio sono dati di Alessio. Una inventata dal
    // modello, scritta lo stesso, farebbe fallire il salvataggio — oppure,
    // peggio, archivierebbe il documento in un posto che non c'è.
    const campi = campiProposti({ nome: "x", tipo: "bollette_del_gas" }, SEZIONI);
    expect(campi.doc_type).toBe("");
  });

  it("🔴 una data che non è una data resta vuota", () => {
    // «agosto 2026» e «03/08/26» non sono date che il resto del gestionale
    // sappia leggere: scriverle produrrebbe un campo pieno e sbagliato.
    expect(campiProposti({ data: "agosto 2026" }, SEZIONI).document_date).toBe("");
    expect(campiProposti({ data: "03/08/2026" }, SEZIONI).document_date).toBe("");
    expect(campiProposti({ scadenza: "fra un anno" }, SEZIONI).expiry_date).toBe("");
  });

  it("⚠️ e una proposta vuota non riempie niente", () => {
    const campi = campiProposti(null, SEZIONI);
    expect(Object.values(campi).every((v) => v === "")).toBe(true);
  });
});

describe("cosa il gestionale NON ha saputo leggere", () => {
  it("🔴 i buchi si dichiarano, uno per uno", () => {
    // Una scheda compilata a metà senza dire quale metà manca si legge come
    // una scheda completa: i campi vuoti sembrano campi che nel documento
    // non c'erano.
    const proposta = { nome: "", tipo: "", data: "" };
    const buchi = cosaNonHoCapito(proposta, campiProposti(proposta, SEZIONI));
    expect(buchi).toContain("come si chiama");
    expect(buchi).toContain("in quale sezione va");
    expect(buchi).toContain("di che data è");
  });

  it("🔴 e una sezione inventata si distingue da una sezione mancante", () => {
    // Sono due fatti diversi: «non ho capito dove va» e «ho capito, ma il
    // posto che dico non esiste». Il secondo si corregge aggiungendo una
    // sezione; il primo no.
    const proposta = { nome: "x", tipo: "bollette_del_gas", data: "2026-08-03" };
    const buchi = cosaNonHoCapito(proposta, campiProposti(proposta, SEZIONI));
    expect(buchi.join(" ")).toMatch(/bollette_del_gas/);
    expect(buchi.join(" ")).toMatch(/non è una sezione/);
  });

  it("quando ha capito tutto non dichiara buchi che non ci sono", () => {
    const proposta = { nome: "Contratto", tipo: "contratti", data: "2026-08-03" };
    expect(cosaNonHoCapito(proposta, campiProposti(proposta, SEZIONI))).toEqual([]);
  });
});

describe("le date di un documento, quando sono più di una", () => {
  it("🔴 si mostrano tutte, con cosa rappresentano", () => {
    // Un documento ha quasi sempre più di una data — emissione, scadenza,
    // decorrenza, firma — e sceglierne una in silenzio vuol dire archiviare
    // una fattura di marzo sotto giugno **senza nessun errore**.
    const date = dateDaDistinguere({
      date_trovate: [
        { data: "2026-08-03", cosa: "data del contratto" },
        { data: "2026-09-01", cosa: "decorrenza" },
        { data: "2032-08-02", cosa: "scadenza" },
      ],
    });
    expect(date).toHaveLength(3);
    expect(date[0]).toEqual({ data: "2026-08-03", cosa: "data del contratto" });
  });

  it("⚠️ con una data sola non c'è niente da distinguere", () => {
    // Un elenco di una riga farebbe sembrare difficile una cosa che non lo è.
    expect(dateDaDistinguere({ date_trovate: [{ data: "2026-08-03", cosa: "emissione" }] })).toEqual(
      []
    );
    expect(dateDaDistinguere({})).toEqual([]);
  });

  it("e le forme che non sono date non entrano nell'elenco", () => {
    expect(
      dateDaDistinguere({
        date_trovate: [
          { data: "2026-08-03", cosa: "emissione" },
          { data: "non l'ho capita", cosa: "?" },
        ],
      })
    ).toEqual([]);
  });
});
