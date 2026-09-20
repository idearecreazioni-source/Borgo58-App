import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// I MINUTI CHE SI POSSONO SCEGLIERE SONO QUATTRO — 20/09/2026
// =====================================================================
// 🔴 PERCHE' QUESTA PROVA GUARDA LE OPZIONI OFFERTE, non la validazione.
//    La prima stesura si accontentava di `step="900"` sul campo orario
//    nativo: il browser rifiutava un 20:07 al salvataggio, ma la rotella
//    dei minuti continuava a offrirli tutti e sessanta. Cioè un divieto che
//    si incontra DOPO, invece di una scelta che si vede prima — ed è la
//    ragione per cui la richiesta è stata rifatta.
//
// ⚠️ E il caso opposto conta quanto il primo: un orario già scritto fuori
//    quarto deve restare leggibile e salvabile. Arrotondarlo da soli
//    cambierebbe un promemoria che qualcuno aveva messo, senza dirlo.

const finte = { getTask: vi.fn(), updateTask: vi.fn(), createTask: vi.fn() };

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
        <Route path="/agenda/nuovo" element={<TaskForm />} />
        <Route path="/agenda/:id" element={<TaskForm />} />
      </Routes>
    </MemoryRouter>,
  );

const taskCon = (dueTime) => ({
  id: "t-1",
  title: "Rinnovo firma digitale",
  description: "",
  due_date: "2026-09-20",
  due_time: dueTime,
  remind_at: null,
  priority: "media",
  status: "da_fare",
  category: "altro",
  visibile_staff: false,
  preferito: false,
  origine_modulo: null,
});

const menuMinuti = () => document.querySelector('[data-campo="scadenza-minuti"]');
const menuOre = () => document.querySelector('[data-campo="scadenza-ore"]');
const vociDi = (select) => [...select.options].map((o) => o.value);
const etichetteDi = (select) => [...select.options].map((o) => o.textContent);

async function scegli(select, valore) {
  await act(async () => {
    select.value = valore;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-19T10:00:00"));
  finte.getTask.mockReset();
  finte.updateTask.mockReset().mockResolvedValue({});
  finte.createTask.mockReset().mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("🔴 in un task nuovo il menu dei minuti offre SOLO i quarti", () => {
  it("le voci sono esattamente 00, 15, 30, 45", async () => {
    mostra("/agenda/nuovo");
    expect(await screen.findByRole("heading", { name: "Nuovo task" })).toBeTruthy();
    const minuti = menuMinuti();
    expect(minuti, "il menu dei minuti non c'è").toBeTruthy();
    // ⚠️ La voce vuota compare finché l'ora non è scelta: è «non deciso»,
    //    non un minuto.
    expect(vociDi(minuti).filter((v) => v !== "")).toEqual(["00", "15", "30", "45"]);
  });

  it("⚠️ e non esiste più un campo orario che li offra tutti e sessanta", () => {
    // È esattamente ciò che la prima stesura lasciava passare.
    expect(document.querySelectorAll('input[type="time"]')).toHaveLength(0);
  });

  it("le ore restano tutte e ventiquattro", async () => {
    mostra("/agenda/nuovo");
    await screen.findByRole("heading", { name: "Nuovo task" });
    expect(vociDi(menuOre()).filter((v) => v !== "")).toHaveLength(24);
  });
});

describe("🔴 un orario storico fuori quarto resta, e non viene riscritto", () => {
  it("le 20:07 si rileggono, e il minuto compare marcato «scritto prima»", async () => {
    finte.getTask.mockResolvedValue(taskCon("20:07:00"));
    mostra("/agenda/t-1");
    await waitFor(() => expect(menuMinuti()?.value).toBe("07"));
    expect(menuOre().value).toBe("20");
    expect(vociDi(menuMinuti())).toEqual(["00", "15", "30", "45", "07"]);
    expect(etichetteDi(menuMinuti()).at(-1)).toMatch(/scritto prima/);
  });

  it("⚠️ e vale per le 9:50, che col passo di cinque minuti erano regolari", async () => {
    finte.getTask.mockResolvedValue(taskCon("09:50:00"));
    mostra("/agenda/t-1");
    await waitFor(() => expect(menuMinuti()?.value).toBe("50"));
    expect(vociDi(menuMinuti())).toContain("50");
  });

  it("🔴 ma cambiando minuto si sceglie fra i quarti, e il vecchio non torna", async () => {
    finte.getTask.mockResolvedValue(taskCon("20:07:00"));
    mostra("/agenda/t-1");
    await waitFor(() => expect(menuMinuti()?.value).toBe("07"));

    await scegli(menuMinuti(), "30");
    expect(menuMinuti().value).toBe("30");
    expect(vociDi(menuMinuti()), "il minuto vecchio è ancora offerto").toEqual([
      "00",
      "15",
      "30",
      "45",
    ]);
  });

  it("⚠️ e cambiando SOLO l'ora il minuto storico non viene arrotondato di nascosto", async () => {
    // 🔴 Il verso che fa danno: se toccare l'ora riportasse i minuti su un
    //    quarto, un promemoria delle 20:07 diventerebbe delle 20:00 senza
    //    che nessuno l'abbia chiesto.
    finte.getTask.mockResolvedValue(taskCon("20:07:00"));
    mostra("/agenda/t-1");
    await waitFor(() => expect(menuMinuti()?.value).toBe("07"));

    await scegli(menuOre(), "21");
    expect(menuOre().value).toBe("21");
    expect(menuMinuti().value, "il minuto storico è stato arrotondato").toBe("07");
  });
});
