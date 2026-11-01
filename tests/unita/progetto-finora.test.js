import { describe, expect, it } from "vitest";
import { riepilogoProgetto, riquadroInQuartaPosizione } from "../../src/lib/calcoli/progettoFinora";
import { totaliDelProgetto } from "../../src/lib/calcoli/investimento";

const agg = [
  { tipo: "srls", soggetto: "Borgo 58", quante: 3, totale: 1000 },
  { tipo: "tasca", soggetto: "Tasca", quante: 1, totale: 200 },
  { tipo: "azienda_agricola", soggetto: "Orto", quante: 1, totale: 50 },
];
const righe = [
  { fonte: "prima_nota", tipo: "srls", importo: 340 },
  { fonte: "anticipazione", tipo: "srls", importo: 460 },
  { fonte: "anticipazione", tipo: "srls", importo: 1.22 },
  { fonte: "prima_nota", tipo: "tasca", importo: 200 },
  { fonte: "anticipazione", tipo: "azienda_agricola", importo: 50 },
];

describe("riepilogoProgetto", () => {
  it("il totale e' identico a quello della pagina «Quanto e' costato il progetto»", () => {
    expect(riepilogoProgetto(agg, righe).totale).toBe(totaliDelProgetto(agg).totale);
    expect(riepilogoProgetto(agg, righe).totale).toBe(1200);
  });
  it("somma solo gli anticipi dentro il totale (l'orto no)", () => {
    expect(riepilogoProgetto(agg, righe).anticipato).toBeCloseTo(461.22, 2);
  });
  it("niente anticipi: zero, non null", () => {
    const solo = [{ tipo: "srls", soggetto: "Borgo 58", quante: 1, totale: 340 }];
    expect(riepilogoProgetto(solo, [righe[0]]).anticipato).toBe(0);
  });
  it("dettaglio troncato: l'anticipato non si dichiara", () => {
    expect(riepilogoProgetto(agg, righe.slice(0, 2)).anticipato).toBeNull();
    expect(riepilogoProgetto(agg, righe.slice(0, 2)).totale).toBe(1200);
  });
  it("input nullo o vuoto non rompe", () => {
    expect(riepilogoProgetto(null, null)).toEqual({ totale: 0, anticipato: 0 });
    expect(riepilogoProgetto([], undefined)).toEqual({ totale: 0, anticipato: 0 });
  });
});

describe("riquadroInQuartaPosizione", () => {
  it("nessuno scontrino: il progetto", () => expect(riquadroInQuartaPosizione(false)).toBe("progetto"));
  it("primo scontrino emesso: tornano gli omaggi", () => expect(riquadroInQuartaPosizione(true)).toBe("omaggi"));
  it("non si sa: restano gli omaggi", () => {
    expect(riquadroInQuartaPosizione(null)).toBe("omaggi");
    expect(riquadroInQuartaPosizione(undefined)).toBe("omaggi");
  });
});
