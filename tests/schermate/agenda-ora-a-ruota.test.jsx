import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// IL PANNELLO DELL'ORA, VISTO DALLA SCHERMATA — 20/09/2026
// =====================================================================
// 🔴 QUESTA PROVA GUARDA COSA SI PUO' SCEGLIERE E QUANDO LA SCELTA DIVENTA
//    VERA. È la quarta forma di questo campo in un giorno, e ognuna è caduta
//    per una ragione diversa: il campo nativo offriva sessanta minuti e
//    rifiutava al salvataggio; i menu a tendina erano due elenchi lunghi; le
//    ruote in linea cambiavano l'orario a ogni tocco, senza un momento in cui
//    dire «ho scelto».
//    Adesso c'è un riquadro con Annulla e Conferma, e queste prove tengono
//    ferme tutte e due le cose: le voci offerte e il momento della scelta.

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

const taskCon = (dueTime, extra = {}) => ({
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
  ...extra,
});

const campo = (quale = "scadenza") => document.querySelector(`[data-scelta-ora="${quale}"]`);
const oraScritta = (quale = "scadenza") => campo(quale).dataset.valore;
const apri = (quale = "scadenza") => campo(quale).querySelector("[data-apri-ora]");
const pannello = (quale = "scadenza") => document.querySelector(`[data-pannello-ora="${quale}"]`);
const ruotaOre = () => document.querySelector('[data-campo="scadenza-ore"]');
const ruotaMinuti = () => document.querySelector('[data-campo="scadenza-minuti"]');
const voci = (r) => [...r.querySelectorAll('[role="option"]')].map((o) => o.dataset.valore);
const scelto = (r) => r.dataset.valore;
const fascia = (q) => pannello().querySelector(`[data-fascia="${q}"]`);

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

