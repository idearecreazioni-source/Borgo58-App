import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

// =====================================================================
// L'AIUTO CONTESTUALE — 21/09/2026, mandato «interfaccia operativa»
// =====================================================================
// 🔴 PERCHE' UN «?» E NON UNA FRASE A SCHERMO. In due giorni d'agosto Alessio
//    ha tolto SETTE spiegazioni sempre visibili: non erano sbagliate, era
//    cambiato il destinatario — *una spiegazione che il lettore ha gia' in
//    testa e' ingombro, e l'ingombro su una schermata che si usa in servizio
//    si paga in secondi*. Il «?» e' la forma che il progetto ha accettato: la
//    spiegazione sta DENTRO il gesto, si apre solo se la si cerca, e non
//    occupa niente finche' nessuno la chiede.
//
// ⚠️ SI RIUSA `Didascalia`, il componente che esiste dal 13/08 ed e' gia' in
//    43 punti: un secondo modo di spiegare le cose sarebbe un secondo
//    comportamento da tenere allineato (mouse, dito, tastiera, Escape).

const finte = {
  corsie: vi.fn(() => Promise.resolve([])),
  fatti: vi.fn(() => Promise.resolve([])),
  mese: vi.fn(() => Promise.resolve([])),
  tra: vi.fn(() => Promise.resolve([])),
  dashboard: vi.fn(() => Promise.resolve([])),
};

vi.mock("../../src/lib/api/tasks", () => ({
  agendaCorsie: (...a) => finte.corsie(...a),
  agendaFatti: (...a) => finte.fatti(...a),
  listTasksForMonth: (...a) => finte.mese(...a),
  listTasksBetween: (...a) => finte.tra(...a),
  listDashboardTasks: (...a) => finte.dashboard(...a),
  completaTask: vi.fn(),
  riapriTask: vi.fn(),
  spostaTask: vi.fn(),
  stellaTask: vi.fn(),
  updateTask: vi.fn(),
}));
vi.mock("../../src/lib/api/reservations", () => ({
  listReservations: vi.fn(() => Promise.resolve([])),
  listRichiesteDaConfermare: vi.fn(() => Promise.resolve([])),
}));
vi.mock("../../src/lib/api/posta", () => ({ contaPostaInAttesa: vi.fn(() => Promise.resolve(0)) }));
vi.mock("../../src/lib/api/voce", () => ({
  quanteAspettano: vi.fn(() => Promise.resolve({ quante: 0, laPiuVecchia: 0 })),
  appuntiDaApprovare: vi.fn(() => Promise.resolve([])),
  approvaAppunto: vi.fn(),
  scartaAppunto: vi.fn(),
  scegliPerAzione: vi.fn(),
}));
vi.mock("../../src/lib/api/spesaSpicciola", () => ({
  listSpesaSpicciola: vi.fn(() => Promise.resolve([])),
}));
vi.mock("../../src/lib/api/avvisi", () => ({
  listAvvisi: vi.fn(() => Promise.resolve([])),
  rimandaAvviso: vi.fn(),
  riprendiAvviso: vi.fn(),
}));
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ isTitolare: true, isStaff: false }),
}));

const { default: AgendaList } = await import("../../src/pages/agenda/AgendaList");
const { default: Dashboard } = await import("../../src/pages/Dashboard");

const mostra = (nodo, inizio) =>
  render(
    <MemoryRouter initialEntries={[inizio]}>
      <Routes>
        <Route path={inizio} element={nodo} />
      </Routes>
    </MemoryRouter>,
  );

