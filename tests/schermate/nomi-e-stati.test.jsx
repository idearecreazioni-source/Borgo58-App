import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// =====================================================================
// I NOMI DEI GESTI — secondo giro visivo, 26/09/2026
// =====================================================================
// 🔴 Il censimento ha trovato gesti che si vedevano e non si sentivano:
//    la spunta «fatto» dell'Agenda senza nome (il `title` stava
//    sull'etichetta), le «✕» di Causali che si chiamavano «✕», e nella
//    Dashboard la categoria di un impegno scritta col codice del database
//    («fisco_scadenze»). Queste prove chiedono i gesti PER NOME, come li
//    cerca un lettore di schermo: se il nome sparisce, non li trovano.
//
// ⚠️ Le MISURE (bersagli, righe che vanno a capo) non si possono provare
//    qui: jsdom non impagina. Stanno in `scripts/prova-visiva-schermate.mjs`
//    (`npm run test:visive`), che misura le stesse schermate in Chrome.

const { agendaCorsie } = await import("../visive/finti/tasks.js");
const RIGHE = await agendaCorsie();

vi.mock("../../src/lib/api/tasks", () => ({
  agendaCorsie: async () => RIGHE,
  agendaFatti: async () => [],
  completaTask: vi.fn(),
  riapriTask: vi.fn(),
  spostaTask: vi.fn(),
  stellaTask: vi.fn(),
  listTasksForMonth: async () => [],
  listTasksBetween: async () => [],
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getTask: vi.fn(),
  listDashboardTasks: async () => [
    { id: "d1", title: "Titolare effettivo", category: "fisco_scadenze", priority: "alta", status: "da_fare", due_date: null },
  ],
}));
vi.mock("../../src/lib/api/voce", () => ({
  azioneAMano: vi.fn(),
  chiudiAMano: vi.fn(),
  quanteAspettano: vi.fn(async () => ({ quante: 0, laPiuVecchia: 0 })),
  appuntiDaApprovare: vi.fn(async () => []),
  approvaAppunto: vi.fn(),
  scartaAppunto: vi.fn(),
  scegliPerAzione: vi.fn(),
}));
vi.mock("../../src/lib/api/spesaSpicciola", () => ({ listSpesaSpicciola: vi.fn(async () => []) }));
vi.mock("../../src/lib/api/reservations", () => ({
  listReservations: vi.fn(async () => []),
  listRichiesteDaConfermare: vi.fn(async () => []),
}));
vi.mock("../../src/lib/api/posta", () => ({ contaPostaInAttesa: vi.fn(async () => 0) }));
vi.mock("../../src/lib/api/avvisi", () => ({
  listAvvisi: vi.fn(async () => []),
  rimandaAvviso: vi.fn(),
  riprendiAvviso: vi.fn(),
}));
vi.mock("../../src/lib/api/cash", () => ({
  listAllCausali: vi.fn(async () => [
    { id: "c1", label: "Trasporti", kind: "uscita", active: true, di_sistema: false, e_costo_fisso: false },
    { id: "c2", label: "Versamento in banca", kind: "uscita", active: true, di_sistema: true, e_costo_fisso: false },
  ]),
  createCausale: vi.fn(),
  deactivateCausale: vi.fn(),
  setCausaleNeiFissi: vi.fn(),
}));
vi.mock("../../src/lib/api/deducibilita", () => ({
  listRegoleDeducibilita: vi.fn(async () => []),
  setRegolaCausale: vi.fn(),
}));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isTitolare: true, isStaff: false }) }));

const { default: AgendaList } = await import("../../src/pages/agenda/AgendaList");
const { default: Causali } = await import("../../src/pages/cassa/Causali");
const { default: Dashboard } = await import("../../src/pages/Dashboard");

const monta = (el) => render(<MemoryRouter>{el}</MemoryRouter>);

describe("🔴 i gesti si trovano per nome", () => {
  it("Agenda: ogni spunta dice quale impegno chiude", async () => {
    monta(<AgendaList />);
    const spunte = await screen.findAllByRole("checkbox", { name: /^Segna fatto: \S/ });
    expect(spunte.length).toBeGreaterThan(0);
    // Nessuna spunta resta senza nome.
    for (const c of document.querySelectorAll("[data-spunta-impegno] input")) {
      expect(c.getAttribute("aria-label")).toMatch(/^Segna fatto: \S/);
    }
  });

  it("Causali: la «✕» dice cosa fa e su quale causale; su quelle di sistema non c'è", async () => {
    monta(<Causali />);
    expect(await screen.findByRole("button", { name: "Disattiva la causale «Trasporti»" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Versamento in banca/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "✕" })).toBeNull();
  });

  it("Dashboard: la categoria di un impegno si legge a parole, non col codice", async () => {
    monta(<Dashboard />);
    await waitFor(() => expect(document.querySelector("[data-titolo-impegno]")).toBeTruthy());
    const titolo = document.querySelector("[data-titolo-impegno]").textContent;
    expect(titolo).toMatch(/Fisco e scadenze/);
    expect(titolo).not.toMatch(/fisco_scadenze/);
  });
});
