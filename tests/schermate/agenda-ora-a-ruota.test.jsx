import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LE DUE RUOTE DELL'ORA, VISTE DALLA SCHERMATA — 20/09/2026
// =====================================================================
// 🔴 QUESTA PROVA GUARDA COSA SI PUO' SCEGLIERE, non cosa il browser
//    accetta. È la terza forma di questo campo in un giorno: campo orario
//    nativo (offriva sessanta minuti e rifiutava al salvataggio), due menu a
//    tendina (giusti ma lunghi da aprire col dito), e adesso due ruote.
//    Quello che non compare non si può scegliere: è la sola forma che si
//    controlla guardando le voci.

const finte = { getTask: vi.fn(), updateTask: vi.fn() };

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

const ruotaOre = () => document.querySelector('[data-campo="scadenza-ore"]');
const ruotaMinuti = () => document.querySelector('[data-campo="scadenza-minuti"]');
const voci = (ruota) => [...ruota.querySelectorAll('[role="option"]')].map((o) => o.dataset.valore);
const scelto = (ruota) => ruota.dataset.valore;
const fascia = (quale) =>
  document.querySelector(`[data-scelta-ora="scadenza"] [data-fascia="${quale}"]`);

const tocca = async (el) => {
  await act(async () => {
    el.click();
  });
};
const tasto = async (el, key) => {
  await act(async () => {
    el.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
  });
};
const rotella = async (el, deltaY) => {
  await act(async () => {
    el.dispatchEvent(new window.WheelEvent("wheel", { deltaY, bubbles: true }));
  });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-19T10:00:00"));
  finte.getTask.mockReset();
  finte.updateTask.mockReset().mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("🔴 niente campo orario del browser, e i minuti sono dodici", () => {
  it("non esiste più un input che offre tutti e sessanta i minuti", async () => {
    mostra("/agenda/nuovo");
    await screen.findByRole("heading", { name: "Nuovo task" });
    expect(document.querySelectorAll('input[type="time"]')).toHaveLength(0);
  });

  it("la ruota dei minuti offre gli scaglioni da cinque", async () => {
    mostra("/agenda/nuovo");
    await screen.findByRole("heading", { name: "Nuovo task" });
    expect(voci(ruotaMinuti())).toEqual([
      "00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55",
    ]);
  });

  it("e si parte da mattina: dodici ore, non ventiquattro", async () => {
    mostra("/agenda/nuovo");
    await screen.findByRole("heading", { name: "Nuovo task" });
    expect(voci(ruotaOre())).toEqual([
      "00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11",
    ]);
    expect(fascia("mattina").getAttribute("aria-pressed")).toBe("true");
  });
});

describe("🔴 la fascia cambia quali ore si vedono, e sposta l'ora scelta", () => {
  it("dal pomeriggio si vedono 12-23, e le 09:30 diventano 21:30", async () => {
    finte.getTask.mockResolvedValue(taskCon("09:30:00"));
    mostra("/agenda/t-1");
    await waitFor(() => expect(scelto(ruotaOre())).toBe("09"));

    await tocca(fascia("pomeriggio"));
    expect(voci(ruotaOre())[0]).toBe("12");
    expect(voci(ruotaOre()).at(-1)).toBe("23");
    expect(scelto(ruotaOre())).toBe("21");
    // ⚠️ I minuti restano dov'erano: la fascia riguarda l'ora.
    expect(scelto(ruotaMinuti())).toBe("30");
  });
});

describe("🔴 le ruote si usano col dito, con la rotella e con le frecce", () => {
  it("toccando una voce si sceglie quella", async () => {
    finte.getTask.mockResolvedValue(taskCon("09:30:00"));
    mostra("/agenda/t-1");
    await waitFor(() => expect(scelto(ruotaMinuti())).toBe("30"));

    await tocca(ruotaMinuti().querySelector('[data-valore="45"]'));
    expect(scelto(ruotaMinuti())).toBe("45");
  });

  it("🔴 con le frecce la ruota GIRA: dall'ultima voce si torna alla prima", async () => {
    finte.getTask.mockResolvedValue(taskCon("09:55:00"));
    mostra("/agenda/t-1");
    await waitFor(() => expect(scelto(ruotaMinuti())).toBe("55"));

    await tasto(ruotaMinuti(), "ArrowDown");
    expect(scelto(ruotaMinuti()), "la ruota si è fermata al bordo").toBe("00");

    await tasto(ruotaMinuti(), "ArrowUp");
    expect(scelto(ruotaMinuti())).toBe("55");
  });

  it("⚠️ e gira anche sulle ore, dentro la fascia", async () => {
    finte.getTask.mockResolvedValue(taskCon("11:00:00"));
    mostra("/agenda/t-1");
    await waitFor(() => expect(scelto(ruotaOre())).toBe("11"));

    await tasto(ruotaOre(), "ArrowDown");
    expect(scelto(ruotaOre())).toBe("00");
  });

  it("con la rotella del mouse si scorre", async () => {
    finte.getTask.mockResolvedValue(taskCon("09:30:00"));
    mostra("/agenda/t-1");
    await waitFor(() => expect(scelto(ruotaMinuti())).toBe("30"));

    await rotella(ruotaMinuti(), 10);
    expect(scelto(ruotaMinuti())).toBe("35");
    await rotella(ruotaMinuti(), -10);
    expect(scelto(ruotaMinuti())).toBe("30");
  });

  it("⚠️ Inizio e Fine portano ai due capi", async () => {
    finte.getTask.mockResolvedValue(taskCon("09:30:00"));
    mostra("/agenda/t-1");
    await waitFor(() => expect(scelto(ruotaMinuti())).toBe("30"));

    await tasto(ruotaMinuti(), "End");
    expect(scelto(ruotaMinuti())).toBe("55");
    await tasto(ruotaMinuti(), "Home");
    expect(scelto(ruotaMinuti())).toBe("00");
  });
});

describe("🔴 un orario storico resta com'è", () => {
  it("le 20:07 si rileggono, e il minuto compare marcato", async () => {
    finte.getTask.mockResolvedValue(taskCon("20:07:00"));
    mostra("/agenda/t-1");
    await waitFor(() => expect(scelto(ruotaMinuti())).toBe("07"));
    expect(fascia("pomeriggio").getAttribute("aria-pressed")).toBe("true");
    expect(voci(ruotaMinuti()).at(-1)).toBe("07");
    expect(
      ruotaMinuti().querySelector('[data-valore="07"]').textContent,
    ).toMatch(/scritto prima/);
  });

  it("🔴 e non viene arrotondato se si cambia altro", async () => {
    // Il verso che farebbe danno: toccare l'ora non deve riscrivere il
    // minuto di un promemoria che qualcuno aveva messo.
    finte.getTask.mockResolvedValue(taskCon("20:07:00"));
    mostra("/agenda/t-1");
    await waitFor(() => expect(scelto(ruotaMinuti())).toBe("07"));

    await tocca(ruotaOre().querySelector('[data-valore="21"]'));
    expect(scelto(ruotaOre())).toBe("21");
    expect(scelto(ruotaMinuti()), "il minuto storico è stato arrotondato").toBe("07");
  });

  it("⚠️ ma una scelta volontaria usa gli scaglioni da cinque, e il vecchio non torna", async () => {
    finte.getTask.mockResolvedValue(taskCon("20:07:00"));
    mostra("/agenda/t-1");
    await waitFor(() => expect(scelto(ruotaMinuti())).toBe("07"));

    await tocca(ruotaMinuti().querySelector('[data-valore="10"]'));
    expect(scelto(ruotaMinuti())).toBe("10");
    expect(voci(ruotaMinuti())).toHaveLength(12);
  });
});
