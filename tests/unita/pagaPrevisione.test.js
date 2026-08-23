import { describe, expect, it } from "vitest";
import { allineaPaga, allineaTutte, righeDiscordi } from "../../src/lib/calcoli/pagaPrevisione";

// Le due caselle della paga tenute d'accordo dalle ore del giorno.
//
// ⚠️ Ogni prova qui misura una DIFFERENZA: i numeri sono scelti perche' la
// risposta giusta e quelle sbagliate non coincidano. Con 8 €/ora e 8 ore
// il prodotto fa 64 e la divisione fa 1 — invertendo le due operazioni la
// prova diventa rossa, che e' il punto.
describe("il netto all'ora e il netto al giorno", () => {
  it("scrivendo l'ora, la giornata segue", () => {
    const r = allineaPaga({ nettoOrario: "9.5", nettoGiorno: "" }, 8, "nettoOrario");
    expect(r.nettoGiorno).toBe("76");
    expect(r.ultimo).toBe("nettoOrario");
  });

  it("scrivendo la giornata, l'ora segue", () => {
    const r = allineaPaga({ nettoOrario: "", nettoGiorno: "76" }, 8, "nettoGiorno");
    expect(r.nettoOrario).toBe("9.5");
    expect(r.ultimo).toBe("nettoGiorno");
  });

  it("cambiando le ore comanda l'ultimo campo toccato — l'ora", () => {
    const r = allineaPaga({ nettoOrario: "9.5", nettoGiorno: "76", ultimo: "nettoOrario" }, 6, "ore");
    expect(r.nettoGiorno).toBe("57");
    expect(r.nettoOrario).toBe("9.5");
  });

  it("cambiando le ore comanda l'ultimo campo toccato — la giornata", () => {
    const r = allineaPaga({ nettoOrario: "9.5", nettoGiorno: "76", ultimo: "nettoGiorno" }, 5, "ore");
    expect(r.nettoOrario).toBe("15.2");
    expect(r.nettoGiorno).toBe("76");
  });

  it("senza memoria comanda l'ora, e lo dice", () => {
    const r = allineaPaga({ nettoOrario: "10", nettoGiorno: "80" }, 4, "ore");
    expect(r.nettoGiorno).toBe("40");
  });

  // ⚠️ Il caso che rompe l'aritmetica prima di ogni altro: zero ore.
  it("con zero ore non si inventa niente", () => {
    const r = allineaPaga({ nettoOrario: "10", nettoGiorno: "80" }, 0, "nettoOrario");
    expect(r.nettoGiorno).toBe("80");
  });

  it("un campo vuoto non diventa zero", () => {
    const r = allineaPaga({ nettoOrario: "", nettoGiorno: "" }, 8, "nettoOrario");
    expect(r.nettoGiorno).toBe("");
  });

  it("si arrotonda al centesimo, non oltre", () => {
    const r = allineaPaga({ nettoOrario: "", nettoGiorno: "100" }, 7, "nettoGiorno");
    expect(r.nettoOrario).toBe("14.29");
  });

  it("tutte le righe seguono le ore insieme", () => {
    const righe = allineaTutte(
      [
        { ruolo: "cucina", nettoOrario: "10", nettoGiorno: "80", ultimo: "nettoOrario" },
        { ruolo: "sala", nettoOrario: "8", nettoGiorno: "64", ultimo: "nettoGiorno" },
      ],
      10
    );
    expect(righe[0].nettoGiorno).toBe("100");
    expect(righe[1].nettoOrario).toBe("6.4");
  });
});

describe("le righe che si contraddicono", () => {
  it("le trova, e dice quali", () => {
    const righe = [
      { nettoOrario: "7", nettoGiorno: "30" },
      { nettoOrario: "10", nettoGiorno: "80" },
      { nettoOrario: "9", nettoGiorno: "72" },
    ];
    expect(righeDiscordi(righe, 8)).toEqual([0]);
  });

  it("l'arrotondamento non e' una contraddizione", () => {
    expect(righeDiscordi([{ nettoOrario: "14.29", nettoGiorno: "100" }], 7)).toEqual([]);
  });

  // ⚠️ PROPRIETA', non quantita': una previsione senza personale non ha
  // righe discordi, e questa prova deve restare verde — non rossa perche'
  // «non ce n'e' almeno una».
  it("nessuna riga, nessuna contraddizione", () => {
    expect(righeDiscordi([], 8)).toEqual([]);
    expect(righeDiscordi([{ nettoOrario: "10", nettoGiorno: "" }], 8)).toEqual([]);
  });
});
