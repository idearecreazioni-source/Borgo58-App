import { describe, expect, it } from "vitest";
import { CAUSALE_ALTRO, omaggiAListino, percentualeOmaggi } from "../../src/lib/calcoli/omaggi";

// La percentuale degli omaggi in Cassa (23/08/2026):
//     omaggi «Altro» ÷ (incassato + omaggi a listino)
// «90 € incassati e 10 € di omaggi danno 10%» — parole di Alessio, ed è il
// primo caso qui sotto, scritto coi suoi numeri.

const riga = (type, causale, importo) => ({
  type,
  full_amount: importo,
  causale: causale ? { label: causale } : null,
});

describe("quanta della roba servita è stata regalata", () => {
  it("il caso di Alessio: 90 incassati e 10 di omaggi fanno il 10%", () => {
    expect(percentualeOmaggi({ omaggiAltro: 10, omaggiTotali: 10, incassato: 90 })).toBe(10);
  });

  it("il denominatore è la roba servita, non l'incasso", () => {
    // ⚠️ La prova che discrimina: dividendo per il solo incassato
    // uscirebbe 11,1%, non 10. Se qualcuno «semplificasse» la formula,
    // questa diventa rossa.
    const conRegola = percentualeOmaggi({ omaggiAltro: 10, omaggiTotali: 10, incassato: 90 });
    expect(conRegola).not.toBeCloseTo(10 / 90 * 100, 5);
  });

  it("gli omaggi con un'altra causale stanno solo al denominatore", () => {
    // 50 di «Altro» e 50 di cortesia su 900 incassati: si è regalato 100,
    // ma in evidenza va il 5% che riguarda «Altro».
    expect(
      percentualeOmaggi({ omaggiAltro: 50, omaggiTotali: 100, incassato: 900 })
    ).toBe(5);
  });

  it("niente di servito non fa zero per cento: fa «non lo so»", () => {
    // Zero servito e zero regalato non è «non abbiamo regalato niente».
    expect(percentualeOmaggi({ omaggiAltro: 0, omaggiTotali: 0, incassato: 0 })).toBeNull();
  });

  it("un mese servito senza regalare niente fa zero per cento, e si dice", () => {
    expect(percentualeOmaggi({ omaggiAltro: 0, omaggiTotali: 0, incassato: 900 })).toBe(0);
  });

  it("una serata tutta in omaggio fa cento per cento, non piu'", () => {
    expect(percentualeOmaggi({ omaggiAltro: 200, omaggiTotali: 200, incassato: 0 })).toBe(100);
  });
});

describe("il valore a listino degli omaggi", () => {
  const righe = [
    riga("omaggio", "Altro", 30),
    riga("omaggio", "altro", 20), // stessa causale scritta diversamente
    riga("omaggio", "Cortesia", 50),
    riga("omaggio", null, 7), // senza causale: entra nel totale, non in «Altro»
    riga("sconto", "Altro", 1000), // gli sconti non sono omaggi
  ];

  it("filtra per causale senza badare alle maiuscole", () => {
    expect(omaggiAListino(righe, CAUSALE_ALTRO)).toBe(50);
  });

  it("senza filtro somma tutti gli omaggi, sconti esclusi", () => {
    expect(omaggiAListino(righe)).toBe(107);
  });

  it("un elenco vuoto fa zero, non esplode", () => {
    expect(omaggiAListino([], CAUSALE_ALTRO)).toBe(0);
    expect(omaggiAListino(null)).toBe(0);
  });
});
