import { describe, expect, it } from "vitest";
import {
  GRUPPI,
  esitoVoce,
  fabbisognoPerMese,
  importoNelCampo,
  leggiImporto,
  leggiRata,
  meseDellaRata,
  nettoDi,
  nomeDellaSpesa,
  nomeGruppo,
  quadra,
  spesoDelPiano,
  totaliDelPiano,
} from "../../src/lib/calcoli/pianoInvestimento";

describe("lo speso del piano (parte 5)", () => {
  const spesa = (fonte, id, importo, assegnato) => ({ fonte, id, data: "2026-10-02", tipo: "srls", importo, assegnato });
  const base = () => ({
    speso: [
      { voce_id: "a", speso: "60.10", impegnato: "300", collegate: 2 },
      { voce_id: "b", speso: "0.20", impegnato: "0", collegate: 1 },
    ],
    spese: [spesa("prima_nota", "m1", "60.30", "60.30"), spesa("anticipazione", "a1", "100", "0"), spesa("prima_nota", "m2", "50", "50")],
    costo: [
      { tipo: "srls", totale: "160.30" },
      { tipo: "tasca", totale: "50" },
      { tipo: "azienda_agricola", totale: "999" },
    ],
  });

  it("le spese da assegnare sono quelle con un resto, al centesimo", () => {
    const d = base();
    d.spese[2].assegnato = "49.99";
    d.speso[0].speso = "110.09";
    const r = spesoDelPiano(d);
    expect(r.daAssegnare.righe.map((s) => [s.id, s.resto])).toEqual([["a1", 100], ["m2", 0.01]]);
    expect(r.daAssegnare.totale).toBe(100.01);
  });

  it("il controllo torna quando righe, costo e speso combaciano (l'orto non conta)", () => {
    const d = base();
    d.speso[0].speso = "110.10";
    const r = spesoDelPiano(d);
    expect(r.controllo).toEqual({ torna: true, costo: 210.3, piano: 210.3 });
    expect(r.perVoce.get("a")).toEqual({ speso: 110.1, impegnato: 300, collegate: 2, scollegate: 0 });
  });

  it("se il costo del progetto dice un'altra cifra, il controllo non torna", () => {
    const d = base();
    d.speso[0].speso = "110.10";
    d.costo[0].totale = "170.30";
    expect(spesoDelPiano(d).controllo.torna).toBe(false);
  });

  it("se lo speso delle voci non è quello assegnato, il controllo non torna", () => {
    expect(spesoDelPiano(base()).controllo.torna).toBe(false);
  });

  it("una spesa assegnata oltre il suo importo non sparisce in silenzio", () => {
    const d = base();
    d.speso[0].speso = "110.10";
    d.spese[2].assegnato = "60";
    d.speso[1].speso = "10.20";
    expect(spesoDelPiano(d).controllo.torna).toBe(false);
  });

  it("niente spese: tutto a zero, e torna", () => {
    expect(spesoDelPiano({ speso: [], spese: [], costo: [] }).controllo).toEqual({ torna: true, costo: 0, piano: 0 });
  });

  it("il nome di una spesa: data, cosa, da dove, chi", () => {
    expect(nomeDellaSpesa({ fonte: "prima_nota", data: "2026-10-02", descrizione: "Acconto cappa", soggetto: "Borgo 58" })).toBe(
      "02/10/2026 · Acconto cappa · prima nota · Borgo 58"
    );
    expect(nomeDellaSpesa({ fonte: "anticipazione", data: "2026-10-05", descrizione: " ", causale: "Attrezzature" })).toBe(
      "05/10/2026 · Attrezzature · anticipo"
    );
    expect(nomeDellaSpesa({ fonte: "prima_nota" })).toBe("senza data · senza descrizione · prima nota");
  });
});

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

describe("gli importi scritti all'italiana", () => {
  it("«16.000» sono sedicimila, non sedici", () => {
    expect(leggiImporto("16.000")).toBe(16000);
    expect(leggiImporto("1.500,50")).toBe(1500.5);
    expect(leggiImporto("1.234.567,8")).toBe(1234567.8);
  });
  it("virgola o punto per i centesimi, € e spazi tollerati", () => {
    expect(leggiImporto("1500,5")).toBe(1500.5);
    expect(leggiImporto("1500.50")).toBe(1500.5);
    expect(leggiImporto(" € 2.000 ")).toBe(2000);
    expect(leggiImporto("0")).toBe(0);
  });
  it("quello che non si capisce è null, mai zero", () => {
    for (const t of ["", "abc", "1,2,3", "15.00.0", "-5", "1,234"]) expect(leggiImporto(t)).toBeNull();
  });
  it("nel campo si rimostra con la virgola", () => {
    expect(importoNelCampo(1500.5)).toBe("1500,50");
    expect(importoNelCampo(2000)).toBe("2000");
    expect(importoNelCampo(null)).toBe("");
  });
});

describe("le rate in percentuale del previsto (07/11)", () => {
  it("50% di 16.470 € sono 8.235 €", () => {
    expect(leggiRata("50%", 16470)).toEqual({ importo: 8235, percentuale: 50 });
    expect(leggiRata("15 %", 16470)).toEqual({ importo: 2470.5, percentuale: 15 });
    expect(leggiRata("12,5%", 1000)).toEqual({ importo: 125, percentuale: 12.5 });
  });
  it("arrotonda al centesimo", () => {
    expect(leggiRata("33%", 100.01).importo).toBe(33);
    expect(leggiRata("15%", 16470.03).importo).toBe(2470.5);
  });
  it("un importo resta un importo", () => {
    expect(leggiRata("2.000", 16470)).toEqual({ importo: 2000, percentuale: null });
  });
  it("i bordi: 0%, 100%, 50,5%, lo spazio", () => {
    expect(leggiRata("0%", 1000)).toEqual({ importo: 0, percentuale: 0 });
    expect(leggiRata("100%", 16470)).toEqual({ importo: 16470, percentuale: 100 });
    expect(leggiRata("50,5%", 1000)).toEqual({ importo: 505, percentuale: 50.5 });
    expect(leggiRata("50 %", 1000).importo).toBe(500);
    expect(leggiRata("2,05%", 1000).importo).toBe(20.5);
  });
  it("senza previsto, o sopra il 100%, una percentuale non vale", () => {
    expect(leggiRata("50%", null)).toBeNull();
    expect(leggiRata("50%", 0)).toBeNull();
    expect(leggiRata("50%", undefined)).toBeNull();
    expect(leggiRata("50%", NaN)).toBeNull();
    expect(leggiRata("100,5%", 1000)).toBeNull();
    expect(leggiRata("1.000%", 1000)).toBeNull();
    expect(leggiRata("€50%", 1000)).toBeNull();
    expect(leggiRata("120%", 1000)).toBeNull();
    expect(leggiRata("%", 1000)).toBeNull();
    expect(leggiRata("cinquanta%", 1000)).toBeNull();
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
