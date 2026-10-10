import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LA SALA SU SCHERMO LARGO — 21/09/2026, mandato «interfaccia operativa»
// =====================================================================
// 🔴 COSA SI PROVA: che le due colonne compaiano SOLO quando c'e' spazio, e
//    che sotto quella misura la schermata resti quella di prima. La regola
//    pura (`salaAffiancata`) ha le sue prove in `tests/unita`; qui si prova
//    che la schermata la CHIAMA davvero e che ci si appende il disegno.
//
// ⚠️ IN JSDOM NON C'E' IMPAGINAZIONE: ogni elemento misura zero e
//    `ResizeObserver` non esiste. Quindi si finge l'uno e l'altro — un
//    osservatore che chiama subito, e una larghezza decisa dalla prova. Non
//    si stanno misurando punti (quelli li misura un browser vero): si sta
//    provando che la schermata chieda la larghezza e ci appenda le colonne.

const finte = {
  pianta: vi.fn(),
  prenotazioni: vi.fn(),
};

vi.mock("../../src/lib/api/sala", () => ({
  getCopertiDelGiorno: vi.fn(() => Promise.resolve([])),
  getPiantaDelGiorno: (...a) => finte.pianta(...a),
  getPercheChiuso: vi.fn(() => Promise.resolve(null)),
  getPostoPerLaSerata: vi.fn(() => Promise.resolve(null)),
  getRegolePrenotazione: vi.fn(() => Promise.resolve({ passo_prenotazioni_minuti: 15 })),
  getTurniDelGiorno: vi.fn(() => Promise.resolve([])),
  isSoldOut: vi.fn(() => Promise.resolve(false)),
  promuoviDisposizione: vi.fn(),
  rimuoviCorrezioneCoperti: vi.fn(),
  riportaSagomaAllaBase: vi.fn(),
  salvaCorrezioneCoperti: vi.fn(),
  salvaSagoma: vi.fn(),
  setSoldOut: vi.fn(),
}));
vi.mock("../../src/lib/api/reservations", () => ({
  annullaPrenotazione: vi.fn(),
  assegnaPrenotazione: vi.fn(),
  creaPrenotazioneSuTavoli: vi.fn(),
  listReservations: (...a) => finte.prenotazioni(...a),
  listTavoliPrenotatiPerData: vi.fn(() => Promise.resolve([])),
  togliAssegnazione: vi.fn(),
  updateReservation: vi.fn(),
}));
vi.mock("../../src/lib/api/orders", () => ({
  listContiPerPrenotazioni: vi.fn(() => Promise.resolve([])),
}));
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ isTitolare: true, isStaff: false }),
}));

const { default: PiantaGiornata } = await import("../../src/pages/calendario/PiantaGiornata");
const { ELENCO_PRENOTAZIONI_PX, SOGLIA_IN_PIEDI_CM_REALI, VUOTO_FRA_LE_COLONNE_PX } = await import(
  "../../src/lib/calcoli/sala"
);

const PXCM = 37.79528;
const LARGO = Math.ceil(SOGLIA_IN_PIEDI_CM_REALI * PXCM + ELENCO_PRENOTAZIONI_PX + VUOTO_FRA_LE_COLONNE_PX);

const TAVOLO = {
  id: "t1",
  label: "T1",
  tipo: "tavolo",
  forma: "rettangolo",
  x: 0,
  y: 0,
  larghezza: 180,
  profondita: 90,
  ruotato: false,
  zona: "sala_alta",
  attivo: true,
  spostata: false,
};

// La larghezza che la schermata misura: si sostituisce il getter di
// `clientWidth`, che in jsdom vale sempre zero.
let larghezzaFinta = 0;
let descrittoreOriginale;

function apparecchiaMisura(larghezza) {
  larghezzaFinta = larghezza;
  globalThis.ResizeObserver = class {
    constructor(fn) {
      this.fn = fn;
    }
    observe() {}
    disconnect() {}
  };
}

