import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAGINE_PUBBLICHE, pubblica } from "../../src/lib/calcoli/pubblico";

describe("le pagine pubbliche partono da sole", () => {
  it("riconosce le due pagine, anche con la barra finale", () => {
    expect(pubblica("/prenota")).toBe(true);
    expect(pubblica("/prenota/")).toBe(true);
    expect(pubblica("/privacy")).toBe(true);
  });

  it("il gestionale non è una pagina pubblica", () => {
    for (const p of ["/", "/dashboard", "/prenotazioni", "/prenota-altro", "", undefined]) {
      expect(pubblica(p)).toBe(false);
    }
  });

  it("🔴 l'elenco e le rotte di Pubblico.jsx dicono la stessa cosa", () => {
    const testo = readFileSync("src/Pubblico.jsx", "utf8");
    const rotte = [...testo.matchAll(/<Route path="(\/[a-z-]+)"/g)].map((m) => m[1]).sort();
    expect(rotte).toEqual([...PAGINE_PUBBLICHE].sort());
  });
});
