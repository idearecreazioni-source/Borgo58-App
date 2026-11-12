import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import PiantaSala from "../../src/components/PiantaSala";
import {
  DISEGNO_LARGHEZZA_CM,
  PILASTRO_FONDALE,
  SALA_PROFONDITA_CM,
  STANZA_IN_BASSO_FONDALE,
  SPESSORE_MURO_STANZA_CM,
  LINEA_STANZA_FONDALE,
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
// 🔴 DAL 12/11/2026 LA PIANTA È RITAGLIATA SULLA SALA (Alessio): il foglio
// si ferma al bancone, e del fondale restano pilastro, scala, contorno della
// sala e contorno della stanza in basso a sinistra. Niente zone colorate.

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

  it("il disegno è ritagliato sulla sala (1150 × 950), sdraiato e in piedi", () => {
    const sdraiata = render(<PiantaSala sagome={SALA_NUOVA} inPiedi={false} />);
    expect(sdraiata.container.querySelector("svg").getAttribute("viewBox")).toBe(
      `0 0 ${DISEGNO_LARGHEZZA_CM} ${SALA_PROFONDITA_CM}`
    );
    expect(DISEGNO_LARGHEZZA_CM).toBe(1150);
    sdraiata.unmount();
    const inPiedi = render(<PiantaSala sagome={SALA_NUOVA} inPiedi />);
    expect(inPiedi.container.querySelector("svg").getAttribute("viewBox")).toBe(
      `0 0 ${SALA_PROFONDITA_CM} ${DISEGNO_LARGHEZZA_CM}`
    );
    // il quarto di giro usa la stessa misura, altrimenti il disegno scivola
    expect(inPiedi.container.querySelector("g[transform]").getAttribute("transform")).toBe(
      `translate(0 ${DISEGNO_LARGHEZZA_CM}) rotate(-90)`
    );
  });

  it("del fondale restano solo pilastro, scala e stanza in basso — niente zone colorate", () => {
    const { container } = render(<PiantaSala sagome={SALA_NUOVA} inPiedi={false} />);
    // Un solo muro pieno, il pilastro fra T2 e T10, alle sue misure.
    const muri = [...container.querySelectorAll("[data-muro]")];
    expect(muri).toHaveLength(1);
    expect(muri[0].getAttribute("x")).toBe(String(PILASTRO_FONDALE.x));
    expect(muri[0].getAttribute("y")).toBe(String(PILASTRO_FONDALE.y));
    expect(muri[0].getAttribute("width")).toBe(String(PILASTRO_FONDALE.larghezza));
    expect(muri[0].getAttribute("height")).toBe(String(PILASTRO_FONDALE.profondita));
    // La scala: 8 gradini = 9 righe.
    expect(container.querySelectorAll("[data-gradino]")).toHaveLength(9);
    // La stanza in basso a sinistra è solo una linea, senza riempimento.
    const stanza = container.querySelector("[data-stanza]");
    expect(stanza.getAttribute("fill")).toBe("none");
    // 🔴 Dal 13/11 la linea sta DENTRO la stanza: il suo lato verso la sala
    // (centro + mezzo spessore) resta prima dello spigolo vero, 358 e 514,
    // così T7 appoggiato al muro non ci finisce sopra.
    const [, cx, cy] = stanza.getAttribute("d").match(/^M ([\d.]+) 0 V ([\d.]+) H 0$/);
    const mezzo = SPESSORE_MURO_STANZA_CM / 2;
    expect(Number(cx) + mezzo).toBeLessThan(STANZA_IN_BASSO_FONDALE.larghezza);
    expect(Number(cy) + mezzo).toBeLessThan(STANZA_IN_BASSO_FONDALE.profondita);
    // e coincide con la fascia che i tavoli disegnati non devono coprire
    expect(Number(cx) + mezzo).toBe(LINEA_STANZA_FONDALE.larghezza);
    expect(Number(cy) + mezzo).toBe(LINEA_STANZA_FONDALE.profondita);
    // Nessun rettangolo del fondale grande come una zona: le zone non si
    // disegnano più (prima ce n'era uno per zona, colorato).
    for (const z of ZONE_FONDALE) {
      const zona = [...container.querySelectorAll("rect")].find(
        (r) =>
          r.getAttribute("x") === String(z.x) &&
          r.getAttribute("y") === String(z.y) &&
          r.getAttribute("width") === String(z.larghezza) &&
          r.getAttribute("height") === String(z.profondita)
      );
      expect(zona, z.nome).toBeUndefined();
    }
  });

  it("un pannello fuori dal foglio non si disegna, uno dentro sì", () => {
    const { container, unmount } = render(
      <PiantaSala
        sagome={SALA_NUOVA}
        inPiedi
        pannelli={[
          { contenuto: <span>fuori</span>, riquadro: { x: 1350, y: 0, larghezza: 640, profondita: 950 } },
          { contenuto: <span>dentro</span>, riquadro: { x: 0, y: 0, larghezza: 360, profondita: 440 } },
        ]}
      />
    );
    expect(container.textContent).not.toContain("fuori");
    const dentro = container.querySelector(".pannello-pianta");
    expect(dentro.textContent).toBe("dentro");
    // in piedi la stanza in basso a sinistra sta in fondo al foglio: la
    // cima è (1150 - 360) / 1150 del disegno
    expect(dentro.style.top).toBe(`${((DISEGNO_LARGHEZZA_CM - 360) / DISEGNO_LARGHEZZA_CM) * 100}%`);
    expect(dentro.style.left).toBe("0%");
    unmount();
  });

  it("e sdraiata il riquadro si misura sul foglio ritagliato, non sulla sala intera", () => {
    const { container } = render(
      <PiantaSala
        sagome={SALA_NUOVA}
        inPiedi={false}
        pannelli={[{ contenuto: <span>dentro</span>, riquadro: { x: 0, y: 0, larghezza: 360, profondita: 440 } }]}
      />
    );
    const dentro = container.querySelector(".pannello-pianta");
    expect(dentro.style.left).toBe("0%");
    expect(dentro.style.top).toBe("0%");
    expect(dentro.style.width).toBe(`${(360 / DISEGNO_LARGHEZZA_CM) * 100}%`);
    expect(dentro.style.height).toBe(`${(440 / SALA_PROFONDITA_CM) * 100}%`);
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