const mostra = () =>
  render(
    <MemoryRouter initialEntries={["/calendario-eventi/pianta"]}>
      <Routes>
        <Route path="/calendario-eventi/pianta" element={<PiantaGiornata />} />
      </Routes>
    </MemoryRouter>,
  );

const riquadro = () => document.querySelector("[data-colonne-sala]");

beforeEach(() => {
  descrittoreOriginale = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, "clientWidth");
  Object.defineProperty(window.HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => larghezzaFinta,
  });
  document.documentElement.style.setProperty("--pxcm", String(PXCM));
  finte.pianta.mockReset().mockResolvedValue([TAVOLO]);
  finte.prenotazioni.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  if (descrittoreOriginale) Object.defineProperty(window.HTMLElement.prototype, "clientWidth", descrittoreOriginale);
  delete globalThis.ResizeObserver;
  vi.clearAllMocks();
});

describe("🔴 la schermata della sala", () => {
  it("si apre e mostra la sala e le prenotazioni", async () => {
    apparecchiaMisura(0);
    mostra();
    await waitFor(() => expect(screen.getByText("Prenotazioni del giorno")).toBeTruthy());
    expect(screen.getByRole("heading", { name: "La sala" })).toBeTruthy();
  });

  it("🔴 su uno schermo stretto resta in colonna, com'era", async () => {
    // 358 punti: l'iPhone di Alessio meno i margini della pagina.
    apparecchiaMisura(358);
    mostra();
    await waitFor(() => expect(riquadro()).toBeTruthy());
    expect(riquadro().className).not.toMatch(/\bgrid\b/);
    expect(riquadro().getAttribute("style")).toBeNull();
  });

  it("🔴 su uno schermo largo la sala e l'elenco si affiancano", async () => {
    apparecchiaMisura(LARGO);
    mostra();
    await waitFor(() => expect(riquadro()?.className).toMatch(/\bgrid\b/));
    const stile = riquadro().getAttribute("style");
    // La colonna di destra e' larga quanto dichiarato, non «a occhio».
    expect(stile).toMatch(new RegExp(`${ELENCO_PRENOTAZIONI_PX}px`));
    expect(stile).toMatch(new RegExp(`${VUOTO_FRA_LE_COLONNE_PX}px`));
  });

  it("⚠️ un punto sotto la misura le colonne non compaiono", async () => {
    apparecchiaMisura(LARGO - 2);
    mostra();
    await waitFor(() => expect(riquadro()).toBeTruthy());
    expect(riquadro().className).not.toMatch(/\bgrid\b/);
  });

  it("🔴 affiancato, l'elenco scorre dentro di se' invece di allungare la colonna", async () => {
    apparecchiaMisura(LARGO);
    mostra();
    await waitFor(() => expect(riquadro()?.className).toMatch(/\bgrid\b/));
    const elenco = document.querySelector("[data-colonna-prenotazioni]");
    expect(elenco.className).toMatch(/overflow-y-auto/);
    expect(elenco.className).toMatch(/sticky/);
    expect(elenco.getAttribute("style")).toMatch(/max-height/i);
  });

  it("⚠️ in colonna l'elenco NON si accorcia: li' non c'e' niente accanto da guardare", async () => {
    apparecchiaMisura(358);
    mostra();
    await waitFor(() => expect(riquadro()).toBeTruthy());
    const elenco = document.querySelector("[data-colonna-prenotazioni]");
    expect(elenco.className).not.toMatch(/overflow-y-auto/);
    expect(elenco.getAttribute("style")).toBeNull();
  });
});

describe("🔴 il «?» della sala", () => {
  it("si apre e dice se uno spostamento vale per oggi o per sempre", async () => {
    apparecchiaMisura(0);
    mostra();
    const q = await waitFor(() => screen.getByRole("button", { name: "Per oggi o per sempre" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
    await act(async () => {
      q.click();
    });
    expect(screen.getByRole("tooltip").textContent).toMatch(/disposizione di partenza/);
  });
});
