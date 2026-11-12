import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import PiantaSala from "../../src/components/PiantaSala";
import {
  MURI_FONDALE,
  SALA_LARGHEZZA_CM,
  SALA_PROFONDITA_CM,
  USCITA_FONDALE,
  ZONE_FONDALE,
} from "../../src/lib/calcoli/sala";

// LA PIANTA NUOVA SULLO SCHERMO (12/11/2026).
//
// La pianta è cambiata: 12 tavoli (2 grandi 160×80, 10 piccoli 70×80), 3
// salottini, la Chef Table spenta, una sola sala. Le prove pure guardano i
// numeri; questa guarda che la schermata disegni quei numeri — i muri del
// file vero, il contorno aperto sull'uscita, le sagome — e che dei nomi
// «sala alta» e «sala bassa» non resti traccia a schermo.

const P = "piccolo";
const G = "grande";
const tavolo = (label, x, y, formato, ruotato = false) => ({
  id: label,
  label,
  tipo: "tavolo",
  forma: "rettangolo",
  zona: "sala",
  larghezza_cm: formato === G ? 160 : 80,
  profondita_cm: formato === G ? 80 : 70,
  spostabile: true,
  posti_fissi: null,
  formato_id: formato,
  x,
  y,
  ruotato,
});
const divano = (label, x) => ({
  id: label,
  label,
  tipo: "divano",
  forma: "rettangolo",
  zona: "divani",
  larghezza_cm: 220,
  profondita_cm: 200,
  spostabile: false,
  posti_fissi: 6,
  formato_id: null,
  x,
  y: 750,
  ruotato: false,
});

// La sala come la mette la migrazione 20261112000004.
const SALA_NUOVA = [
  tavolo("T1", 450, 0, G, true),
  tavolo("T2", 650, 270, G, true),
  tavolo("T3", 700, 0, P),
  tavolo("T4", 700, 70, P),
  tavolo("T5", 950, 0, P),
  tavolo("T6", 950, 70, P),
  tavolo("T7", 360, 340, P),
  tavolo("T8", 910, 240, P),
  tavolo("T9", 910, 310, P),
  tavolo("T10", 650, 520, P, true),
  tavolo("T11", 920, 500, P),
  tavolo("T12", 920, 570, P),
  divano("Divano 1", 300),
  divano("Divano 2", 520),
  divano("Divano 3", 740),
];

// jsdom non ha ResizeObserver: la pianta lo usa per misurarsi. Qui non
// serve che misuri niente, basta che esista.
beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe("la pianta nuova sullo schermo", () => {
  it("disegna le 15 sagome della sala nuova, con il loro nome", () => {
    const { container } = render(<PiantaSala sagome={SALA_NUOVA} inPiedi={false} />);
    const sagome = [...container.querySelectorAll("[data-sagoma]")];
    expect(sagome).toHaveLength(15);
    // Il nome è la scritta in grassetto di ogni sagoma: si confrontano i
    // nomi esatti, non un pezzo di testo ("T1" sta anche dentro "T10").
    const nomi = sagome.map((g) => g.querySelector('text[font-weight="600"]')?.textContent);
    expect(nomi.sort()).toEqual(SALA_NUOVA.map((s) => s.label).sort());
  });

  it("il disegno ha le misure della sala nuova, sdraiata e in piedi", () => {
    const sdraiata = render(<PiantaSala sagome={SALA_NUOVA} inPiedi={false} />);
    expect(sdraiata.container.querySelector("svg").getAttribute("viewBox")).toBe(
      `0 0 ${SALA_LARGHEZZA_CM} ${SALA_PROFONDITA_CM}`
    );
    sdraiata.unmount();
    const inPiedi = render(<PiantaSala sagome={SALA_NUOVA} inPiedi />);
    expect(inPiedi.container.querySelector("svg").getAttribute("viewBox")).toBe(
      `0 0 ${SALA_PROFONDITA_CM} ${SALA_LARGHEZZA_CM}`
    );
  });

  it("disegna i muri presi dal file vero", () => {
    const { container } = render(<PiantaSala sagome={SALA_NUOVA} inPiedi={false} />);
    // Tutti i muri, e tutte le righe della scala (8 gradini = 9 righe).
    expect(container.querySelectorAll("[data-muro]")).toHaveLength(MURI_FONDALE.length);
    expect(container.querySelectorAll("[data-gradino]")).toHaveLength(9);
    // Un rettangolo per ogni muro, alle sue misure: si cerca il muro di
    // spina centrale, che è quello che divide la sala in due ma non la
    // fa diventare due sale.
    const spina = MURI_FONDALE[1];
    const trovato = [...container.querySelectorAll("rect")].some(
      (r) =>
        r.getAttribute("x") === String(spina.x) &&
        r.getAttribute("y") === String(spina.y) &&
        r.getAttribute("width") === String(spina.larghezza) &&
        r.getAttribute("height") === String(spina.profondita)
    );
    expect(trovato).toBe(true);
  });

  it("il contorno della sala si apre dove c'è l'uscita", () => {
    const { container } = render(<PiantaSala sagome={SALA_NUOVA} inPiedi={false} />);
    const contorno = [...container.querySelectorAll("path")].find((p) =>
      (p.getAttribute("d") ?? "").startsWith(`M 0 ${USCITA_FONDALE.daY}`)
    );
    expect(contorno).toBeTruthy();
    // finisce all'altro capo del varco, senza richiudersi
    expect(contorno.getAttribute("d").trim().endsWith(`V ${USCITA_FONDALE.aY}`)).toBe(true);
  });

  it("una sola sala: i nomi delle zone non si scrivono, e «sala alta / bassa» non c'è più", () => {
    const { container } = render(<PiantaSala sagome={SALA_NUOVA} inPiedi={false} />);
    const testo = container.textContent.toLowerCase();
    expect(testo).not.toMatch(/sala (alta|bassa)/);
    for (const z of ZONE_FONDALE) expect(container.textContent).not.toContain(z.nome);
  });
});
