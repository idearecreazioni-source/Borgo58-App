import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { campiImpegno } from "../../src/lib/calcoli/agenda";

// «QUANDO ARRIVO» È STATO TOLTO — 12/11/2026, deciso da Alessio: il raggio
// dei Comandi dell'iPhone era troppo largo, il GPS oscillava e le notifiche
// si ripetevano. Prende il posto di `agenda-luogo-nella-scheda.test.jsx`.
// ⚠️ Si prova anche il contrario di una perdita: un impegno che il luogo
//    ce l'ha già, aperto e salvato, NON lo cancella — l'aggiornamento non
//    nomina la colonna, quindi nel database resta com'è.

const finte = { getTask: vi.fn(), createTask: vi.fn(), updateTask: vi.fn() };

vi.mock("../../src/lib/api/tasks", () => ({
  agendaCorsie: vi.fn(),
  agendaFatti: vi.fn(),
  completaTask: vi.fn(),
  riapriTask: vi.fn(),
  spostaTask: vi.fn(),
  stellaTask: vi.fn(),
  listTasksForMonth: vi.fn(),
  listTasksBetween: vi.fn(),
  createTask: (...a) => finte.createTask(...a),
  updateTask: (...a) => finte.updateTask(...a),
  deleteTask: vi.fn(),
  getTask: (...a) => finte.getTask(...a),
}));
vi.mock("../../src/lib/api/voce", () => ({ azioneAMano: vi.fn(), chiudiAMano: vi.fn() }));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isTitolare: true }) }));

const { default: TaskForm } = await import("../../src/pages/agenda/TaskForm");

const mostra = (inizio) =>
  render(
    <MemoryRouter initialEntries={[inizio]}>
      <Routes>
        <Route path="/agenda" element={<p>elenco</p>} />
        <Route path="/agenda/nuovo" element={<TaskForm />} />
        <Route path="/agenda/:id" element={<TaskForm />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  finte.getTask.mockReset();
  finte.createTask.mockReset().mockResolvedValue({});
  finte.updateTask.mockReset().mockResolvedValue({});
});

describe("«Quando arrivo» non c'è più", () => {
  it("🔴 nell'elenco dell'Agenda non c'è la colonna, anche su un impegno che il luogo ce l'ha", () => {
    const campi = campiImpegno({ luogo: "casa", due_date: null, giorni_in_lista: 1 });
    expect(campi.some((c) => c.chiave === "luogo" || c.etichetta === "Quando arrivo")).toBe(false);
  });

  it("🔴 nel modulo non c'è il gruppo, e un impegno nuovo si salva senza luogo", async () => {
    const { container } = mostra("/agenda/nuovo");
    expect(screen.queryByText("Ricordamelo quando arrivo")).toBeNull();
    expect(container.querySelector("[data-scelta-luogo]")).toBeNull();
    expect(screen.queryByRole("button", { name: "a casa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "in cantina" })).toBeNull();

    fireEvent.change(screen.getByText("Titolo").parentElement.querySelector("input"), {
      target: { value: "Pesare la mamma a casa" },
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Crea task" })));
    await waitFor(() => expect(finte.createTask).toHaveBeenCalled());
    expect(finte.createTask.mock.calls[0][0]).not.toHaveProperty("luogo");
  });

  it("🔴 un impegno che ha già un luogo, salvato, non lo perde (il salvataggio non lo nomina)", async () => {
    finte.getTask.mockResolvedValue({
      id: "t-1",
      title: "Chiamare il fornitore",
      description: "",
      due_date: null,
      due_time: null,
      remind_at: null,
      reminder_sent_at: null,
      priority: "media",
      status: "da_fare",
      category: "altro",
      visibile_staff: false,
      preferito: false,
      origine_modulo: null,
      luogo: "cantina",
    });
    const { container } = mostra("/agenda/t-1");
    await screen.findByDisplayValue("Chiamare il fornitore");
    expect(container.querySelector("[data-scelta-luogo]")).toBeNull();

    const salva = screen.getAllByRole("button").find((b) => /salva/i.test(b.textContent));
    await act(async () => fireEvent.click(salva));
    await waitFor(() => expect(finte.updateTask).toHaveBeenCalled());
    const [id, payload] = finte.updateTask.mock.calls[0];
    expect(id).toBe("t-1");
    expect(payload).not.toHaveProperty("luogo");
  });
});
