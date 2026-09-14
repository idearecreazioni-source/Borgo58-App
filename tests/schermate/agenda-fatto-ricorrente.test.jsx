import { MemoryRouter } from "react-router-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// «FATTO» DALL'AGENDA — 12/09/2026, mandato «ricorrenze chiuse dalla
// Dashboard». L'Agenda chiude dalla stessa strada della Dashboard
// (`chiudiImpegno`): questa prova tiene fermo che l'Agenda fa quello che
// faceva, e che il messaggio d'errore nomina l'impegno invece di «la riga».
// Letture finte, nessun database.

const finte = {
  corsie: vi.fn(),
  completaTask: vi.fn(),
};
vi.mock("../../src/lib/api/tasks", () => ({
  agendaCorsie: (...a) => finte.corsie(...a),
  agendaFatti: vi.fn(() => Promise.resolve([])),
  completaTask: (...a) => finte.completaTask(...a),
  riapriTask: vi.fn(),
  listTasksForMonth: vi.fn(() => Promise.resolve([])),
  spostaTask: vi.fn(),
  stellaTask: vi.fn(),
}));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isTitolare: true, isStaff: false }) }));

const { default: AgendaList } = await import("../../src/pages/agenda/AgendaList");

const IMPEGNO = {
  id: "t1",
  title: "Versare l'IVA del trimestre",
  description: null,
  due_date: "2026-09-15",
  due_time: null,
  category: "fisco_scadenze",
  origine_modulo: null,
  preferito: false,
  ricorrenza_ogni: 3,
  ricorrenza_unita: "mesi",
  status: "da_fare",
  visibile_staff: true,
  corsia: "questa_settimana",
  giorni_in_lista: 3,
  giorni_alla_scadenza: 3,
};
const NATO = "Fatto. Ne è già nato uno nuovo alla prossima scadenza.";

const mostra = () =>
  render(
    <MemoryRouter>
      <AgendaList />
    </MemoryRouter>,
  );
// La casella «fatto» dell'Agenda: un'etichetta col titolo «Fatto».
// ⚠️ Qui l'elenco si disegna due volte (telefono e computer: il CSS che ne
//    nasconde uno non c'è), quindi titolo e casella compaiono due volte.
const casella = async () => {
  await screen.findAllByText(IMPEGNO.title);
  return screen.getAllByTitle("Fatto")[0].querySelector("input");
};

beforeEach(() => {
  finte.corsie.mockReset().mockResolvedValue([IMPEGNO]);
  finte.completaTask.mockReset().mockResolvedValue("t1-successivo");
});

describe("🔴 «fatto» dall'Agenda, dalla strada condivisa", () => {
  it("un ricorrente: completaTask col solo identificativo, la frase del successivo, e l'elenco riletto", async () => {
    mostra();
    const c = await casella();
    await act(async () => {
      fireEvent.click(c);
    });
    await waitFor(() => expect(screen.getByText(NATO)).toBeTruthy());
    expect(finte.completaTask.mock.calls).toEqual([["t1"]]);
    // Come prima: dopo la chiusura l'Agenda rilegge le corsie.
    expect(finte.corsie.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("se il salvataggio fallisce il messaggio nomina l'impegno, non «la riga», e la riga torna", async () => {
    finte.completaTask.mockRejectedValue(new Error("Questo impegno risulta già fatto"));
    mostra();
    const c = await casella();
    await act(async () => {
      fireEvent.click(c);
    });
    const errore = await screen.findByText(/risulta già fatto/);
    expect(errore.textContent).toContain(`«${IMPEGNO.title}» non si è salvato`);
    expect(errore.textContent).not.toContain("la riga");
    // La riga è tornata al suo posto.
    expect(screen.getAllByText(IMPEGNO.title).length).toBeGreaterThan(0);
  });
});
