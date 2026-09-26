import { describe, expect, it } from "vitest";
import { datiInChiaro, impegnoScelto, nonDistinguibili } from "../../src/lib/calcoli/appunti";

// =====================================================================
// QUELLO CHE LA SCHERMATA DICE DOPO UNA SCELTA — 09/09/2026
// =====================================================================
// 🔴 Due frasi, e tutte e due esistono per non dire il falso: «hai scelto
//    questo» solo dove qualcuno ha scelto davvero, e «non riesco a
//    distinguerli» dove due candidati si leggono uguali.

describe("l'impegno scelto col dito", () => {
  it("si legge, e col titolo di AGENDA", () => {
    expect(
      impegnoScelto({
        dati: { scelto_a_mano: true, titolo: "Andare dal commercialista", task_id: "t-1" },
      })
    ).toBe("Andare dal commercialista");
  });

  it("🔴 senza il segno della scelta NON si dice niente", () => {
    // È il caso a candidato unico: il gestionale ha trovato l'impegno da sé,
    // e nessuno ha scelto. Dire «hai scelto» lì sarebbe raccontare un gesto
    // che non c'è stato — e la #45 resta invariata proprio per questo.
    expect(impegnoScelto({ dati: { titolo: "Ordine delle verdure", task_id: "t-1" } })).toBeNull();
  });

  it("e nemmeno se il segno c'è ma il titolo no", () => {
    expect(impegnoScelto({ dati: { scelto_a_mano: true, titolo: "   " } })).toBeNull();
    expect(impegnoScelto({ dati: { scelto_a_mano: true } })).toBeNull();
  });

  it("un elemento vuoto non fa esplodere niente", () => {
    expect(impegnoScelto(null)).toBeNull();
    expect(impegnoScelto({})).toBeNull();
    expect(impegnoScelto({ dati: {} })).toBeNull();
  });

  it("⚠️ e il segno dev'essere proprio vero, non «qualcosa di vero»", () => {
    // Un `"si"` o un `1` arrivati da chissà dove non contano: la frase la
    // scrive il database, e la scrive booleana.
    expect(impegnoScelto({ dati: { scelto_a_mano: "si", titolo: "X" } })).toBeNull();
    expect(impegnoScelto({ dati: { scelto_a_mano: 1, titolo: "X" } })).toBeNull();
  });
});

describe("i candidati che non si distinguono", () => {
  it("si dichiarano", () => {
    expect(nonDistinguibili({ dati: { indistinguibili: true } })).toBe(true);
  });

  it("e negli altri casi non si dice niente", () => {
    expect(nonDistinguibili({ dati: {} })).toBe(false);
    expect(nonDistinguibili({ dati: { indistinguibili: false } })).toBe(false);
    expect(nonDistinguibili(null)).toBe(false);
  });
});

describe("🔴 nessuna delle due dichiarazioni è un dato da scrivere", () => {
  it("non compaiono fra i dati concreti", () => {
    // ⚠️ I dati concreti sono «cosa verrebbe scritto approvando». Queste due
    //    dicono COME ci si è arrivati: mostrarle lì farebbe credere a chi
    //    firma che sta autorizzando anche quelle.
    const chiaro = datiInChiaro({
      titolo: "Andare dal commercialista",
      scelto_a_mano: true,
      indistinguibili: true,
    });
    expect(chiaro).toContain("Andare dal commercialista");
    expect(chiaro.toLowerCase()).not.toContain("scelto_a_mano");
    expect(chiaro.toLowerCase()).not.toContain("indistinguibili");
  });

  it("...e un elemento fatto di sole dichiarazioni non ha niente da scrivere", () => {
    expect(datiInChiaro({ scelto_a_mano: true, indistinguibili: true })).toBe("");
  });
});
