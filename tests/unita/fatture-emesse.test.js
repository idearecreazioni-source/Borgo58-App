import { describe, expect, it } from "vitest";
import {
  alCentesimo,
  datiSocietaMancanti,
  imponibileRiga,
  numeroFattura,
  totaliFattura,
} from "../../src/lib/calcoli/fattureEmesse";

// Le fatture ai clienti (13/11/2026). I casi sono quelli della verifica
// della migrazione 20261113000002: l'anteprima deve dire lo stesso totale
// che il database congela con «Emetti».

describe("i conti della fattura ai clienti", () => {
  it("lo stesso caso della migrazione: 4 × 25 al 10% + 100 al 22% = 232", () => {
    const t = totaliFattura([
      { quantita: 4, prezzo_unitario: 25, aliquota_iva: 10 },
      { quantita: 1, prezzo_unitario: 100, aliquota_iva: 22 },
    ]);
    expect(t.imponibile).toBe(200);
    expect(t.imposta).toBe(32);
    expect(t.totale).toBe(232);
    expect(t.riepilogo.map((g) => g.aliquota)).toEqual([22, 10]);
  });

  it("l'IVA si calcola sul totale dell'aliquota, non riga per riga", () => {
    // Tre righe da 0,15 al 10%: riga per riga sarebbe 3 × 0,02 = 0,06;
    // sul totale (0,45) è 0,05 — come fa il database.
    const righe = [1, 2, 3].map(() => ({ quantita: 1, prezzo_unitario: 0.15, aliquota_iva: 10 }));
    expect(totaliFattura(righe).imposta).toBe(0.05);
  });

  it("i casi a metà centesimo vanno come nel database (decimale esatto, metà lontano da zero)", () => {
    // In virgola mobile 1,5 × 1,15 = 1,7249999…: il database dice 1,73.
    expect(imponibileRiga({ quantita: 1.5, prezzo_unitario: 1.15 })).toBe(1.73);
    // 0,05 al 10% = 0,005 → 0,01; 0,15 al 22% = 0,033 → 0,03.
    expect(totaliFattura([{ prezzo_unitario: 0.05, aliquota_iva: 10 }]).imposta).toBe(0.01);
    expect(totaliFattura([{ prezzo_unitario: 0.15, aliquota_iva: 22 }]).imposta).toBe(0.03);
    // Uno sconto in negativo si arrotonda simmetrico.
    expect(imponibileRiga({ quantita: 1.5, prezzo_unitario: -1.15 })).toBe(-1.73);
  });

  it("ogni riga si arrotonda al centesimo prima di sommare", () => {
    expect(imponibileRiga({ quantita: 3, prezzo_unitario: 0.34 })).toBe(1.02);
    expect(alCentesimo(2.675)).toBe(2.68);
    expect(alCentesimo(-2.675)).toBe(-2.68);
  });

  it("una riga senza IVA porta la sua natura, e fa gruppo a parte", () => {
    const t = totaliFattura([
      { prezzo_unitario: 50, aliquota_iva: 0, natura: "N4" },
      { prezzo_unitario: 50, aliquota_iva: 10 },
    ]);
    expect(t.riepilogo).toEqual([
      { aliquota: 10, natura: null, imponibile: 50, imposta: 5 },
      { aliquota: 0, natura: "N4", imponibile: 50, imposta: 0 },
    ]);
    expect(t.totale).toBe(105);
  });

  it("il 10% è l'aliquota di partenza", () => {
    expect(totaliFattura([{ prezzo_unitario: 100 }]).imposta).toBe(10);
  });

  it("il numero si stampa «numero/anno», e una bozza non ne ha", () => {
    expect(numeroFattura({ numero: 1, anno: 2027 })).toBe("1/2027");
    expect(numeroFattura({ numero: null, anno: 2027 })).toBeNull();
  });

  it("dice quali dati della società mancano per emettere", () => {
    expect(datiSocietaMancanti({ legal_name: "Borgo 58 S.r.l.s." })).toEqual([
      "partita IVA",
      "indirizzo della sede",
      "CAP",
      "comune",
      "provincia",
    ]);
    expect(
      datiSocietaMancanti({
        legal_name: "Borgo 58 S.r.l.s.",
        vat_number: "01343950869",
        sede_indirizzo: "Via Prova 58",
        sede_cap: "84043",
        sede_comune: "Agropoli",
        sede_provincia: "SA",
      })
    ).toEqual([]);
  });
});
