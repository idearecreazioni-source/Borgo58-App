import { describe, expect, it } from "vitest";
import { controllaNumeri } from "../../src/lib/memo/controllaNumeri";

describe("controllaNumeri", () => {
  it("accetta importi letti e le date", () => {
    expect(controllaNumeri("Hai speso 1.250,50 € il 2026-11-14.", [{ totale: 1250.5 }]).verificato).toBe(true);
  });

  it("non fa passare una stima inventata", () => {
    const esito = controllaNumeri("Sono circa 300 €.", [{ totale: 250 }]);
    expect(esito.verificato).toBe(false);
    expect(esito.avviso).toContain("Controllalo");
  });
});
