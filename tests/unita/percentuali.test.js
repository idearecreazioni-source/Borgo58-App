import { describe, expect, it } from "vitest";
import { inFrazione, inPunti } from "../../src/lib/calcoli/percentuali.js";

// La conversione fra i punti che si scrivono e la frazione che si salva.
// ⚠️ Nasce il 24/08 dal caso `commissione_pos_percento`, che esisteva in
// due tabelle con due unita' diverse: queste prove congelano la regola in
// modo che le due schermate non possano piu' separarsi.

describe("dai punti alla frazione", () => {
  it("porta la commissione della banca dove il database la vuole", () => {
    expect(inFrazione(1.5)).toBe(0.015);
    expect(inFrazione("1.5")).toBe(0.015);
    expect(inFrazione(25)).toBe(0.25);
  });

  it("lo zero è una risposta, il vuoto no", () => {
    // ⚠️ È la distinzione che il progetto tiene ferma dal 15/08: «non pago
    // commissione» e «non l'ho ancora deciso» sono due cose diverse, e un
    // vuoto trasformato in zero risponde al posto di chi non ha risposto.
    expect(inFrazione(0)).toBe(0);
    expect(inFrazione("")).toBeNull();
    expect(inFrazione(null)).toBeNull();
    expect(inFrazione(undefined)).toBeNull();
  });

  it("una cosa che non è un numero non diventa zero", () => {
    expect(inFrazione("boh")).toBeNull();
  });
});

describe("dalla frazione ai punti", () => {
  it("rimette il numero come lo dice la banca", () => {
    expect(inPunti(0.015)).toBe("1.5");
    expect(inPunti(0.25)).toBe("25");
    expect(inPunti(0)).toBe("0");
  });

  it("non lascia trapelare la virgola mobile", () => {
    // ⚠️ Senza l'arrotondamento, 0,0125 tornerebbe «1.2500000000000002» —
    // e finirebbe cosi' dentro un campo numerico.
    expect(inPunti(0.0125)).toBe("1.25");
    expect(inPunti(0.07)).toBe("7");
  });

  it("un valore mai impostato torna vuoto, non la parola «null»", () => {
    // `String(null)` da' «null», che nel campo diventa NaN alla scrittura
    // successiva: e' il difetto che `aTesto` gia' evitava altrove.
    expect(inPunti(null)).toBe("");
    expect(inPunti(undefined)).toBe("");
  });
});

describe("il giro d'andata e ritorno", () => {
  it("un numero scritto e riletto resta lo stesso", () => {
    // ⚠️ È la proprietà che conta davvero: chi digita 1,5 deve rileggere
    // 1,5. Se le due funzioni si separassero, il numero si sposterebbe di
    // cento volte a ogni salvataggio — piano, e senza nessun errore.
    for (const punti of ["0", "1.5", "3.9", "24", "25", "100"]) {
      expect(inPunti(inFrazione(punti))).toBe(punti);
    }
  });
});
