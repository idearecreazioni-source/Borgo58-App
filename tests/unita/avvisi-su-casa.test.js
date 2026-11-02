import { describe, expect, it } from "vitest";
import { senzaQuelliDiCasa } from "../../src/lib/api/avvisi";

// Su Casa i lavori pianificati sono spenti apposta: l'avviso della
// sorveglianza ferma sarebbe vero per sempre (01/11/2026).
describe("gli avvisi su Casa", () => {
  const avvisi = [{ chiave: "sorveglianza" }, { chiave: "quadratura" }];

  it("su Casa la sorveglianza ferma non compare", () => {
    expect(senzaQuelliDiCasa(avvisi, "casa")).toEqual([{ chiave: "quadratura" }]);
  });

  it("🔴 nel gestionale vero resta: lì vuol dire che nessuno guarda più", () => {
    expect(senzaQuelliDiCasa(avvisi, "produzione")).toEqual(avvisi);
    expect(senzaQuelliDiCasa(avvisi, "prova")).toEqual(avvisi);
    expect(senzaQuelliDiCasa(avvisi, undefined)).toEqual(avvisi);
  });
});
