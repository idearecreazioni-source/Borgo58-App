import { describe, expect, it } from "vitest";
import { propostaLeggibile } from "../../src/lib/calcoli/quantita";

// ⚠️ I due casi che vengono dai dati veri del progetto di prova, misurati
// il 29/08: l'amido di mais a 0,4218 kg e il basilico a 5,79 mazzo.
describe("il numero che si propone davanti allo scaffale", () => {
  it("chili e litri si fermano a due decimali", () => {
    expect(propostaLeggibile(0.4218, "kg")).toBe("0.42");
    expect(propostaLeggibile(2.7649, "l")).toBe("2.76");
  });

  it("e non lasciano zeri inutili in coda", () => {
    expect(propostaLeggibile(3, "kg")).toBe("3");
    expect(propostaLeggibile(3.1, "kg")).toBe("3.1");
  });

  it("pezzi e mazzi sono interi: un mezzo mazzo non esiste", () => {
    expect(propostaLeggibile(5.79, "mazzo")).toBe("6");
    expect(propostaLeggibile(14.4, "pz")).toBe("14");
  });

  // ⚠️ Sotto l'unita' si dice zero, ed e' la verita': «non ce n'e'
  // abbastanza per un pezzo intero». Il numero vero resta nel database.
  it("meno di un pezzo si propone come zero", () => {
    expect(propostaLeggibile(0.3, "pz")).toBe("0");
  });

  it("un numero che non e' un numero non diventa zero", () => {
    // Uno zero qui si leggerebbe «non ce n'e'»: meglio un campo vuoto.
    expect(propostaLeggibile(null, "kg")).toBe("");
    expect(propostaLeggibile("", "kg")).toBe("");
  });
});
