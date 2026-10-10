import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import Scorciatoia from "../../src/components/Scorciatoia";

// =====================================================================
// LE SCORCIATOIE — 21/09/2026, mandato «interfaccia operativa desktop/mobile»
// =====================================================================
// 🔴 IL DIFETTO CHIUSO: le file di porte fra schermate vicine erano scritte a
//    mano in quattro file, e tre di loro portavano lo stampo giusto mentre le
//    Comande — la schermata del SERVIZIO — ne avevano uno piu' piccolo, con
//    `tocco-campo` (la classe dei campi in cui si scrive) invece di
//    `tocco-bottone`. Nessuno l'avrebbe visto rileggendo: ogni riga, da sola,
//    e' plausibile.
//
// ⚠️ QUI SI PROVA LA STRUTTURA, NON I PUNTI: in queste prove non c'e' un
//    motore di stile, quindi si controlla che ci sia la classe che porta il
//    bersaglio — i millimetri li misura `npm run test:visive` in un browser.

const mostra = (nodo, inizio = "/cassa") =>
  render(<MemoryRouter initialEntries={[inizio]}>{nodo}</MemoryRouter>);

describe("🔴 lo stampo e' uno", () => {
  it("una porta porta il bersaglio del dito e i margini dichiarati", () => {
    mostra(<Scorciatoia to="/cassa/causali">Causali</Scorciatoia>);
    const a = screen.getByRole("link", { name: "Causali" });
    expect(a.className).toMatch(/\btocco-bottone\b/);
    expect(a.className).toMatch(/\bpx-4\b/);
    // 🔴 `tocco-campo` e' la classe dei campi: su una porta era il difetto.
    expect(a.className).not.toMatch(/tocco-campo/);
  });

  it("il gesto pieno di una fila si distingue, senza cambiare bersaglio", () => {
    mostra(
      <>
        <Scorciatoia to="/cassa/prima-nota" principale>
          Prima nota
        </Scorciatoia>
        <Scorciatoia to="/cassa/causali">Causali</Scorciatoia>
      </>,
    );
    const pieno = screen.getByRole("link", { name: "Prima nota" });
    const vuoto = screen.getByRole("link", { name: "Causali" });
    expect(pieno.className).toMatch(/bg-b58-terracotta/);
    expect(vuoto.className).not.toMatch(/bg-b58-terracotta/);
    // Il bersaglio e' lo stesso: cambia il colore, non la taglia.
    expect(pieno.className).toMatch(/\btocco-bottone\b/);
  });
});

describe("🔴 l'accessibilita': dove sei e cos'e' premuto", () => {
  it("la porta che punta alla schermata aperta lo dichiara", () => {
    mostra(
      <>
        <Scorciatoia to="/cassa/causali">Causali</Scorciatoia>
        <Scorciatoia to="/cassa/prestiti">Prestiti</Scorciatoia>
      </>,
      "/cassa/causali",
    );
    expect(screen.getByRole("link", { name: "Causali" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Prestiti" }).getAttribute("aria-current")).toBeNull();
  });

  it("⚠️ conta anche la coda dopo il «?»: «La mia tasca» e «Prima nota» vanno alla stessa pagina", () => {
    mostra(
      <>
        <Scorciatoia to="/cassa/prima-nota">Prima nota</Scorciatoia>
        <Scorciatoia to="/cassa/prima-nota?soggetto=tasca">La mia tasca</Scorciatoia>
      </>,
      "/cassa/prima-nota?soggetto=tasca",
    );
    expect(screen.getByRole("link", { name: "La mia tasca" }).getAttribute("aria-current")).toBe("page");
    // Senza il confronto della coda risulterebbero corrente tutte e due.
    expect(screen.getByRole("link", { name: "Prima nota" }).getAttribute("aria-current")).toBeNull();
  });

  it("un interruttore dice se e' premuto; una porta non e' un interruttore", () => {
    mostra(
      <>
        <Scorciatoia premuto={true}>Coperto</Scorciatoia>
        <Scorciatoia premuto={false}>Dimensione dei tocchi</Scorciatoia>
        <Scorciatoia to="/cassa/causali">Causali</Scorciatoia>
      </>,
    );
    expect(screen.getByRole("button", { name: "Coperto", pressed: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dimensione dei tocchi", pressed: false })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Causali" }).getAttribute("aria-pressed")).toBeNull();
  });

  it("un gesto senza stato non finge di essere un interruttore", () => {
    mostra(<Scorciatoia onClick={() => {}}>Impostazioni</Scorciatoia>);
    const b = screen.getByRole("button", { name: "Impostazioni" });
    expect(b.getAttribute("aria-pressed")).toBeNull();
    expect(b.getAttribute("type")).toBe("button");
  });
});

// =====================================================================
// 🔴 LA RETE CHE IMPEDISCE IL RITORNO
// =====================================================================
// ⚠️ Le prove qui sopra dicono che il componente e' giusto; non dicono che le
//    schermate lo usino. Senza questa rete, domani una porta nuova puo'
//    nascere con la classe copiata a mano e nessuno se ne accorge — che e'
//    come sono nate le quattro copie divergenti.
describe("🔴 le schermate passano dal componente, non da una classe copiata", () => {
  const FILE = [
    "src/pages/cassa/CassaHome.jsx",
    "src/pages/comande/Sala.jsx",
    "src/pages/comande/Bar.jsx",
    "src/pages/comande/Cucina.jsx",
  ];
  const VECCHIE = [
    'tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4"',
    'tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-3 py-2"',
  ];

  for (const f of FILE) {
    it(`${f} importa e usa Scorciatoia`, () => {
      const t = readFileSync(f, "utf8");
      expect(t).toContain("components/Scorciatoia");
      expect(t).toMatch(/<Scorciatoia\b/);
    });

    it(`${f} non contiene piu' lo stampo copiato a mano`, () => {
      const t = readFileSync(f, "utf8");
      for (const v of VECCHIE) expect(t.includes(v), `stampo copiato: ${v.slice(0, 40)}…`).toBe(false);
    });
  }

  it("🔴 nelle Comande gli interruttori del pannello hanno un bersaglio", () => {
    // Prima non avevano nessun `tocco-*`: erano alti quanto il testo, in una
    // schermata che si usa col dito durante il servizio.
    const t = readFileSync("src/pages/comande/Sala.jsx", "utf8");
    expect(t).toMatch(/<Scorciatoia tonda onClick=\{\(\) => setPanel\("coperto"\)\} premuto=/);
    expect(t).toMatch(/<Scorciatoia tonda onClick=\{\(\) => setPanel\("calibrazione"\)\} premuto=/);
    expect(t).not.toMatch(/testo-sala rounded-full px-3 py-1\.5 border/);
  });
});
