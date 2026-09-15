import { MemoryRouter } from "react-router-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LA SPUNTA DELLA DASHBOARD E I RICORRENTI — 12/09/2026, mandato esteso,
// priorità 2. Analisi completa: docs/referti/20260912_la_spunta_della_dashboard.md
// =====================================================================
// 🔴 IL DIFETTO, in una riga: la Dashboard chiude un impegno con
//    `updateTask(id, { status: "completato" })`, cioè scrive la colonna
//    dritta nella tabella. L'impegno successivo di una ricorrenza lo crea
//    SOLO `completa_task` (la usa l'Agenda, via `completaTask`); nessuno dei
//    tre trigger di `tasks` lo fa. Quindi un ricorrente spuntato dalla
//    Dashboard si chiude e non torna più.
//
// ⚠️ LA CORREZIONE NON È IN QUESTO RAMO, per decisione del mandato: la
//    Dashboard è toccata dalla PR #58, ancora aperta. Qui c'è la prova che
//    la correzione dovrà far diventare verde.
//
// ⚠️ COME SI LEGGE `it.fails`: il caso è scritto come DEVE essere, e oggi
//    fallisce; `it.fails` lo segna «atteso rosso», così i controlli restano
//    verdi. Il giorno della correzione il caso PASSA, `it.fails` diventa
//    rosso e costringe a trasformarlo in `it` — non si può dimenticare.
//    Il secondo caso fotografa il comportamento di oggi e diventa rosso
//    nello stesso momento: va tolto insieme.

const finte = {
  compiti: vi.fn(),
  updateTask: vi.fn(() => Promise.resolve({})),
  completaTask: vi.fn(() => Promise.resolve("t1-successivo")),
};
vi.mock("../../src/lib/api/tasks", () => ({
  listDashboardTasks: (...a) => finte.compiti(...a),
  updateTask: (...a) => finte.updateTask(...a),
  completaTask: (...a) => finte.completaTask(...a),
}));
vi.mock("../../src/lib/api/spesaSpicciola", () => ({ listSpesaSpicciola: vi.fn(() => Promise.resolve([])) }));
vi.mock("../../src/lib/api/reservations", () => ({
  listReservations: vi.fn(() => Promise.resolve([])),
  listRichiesteDaConfermare: vi.fn(() => Promise.resolve([])),
}));
vi.mock("../../src/lib/api/posta", () => ({ contaPostaInAttesa: vi.fn(() => Promise.resolve(0)) }));
// ⚠️ Anche le funzioni che la Dashboard della PR #58 aggiunge (gli appunti
//    da approvare): così la stessa prova gira sulla base da cui partirà la
//    correzione, ed è stata fatta girare lì (vedi il referto).
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
const { oggiLocale } = await import("../../src/lib/constants");

const RICORRENTE = {
  id: "t1",
  title: "Versare l'IVA del trimestre",
  due_date: oggiLocale(),
  priority: "alta",
  category: "fisco_scadenze",
  status: "da_fare",
  ricorrenza_ogni: 3,
  ricorrenza_unita: "mesi",
};

const spuntaDallaDashboard = async () => {
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
  const casella = await screen.findByRole("checkbox", { name: `Segna fatto: ${RICORRENTE.title}` });
  await act(async () => {
    fireEvent.click(casella);
  });
};

// La frase dell'Agenda quando nasce il successivo: la stessa, parola per parola.
const NATO = "Fatto. Ne è già nato uno nuovo alla prossima scadenza.";

const impegno = (id, title, ogni, unita) => ({
  id,
  title,
  due_date: oggiLocale(),
  priority: "media",
  category: "altro",
  status: "da_fare",
  ricorrenza_ogni: ogni,
  ricorrenza_unita: unita,
});

const mostraDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
const casellaDi = (title) => screen.findByRole("checkbox", { name: `Segna fatto: ${title}` });

beforeEach(() => {
  finte.compiti.mockReset().mockResolvedValue([RICORRENTE]);
  finte.updateTask.mockClear();
  // Come la funzione del database: restituisce il successivo se l'impegno
  // si ripete, niente se non si ripete.
  finte.completaTask.mockReset().mockImplementation((id) => Promise.resolve(id.startsWith("n") ? null : `${id}-successivo`));
});

