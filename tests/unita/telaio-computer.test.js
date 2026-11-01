import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { percorsoComande } from "../../src/lib/schermo";

// 🔴 LA BARRA IN ALTO E IL MENU A CASSETTO COL PROFILO «COMPUTER» (31/10/2026,
// M14 del controllo finale). La prova visiva li misura su una copia nel banco
// (`tests/visive/schermate/main.jsx`), perché il banco non monta il Layout
// vero. Questa prova lega la copia all'originale: se il Layout perde la
// classe, la regola di index.css non lo raggiunge più e la prova visiva non
// se ne accorgerebbe.

const layout = readFileSync("src/components/Layout.jsx", "utf8");
const css = readFileSync("src/index.css", "utf8");

describe("barra in alto e menu a cassetto nel profilo «Computer»", () => {
  it("la barra in alto del Layout porta `telaio-del-gestionale`", () => {
    expect(layout).toMatch(/<header[\s\S]{0,80}className="telaio-del-gestionale lg:hidden/);
  });

  it("il pannello del menu a cassetto la porta anche lui", () => {
    expect(layout).toMatch(/className="telaio-del-gestionale w-72 h-full shadow-xl"/);
  });

  it("e la domanda che compare sotto la barra (MEMO acceso) anche", () => {
    expect(layout).toMatch(/className="telaio-del-gestionale lg:hidden print:hidden pt-3">{avviso}/);
  });

  it("ogni regola del profilo che copre la barra laterale copre anche loro", () => {
    const conAside = css.match(/:root\[data-schermo="computer"\] :is\([^)]*aside[^)]*\)/g) ?? [];
    expect(conAside.length).toBeGreaterThan(4);
    for (const r of conAside) expect(r).toContain(".telaio-del-gestionale");
  });
});

// 🔴 /comande/stampanti È UNA PAGINA D'UFFICIO (31/10/2026, M8 del controllo
// finale): sta sotto /comande/ ma si apre dal computer, quindi deve seguire il
// profilo «Computer». Le altre pagine delle Comande restano escluse.
describe("quali percorsi sono Comande di sala/cucina", () => {
  it("le pagine di sala e cucina restano escluse dal profilo", () => {
    expect(percorsoComande("/comande")).toBe(true);
    expect(percorsoComande("/comande/")).toBe(true);
    expect(percorsoComande("/comande/sala")).toBe(true);
    expect(percorsoComande("/comande/cucina/3")).toBe(true);
  });

  it("le stampanti sono d'ufficio, anche con la barra finale o un sotto-percorso", () => {
    expect(percorsoComande("/comande/stampanti")).toBe(false);
    expect(percorsoComande("/comande/stampanti/")).toBe(false);
    expect(percorsoComande("/comande/stampanti/3")).toBe(false);
  });

  it("un nome che solo comincia come «stampanti» non vale", () => {
    expect(percorsoComande("/comande/stampantiX")).toBe(true);
  });

  it("fuori dalle Comande non è mai Comande", () => {
    expect(percorsoComande("/")).toBe(false);
    expect(percorsoComande("/comandel")).toBe(false);
    expect(percorsoComande("/impostazioni")).toBe(false);
    expect(percorsoComande(undefined)).toBe(false);
  });

  it("il Layout usa questa funzione e non più il confronto a mano", () => {
    expect(layout).toMatch(/const isComande = percorsoComande\(pathname\)/);
    expect(layout).not.toMatch(/startsWith\("\/comande\/"\)/);
  });
});
