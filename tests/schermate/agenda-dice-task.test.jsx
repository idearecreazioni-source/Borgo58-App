import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// IN AGENDA SI DICE «TASK» — 20/09/2026, e ROVESCIA il 17/09
// =====================================================================
// 🔴 COSA E' CAMBIATO, E PERCHE' LA PROVA E' RIMASTA. L'11/09 la parola
//    «task» era stata tolta dall'interfaccia e sostituita con «impegno»
//    (`docs/consegne/20260911_impegno_non_task.md`), e il 17/09 questa prova
//    era nata per impedire che tornasse. Il 20/09 la decisione e' stata
//    ROVESCIATA: nei percorsi di Agenda e di MEMO la parola visibile torna a
//    essere «task».
//    ⚠️ LA RAGIONE DI ALLORA NON ERA SBAGLIATA — «task» e' una parola
//    tecnica — ma non e' piu' quella che decide: chi usa il gestionale ha
//    chiesto «task». Quello che resta vero e' il METODO: una parola che vive
//    solo in un riepilogo torna indietro al primo pulsante nuovo che qualcuno
//    scrive. Quindi la prova non si cancella, **si gira**: adesso pretende
//    «task» e rifiuta «impegno» — la stessa rete nell'altro verso.
//    ⚠️ E resta fuori tutto cio' che e' tecnico: tabelle, colonne e funzioni
//    dell'API continuano a chiamarsi come si chiamano.
//
// 🔴 SI GUARDA IL TESTO DISEGNATO, NON IL CODICE SORGENTE, ed e' la scelta
//    che rende questa rete usabile, e adesso vale al contrario: nel sorgente
//    restano `campiImpegno`, `SchedaImpegno` e `chiudiImpegno`, e un setaccio
//    sul sorgente griderebbe su nomi che nessuno legge — **un guardiano che
//    grida sempre si impara a spegnere**.
//    Quello che conta e' la parola che Alessio legge sullo schermo.
//
// ⚠️ E IL SETACCIO SI TARA SU CASI DI RISPOSTA NOTA (regola del 26/08): un
//    controllo «questa parola non compare» che non sapesse riconoscere la
//    parola direbbe «a posto» su qualunque schermata — cioe' sarebbe un
//    guardiano che approva senza aver guardato.

// La parola che in Agenda non si deve piu' leggere. ⚠️ Prende «impegno»,
// «impegni» e «Impegno», e lascia stare tutto il resto.
const parolaVecchia = /impegn/i;
const testoDisegnato = () => document.body.textContent.replace(/\s+/g, " ").trim();

const finte = {
  tra: vi.fn(),
  mese: vi.fn(),
  corsie: vi.fn(),
  fatti: vi.fn(),
  getTask: vi.fn(),
};

vi.mock("../../src/lib/api/tasks", () => ({
  agendaCorsie: (...a) => finte.corsie(...a),
  agendaFatti: (...a) => finte.fatti(...a),
  completaTask: vi.fn(),
  riapriTask: vi.fn(),
  spostaTask: vi.fn(),
  stellaTask: vi.fn(),
  listTasksForMonth: (...a) => finte.mese(...a),
  listTasksBetween: (...a) => finte.tra(...a),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getTask: (...a) => finte.getTask(...a),
}));
vi.mock("../../src/lib/api/voce", () => ({
  azioneAMano: vi.fn(),
  chiudiAMano: vi.fn(),
}));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isTitolare: true }) }));

const { default: AgendaList } = await import("../../src/pages/agenda/AgendaList");
const { default: TaskForm } = await import("../../src/pages/agenda/TaskForm");

const mostra = (inizio) =>
  render(
    <MemoryRouter initialEntries={[inizio]}>
      <Routes>
        <Route path="/agenda" element={<AgendaList />} />
        {/* ⚠️ Il percorso fisso si dichiara PRIMA di quello con il segnaposto:
            «/agenda/nuovo» combacia con tutti e due, e chi apre il modulo
            nuovo non deve finire nel ramo che va a cercare un impegno. */}
        <Route path="/agenda/nuovo" element={<TaskForm />} />
        <Route path="/agenda/:id" element={<TaskForm />} />
      </Routes>
    </MemoryRouter>,
  );

