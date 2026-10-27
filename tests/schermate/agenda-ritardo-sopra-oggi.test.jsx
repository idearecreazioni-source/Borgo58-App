import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// GLI SCADUTI IN UNA SEZIONE LORO, SEMPRE APERTA, SOPRA «OGGI» —
// 27/10/2026, sera. Alessio, sulla Dashboard con «scaduto il …» su ogni
// riga: «rende tutto confusionario». E la sezione va prima: «così leggo
// prima cosa mi sono lasciato indietro».
// ⚠️ Si prova la schermata: che la sezione sia aperta senza toccare niente
//    è proprio quello che prima mancava (era chiusa di suo).

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
  it("🔴 «In ritardo» è aperta, viene prima di «Oggi», e le righe non dicono «scaduto da»", async () => {
    render(
      <MemoryRouter initialEntries={["/agenda"]}>
        <AgendaList />
      </MemoryRouter>,
    );
    // ⚠️ Ogni riga si disegna due volte (scheda sul telefono, tabella da
    //    computer): si guarda la prima.
    const [scaduto] = await screen.findAllByText("Chiamare il commercialista");
    const titolo = screen.getByRole("heading", { name: /In ritardo/ });
    const oggi = screen.getByText("Oggi");
    const [diOggi] = screen.getAllByText("Ordinare il pane");
    const segue = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(segue(titolo, scaduto)).toBe(true);
    expect(segue(scaduto, oggi)).toBe(true);
    expect(segue(oggi, diOggi)).toBe(true);
    // non si chiude: niente freccia accanto al titolo
    expect(titolo.parentElement.textContent).not.toMatch(/[▸▾]/);
    expect(screen.queryAllByText(/scaduto da/)).toHaveLength(0);
  });
});
