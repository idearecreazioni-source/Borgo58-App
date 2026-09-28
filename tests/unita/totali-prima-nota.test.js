// I totali del periodo della Prima nota — 27/09/2026, secondo batch visivo.
// Il saldo è la differenza dei due totali, e nient'altro: se la formula
// cambiasse, questa prova diventa rossa prima della schermata.
import { describe, expect, it } from "vitest";
import { totaliDelPeriodo } from "../../src/lib/calcoli/totaliPrimaNota.js";

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
