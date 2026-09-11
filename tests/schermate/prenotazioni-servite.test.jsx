import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// =====================================================================
// UNA PRENOTAZIONE SERVITA SI APRE, E IL SUO STATO SI LEGGE — 11/09/2026
// =====================================================================
// 🔴 COSA SI PROVA (trovato dal censimento del mandato notturno 2):
//    · aprire una prenotazione «servita» — lo stato che il database scrive
//      da solo quando il conto si chiude — dava una PAGINA BIANCA:
//      `STATUS_ACTIONS[status].map` su uno stato che non aveva la sua voce;
//    · nell'elenco, l'etichetta di «servita» e di «non si è presentato» non
//      aveva nessuno sfondo: testo chiaro su fondo chiaro, cioè illeggibile.

const prenotazione = (extra = {}) => ({
  id: "p1",
  type: "prenotazione",
  reservation_date: "2026-09-10",
  reservation_time: "20:00:00",
  party_size: 4,
  customer_name: "Rossi",
  customer_phone: null,
  customer_email: null,
  notes: null,
  event_type: null,
  event_menu_id: null,
  customer_id: null,
  status: "servita",
  ...extra,
});

vi.mock("../../src/lib/api/reservations", () => ({
  fabbisognoEvento: vi.fn(async () => []),
  annullaPrenotazione: vi.fn(),
  createReservation: vi.fn(),
  getReservation: vi.fn(async () => prenotazione()),
  getReservationDeposit: vi.fn(async () => null),
  listTavoliPrenotazione: vi.fn(async () => []),
  setReservationDeposit: vi.fn(),
  statoCaparra: vi.fn(async () => null),
  trattieniCaparra: vi.fn(),
  annullaTrattenutaCaparra: vi.fn(),
  updateReservation: vi.fn(),
  listReservations: vi.fn(async () => [
    prenotazione(),
    prenotazione({ id: "p2", status: "non_presentata", customer_name: "Bianchi" }),
  ]),
  listRichiesteDaConfermare: vi.fn(async () => []),
}));
vi.mock("../../src/lib/api/menus", () => ({ listMenus: vi.fn(async () => []) }));
vi.mock("../../src/lib/api/preventivi", () => ({ trattativeDelGiorno: vi.fn(async () => []) }));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isTitolare: true, isStaff: false }) }));

const { default: ReservationForm } = await import("../../src/pages/calendario/ReservationForm");
const { default: ReservationsList } = await import("../../src/pages/calendario/ReservationsList");

describe("🔴 una prenotazione servita", () => {
  it("si apre (prima: pagina bianca) e dice il suo stato, senza pulsanti per cambiarlo", async () => {
    render(
      <MemoryRouter initialEntries={["/calendario-eventi/p1"]}>
        <Routes>
          <Route path="/calendario-eventi/:id" element={<ReservationForm />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Servita")).toBeTruthy());
    // Lo stato lo scrive il database chiudendo il conto: a mano non si cambia.
    for (const nome of ["Conferma", "Annulla", "Non si è presentato", "Riprendi la prenotazione"]) {
      expect(screen.queryByRole("button", { name: nome })).toBeNull();
    }
  });
});

describe("🔴 l'elenco delle prenotazioni", () => {
  it("l'etichetta di «servita» e di «non si è presentato» ha uno sfondo, cioè si legge", async () => {
    render(
      <MemoryRouter>
        <ReservationsList />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText("Rossi").length).toBeGreaterThan(0));
    const etichette = (testo) => screen.getAllByText(testo).filter((e) => e.tagName === "SPAN");
    for (const testo of ["Servita", "Non si è presentato"]) {
      const trovate = etichette(testo);
      expect(trovate.length, testo).toBeGreaterThan(0);
      for (const e of trovate) {
        expect(e.className, testo).not.toMatch(/undefined/);
        expect(e.className, testo).toMatch(/\bbg-b58-/);
      }
    }
  });
});
