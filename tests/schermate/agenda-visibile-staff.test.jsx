import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// «VISIBILE ALLO STAFF» PARTE TOLTA — 15/10/2026, deciso da Alessio
// =====================================================================
// Un impegno nuovo nasce riservato al titolare; uno già scritto tiene il
// valore che ha. Le due prove insieme sono il punto: se la casella
// leggesse il predefinito anche in modifica, un impegno visibile allo
// staff apparirebbe riservato e al primo salvataggio lo diventerebbe.

const finte = { getTask: vi.fn() };

vi.mock("../../src/lib/api/tasks", () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getTask: (...a) => finte.getTask(...a),
}));
vi.mock("../../src/lib/api/voce", () => ({ azioneAMano: vi.fn(), chiudiAMano: vi.fn() }));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isTitolare: true }) }));

const { default: TaskForm } = await import("../../src/pages/agenda/TaskForm");

const apri = (indirizzo) =>
  render(
    <MemoryRouter initialEntries={[indirizzo]}>
      <Routes>
        <Route path="/agenda/nuovo" element={<TaskForm />} />
        <Route path="/agenda/:id" element={<TaskForm />} />
      </Routes>
    </MemoryRouter>,
  );

const casella = async () => {
  await waitFor(() => expect(document.querySelector("[data-casella-staff]")).toBeTruthy());
  return within(document.querySelector("[data-casella-staff]")).getByRole("checkbox");
};

afterEach(() => vi.clearAllMocks());

describe("«Visibile allo staff»", () => {
  it("su un impegno nuovo parte senza spunta", async () => {
    apri("/agenda/nuovo");
    expect((await casella()).checked).toBe(false);
  });

  it("su un impegno già scritto tiene il valore che ha", async () => {
    finte.getTask.mockResolvedValue({
      id: "t-1",
      title: "Già visibile",
      description: "",
      due_date: null,
      due_time: null,
      remind_at: null,
      priority: "media",
      status: "da_fare",
      category: "altro",
      visibile_staff: true,
      preferito: false,
      origine_modulo: null,
    });
    apri("/agenda/t-1");
    await waitFor(() => expect(document.querySelector('input[value="Già visibile"]')).toBeTruthy());
    expect((await casella()).checked).toBe(true);
  });
});
