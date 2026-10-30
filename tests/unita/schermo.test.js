import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCELTE_SCHERMO, propostaSchermo, sceltaSalvata } from "../../src/lib/schermo.js";

// Lo schermo di questo apparecchio (29/10/2026, decisione di Alessio del 28/10).

describe("la prima volta lo propone il gestionale", () => {
  it("col mouse e uno schermo largo è un computer", () => {
    expect(propostaSchermo({ larghezza: 1280, puntatoreFine: true })).toBe("computer");
    expect(propostaSchermo({ larghezza: 1024, puntatoreFine: true })).toBe("computer");
  });
  it("col dito: sotto i 768 un telefono, sopra un tablet", () => {
    expect(propostaSchermo({ larghezza: 390, puntatoreFine: false })).toBe("telefono");
    expect(propostaSchermo({ larghezza: 768, puntatoreFine: false })).toBe("tablet");
    expect(propostaSchermo({ larghezza: 1366, puntatoreFine: false })).toBe("tablet");
  });
  it("un portatile stretto è un tablet, ma una finestra stretta su un monitor largo resta un computer", () => {
    expect(propostaSchermo({ larghezza: 900, puntatoreFine: true })).toBe("tablet");
    expect(propostaSchermo({ larghezza: 900, larghezzaSchermo: 1920, puntatoreFine: true })).toBe("computer");
  });
});

describe("la scelta salvata", () => {
  const memoria = (v) => ({ getItem: () => v });
  it("vale solo se è una delle quattro", () => {
    for (const s of SCELTE_SCHERMO) expect(sceltaSalvata(memoria(s.valore))).toBe(s.valore);
    expect(sceltaSalvata(memoria("televisore"))).toBeNull();
    expect(sceltaSalvata(memoria(null))).toBeNull();
  });
  it("una memoria che non si lascia leggere non rompe niente", () => {
    expect(sceltaSalvata({ getItem: () => { throw new Error("bloccata"); } })).toBeNull();
  });
});

describe("🔴 il telefono non legge niente del profilo nuovo", () => {
  const css = readFileSync("src/index.css", "utf8").replace(/\r\n/g, "\n");
  // Solo le regole, non i commenti che ne parlano.
  const regole = css.split("\n").filter((r) => /^\s*:root\[data-schermo/.test(r));

  it("ogni regola del profilo vale solo col computer, e solo a schermo", () => {
    expect(regole.length).toBeGreaterThan(0);
    for (const r of regole) expect(r, r).toContain('[data-schermo="computer"]');
    const prima = css.slice(0, css.indexOf(regole[0]));
    expect(prima.lastIndexOf("@media screen {"), "il profilo deve stare dentro @media screen").toBeGreaterThan(prima.lastIndexOf("}\n\n"));
  });
  it("le Comande restano fuori: il profilo vale dentro il gestionale e nel menu", () => {
    for (const r of regole) expect(r, r).toMatch(/main\.contenuto-ampio/);
  });
});
