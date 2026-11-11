import { describe, expect, it } from "vitest";
import { propostaSpesaBanca, speseBancaDaRegistrare } from "../../src/lib/calcoli/speseBanca.js";

// 🔴 LE SPESE DELLA BANCA SI PROPONGONO DA SOLE (12/11/2026): Alessio
//    l'11/11 ha scritto a mano sette righe di commissioni e canoni.

const DESCR = { "16": "COMM. BONIFICO COBON", "18": "CANONE GESTIONE C/C", "74": "BOLLI C/C E DEPOSITI" };

const CAUSALI = [
  { id: "sb", label: "Spese bancarie", kind: "uscita" },
  { id: "rb", label: "Rimborso spese banca", kind: "entrata" },
  { id: "au", label: "Altra uscita", kind: "uscita" },
];

describe("propostaSpesaBanca", () => {
  it.each([
    ["16", -1, "commissioni"],
    ["18", -10, "canone del conto"],
    ["74", -9.83, "bolli"],
  ])("ABI %s in uscita → Spese bancarie, estratto conto (%s €)", (abi, importo, cosa) => {
    const p = propostaSpesaBanca({ importo, causale_abi: abi, descrizione: DESCR[abi] }, CAUSALI);
    expect(p).toMatchObject({ causaleId: "sb", tipoDocumento: "estratto_conto" });
    expect(p.perche).toContain(cosa);
  });

  it("ABI 68 in entrata → Rimborso spese banca", () => {
    expect(propostaSpesaBanca({ importo: 10, causale_abi: "68", descrizione: "RICARICA-RIMBORSO CANONE OCCAN" }, CAUSALI)).toMatchObject({ causaleId: "rb" });
  });

  it("un bonifico (ABI 26) non è una spesa della banca: niente proposta", () => {
    expect(propostaSpesaBanca({ importo: -1500, causale_abi: "26" }, CAUSALI)).toBeNull();
  });

  it("il segno conta: ABI 16 in entrata non è una commissione", () => {
    expect(propostaSpesaBanca({ importo: 1, causale_abi: "16", descrizione: "COMM. BONIFICO" }, CAUSALI)).toBeNull();
  });

  it("se la causale non esiste più col suo nome, nessuna proposta (meglio che una sbagliata)", () => {
    expect(propostaSpesaBanca({ importo: -1, causale_abi: "16", descrizione: "COMM. BONIFICO" }, [{ id: "x", label: "Altra uscita", kind: "uscita" }])).toBeNull();
  });

  it("senza codice ABI o con importo zero, nessuna proposta", () => {
    expect(propostaSpesaBanca({ importo: -1, causale_abi: null }, CAUSALI)).toBeNull();
    expect(propostaSpesaBanca({ importo: 0, causale_abi: "16" }, CAUSALI)).toBeNull();
  });
});

describe("speseBancaDaRegistrare", () => {
  it("solo le righe da abbinare, e solo quelle riconosciute", () => {
    const righe = speseBancaDaRegistrare(
      [
        { id: "a", importo: -1, causale_abi: "16", descrizione: "COMM. BONIFICO" },
        { id: "b", importo: -1500, causale_abi: "26" },
        { id: "c", importo: -2, causale_abi: "16", descrizione: "COMM", cash_movement_id: "m1" },
        { id: "d", importo: -9.83, causale_abi: "74", descrizione: "BOLLI", ignorato_il: "2026-11-11" },
        { id: "e", importo: 10, causale_abi: "68", descrizione: "RIMBORSO CANONE" },
      ],
      CAUSALI,
    );
    expect(righe.map((x) => x.m.id)).toEqual(["a", "e"]);
  });
});

describe("la descrizione fa da seconda prova", () => {
  it("ABI 16 con una descrizione che non parla di spese della banca: niente proposta", () => {
    expect(propostaSpesaBanca({ importo: -300, causale_abi: "16", descrizione: "PAGAMENTO FORNITORE ROSSI" }, CAUSALI)).toBeNull();
  });
});
