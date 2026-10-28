import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// «RICORDAMELO QUANDO ARRIVO» NELLA SCHEDA DELL'IMPEGNO — 28/10/2026.
// Si prova la scheda vera: il luogo scelto deve arrivare nel salvataggio,
// e un impegno che ce l'ha deve riaprirsi col suo luogo acceso.

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

describe("il luogo nella scheda dell'impegno", () => {
  it("🔴 «a casa» arriva nel salvataggio; senza toccare niente il luogo è vuoto", async () => {
    mostra("/agenda/nuovo");
    const nessuno = screen.getByRole("button", { name: "Da nessuna parte" });
    expect(nessuno.getAttribute("aria-pressed")).toBe("true");

    fireEvent.change(screen.getByText("Titolo").parentElement.querySelector("input"), {
      target: { value: "Pesare la mamma" },
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "a casa" })));
    expect(screen.getByRole("button", { name: "a casa" }).getAttribute("aria-pressed")).toBe("true");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Crea task" })));
    await waitFor(() => expect(finte.createTask).toHaveBeenCalled());
    expect(finte.createTask.mock.calls[0][0]).toMatchObject({ title: "Pesare la mamma", luogo: "casa" });
  });

  it("un impegno del ristorante si riapre col ristorante acceso", async () => {
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
      luogo: "ristorante",
    });
    mostra("/agenda/t-1");
    const bottone = await screen.findByRole("button", { name: "al ristorante" });
    expect(bottone.getAttribute("aria-pressed")).toBe("true");
  });
});
