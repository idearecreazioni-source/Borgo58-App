import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UNO SCADUTO SI LEGGE SOTTO «OGGI», IN TESTA — 27/10/2026, chiesto da
// Alessio: «vorrei che gli impegni in ritardo non finissero più nella
// sezione "in ritardo" ma vorrei che mi vengano riproposti nei giorni a
// seguire fino a quando non li spunto».
// ⚠️ Si prova la schermata, non solo `giornoInAgenda`: il cambio vero è la
//    chiave con cui l'Agenda raggruppa i giorni, e con `r.due_date` uno
//    scaduto tornerebbe sotto «Martedì 20» senza che nessun calcolo sbagli.

const finte = { corsie: vi.fn() };
vi.mock("../../src/lib/api/tasks", () => ({
  agendaCorsie: (...a) => finte.corsie(...a),
  agendaFatti: vi.fn(() => Promise.resolve([])),
  completaTask: vi.fn(),
  riapriTask: vi.fn(),
  spostaTask: vi.fn(),
  stellaTask: vi.fn(),
  listTasksForMonth: vi.fn(() => Promise.resolve([])),
  listTasksBetween: vi.fn(() => Promise.resolve([])),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getTask: vi.fn(),
}));
vi.mock("../../src/lib/api/voce", () => ({ azioneAMano: vi.fn(), chiudiAMano: vi.fn() }));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isTitolare: true }) }));

const { default: AgendaList } = await import("../../src/pages/agenda/AgendaList");

const riga = (over) => ({
  id: Math.random().toString(36).slice(2),
  status: "da_fare",
  priority: "media",
  category: "altro",
  preferito: false,
  giorni_in_lista: 10,
  due_time: null,
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-27T10:00:00"));
  // ⚠️ Nell'ordine in cui le manda `agenda_corsie`: prima gli scaduti.
  finte.corsie.mockReset().mockResolvedValue([
    riga({ title: "Chiamare il commercialista", due_date: "2026-10-20", giorni_alla_scadenza: -7, corsia: "in_ritardo" }),
    riga({ title: "Ordinare il pane", due_date: "2026-10-27", giorni_alla_scadenza: 0, corsia: "questa_settimana" }),
    riga({ title: "Pulire la cappa", due_date: "2026-10-28", giorni_alla_scadenza: 1, corsia: "questa_settimana" }),
  ]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("l'Agenda e gli scaduti", () => {
  it("🔴 niente sezione «In ritardo»: lo scaduto è sotto «Oggi», prima di quello di oggi", async () => {
    render(
      <MemoryRouter initialEntries={["/agenda"]}>
        <AgendaList />
      </MemoryRouter>,
    );
    // ⚠️ Ogni riga si disegna due volte (scheda sul telefono, tabella da
    //    computer): si guarda la prima.
    const [scaduto] = await screen.findAllByText("Chiamare il commercialista");
    expect(screen.queryByRole("heading", { name: /In ritardo/ })).toBeNull();

    const oggi = screen.getByText("Oggi");
    const domani = screen.getByText("Domani");
    const [diOggi] = screen.getAllByText("Ordinare il pane");
    const segue = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(segue(oggi, scaduto)).toBe(true);
    expect(segue(scaduto, diOggi)).toBe(true);
    expect(segue(diOggi, domani)).toBe(true);
    // e dice da quanto è scaduto
    expect(screen.getAllByText(/scaduto da 7 giorni/).length).toBeGreaterThan(0);
  });
});
