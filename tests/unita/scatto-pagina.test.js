import { describe, expect, it, vi } from "vitest";

// L'immagine della pagina per «Segnala» (28/10/2026): le misure. Il
// ridisegno vero lo fa il browser; qui si tiene fermo che l'immagine resti
// nitida ma dentro i tetti che l'iPhone sa disegnare.
vi.mock("modern-screenshot", () => ({ domToBlob: vi.fn() }));
const { scalaDelloScatto, misureDelloScatto, fuoriDallaFoto } = await import("../../src/lib/scattoPagina.js");

describe("le misure dell'immagine della pagina", () => {
  it("un telefono: nitida come lo schermo, fino a 2", () => {
    expect(scalaDelloScatto(390, 1500, 3)).toBe(2);
    expect(scalaDelloScatto(390, 1500, 1)).toBe(1);
  });

  it("un computer largo non supera i 1400 punti di larghezza", () => {
    expect(1920 * scalaDelloScatto(1920, 1080, 1)).toBeCloseTo(1400, 5);
  });

  it("🔴 una pagina lunga resta sotto gli 8 milioni di punti", () => {
    const s = scalaDelloScatto(390, 8000, 3);
    expect(390 * s * (8000 * s)).toBeLessThanOrEqual(8_000_000 + 1);
  });

  it("l'altezza si taglia a 8000 e lo dice", () => {
    expect(misureDelloScatto({ scrollWidth: 390, scrollHeight: 12000 })).toEqual({
      larghezza: 390,
      altezza: 8000,
      tagliata: true,
    });
    expect(misureDelloScatto({ scrollWidth: 390, scrollHeight: 900 }).tagliata).toBe(false);
  });

  it("il riquadro di «Segnala» resta fuori dall'immagine", () => {
    const elemento = (marcato) => ({ nodeType: 1, hasAttribute: (n) => marcato && n === "data-fuori-dalla-foto" });
    expect(fuoriDallaFoto(elemento(true))).toBe(false);
    expect(fuoriDallaFoto(elemento(false))).toBe(true);
    expect(fuoriDallaFoto({ nodeType: 3 })).toBe(true);
    const riservato = { nodeType: 1, hasAttribute: (n) => n === "data-riservato" };
    expect(fuoriDallaFoto(riservato)).toBe(false);
  });
});
