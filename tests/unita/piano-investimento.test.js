import { describe, expect, it } from "vitest";
import {
  GRUPPI,
  esitoVoce,
  fabbisognoPerMese,
  meseDellaRata,
  nettoDi,
  nomeGruppo,
  quadra,
  totaliDelPiano,
} from "../../src/lib/calcoli/pianoInvestimento";

// Il piano dell'investimento (07/11/2026): le regole pure. I divieti
// (IVA, stati, collegamenti, solo il titolare) vivono nel database e li
// prova la verifica della migrazione 20261107000001.

describe("i gruppi", () => {
  it("sono i cinque del foglio di Alessio, da A a E", () => {
    expect(GRUPPI.map((g) => g.codice)).toEqual(["A", "B", "C", "D", "E"]);
    expect(nomeGruppo("B")).toBe("Impianti");
  });
  it("una lettera sconosciuta si dice, non sparisce", () => {
    expect(nomeGruppo("Z")).toBe("Gruppo Z");
  });
});

describe("il netto", () => {
  it("al 22% come nel foglio: 15.000 → 12.295,08", () => {
    expect(nettoDi(15000, 22)).toBe(12295.08);
  });
  it("senza IVA (affitto, bolli) il netto è l'importo", () => {
    expect(nettoDi(1500, 0)).toBe(1500);
  });
  it("arrotonda come il database anche sui mezzi centesimi: 4,81 al 4% → 4,63", () => {
    expect(nettoDi(4.81, 4)).toBe(4.63);
    expect(nettoDi(0.13, 4)).toBe(0.13);
  });
});

describe("il ✓", () => {
  it("acconto e rate che fanno il totale: quadra", () => {
    const r = quadra({ importo_ivato: 16000 }, [{ importo: 8000 }, { importo: 2000 }, { importo: 3000 }, { importo: 3000 }]);
    expect(r).toEqual({ quadra: true, distribuito: 16000, mancano: 0 });
  });
  it("niente centesimi inventati: 0,10 + 0,20 fanno 0,30", () => {
    expect(quadra({ importo_ivato: 0.3 }, [{ importo: 0.1 }, { importo: 0.2 }]).quadra).toBe(true);
  });
  it("mancano 500 €: dice quanti", () => {
    expect(quadra({ importo_ivato: 2000 }, [{ importo: 1000 }, { importo: 500 }])).toEqual({ quadra: false, distribuito: 1500, mancano: 500 });
  });
  it("rate oltre il totale: mancano negativo", () => {
    expect(quadra({ importo_ivato: 100 }, [{ importo: 150 }]).mancano).toBe(-50);
  });
  it("nessuna rata: non quadra (a meno che la voce valga zero)", () => {
    expect(quadra({ importo_ivato: 100 }, []).quadra).toBe(false);
    expect(quadra({ importo_ivato: 0 }, []).quadra).toBe(true);
  });
});

describe("il mese di una rata, con l'apertura ad aprile 2027", () => {
  it("mese 0 è l'acconto, entro marzo 2027", () => {
    expect(meseDellaRata("2027-04-01", 0)).toEqual({ anno: 2027, mese: 3, etichetta: "Acconto (entro marzo 2027)", acconto: true });
  });
  it("mese 1 è aprile 2027, mese 7 è ottobre 2027", () => {
    expect(meseDellaRata("2027-04-01", 1).etichetta).toBe("Aprile 2027");
    expect(meseDellaRata("2027-04-01", 7).etichetta).toBe("Ottobre 2027");
  });
  it("se l'apertura slitta a giugno, tutto si sposta", () => {
    expect(meseDellaRata("2027-06-01", 0).etichetta).toBe("Acconto (entro maggio 2027)");
    expect(meseDellaRata("2027-06-01", 1).etichetta).toBe("Giugno 2027");
  });
  it("attraversa l'anno", () => {
    expect(meseDellaRata("2027-11-01", 3).etichetta).toBe("Gennaio 2028");
    expect(meseDellaRata("2027-01-01", 0).etichetta).toBe("Acconto (entro dicembre 2026)");
  });
  it("una data o un mese sbagliati si rifiutano", () => {
    expect(() => meseDellaRata("", 1)).toThrow();
    expect(() => meseDellaRata("2027-13-01", 1)).toThrow();
    expect(() => meseDellaRata("2027-04-01", -1)).toThrow();
    expect(() => meseDellaRata("2027-04-01", 13)).toThrow();
    expect(() => meseDellaRata("2027-04-01", 1.5)).toThrow();
  });
});

