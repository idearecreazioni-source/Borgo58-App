import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LA SETTIMANA DELL'AGENDA — 11/09/2026, mandato notturno
// =====================================================================
// 🔴 COSA SI PROVA: il selettore «Lista · Settimana · Mese», la lettura dei
//    sette giorni giusti, l'ordine per ora, il giorno vuoto, il passaggio
//    fra le settimane col ritorno a quella di oggi, e il tocco che apre la
//    scheda. La FORMA (niente tagli, niente scorrimento di lato, giorni
//    compatti) la misura la prova visiva in un browser vero.
//
// ⚠️ IL GIORNO È FERMO: mercoledì 9 settembre 2026, cioè la settimana da
//    lunedì 7 a domenica 13. Solo `Date` è finto: i tempi di React no.

const finte = { tra: vi.fn(), mese: vi.fn() };

vi.mock("../../src/lib/api/tasks", () => ({
  agendaCorsie: vi.fn(() => Promise.resolve([])),
  agendaFatti: vi.fn(() => Promise.resolve([])),
  completaTask: vi.fn(),
  riapriTask: vi.fn(),
  spostaTask: vi.fn(),
  stellaTask: vi.fn(),
  listTasksForMonth: (...a) => finte.mese(...a),
  listTasksBetween: (...a) => finte.tra(...a),
}));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isTitolare: true }) }));

const { default: AgendaList } = await import("../../src/pages/agenda/AgendaList");

const t = (id, due_date, due_time = null, extra = {}) => ({ id, title: `Impegno ${id}`, due_date, due_time, status: "da_fare", ...extra });
const RIGHE = [
  t("sera", "2026-09-07", "18:30:00"),
  t("mattina", "2026-09-07", "09:00:00"),
  t("giornata", "2026-09-07"),
  t("fatto", "2026-09-09", null, { status: "completato" }),
  t("prima", "2026-09-03", "11:00:00"),
  // Nella settimana del 21: la lettura vecchia, se vincesse, la farebbe
  // sparire (vedi «due tocchi veloci»).
  t("dopo2", "2026-09-22", "12:00:00"),
];

function Scheda() {
  const { id } = useParams();
  return <p>scheda di {id}</p>;
}

const mostra = () =>
  render(
    <MemoryRouter initialEntries={["/agenda"]}>
      <Routes>
        <Route path="/agenda" element={<AgendaList />} />
        <Route path="/agenda/:id" element={<Scheda />} />
      </Routes>
    </MemoryRouter>,
  );

async function tocca(el) {
  await act(async () => {
    el.click();
  });
}

