import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// GLI SCADUTI IN «IN RITARDO», SOPRA GLI IMPEGNI DI OGGI — 27/10/2026, sera.
// Si ripropongono ogni giorno finché non si spuntano, ma in una sezione
// loro: «scaduto il …» su ogni riga «rende tutto confusionario» (Alessio).

const finte = { compiti: vi.fn() };
vi.mock("../../src/lib/api/tasks", () => ({
  listDashboardTasks: (...a) => finte.compiti(...a),
  updateTask: vi.fn(() => Promise.resolve({})),
  completaTask: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("../../src/lib/api/spesaSpicciola", () => ({ listSpesaSpicciola: vi.fn(() => Promise.resolve([])) }));
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

const impegno = (over) => ({
  id: Math.random().toString(36).slice(2),
  priority: "media",
  category: "altro",
  status: "da_fare",
  ...over,
});

describe("la Dashboard e gli scaduti", () => {
  it("🔴 uno scaduto sta in «In ritardo», sopra gli impegni di oggi, con la data piccola", async () => {
    // ⚠️ La data si conta da oggi: una data fissa smetterebbe di essere
    //    «passata» se la prova girasse con un orologio diverso.
    const d = new Date(`${oggiLocale()}T12:00:00`);
    d.setDate(d.getDate() - 7);
    const scadenza = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    finte.compiti.mockResolvedValue([
      impegno({ title: "Chiamare il commercialista", due_date: scadenza }),
      impegno({ title: "Ordinare il pane", due_date: oggiLocale() }),
    ]);
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    const scaduto = await screen.findByRole("checkbox", { name: "Segna fatto: Chiamare il commercialista" });
    const diOggi = screen.getByRole("checkbox", { name: "Segna fatto: Ordinare il pane" });
    const ritardo = screen.getByRole("heading", { name: "In ritardo (1)" });
    const diOggiTitolo = screen.getByRole("heading", { name: "Impegni di oggi" });
    const segue = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(segue(ritardo, scaduto)).toBe(true);
    expect(segue(scaduto, diOggiTitolo)).toBe(true);
    expect(segue(diOggiTitolo, diOggi)).toBe(true);
    // la data, piccola e senza «scaduto il»
    const giorno = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(d);
    expect(screen.getByText(giorno)).toBeTruthy();
    expect(screen.queryAllByText(/scaduto il/)).toHaveLength(0);
  });

  it("senza scaduti la sezione non c'è", async () => {
    finte.compiti.mockResolvedValue([impegno({ title: "Ordinare il pane", due_date: oggiLocale() })]);
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    await screen.findByRole("checkbox", { name: "Segna fatto: Ordinare il pane" });
    expect(screen.queryByRole("heading", { name: /In ritardo/ })).toBeNull();
  });
});
