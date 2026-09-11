import { describe, expect, it } from "vitest";
import { fraseNonVuolDire } from "../../src/lib/calcoli/letture";

// LA FRASE DOPO «NON RIESCO A LEGGERE …» — 11/09/2026.
// 🔴 COSA TIENE FERMO: un pezzo di frase passato da una schermata non esce
//    più da solo a schermo («che questo documento non abbia una sezione»),
//    una frase intera resta com'è, e senza frase vale quella predefinita.

describe("fraseNonVuolDire", () => {
  it("🔴 il pezzo che comincia con «che» diventa una frase intera", () => {
    expect(fraseNonVuolDire("che questo documento non abbia una sezione")).toBe(
      "Non vuol dire che questo documento non abbia una sezione: vuol dire che non lo so.",
    );
    expect(fraseNonVuolDire("che non ce ne siano")).toBe(
      "Non vuol dire che non ce ne siano: vuol dire che non lo so.",
    );
  });

  it("una frase intera resta com'è", () => {
    const f = "Non vuol dire che è vuota: vuol dire che non lo so. Di solito è la connessione.";
    expect(fraseNonVuolDire(f)).toBe(f);
  });

  it("senza frase vale quella predefinita, anche con soli spazi", () => {
    expect(fraseNonVuolDire(undefined, "predefinita")).toBe("predefinita");
    expect(fraseNonVuolDire("   ", "predefinita")).toBe("predefinita");
    expect(fraseNonVuolDire(null)).toBeUndefined();
  });
});
