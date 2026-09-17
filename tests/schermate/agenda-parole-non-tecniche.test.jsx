import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// IN AGENDA SI DICE «IMPEGNO», MAI «TASK» — 17/09/2026
// =====================================================================
// 🔴 PERCHE' ESISTE, ed e' una misura e non un timore. L'11/09/2026 la parola
//    «task» e' stata tolta dall'interfaccia e sostituita con «impegno»
//    (`docs/consegne/20260911_impegno_non_task.md`). Cercata in tutto
//    `tests/`: **zero occorrenze** di «Nuovo impegno» e **zero** di «Nuovo
//    task». Quella rinomina viveva soltanto in un riepilogo.
//    ⚠️ Una parola che vive in un riepilogo torna indietro al primo pulsante
//    nuovo che qualcuno scrive, e non se ne accorge nessuno: e' la forma
//    della disciplina che si degrada, e in questo progetto vale la regola
//    opposta — *preferire l'automazione alla disciplina*.
//
// 🔴 SI GUARDA IL TESTO DISEGNATO, NON IL CODICE SORGENTE, ed e' la scelta
//    che rende questa rete usabile. Le funzioni dell'API si chiamano
//    `completaTask`, `spostaTask`, `listTasksForMonth`, e la colonna del
//    database e' `tasks`: un setaccio sul sorgente darebbe falsi allarmi a
//    raffica, e **un guardiano che grida sempre si impara a spegnere**.
//    Quello che conta e' la parola che Alessio legge sullo schermo.
//
// ⚠️ E IL SETACCIO SI TARA SU CASI DI RISPOSTA NOTA (regola del 26/08): un
//    controllo «questa parola non compare» che non sapesse riconoscere la
//    parola direbbe «a posto» su qualunque schermata — cioe' sarebbe un
//    guardiano che approva senza aver guardato.

const parolaTecnica = /task/i;
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
  it("prende «task» dove c'e' davvero", () => {
    expect("+ Nuovo task").toMatch(parolaTecnica);
    expect("Nessun task in ritardo").toMatch(parolaTecnica);
    expect("Tasks completati").toMatch(parolaTecnica);
  });

  it("e non inciampa sulle parole vere del gestionale", () => {
    expect("+ Nuovo impegno").not.toMatch(parolaTecnica);
    // 🔴 «Tasca» E' UNA PAROLA DI QUESTO GESTIONALE — il soggetto delle spese
    //    che Alessio paga di suo — e un setaccio che la scambiasse per
    //    «task» griderebbe su una schermata sana.
    expect("Spesa dalla tasca").not.toMatch(parolaTecnica);
  });
});

describe("🔴 l'elenco dell'Agenda non dice mai «task»", () => {
  it("il pulsante e' «+ Nuovo impegno», e la parola non compare in nessuna delle tre viste", async () => {
    mostra("/agenda");
    expect(screen.getByRole("link", { name: "+ Nuovo impegno" })).toBeTruthy();
    expect(testoDisegnato(), "la Lista dice «task»").not.toMatch(parolaTecnica);

    await tocca(screen.getByRole("button", { name: "Settimana" }));
    await waitFor(() => expect(document.querySelectorAll("[data-giorno]")).toHaveLength(7));
    expect(testoDisegnato(), "la Settimana dice «task»").not.toMatch(parolaTecnica);

    await tocca(screen.getByRole("button", { name: "Mese" }));
    await waitFor(() => expect(finte.mese).toHaveBeenCalled());
    expect(testoDisegnato(), "il Mese dice «task»").not.toMatch(parolaTecnica);
  });
});

describe("🔴 e nemmeno il modulo di un impegno", () => {
  it("scrivendone uno nuovo si legge «Nuovo impegno»", async () => {
    mostra("/agenda/nuovo");
    expect(await screen.findByRole("heading", { name: "Nuovo impegno" })).toBeTruthy();
    expect(testoDisegnato(), "il modulo nuovo dice «task»").not.toMatch(parolaTecnica);
  });

  it("⚠️ e aprendone uno esistente «Modifica impegno» — il titolo che si vede piu' spesso", async () => {
    // Coprire solo il modulo nuovo lascerebbe scoperto proprio il titolo che
    // si tocca ogni volta che si corregge qualcosa.
    mostra("/agenda/t-1");
    expect(await screen.findByRole("heading", { name: "Modifica impegno" })).toBeTruthy();
    expect(testoDisegnato(), "il modulo di modifica dice «task»").not.toMatch(parolaTecnica);
  });
});