const giorni = () => [...document.querySelectorAll("[data-giorno]")];
const giorno = (iso) => document.querySelector(`[data-giorno="${iso}"]`);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-09T10:00:00"));
  finte.tra.mockReset().mockImplementation((dal, al) =>
    Promise.resolve(RIGHE.filter((r) => r.due_date >= dal && r.due_date <= al)),
  );
  finte.mese.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("🔴 il selettore", () => {
  it("tre voci allo stesso livello; si apre sulla Lista, e Mese è il calendario di sempre", async () => {
    mostra();
    expect(screen.getByRole("button", { name: "Lista" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Settimana" })).toBeTruthy();
    await tocca(screen.getByRole("button", { name: "Mese" }));
    await waitFor(() => expect(finte.mese).toHaveBeenCalledWith(2026, 9));
    expect(document.querySelector("[data-settimana]")).toBeNull();
  });
});

describe("🔴 il mese: lo stesso giorno si legge come nella settimana", () => {
  it("in ordine (senza ora in cima), con l'ora, il fatto barrato; le frecce hanno un nome", async () => {
    finte.mese.mockResolvedValue([
      t("sera", "2026-09-07", "18:30:00"),
      t("mattina", "2026-09-07", "09:00:00"),
      t("giornata", "2026-09-07"),
      t("fatto7", "2026-09-07", null, { status: "completato" }),
    ]);
    mostra();
    await tocca(screen.getByRole("button", { name: "Mese" }));
    expect(screen.getByRole("button", { name: "Mese precedente" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mese successivo" })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "7" })).toBeTruthy());
    await tocca(screen.getByRole("button", { name: "7" }));
    const ids = [...document.querySelectorAll("[data-impegno]")].map((b) => b.dataset.impegno);
    // Senza ora prima, a pari ora per titolo: «Impegno fatto7» < «Impegno giornata».
    expect(ids).toEqual(["fatto7", "giornata", "mattina", "sera"]);
    expect(document.querySelector("[data-impegno='mattina'] [data-ora]").textContent).toBe("09:00");
    expect(document.querySelector("[data-impegno='giornata'] [data-ora]")).toBeNull();
    expect(document.querySelector("[data-impegno='fatto7'] [data-titolo]").className).toMatch(/line-through/);
    expect(document.querySelector("[data-impegno='sera'] [data-titolo]").className).not.toMatch(/line-through/);
  });
});

describe("🔴 la settimana", () => {
  it("legge da lunedì 7 a domenica 13, e mostra i sette giorni", async () => {
    mostra();
    await tocca(screen.getByRole("button", { name: "Settimana" }));
    await waitFor(() => expect(finte.tra).toHaveBeenCalledWith("2026-09-07", "2026-09-13"));
    await waitFor(() => expect(giorni()).toHaveLength(7));
    expect(giorni().map((g) => g.dataset.giorno)).toEqual([
      "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13",
    ]);
    expect(screen.getByText("7 – 13 settembre 2026")).toBeTruthy();
    // Oggi è mercoledì, e si vede.
    expect(giorno("2026-09-09").hasAttribute("data-oggi")).toBe(true);
    // Sulla settimana di oggi il ritorno non serve.
    expect(document.querySelector("[data-settimana-questa]")).toBeNull();
  });

  it("🔴 dentro un giorno: senza ora in cima, poi per ora — con l'ora scritta", async () => {
    mostra();
    await tocca(screen.getByRole("button", { name: "Settimana" }));
    await waitFor(() => expect(giorno("2026-09-07")?.querySelectorAll("[data-impegno]")).toHaveLength(3));
    const lun = [...giorno("2026-09-07").querySelectorAll("[data-impegno]")];
    expect(lun.map((b) => b.dataset.impegno)).toEqual(["giornata", "mattina", "sera"]);
    expect(lun.map((b) => b.querySelector("[data-ora]").textContent)).toEqual(["", "09:00", "18:30"]);
  });

  it("un giorno vuoto dice «niente», e il fatto resta, barrato", async () => {
    mostra();
    await tocca(screen.getByRole("button", { name: "Settimana" }));
    await waitFor(() => expect(giorni()).toHaveLength(7));
    expect(within(giorno("2026-09-08")).getByText("niente")).toBeTruthy();
    const fatto = giorno("2026-09-09").querySelector("[data-impegno='fatto'] [data-titolo]");
    expect(fatto.className).toMatch(/line-through/);
  });

  it("→ la settimana dopo, ← quella prima, e «Torna a questa settimana»", async () => {
    mostra();
    await tocca(screen.getByRole("button", { name: "Settimana" }));
    await waitFor(() => expect(giorni()).toHaveLength(7));

    await tocca(screen.getByRole("button", { name: "Settimana successiva" }));
    await waitFor(() => expect(finte.tra).toHaveBeenLastCalledWith("2026-09-14", "2026-09-20"));
    await waitFor(() => expect(screen.getByText("14 – 20 settembre 2026")).toBeTruthy());
    // Settimana vuota: sette «niente», nessun impegno.
    await waitFor(() => expect(document.querySelectorAll("[data-vuoto]")).toHaveLength(7));
    expect(document.querySelectorAll("[data-impegno]")).toHaveLength(0);

    await tocca(screen.getByRole("button", { name: "Torna a questa settimana" }));
    await waitFor(() => expect(screen.getByText("7 – 13 settembre 2026")).toBeTruthy());

    await tocca(screen.getByRole("button", { name: "Settimana precedente" }));
    await waitFor(() => expect(finte.tra).toHaveBeenLastCalledWith("2026-08-31", "2026-09-06"));
    await waitFor(() => expect(giorno("2026-09-03")?.querySelector("[data-impegno='prima']")).toBeTruthy());
    expect(screen.getByText("31 agosto – 6 settembre 2026")).toBeTruthy();
  });

  it("⚠️ due tocchi veloci: vince l'ultima settimana chiesta, non la lettura più lenta", async () => {
    let sblocca = () => {};
    mostra();
    await tocca(screen.getByRole("button", { name: "Settimana" }));
    await waitFor(() => expect(giorni()).toHaveLength(7));
    // La prossima lettura (settimana dopo) resta in volo…
    finte.tra.mockImplementationOnce(
      () =>
        new Promise((r) => {
          sblocca = () => r([t("vecchia", "2026-09-15")]);
        }),
    );
    await tocca(screen.getByRole("button", { name: "Settimana successiva" }));
    // …e intanto si va avanti ancora di una, dove c'è un impegno.
    await tocca(screen.getByRole("button", { name: "Settimana successiva" }));
    await waitFor(() => expect(screen.getByText("21 – 27 settembre 2026")).toBeTruthy());
    await waitFor(() => expect(document.querySelector("[data-impegno='dopo2']")).toBeTruthy());
    await act(async () => {
      sblocca();
    });
    // ⚠️ Il caso che conta NON è «la vecchia compare» — divisa sui giorni di
    //    questa settimana non ci starebbe comunque — ma che la risposta
    //    vecchia si porti via quella giusta: senza la guardia, «dopo2»
    //    sparirebbe e il martedì direbbe «niente». Rompendo la guardia, la
    //    prima stesura di questa prova restava verde.
    expect(document.querySelector("[data-impegno='dopo2']")).toBeTruthy();
    expect(document.querySelector("[data-impegno='vecchia']")).toBeNull();
  });

  it("🔴 se la lettura fallisce lo dice, non disegna sette «niente», e si riprova", async () => {
    mostra();
    finte.tra.mockImplementationOnce(() => Promise.reject(new Error("rete assente")));
    await tocca(screen.getByRole("button", { name: "Settimana" }));
    await waitFor(() => expect(document.querySelector("[data-errore-settimana]")).toBeTruthy());
    expect(screen.getByText(/rete assente/)).toBeTruthy();
    expect(giorni()).toHaveLength(0);
    expect(document.querySelectorAll("[data-vuoto]")).toHaveLength(0);
    await tocca(screen.getByRole("button", { name: "Riprova" }));
    await waitFor(() => expect(giorni()).toHaveLength(7));
    expect(document.querySelector("[data-errore-settimana]")).toBeNull();
    expect(screen.queryByText(/rete assente/)).toBeNull();
  });

  it("🔴 toccare un impegno apre la sua scheda", async () => {
    mostra();
    await tocca(screen.getByRole("button", { name: "Settimana" }));
    await waitFor(() => expect(document.querySelector("[data-impegno='mattina']")).toBeTruthy());
    await tocca(document.querySelector("[data-impegno='mattina']"));
    expect(screen.getByText("scheda di mattina")).toBeTruthy();
  });
});
