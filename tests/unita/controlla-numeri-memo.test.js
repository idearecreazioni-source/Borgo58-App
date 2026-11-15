import { describe, expect, it } from "vitest";
import { controllaNumeri, numeriSenzaFonte } from "../../src/lib/memo/controllaNumeri";

describe("controllaNumeri", () => {
  it("accetta importi letti e le date", () => {
    expect(controllaNumeri("Hai speso 1.250,50 € il 2026-11-14.", [{ totale: 1250.5 }]).verificato).toBe(true);
  });

  it("non fa passare una stima inventata", () => {
    const esito = controllaNumeri("Sono circa 300 €.", [{ totale: 250 }]);
    expect(esito.verificato).toBe(false);
    expect(esito.avviso).toContain("Controllalo");
  });

  it("le date scritte per esteso e le ore non sono numeri inventati (era un falso allarme del 15/11)", () => {
    const esito = controllaNumeri("L'impegno del 30/08/2026 e quello del 16/09/2026 sono in ritardo, alle 22:15.", []);
    expect(esito.verificato).toBe(true);
  });

  it("i numeri della data di oggi dati al modello sono ammessi", () => {
    expect(controllaNumeri("Oggi è il 15 novembre 2026.", []).verificato).toBe(false);
    expect(numeriSenzaFonte("Oggi è il 15 novembre 2026.", [], [15, 11, 2026, 22, 15])).toEqual([]);
  });
});
