import { describe, expect, it } from "vitest";
import { cartaDaStampare } from "../../src/lib/calcoli/cartaVini";

// N19 (11/10/2026): come si stampa la carta dei vini.

describe("la carta dei vini stampata", () => {
  it("🔴 la stessa bottiglia al calice e in bottiglia è UNA riga con due prezzi", () => {
    const c = cartaDaStampare([
      {
        nome: "Bianchi",
        voci: [
          { name: "Grillo", producer: "Baglio", serving: "Calice", selling_price: 6, active: true },
          { name: "grillo ", producer: "baglio", serving: "Bottiglia", selling_price: 28, active: true },
          { name: "Catarratto", producer: null, serving: "Bottiglia", selling_price: 24, active: true },
        ],
      },
    ]);
    expect(c[0].righe).toEqual([
      { nome: "Grillo", produttore: "Baglio", formati: [{ formato: "Calice", prezzo: 6 }, { formato: "Bottiglia", prezzo: 28 }] },
      { nome: "Catarratto", produttore: null, formati: [{ formato: "Bottiglia", prezzo: 24 }] },
    ]);
  });

  it("stesso nome ma produttore diverso: due vini, due righe", () => {
    const c = cartaDaStampare([
      { nome: "Rossi", voci: [
        { name: "Nero d'Avola", producer: "A", serving: "Bottiglia", selling_price: 20, active: true },
        { name: "Nero d'Avola", producer: "B", serving: "Bottiglia", selling_price: 30, active: true },
      ] },
    ]);
    expect(c[0].righe).toHaveLength(2);
  });

  it("le voci fuori carta non si stampano, e una categoria vuota sparisce", () => {
    const c = cartaDaStampare([
      { nome: "Rosati", voci: [{ name: "X", serving: "Calice", selling_price: 5, active: false }] },
      { nome: "Rossi", voci: [{ name: "Y", serving: "Calice", selling_price: 7, active: true }] },
    ]);
    expect(c.map((x) => x.nome)).toEqual(["Rossi"]);
  });
});