describe("l'esito di una voce, IVA inclusa", () => {
  it("speso sopra il previsto: sforato, di quanto", () => {
    expect(esitoVoce({ previsto: 1000, speso: 1200 })).toEqual({ esito: "sforato", differenza: 200 });
  });
  it("con le fatture da pagare supera: a rischio", () => {
    expect(esitoVoce({ previsto: 1000, speso: 800, impegnato: 300 })).toEqual({ esito: "a_rischio", differenza: 100 });
  });
  it("confermata, tutto pagato, sotto: risparmio", () => {
    expect(esitoVoce({ previsto: 1000, speso: 900, confermata: true, tuttoPagato: true })).toEqual({ esito: "risparmio", differenza: 100 });
  });
  it("sotto ma non ancora tutto pagato: in linea, non risparmio", () => {
    expect(esitoVoce({ previsto: 1000, speso: 900, confermata: true }).esito).toBe("in_linea");
  });
  it("speso uguale al previsto: in linea", () => {
    expect(esitoVoce({ previsto: 1000, speso: 1000 }).esito).toBe("in_linea");
  });
  it("speso più impegnato esattamente uguale al previsto: in linea, non a rischio", () => {
    expect(esitoVoce({ previsto: 1000, speso: 600, impegnato: 400 }).esito).toBe("in_linea");
  });
});

describe("i totali del piano", () => {
  const voci = [
    { id: 1, gruppo: "A", importo_ivato: 15000, speso: 16000 },
    { id: 2, gruppo: "A", importo_ivato: 2000, speso: 500 },
    { id: 3, gruppo: "B", importo_ivato: 16000, speso: 0, impegnato: 8000 },
    { id: 4, gruppo: "D", importo_ivato: 999, archiviata_il: "2026-11-07" },
  ];
  it("un risparmio non nasconde uno sforamento", () => {
    const t = totaliDelPiano(voci).perGruppo.A;
    expect(t.differenza).toBe(-500);
    expect(t.sforamenti).toBe(1000);
  });
  it("le voci archiviate non contano", () => {
    const t = totaliDelPiano(voci);
    expect(t.totale.previsto).toBe(33000);
    expect(t.totale.voci).toBe(3);
    expect(t.perGruppo.D.previsto).toBe(0);
  });
  it("una voce di un gruppo sconosciuto entra nel totale, sotto il suo gruppo", () => {
    const t = totaliDelPiano([{ id: 9, gruppo: "Z", importo_ivato: 10 }]);
    expect(t.perGruppo.Z.previsto).toBe(10);
    expect(t.totale.previsto).toBe(10);
  });
  it("i gruppi senza voci ci sono lo stesso, a zero", () => {
    expect(totaliDelPiano([]).perGruppo.E).toEqual({ previsto: 0, speso: 0, impegnato: 0, sforamenti: 0, differenza: 0, voci: 0 });
  });
});

describe("il fabbisogno mese per mese", () => {
  it("somma le rate per mese, salta le voci archiviate, riempie i mesi vuoti", () => {
    const voci = [{ id: "a" }, { id: "b" }, { id: "c", archiviata_il: "x" }];
    const rate = [
      { voce_id: "a", mese_rel: 0, importo: 1000 },
      { voce_id: "b", mese_rel: 0, importo: 500 },
      { voce_id: "a", mese_rel: 2, importo: 500 },
      { voce_id: "c", mese_rel: 1, importo: 9999 },
    ];
    expect(fabbisognoPerMese("2027-04-01", voci, rate)).toEqual([
      { mese_rel: 0, etichetta: "Acconto (entro marzo 2027)", importo: 1500 },
      { mese_rel: 1, etichetta: "Aprile 2027", importo: 0 },
      { mese_rel: 2, etichetta: "Maggio 2027", importo: 500 },
    ]);
  });
});