const tocca = async (el) => {
  await act(async () => {
    el.click();
  });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T10:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("🔴 l'Agenda: il «?» accanto alle tre viste", () => {
  it("c'e', ha un nome, e non occupa niente finche' nessuno lo tocca", async () => {
    mostra(<AgendaList />, "/agenda");
    const q = await waitFor(() => screen.getByRole("button", { name: "Cosa cambia fra le tre viste" }));
    // Chiuso: nessuna spiegazione a schermo.
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(q.getAttribute("aria-expanded")).toBe("false");
    // Il bersaglio e' quello del dito, non la grandezza del disegno.
    expect(q.className).toMatch(/\btocco-bottone\b/);
  });

  it("toccandolo si apre, e dice cosa cambia fra Lista, Settimana e Mese", async () => {
    mostra(<AgendaList />, "/agenda");
    const q = await waitFor(() => screen.getByRole("button", { name: "Cosa cambia fra le tre viste" }));
    await tocca(q);
    const spiega = screen.getByRole("tooltip");
    expect(spiega.textContent).toMatch(/urgenza/);
    expect(spiega.textContent).toMatch(/senza data/);
    expect(q.getAttribute("aria-expanded")).toBe("true");
    expect(q.getAttribute("aria-controls")).toBe(spiega.id);
  });

  it("⚠️ i tre pulsanti delle viste restano quelli, col loro stato", async () => {
    mostra(<AgendaList />, "/agenda");
    await waitFor(() => expect(screen.getByRole("button", { name: "Lista" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "Lista" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Settimana" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mese" })).toBeTruthy();
    // Il «?» non e' una quarta vista: non porta `data-vista`.
    const q = screen.getByRole("button", { name: "Cosa cambia fra le tre viste" });
    expect(q.hasAttribute("data-vista")).toBe(false);
    expect(document.querySelectorAll("[data-vista]")).toHaveLength(3);
  });
});

describe("🔴 la schermata iniziale: il «?» accanto alla data", () => {
  it("spiega perche' un riquadro un giorno c'e' e un altro no", async () => {
    mostra(<Dashboard />, "/dashboard");
    const q = await waitFor(() => screen.getByRole("button", { name: "Cosa vedi qui" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
    await tocca(q);
    const spiega = screen.getByRole("tooltip");
    expect(spiega.textContent).toMatch(/riquadri vuoti non si disegnano/);
    // ⚠️ Parla solo di cose visibili qui: il collegamento all'Agenda c'e'.
    expect(spiega.textContent).toMatch(/Agenda completa/);
    expect(screen.getByRole("link", { name: /Agenda completa/ })).toBeTruthy();
  });
});

// =====================================================================
// 🔴 SALA E COMANDE: si guarda il sorgente, e il limite e' dichiarato
// =====================================================================
// ⚠️ `PiantaGiornata` e `comande/Sala` non sono montate da nessuna prova di
//    questo strato: sono due schermate da 1775 e 2414 righe che leggono una
//    dozzina di moduli, e fingerli tutti per guardare un «?» costerebbe piu'
//    di quello che prova. Qui si controlla che il «?» ci sia e che sia QUELLO
//    (`Didascalia`, non una spiegazione inventata di nuovo); che si apra e si
//    chiuda lo provano i casi dell'Agenda e della schermata iniziale, perche'
//    il comportamento vive nel componente, non nella schermata.
describe("🔴 la Sala e le Comande hanno il loro «?»", () => {
  const CASI = [
    ["src/pages/calendario/PiantaGiornata.jsx", "Per oggi o per sempre", /disposizione di partenza/],
    ["src/pages/comande/Sala.jsx", "Dove portano", /Scontrini serve a segnalare/],
  ];
  for (const [file, etichetta, dentro] of CASI) {
    it(`${file}: «${etichetta}»`, () => {
      const t = readFileSync(file, "utf8");
      expect(t).toContain("components/Didascalia");
      expect(t).toContain(`<Didascalia etichetta="${etichetta}">`);
      expect(t).toMatch(dentro);
    });
  }

  it("⚠️ tutte e quattro le schermate del mandato ne hanno uno", () => {
    const file = [
      "src/pages/agenda/AgendaList.jsx",
      "src/pages/calendario/PiantaGiornata.jsx",
      "src/pages/comande/Sala.jsx",
      "src/pages/Dashboard.jsx",
    ];
    const senza = file.filter((f) => !readFileSync(f, "utf8").includes("<Didascalia"));
    expect(senza).toEqual([]);
  });
});
