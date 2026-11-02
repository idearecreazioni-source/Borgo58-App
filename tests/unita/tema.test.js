import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHIAVE_TEMA, SCELTE_TEMA, leggiSceltaTema } from "../../src/lib/tema";

// IL TEMA CHIARO O SCURO (27/10/2026, restyling).

const memoria = (valore) => ({ getItem: (k) => (k === CHIAVE_TEMA ? valore : null) });

describe("la scelta del tema", () => {
  it("senza scelta, o con una scelta sconosciuta, resta il chiaro di sempre", () => {
    expect(leggiSceltaTema(memoria(null))).toBe("chiaro");
    expect(leggiSceltaTema(memoria("viola"))).toBe("chiaro");
    expect(leggiSceltaTema({ getItem: () => { throw new Error("bloccata"); } })).toBe("chiaro");
  });

  // 🔴 27/10/2026, sera, chiesto da Alessio: via «Come il telefono».
  it("🔴 le scelte sono due, Chiaro e Scuro", () => {
    expect(SCELTE_TEMA.map((s) => s.valore)).toEqual(["chiaro", "scuro"]);
    expect(leggiSceltaTema(memoria("scuro"))).toBe("scuro");
  });

  it("public/tema.js usa la stessa chiave, e chi aveva «auto» tiene quello che vedeva", () => {
    const prima = readFileSync("public/tema.js", "utf8");
    expect(prima).toContain(`"${CHIAVE_TEMA}"`);
    expect(prima).toContain('s === "auto"');
    expect(prima).toContain("(prefers-color-scheme: dark)");
    expect(prima).toContain('localStorage.setItem("b58-tema", s)');
  });

  it("index.html carica public/tema.js prima del gestionale, e non come modulo", () => {
    const html = readFileSync("index.html", "utf8");
    const tema = html.indexOf('<script src="/tema.js"></script>');
    expect(tema).toBeGreaterThan(-1);
    expect(tema).toBeLessThan(html.indexOf('type="module"'));
  });

  it("il tema scuro vale solo a schermo: la carta esce chiara", () => {
    const css = readFileSync("src/index.css", "utf8").replace(/\r\n/g, "\n");
    const scuro = css.indexOf(':root[data-tema="scuro"]');
    expect(scuro).toBeGreaterThan(-1);
    expect(css.lastIndexOf("@media screen {", scuro)).toBeGreaterThan(-1);
    expect(css.slice(css.lastIndexOf("@media", scuro), scuro)).toMatch(/^@media screen \{/);
  });
});