/** Apre il pannello di un task già scritto. */
const apriSu = async (ora, quale = "scadenza") => {
  finte.getTask.mockResolvedValue(taskCon(ora));
  mostra("/agenda/t-1");
  await waitFor(() => expect(oraScritta(quale)).toBe(ora.slice(0, 5)));
  await tocca(apri(quale));
  await waitFor(() => expect(pannello(quale)).toBeTruthy());
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

describe("🔴 il riquadro si apre, e prima non c'è", () => {
  it("il campo mostra l'ora scritta e apre il pannello", async () => {
    await apriSu("09:30:00");
    expect(pannello()).toBeTruthy();
    expect(pannello().querySelector("[data-riga-centrale]"), "manca la riga centrale").toBeTruthy();
    expect(pannello().querySelector("[data-annulla-ora]")).toBeTruthy();
    expect(pannello().querySelector("[data-conferma-ora]")).toBeTruthy();
  });

  it("🔴 e non c'è nessun campo orario del browser, su nessuna piattaforma", async () => {
    // ⚠️ Il nativo si potrebbe tenere solo potendo verificare che proponga
    //    davvero i soli scaglioni da cinque: da qui non si può verificare,
    //    e la regola dice di non mostrare mai tutti i minuti per poi
    //    respingerne alcuni al salvataggio.
    await apriSu("09:30:00");
    expect(document.querySelectorAll('input[type="time"]')).toHaveLength(0);
  });
});

describe("🔴 mattina e pomeriggio, e le voci offerte", () => {
  it("mattina mostra 00-11, pomeriggio 12-23", async () => {
    await apriSu("09:30:00");
    expect(fascia("mattina").getAttribute("aria-pressed")).toBe("true");
    expect(voci(ruotaOre())).toEqual([
      "00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11",
    ]);

    await tocca(fascia("pomeriggio"));
    expect(voci(ruotaOre())[0]).toBe("12");
    expect(voci(ruotaOre()).at(-1)).toBe("23");
    // Le 09:30 diventano le 21:30: i minuti restano dov'erano.
    expect(scelto(ruotaOre())).toBe("21");
    expect(scelto(ruotaMinuti())).toBe("30");
  });

  it("i minuti sono dodici, di cinque in cinque", async () => {
    await apriSu("09:30:00");
    expect(voci(ruotaMinuti())).toEqual([
      "00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55",
    ]);
  });
});

describe("🔴 le ruote girano: dito, rotella, tastiera", () => {
  it("toccando una voce si sceglie quella", async () => {
    await apriSu("09:30:00");
    await tocca(ruotaMinuti().querySelector('[data-valore="45"]'));
    expect(scelto(ruotaMinuti())).toBe("45");
  });

  it("🔴 con le frecce si gira: dall'ultima voce si torna alla prima", async () => {
    await apriSu("09:55:00");
    await tasto(ruotaMinuti(), "ArrowDown");
    expect(scelto(ruotaMinuti()), "la ruota si è fermata al bordo").toBe("00");
    await tasto(ruotaMinuti(), "ArrowUp");
    expect(scelto(ruotaMinuti())).toBe("55");
  });

  it("⚠️ e gira anche sulle ore, dentro la fascia", async () => {
    await apriSu("11:00:00");
    await tasto(ruotaOre(), "ArrowDown");
    expect(scelto(ruotaOre())).toBe("00");
  });

  it("con la rotella del mouse si scorre", async () => {
    await apriSu("09:30:00");
    await rotella(ruotaMinuti(), 10);
    expect(scelto(ruotaMinuti())).toBe("35");
    await rotella(ruotaMinuti(), -10);
    expect(scelto(ruotaMinuti())).toBe("30");
  });

  it("⚠️ Inizio e Fine portano ai due capi", async () => {
    await apriSu("09:30:00");
    await tasto(ruotaMinuti(), "End");
    expect(scelto(ruotaMinuti())).toBe("55");
    await tasto(ruotaMinuti(), "Home");
    expect(scelto(ruotaMinuti())).toBe("00");
  });
});

describe("🔴 finché non si conferma, l'orario non è cambiato", () => {
  it("girare le ruote non tocca il valore vero", async () => {
    // 🔴 È la ragione per cui questa forma ha sostituito le ruote in linea:
    //    lì ogni tocco cambiava l'orario, quindi «guardare» e «scegliere»
    //    erano lo stesso gesto e non si poteva ripensarci.
    await apriSu("09:30:00");
    await tocca(ruotaMinuti().querySelector('[data-valore="45"]'));
    expect(oraScritta(), "l'orario è cambiato prima della conferma").toBe("09:30");
  });

  it("Annulla esce com'era entrato", async () => {
    await apriSu("09:30:00");
    await tocca(ruotaMinuti().querySelector('[data-valore="45"]'));
    await tocca(pannello().querySelector("[data-annulla-ora]"));
    expect(pannello()).toBeNull();
    expect(oraScritta()).toBe("09:30");
  });

  it("Conferma scrive la scelta", async () => {
    await apriSu("09:30:00");
    await tocca(ruotaMinuti().querySelector('[data-valore="45"]'));
    await tocca(pannello().querySelector("[data-conferma-ora]"));
    expect(pannello()).toBeNull();
    expect(oraScritta()).toBe("09:45");
  });
});

describe("🔴 un orario storico resta com'è", () => {
  it("le 20:07 si rileggono, e il minuto compare marcato", async () => {
    await apriSu("20:07:00");
    expect(fascia("pomeriggio").getAttribute("aria-pressed")).toBe("true");
    expect(voci(ruotaMinuti()).at(-1)).toBe("07");
    expect(ruotaMinuti().querySelector('[data-valore="07"]').textContent).toMatch(/scritto prima/);
  });

  it("🔴 e non viene arrotondato se si cambia altro", async () => {
    // Il verso che farebbe danno: toccare l'ora non deve riscrivere il
    // minuto di un promemoria che qualcuno aveva messo.
    await apriSu("20:07:00");
    await tocca(ruotaOre().querySelector('[data-valore="21"]'));
    await tocca(pannello().querySelector("[data-conferma-ora]"));
    expect(oraScritta()).toBe("21:07");
  });

  it("⚠️ ma una scelta volontaria usa gli scaglioni da cinque, e il vecchio non torna", async () => {
    await apriSu("20:07:00");
    await tocca(ruotaMinuti().querySelector('[data-valore="10"]'));
    expect(voci(ruotaMinuti())).toHaveLength(12);
    await tocca(pannello().querySelector("[data-conferma-ora]"));
    expect(oraScritta()).toBe("20:10");
  });
});

describe("🔴 lo stesso pannello vale per il promemoria Telegram", () => {
  it("si apre, gira e conferma anche lì", async () => {
    finte.getTask.mockResolvedValue(taskCon("09:30:00", { remind_at: "2026-09-20T06:30:00Z" }));
    mostra("/agenda/t-1");
    await waitFor(() => expect(campo("avviso")).toBeTruthy());

    await tocca(apri("avviso"));
    await waitFor(() => expect(pannello("avviso")).toBeTruthy());
    const minutiAvviso = document.querySelector('[data-campo="avviso-minuti"]');
    expect(voci(minutiAvviso)).toHaveLength(12);

    await tocca(minutiAvviso.querySelector('[data-valore="45"]'));
    await tocca(pannello("avviso").querySelector("[data-conferma-ora]"));
    expect(oraScritta("avviso").slice(3)).toBe("45");
  });

  it("⚠️ e senza giorno il pulsante è spento: un'ora senza giorno non è un avviso", async () => {
    finte.getTask.mockResolvedValue(taskCon("09:30:00"));
    mostra("/agenda/t-1");
    await waitFor(() => expect(campo("avviso")).toBeTruthy());
    expect(apri("avviso").disabled).toBe(true);
  });
});