describe("🔴 un impegno ricorrente spuntato dalla Dashboard", () => {
  // ⚠️ Era `it.fails` nella #68 («atteso rosso finché non si corregge»):
  //    con la correzione passa, quindi diventa `it`. Il secondo caso della
  //    #68, la «fotografia di oggi» con `updateTask`, è tolto come la #68
  //    stessa chiedeva.
  it("passa da completaTask, come l'Agenda, e non scrive lo stato a mano", async () => {
    await spuntaDallaDashboard();
    await waitFor(() => expect(finte.completaTask).toHaveBeenCalledWith("t1"), { timeout: 500 });
    expect(finte.updateTask).not.toHaveBeenCalled();
  });

  // 🔴 GIORNALIERA, SETTIMANALE, MENSILE (mandato del 12/09): la Dashboard
  //    non calcola niente — manda l'identificativo e basta, e il successivo
  //    lo crea la funzione del database con le stesse proprietà. Quindi si
  //    prova che la chiamata è quella dell'Agenda, SENZA nient'altro dentro:
  //    niente data, ora, promemoria, staff o visibilità decisi qui.
  for (const [id, title, ogni, unita] of [
    ["g1", "Sanificare la cappa", 1, "giorni"],
    ["s1", "Pulire la cella", 1, "settimane"],
    ["m1", "Controllare gli estintori", 1, "mesi"],
  ]) {
    it(`ricorrenza ${unita}: una chiamata sola a completaTask col solo identificativo, la riga sparisce, e la frase dell'Agenda`, async () => {
      finte.compiti.mockResolvedValue([impegno(id, title, ogni, unita)]);
      mostraDashboard();
      const casella = await casellaDi(title);
      await act(async () => {
        fireEvent.click(casella);
      });
      await waitFor(() => expect(screen.getByText(NATO)).toBeTruthy());
      expect(finte.completaTask).toHaveBeenCalledTimes(1);
      expect(finte.completaTask.mock.calls[0]).toEqual([id]);
      expect(finte.updateTask).not.toHaveBeenCalled();
      expect(screen.queryByRole("checkbox", { name: `Segna fatto: ${title}` })).toBeNull();
    });
  }

  it("un impegno che NON si ripete: si chiude dalla stessa strada, e nessuna frase su un successivo", async () => {
    finte.compiti.mockResolvedValue([impegno("n1", "Ritirare le tovaglie", null, null)]);
    mostraDashboard();
    const casella = await casellaDi("Ritirare le tovaglie");
    await act(async () => {
      fireEvent.click(casella);
    });
    await waitFor(() => expect(finte.completaTask).toHaveBeenCalledWith("n1"));
    expect(finte.updateTask).not.toHaveBeenCalled();
    expect(screen.queryByText(NATO)).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Segna fatto: Ritirare le tovaglie" })).toBeNull();
  });

  // ⚠️ DOPPIO TOCCO — COSA PROVA QUESTO CASO, E COSA NO. Qui un secondo
  //    `click` sulla stessa casella non arriva al codice (misurato: tolta la
  //    guardia di `chiudiImpegno`, la prima stesura di questo caso restava
  //    verde). Quindi si prova la difesa che si VEDE: la casella sparisce al
  //    primo tocco, PRIMA della risposta, e non ce n'è una seconda da
  //    premere. La guardia sul secondo tocco la prova
  //    `tests/unita/chiudi-impegno.test.js`, che senza guardia diventa rossa.
  it("⚠️ doppio tocco: la casella sparisce al primo tocco, prima della risposta, e parte una richiesta sola", async () => {
    let risolvi = () => {};
    finte.completaTask.mockImplementationOnce(() => new Promise((r) => (risolvi = r)));
    mostraDashboard();
    const casella = await casellaDi(RICORRENTE.title);
    await act(async () => {
      fireEvent.click(casella);
    });
    // La richiesta è ancora in volo e la casella non c'è già più.
    expect(screen.queryByRole("checkbox", { name: `Segna fatto: ${RICORRENTE.title}` })).toBeNull();
    expect(finte.completaTask).toHaveBeenCalledTimes(1);
    await act(async () => risolvi("t1-successivo"));
    expect(finte.completaTask).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(NATO)).toHaveLength(1);
  });

  it("⚠️ richiesta ripetuta e respinta (già fatto da un'altra parte): la riga torna e lo dice, niente scritto a mano", async () => {
    finte.completaTask.mockImplementationOnce(() => Promise.reject(new Error("Questo impegno risulta già fatto")));
    mostraDashboard();
    const casella = await casellaDi(RICORRENTE.title);
    await act(async () => {
      fireEvent.click(casella);
    });
    await waitFor(() => expect(screen.getByText(/risulta già fatto/)).toBeTruthy());
    // Il messaggio nomina l'impegno, non «la riga» (12/09/2026).
    expect(screen.getByText(/risulta già fatto/).textContent).toContain(`«${RICORRENTE.title}» non si è salvato`);
    expect(screen.getByText(/risulta già fatto/).textContent).not.toContain("la riga");
    expect(await casellaDi(RICORRENTE.title)).toBeTruthy();
    expect(finte.updateTask).not.toHaveBeenCalled();
    expect(screen.queryByText(NATO)).toBeNull();
  });
});
