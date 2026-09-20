import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// L'ORA SI SCEGLIE A QUARTI D'ORA — 20/09/2026
// =====================================================================
// 🔴 LA PARTE CHE PUO' FARE DANNO E' LA SECONDA, NON LA PRIMA. Mettere il
//    passo a 900 è una riga; il punto è che `step` in un campo orario non
//    è solo un comodo per il selettore — rende **non valido** un orario
//    fuori griglia. Un promemoria salvato alle 20:07 (o alle 9:50, che col
//    passo di cinque minuti era regolare) non si potrebbe più salvare: il
//    modulo si rifiuterebbe di partire su una cosa che nessuno aveva
//    chiesto di cambiare.
//
// ⚠️ PERCHE' ADESSO IL CASO NON E' PIU' RARO: allargando la griglia da 5 a
//    15 minuti, tutti gli orari a 5, 10, 20, 25… escono dalla griglia. Erano
//    dentro fino a ieri, quindi ce ne sono.
//
// ⚠️ SI GUARDA L'ATTRIBUTO SUL CAMPO DISEGNATO, non la funzione che lo
//    calcola: quello che conta è cosa fa il browser a chi preme «Salva».

const finte = { getTask: vi.fn() };

vi.mock("../../src/lib/api/tasks", () => ({
  agendaCorsie: vi.fn(),
  agendaFatti: vi.fn(),
  completaTask: vi.fn(),
  riapriTask: vi.fn(),
  spostaTask: vi.fn(),
  stellaTask: vi.fn(),
  listTasksForMonth: vi.fn(),
  listTasksBetween: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
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
        <Route path="/agenda/nuovo" element={<TaskForm />} />
        <Route path="/agenda/:id" element={<TaskForm />} />
      </Routes>
    </MemoryRouter>,
  );

const taskCon = (dueTime, remindAt) => ({
  id: "t-1",
  title: "Rinnovo firma digitale",
  description: "",
  due_date: "2026-09-20",
  due_time: dueTime,
  remind_at: remindAt,
  priority: "media",
  status: "da_fare",
  category: "altro",
  visibile_staff: false,
  preferito: false,
  origine_modulo: null,
});

const campiOra = () => [...document.querySelectorAll('input[type="time"]')];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-19T10:00:00"));
  finte.getTask.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("🔴 un task nuovo si scrive a quarti d'ora", () => {
  it("i campi dell'ora hanno il passo di 900 secondi", async () => {
    mostra("/agenda/nuovo");
    expect(await screen.findByRole("heading", { name: "Nuovo task" })).toBeTruthy();
    const ore = campiOra();
    expect(ore.length, "nel modulo non ci sono campi orari").toBeGreaterThan(0);
    for (const campo of ore) {
      expect(campo.getAttribute("step"), "un campo orario non va a quarti d'ora").toBe("900");
    }
  });
});

describe("🔴 ma un orario già scritto fuori dal quarto d'ora resta salvabile", () => {
  it("le 20:07 si rileggono e il campo NON impone il passo", async () => {
    finte.getTask.mockResolvedValue(taskCon("20:07:00", null));
    mostra("/agenda/t-1");
    await waitFor(() => expect(finte.getTask).toHaveBeenCalled());
    const scadenza = await waitFor(() => {
      const c = campiOra().find((x) => x.value === "20:07");
      expect(c, "l'ora storica non si rilegge nel campo").toBeTruthy();
      return c;
    });
    // ⚠️ Nessun `step`: col passo il browser rifiuterebbe il salvataggio di
    //    un valore che il gestionale gli ha messo lui dentro.
    expect(scadenza.getAttribute("step")).toBeNull();
  });

  it("⚠️ e vale anche per le 9:50, che fino a ieri erano regolari", async () => {
    // 🔴 È il caso che il passaggio da 5 a 15 minuti crea da solo: 9:50 era
    //    dentro la griglia vecchia e non è dentro quella nuova.
    finte.getTask.mockResolvedValue(taskCon("09:50:00", null));
    mostra("/agenda/t-1");
    await waitFor(() => expect(finte.getTask).toHaveBeenCalled());
    const scadenza = await waitFor(() => {
      const c = campiOra().find((x) => x.value === "09:50");
      expect(c).toBeTruthy();
      return c;
    });
    expect(scadenza.getAttribute("step")).toBeNull();
  });

  it("⚠️ mentre un orario già su un quarto d'ora il passo ce l'ha", async () => {
    // Il verso opposto: se il passo sparisse sempre, la richiesta non
    // sarebbe soddisfatta proprio su chi corregge un task esistente.
    finte.getTask.mockResolvedValue(taskCon("20:30:00", null));
    mostra("/agenda/t-1");
    await waitFor(() => expect(finte.getTask).toHaveBeenCalled());
    const scadenza = await waitFor(() => {
      const c = campiOra().find((x) => x.value === "20:30");
      expect(c).toBeTruthy();
      return c;
    });
    expect(scadenza.getAttribute("step")).toBe("900");
  });
});