async function tocca(el) {
  await act(async () => {
    el.click();
  });
}

/** Un impegno come lo restituisce il gestionale a chi ne apre uno esistente. */
const impegnoEsistente = {
  id: "t-1",
  title: "Rinnovo firma digitale",
  description: "",
  due_date: "2026-09-20",
  due_time: null,
  priority: "media",
  status: "da_fare",
  category: "altro",
  preferito: false,
  ricorrenza_ogni: null,
  ricorrenza_unita: null,
  remind_at: null,
  reminder_sent_at: null,
  visibile_staff: true,
  origine_modulo: null,
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-09T10:00:00"));
  finte.corsie.mockReset().mockResolvedValue([]);
  finte.fatti.mockReset().mockResolvedValue([]);
  finte.tra.mockReset().mockResolvedValue([]);
  finte.mese.mockReset().mockResolvedValue([]);
  finte.getTask.mockReset().mockResolvedValue(impegnoEsistente);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("🔴 il setaccio riconosce la parola che cerca", () => {
  // ⚠️ SENZA QUESTO, TUTTO IL RESTO NON PROVA NIENTE. Un controllo «non
  //    compare» e' verde anche quando non sa cercare.
  it("prende «impegno» dove c'e' davvero", () => {
    expect("+ Nuovo impegno").toMatch(parolaVecchia);
    expect("Nessun impegno in questo giorno.").toMatch(parolaVecchia);
    expect("La visibilita' degli impegni automatici").toMatch(parolaVecchia);
  });

  it("e non inciampa sulle parole nuove", () => {
    expect("+ Nuovo task").not.toMatch(parolaVecchia);
    // ⚠️ «Tasca» resta una parola di questo gestionale: il setaccio nuovo non
    //    la tocca, ed e' bene che una riga lo dica.
    expect("Spesa dalla tasca").not.toMatch(parolaVecchia);
  });
});

describe("🔴 l'elenco dell'Agenda dice «task», e non dice piu' «impegno»", () => {
  it("il pulsante e' «+ Nuovo task», e la parola vecchia non compare in nessuna delle tre viste", async () => {
    mostra("/agenda");
    expect(screen.getByRole("link", { name: "+ Nuovo task" })).toBeTruthy();
    expect(testoDisegnato(), "la Lista dice ancora «impegno»").not.toMatch(parolaVecchia);

    await tocca(screen.getByRole("button", { name: "Settimana" }));
    await waitFor(() => expect(document.querySelectorAll("[data-giorno]")).toHaveLength(7));
    expect(testoDisegnato(), "la Settimana dice ancora «impegno»").not.toMatch(parolaVecchia);

    await tocca(screen.getByRole("button", { name: "Mese" }));
    await waitFor(() => expect(finte.mese).toHaveBeenCalled());
    expect(testoDisegnato(), "il Mese dice ancora «impegno»").not.toMatch(parolaVecchia);
  });
});

describe("🔴 e nemmeno il modulo di un task", () => {
  it("scrivendone uno nuovo si legge «Nuovo task»", async () => {
    mostra("/agenda/nuovo");
    expect(await screen.findByRole("heading", { name: "Nuovo task" })).toBeTruthy();
    expect(testoDisegnato(), "il modulo nuovo dice ancora «impegno»").not.toMatch(parolaVecchia);
  });

  it("⚠️ e aprendone uno esistente «Modifica task» — il titolo che si vede piu' spesso", async () => {
    // Coprire solo il modulo nuovo lascerebbe scoperto proprio il titolo che
    // si tocca ogni volta che si corregge qualcosa.
    mostra("/agenda/t-1");
    expect(await screen.findByRole("heading", { name: "Modifica task" })).toBeTruthy();
    expect(testoDisegnato(), "il modulo di modifica dice ancora «impegno»").not.toMatch(parolaVecchia);
  });
});
