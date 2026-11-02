import { describe, it, expect } from "vitest";
import { eGiaRegistrata } from "../../src/lib/calcoli/fatturaPA";

describe("eGiaRegistrata", () => {
  it("riconosce il rifiuto per file già caricato", () => {
    expect(eGiaRegistrata("Questa fattura elettronica e' gia' stata registrata (n. 12 del 01/10/2026).")).toBe(true);
  });
  it("riconosce il rifiuto per stesso numero e data", () => {
    expect(eGiaRegistrata("La fattura n. 5 del 02/10/2026 di questo fornitore e' gia' registrata (Rossi, forse a mano).")).toBe(true);
  });
  it("riconosce anche le lettere accentate", () => {
    expect(eGiaRegistrata("È già registrata")).toBe(true);
  });
  it("non scambia altri errori", () => {
    expect(eGiaRegistrata("Alla fattura mancano il numero o la data.")).toBe(false);
    expect(eGiaRegistrata(undefined)).toBe(false);
    expect(eGiaRegistrata(null)).toBe(false);
  });
});
