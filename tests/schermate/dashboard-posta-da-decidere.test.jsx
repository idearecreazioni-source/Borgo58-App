import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// 12/11/2026, deciso da Alessio: le mail non sono «richieste dei clienti».
// La posta ha un riquadro suo, «Posta da decidere», che porta alla pagina Posta.

const finte = { posta: vi.fn(), richieste: vi.fn() };
vi.mock("../../src/lib/api/tasks", () => ({
  listDashboardTasks: vi.fn(() => Promise.resolve([])),
  updateTask: vi.fn(() => Promise.resolve({})),
  completaTask: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("../../src/lib/api/spesaSpicciola", () => ({ listSpesaSpicciola: vi.fn(() => Promise.resolve([])) }));
vi.mock("../../src/lib/api/reservations", () => ({
  listReservations: vi.fn(() => Promise.resolve([])),
  listRichiesteDaConfermare: (...a) => finte.richieste(...a),
}));
vi.mock("../../src/lib/api/posta", () => ({ contaPostaInAttesa: (...a) => finte.posta(...a) }));
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

const mostra = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );

describe("la Dashboard e la posta da decidere", () => {
  it("🔴 la posta ha un riquadro suo, e non si chiama «richieste dei clienti»", async () => {
    finte.posta.mockResolvedValue(3);
    finte.richieste.mockResolvedValue([]);
    mostra();
    expect(await screen.findByRole("heading", { name: "Posta da decidere" })).toBeTruthy();
    const link = screen.getByRole("link", { name: /3 mail da decidere/ });
    expect(link.getAttribute("href")).toBe("/documenti/posta");
    expect(screen.queryByText(/Richieste dei clienti/)).toBeNull();
  });

  it("le prenotazioni restano nel loro riquadro, senza contare la posta", async () => {
    finte.posta.mockResolvedValue(0);
    finte.richieste.mockResolvedValue([{ id: "r1" }]);
    mostra();
    expect(await screen.findByRole("heading", { name: /Richieste dei clienti/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /1 prenotazione da confermare/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Posta da decidere" })).toBeNull();
  });
});
