import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// =====================================================================
// LA SPESA SPICCIOLA NELLA SCHERMATA DELLA MATTINA
// =====================================================================
// 10/09/2026, Blocco 5 del mandato notturno.
//
// 🔴 È L'UNICA LISTA CHE SI GUARDA USCENDO DI CASA, ed era raggiungibile
//    solo passando dal Magazzino: chi la dettava la sera non la ritrovava
//    la mattina, che è l'unico momento in cui serve.
//
// 🔴 E NON VA CONFUSA CON LA LISTA DEI FORNITORI. Quella nasce dalle
//    soglie del magazzino e finisce in un ordine; questa è la roba che si
//    compra di persona al supermercato. Il riquadro lo dice **con le
//    parole**, non solo col titolo: sbagliare lista vuol dire portare al
//    fornitore la spesa del supermercato.

const finte = {
  spicciola: vi.fn(() => Promise.resolve([])),
};

vi.mock("../../src/lib/api/spesaSpicciola", () => ({
  listSpesaSpicciola: (...a) => finte.spicciola(...a),
}));
vi.mock("../../src/lib/api/tasks", () => ({
  listDashboardTasks: vi.fn(() => Promise.resolve([])),
  updateTask: vi.fn(),
}));
vi.mock("../../src/lib/api/reservations", () => ({
  listReservations: vi.fn(() => Promise.resolve([])),
  listRichiesteDaConfermare: vi.fn(() => Promise.resolve([])),
}));
vi.mock("../../src/lib/api/posta", () => ({
  contaPostaInAttesa: vi.fn(() => Promise.resolve(0)),
}));
vi.mock("../../src/lib/api/voce", () => ({
  quanteAspettano: vi.fn(() => Promise.resolve({ quante: 0, laPiuVecchia: 0 })),
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

const mattina = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );

describe("il riquadro della spesa spicciola", () => {
  it("🔴 dice quante cose restano, e porta dritto a quella schermata", async () => {
    finte.spicciola.mockResolvedValueOnce([
      { id: "1", articolo: "shampoo" },
      { id: "2", articolo: "carta forno" },
      { id: "3", articolo: "pile" },
    ]);
    mattina();
    const riga = await screen.findByText(/3 cose da comprare/i);
    const collegamento = riga.closest("a");
    expect(collegamento.getAttribute("href")).toBe("/magazzino/spesa-spicciola");
  });

  it("🔴 e dice DI PERSONA: non è la lista che va al fornitore", async () => {
    // Sbagliare lista vuol dire portare al fornitore la spesa del
    // supermercato, oppure comprare di persona quello che il fornitore
    // porterebbe. Le due si distinguono solo se il riquadro lo scrive.
    finte.spicciola.mockResolvedValueOnce([{ id: "1", articolo: "shampoo" }]);
    mattina();
    // ⚠️ Si guarda il RIQUADRO INTERO e non il pezzo grassettato: il numero
    //    e la spiegazione stanno in due elementi diversi, e cercare il
    //    testo trova solo il primo.
    const riquadro = (await screen.findByText(/una cosa da comprare/i)).closest("a");
    expect(riquadro.textContent).toMatch(/di persona/i);
    expect(riquadro.textContent).toMatch(/spesa spicciola/i);
  });

  it("⚠️ con la lista vuota il riquadro non c'è", async () => {
    // Un riquadro che dice «niente» tutte le mattine diventa arredamento,
    // e allora smette di farsi notare il giorno che parla.
    finte.spicciola.mockResolvedValueOnce([]);
    mattina();
    await waitFor(() => expect(finte.spicciola).toHaveBeenCalled());
    expect(screen.queryByText(/da comprare/i)).toBeNull();
  });

  it("🔴 e una lettura fallita NON si legge «non c'è niente da comprare»", async () => {
    // È la regola del 19/08: assenza di informazione e informazione di
    // assenza sono due cose diverse, e la seconda qui sarebbe una frase
    // tranquilla e falsa — si esce di casa senza comprare niente.
    finte.spicciola.mockRejectedValueOnce(new Error("la rete non risponde"));
    mattina();
    const riga = await screen.findByText(/non sono riuscito a leggere la spesa spicciola/i);
    expect(riga).toBeTruthy();
    expect(screen.getByRole("button", { name: /riprova/i })).toBeTruthy();
  });
});
