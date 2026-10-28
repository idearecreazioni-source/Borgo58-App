import { describe, expect, it } from "vitest";
import { escapeCell } from "../../src/lib/csv";

// UNA NOTA NON DIVENTA UNA FORMULA (notte del 28/10/2026).

describe("una cella del CSV", () => {
  it("🔴 un testo che comincia come una formula prende l'apostrofo", () => {
    expect(escapeCell("=SOMMA(A1:A9)")).toBe("'=SOMMA(A1:A9)");
    expect(escapeCell("+39 333 1234567")).toBe("'+39 333 1234567");
    expect(escapeCell("@fornitore")).toBe("'@fornitore");
    expect(escapeCell("- da rivedere")).toBe("'- da rivedere");
  });

  it("⚠️ un importo negativo resta un numero", () => {
    expect(escapeCell("-12.50")).toBe("-12.50");
    expect(escapeCell(-3)).toBe("-3");
  });

  it("virgolette, a capo e ritorno carrello vanno tra virgolette", () => {
    expect(escapeCell('detto "bene"')).toBe('"detto ""bene"""');
    expect(escapeCell("riga\runo")).toBe('"riga\runo"');
    expect(escapeCell("a,b")).toBe('"a,b"');
    expect(escapeCell(null)).toBe("");
  });
});
