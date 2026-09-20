import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// IL SOLLECITO — spento di suo, e solo dove c'è un promemoria
// =====================================================================
// 🔴 LA COSA DA NON SBAGLIARE E' IL DEFAULT. Un sollecito acceso di suo
//    manderebbe messaggi che nessuno ha chiesto, su task che esistono da
//    prima — ed è esattamente ciò che questo gestionale chiama «una cadenza
//    decisa di nascosto».
//
// ⚠️ E LA SECONDA E' IL LEGAME COL PROMEMORIA: senza avviso il sollecito non
//    ha un istante da cui contare, il database lo rifiuta, e un modulo che
//    lo offrisse lo stesso farebbe fallire il salvataggio.

const finte = { getTask: vi.fn(), createTask: vi.fn(), updateTask: vi.fn() };

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

const taskBase = (extra = {}) => ({
  id: "t-1",
  title: "Rinnovo firma digitale",
  description: "",
  due_date: "2026-09-20",
  due_time: null,
  remind_at: null,
  reminder_sent_at: null,
  priority: "media",
  status: "da_fare",
  category: "altro",
  visibile_staff: false,
  preferito: false,
  origine_modulo: null,
  sollecito_ogni: null,
  sollecito_unita: null,
  ...extra,
});

const riquadroSollecito = () => document.querySelector("[data-sollecito]");
const menuSollecito = () => screen.queryByLabelText("Sollecito");

async function scegli(el, valore) {
  await act(async () => {
    el.value = valore;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-19T10:00:00"));
  finte.getTask.mockReset();
  finte.createTask.mockReset().mockResolvedValue({});
  finte.updateTask.mockReset().mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("🔴 il sollecito è spento, e non si può nemmeno chiedere senza promemoria", () => {
  it("in un task nuovo il riquadro non c'è", async () => {
    mostra("/agenda/nuovo");
    expect(await screen.findByRole("heading", { name: "Nuovo task" })).toBeTruthy();
    expect(riquadroSollecito(), "il sollecito si offre senza promemoria").toBeNull();
  });

  it("⚠️ e nemmeno su un task esistente che non ha un avviso", async () => {
    finte.getTask.mockResolvedValue(taskBase());
    mostra("/agenda/t-1");
    await waitFor(() => expect(finte.getTask).toHaveBeenCalled());
    expect(riquadroSollecito()).toBeNull();
  });

  it("con un avviso il riquadro compare, e la voce scelta è «una volta sola»", async () => {
    finte.getTask.mockResolvedValue(taskBase({ remind_at: "2026-09-20T08:00:00Z" }));
    mostra("/agenda/t-1");
    await waitFor(() => expect(riquadroSollecito()).toBeTruthy());
    expect(menuSollecito().value, "il sollecito è acceso di suo").toBe("no");
  });
});

describe("🔴 acceso, usa le stesse parole della ricorrenza", () => {
  it("«ogni N unità», e le unità sono le quattro di sempre", async () => {
    finte.getTask.mockResolvedValue(taskBase({ remind_at: "2026-09-20T08:00:00Z" }));
    mostra("/agenda/t-1");
    await waitFor(() => expect(menuSollecito()).toBeTruthy());

    await scegli(menuSollecito(), "si");
    const quanti = screen.getByLabelText("Ogni quanto sollecitare");
    const unita = screen.getByLabelText("Unità del sollecito");
    expect(quanti.value).toBe("1");
    expect([...unita.options].map((o) => o.value)).toEqual([
      "giorni",
      "settimane",
      "mesi",
      "anni",
    ]);
    // ⚠️ La proposta si vede e si corregge: non è una risposta data al posto
    //    suo, è la prima cosa su cui cade l'occhio.
    expect(unita.value).toBe("giorni");
  });
});

describe("🔴 quello che arriva al database", () => {
  const salva = async () => {
    const bottone = screen.getByRole("button", { name: /Salva modifiche/ });
    await act(async () => {
      bottone.closest("form").requestSubmit();
    });
  };

  it("spento manda due caselle vuote, non zero", async () => {
    // Uno zero sarebbe una cadenza che non passa mai: il vuoto dice «non
    // l'ha chiesto», che è un'altra cosa.
    finte.getTask.mockResolvedValue(taskBase({ remind_at: "2026-09-20T08:00:00Z" }));
    mostra("/agenda/t-1");
    await waitFor(() => expect(menuSollecito()).toBeTruthy());
    await salva();
    await waitFor(() => expect(finte.updateTask).toHaveBeenCalled());
    const payload = finte.updateTask.mock.calls[0][1];
    expect(payload.sollecito_ogni).toBeNull();
    expect(payload.sollecito_unita).toBeNull();
  });

  it("acceso manda «ogni N unità»", async () => {
    finte.getTask.mockResolvedValue(taskBase({ remind_at: "2026-09-20T08:00:00Z" }));
    mostra("/agenda/t-1");
    await waitFor(() => expect(menuSollecito()).toBeTruthy());
    await scegli(menuSollecito(), "si");
    await scegli(screen.getByLabelText("Unità del sollecito"), "settimane");
    await salva();
    await waitFor(() => expect(finte.updateTask).toHaveBeenCalled());
    const payload = finte.updateTask.mock.calls[0][1];
    expect(payload.sollecito_ogni).toBe(1);
    expect(payload.sollecito_unita).toBe("settimane");
  });

  it("🔴 togliendo il promemoria se ne va anche il sollecito", async () => {
    // Senza questa regola il salvataggio fallirebbe contro il vincolo del
    // database, e chi ha solo tolto un avviso non capirebbe perché.
    finte.getTask.mockResolvedValue(
      taskBase({ remind_at: "2026-09-20T08:00:00Z", sollecito_ogni: 2, sollecito_unita: "giorni" }),
    );
    mostra("/agenda/t-1");
    await waitFor(() => expect(menuSollecito()?.value).toBe("si"));

    await act(async () => {
      screen.getByRole("button", { name: "Rimuovi promemoria" }).click();
    });
    expect(riquadroSollecito(), "il riquadro resta senza promemoria").toBeNull();

    await salva();
    await waitFor(() => expect(finte.updateTask).toHaveBeenCalled());
    const payload = finte.updateTask.mock.calls[0][1];
    expect(payload.remind_at).toBeNull();
    expect(payload.sollecito_ogni).toBeNull();
  });
});
