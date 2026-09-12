import { MemoryRouter } from "react-router-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LA SPUNTA DELLA DASHBOARD E I RICORRENTI — 12/09/2026, mandato esteso,
// priorità 2. Analisi completa: docs/referti/20260912_la_spunta_della_dashboard.md
// =====================================================================
// 🔴 IL DIFETTO, in una riga: la Dashboard chiude un impegno con
//    `updateTask(id, { status: "completato" })`, cioè scrive la colonna
//    dritta nella tabella. L'impegno successivo di una ricorrenza lo crea
//    SOLO `completa_task` (la usa l'Agenda, via `completaTask`); nessuno dei
//    tre trigger di `tasks` lo fa. Quindi un ricorrente spuntato dalla
//    Dashboard si chiude e non torna più.
//
// ⚠️ LA CORREZIONE NON È IN QUESTO RAMO, per decisione del mandato: la
//    Dashboard è toccata dalla PR #58, ancora aperta. Qui c'è la prova che
//    la correzione dovrà far diventare verde.
//
// ⚠️ COME SI LEGGE `it.fails`: il caso è scritto come DEVE essere, e oggi
//    fallisce; `it.fails` lo segna «atteso rosso», così i controlli restano
//    verdi. Il giorno della correzione il caso PASSA, `it.fails` diventa
//    rosso e costringe a trasformarlo in `it` — non si può dimenticare.
//    Il secondo caso fotografa il comportamento di oggi e diventa rosso
//    nello stesso momento: va tolto insieme.

const finte = {
  compiti: vi.fn(),
  updateTask: vi.fn(() => Promise.resolve({})),
  completaTask: vi.fn(() => Promise.resolve("t1-successivo")),
};
vi.mock("../../src/lib/api/tasks", () => ({
  listDashboardTasks: (...a) => finte.compiti(...a),
  updateTask: (...a) => finte.updateTask(...a),
  completaTask: (...a) => finte.completaTask(...a),
}));
vi.mock("../../src/lib/api/spesaSpicciola", () => ({ listSpesaSpicciola: vi.fn(() => Promise.resolve([])) }));
vi.mock("../../src/lib/api/reservations", () => ({
  listReservations: vi.fn(() => Promise.resolve([])),
  listRichiesteDaConfermare: vi.fn(() => Promise.resolve([])),
}));
vi.mock("../../src/lib/api/posta", () => ({ contaPostaInAttesa: vi.fn(() => Promise.resolve(0)) }));
// ⚠️ Anche le funzioni che la Dashboard della PR #58 aggiunge (gli appunti
//    da approvare): così la stessa prova gira sulla base da cui partirà la
//    correzione, ed è stata fatta girare lì (vedi il referto).
vi.mock("../../src/lib/api/voce", () => ({
  quanteAspettano: vi.fn(() => Promise.resolve({ quante: 0, laPiuVecchia: 0 })),
  appuntiDaApprovare: vi.fn(() => Promise.resolve([])),
  approvaAppunto: vi.fn(),
  scartaAppunto: vi.fn(),
  scegliPerAzione: vi.fn(),
}));
vi.mock("../../src/lib/api/avvisi", () => ({
  listAvvisi: vi.fn(() => Promise.resolve([])),
  rimandaAvviso: vi.fn(),
  riprendiAvviso: vi.fn(),
}));
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ isStaff: false, isTitolare: true }),
}));

const { default: Dashboard } = await import("../../src/pages/Dashboard");
const { oggiLocale } = await import("../../src/lib/constants");

const RICORRENTE = {
  id: "t1",
  title: "Versare l'IVA del trimestre",
  due_date: oggiLocale(),
  priority: "alta",
  category: "fisco_scadenze",
  status: "da_fare",
  ricorrenza_ogni: 3,
  ricorrenza_unita: "mesi",
};

const spuntaDallaDashboard = async () => {
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
  const casella = await screen.findByRole("checkbox", { name: `Segna fatto: ${RICORRENTE.title}` });
  await act(async () => {
    fireEvent.click(casella);
  });
};

beforeEach(() => {
  finte.compiti.mockReset().mockResolvedValue([RICORRENTE]);
  finte.updateTask.mockClear();
  finte.completaTask.mockClear();
});

describe("🔴 un impegno ricorrente spuntato dalla Dashboard", () => {
  it.fails("[ATTESO ROSSO finché non si corregge] passa da completaTask, come l'Agenda, e non scrive lo stato a mano", async () => {
    await spuntaDallaDashboard();
    await waitFor(() => expect(finte.completaTask).toHaveBeenCalledWith("t1"), { timeout: 500 });
    expect(finte.updateTask).not.toHaveBeenCalled();
  });

  it("[FOTOGRAFIA DI OGGI, da togliere con la correzione] scrive status «completato» con updateTask, e completaTask non viene chiamata", async () => {
    await spuntaDallaDashboard();
    await waitFor(() => expect(finte.updateTask).toHaveBeenCalledWith("t1", { status: "completato" }));
    expect(finte.completaTask).not.toHaveBeenCalled();
  });
});
