// I totali del periodo della Prima nota — 27/09/2026, secondo batch visivo.
// Il saldo è la differenza dei due totali, e nient'altro: se la formula
// cambiasse, questa prova diventa rossa prima della schermata.
import { describe, expect, it } from "vitest";
import { entratiUscitiDelMese, totaliDelPeriodo } from "../../src/lib/calcoli/totaliPrimaNota.js";

const mov = (direction, amount) => ({ direction, amount });

describe("entrate, uscite e saldo del periodo", () => {
  it("somma le entrate e le uscite, e il saldo è la loro differenza", () => {
    // Gli stessi sei movimenti della prova visiva: 1.750,00 in entrata,
    // 3.030,85 in uscita.
    const t = totaliDelPeriodo([
      mov("uscita", 38.5),
      mov("entrata", 1250),
      mov("uscita", 12),
      mov("uscita", 2480.35),
      mov("entrata", 500),
      mov("uscita", 500),
    ]);
    expect(t.inc).toBeCloseTo(1750, 2);
    expect(t.out).toBeCloseTo(3030.85, 2);
    expect(t.saldo).toBeCloseTo(-1280.85, 2);
  });

  it("gli importi arrivano come testo dal database e si contano come numeri", () => {
    const t = totaliDelPeriodo([mov("entrata", "10.10"), mov("uscita", "0.10")]);
    expect(t.saldo).toBeCloseTo(10, 2);
  });

  it("senza movimenti è tutto zero, non vuoto", () => {
    expect(totaliDelPeriodo([])).toEqual({ inc: 0, out: 0, saldo: 0 });
  });

  it("il saldo è sempre entrate meno uscite, qualunque sia il segno", () => {
    for (const [e, u] of [[0, 5], [5, 0], [7.25, 7.25]]) {
      const t = totaliDelPeriodo([mov("entrata", e), mov("uscita", u)]);
      expect(t.saldo).toBeCloseTo(t.inc - t.out, 10);
    }
  });
});

// 🔴 «QUESTO MESE ENTRATI / USCITI» (revisione dell'11/11, punto 7): i
//    soldi che si spostano non sono né entrati né usciti.
describe("entrati e usciti del mese, nel riquadro della Cassa", () => {
  const conCausale = (direction, amount, di_sistema, label = "x") => ({
    direction,
    amount,
    causale: { id: label, label, di_sistema },
  });

  it("un versamento in banca non fa +800 e −800", () => {
    const t = entratiUscitiDelMese([
      conCausale("uscita", 800, true, "Versamento in banca"),
      conCausale("entrata", 800, true, "Versamento dalla cassa"),
      conCausale("uscita", 42.5, false, "Spesa al mercato"),
    ]);
    expect(t.inc).toBeCloseTo(0, 2);
    expect(t.out).toBeCloseTo(42.5, 2);
  });

  it("un prestito ricevuto e la sua restituzione non sono incassi né costi", () => {
    const t = entratiUscitiDelMese([
      conCausale("entrata", 8000, true, "Prestito ricevuto"),
      conCausale("uscita", 500, true, "Restituzione di prestito"),
      conCausale("entrata", "120.00", false, "Altro incasso"),
    ]);
    expect(t.inc).toBeCloseTo(120, 2);
    expect(t.out).toBeCloseTo(0, 2);
  });

  it("una riga senza causale si conta, come prima", () => {
    const t = entratiUscitiDelMese([{ direction: "uscita", amount: 7, causale: null }, mov("entrata", 3)]);
    expect(t.out).toBeCloseTo(7, 2);
    expect(t.inc).toBeCloseTo(3, 2);
  });

  it("la Prima nota invece somma tutto: è il registro", () => {
    const righe = [conCausale("uscita", 800, true), conCausale("uscita", 10, false)];
    expect(totaliDelPeriodo(righe).out).toBeCloseTo(810, 2);
    expect(entratiUscitiDelMese(righe).out).toBeCloseTo(10, 2);
  });

  it("senza movimenti fa zero, anche se l'elenco manca", () => {
    expect(entratiUscitiDelMese([])).toEqual({ inc: 0, out: 0, saldo: 0 });
    expect(entratiUscitiDelMese(undefined)).toEqual({ inc: 0, out: 0, saldo: 0 });
  });
});
