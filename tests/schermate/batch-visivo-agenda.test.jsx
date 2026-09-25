import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// IL PRIMO GIRO DEL CENSIMENTO VISIVO — 25/09/2026
// =====================================================================
// Cinque cose trovate misurando il gestionale pubblicato su Prova, e
// tenute ferme qui:
//   1. in Agenda «Elimina» chiedeva niente e cancellava al primo tocco;
//   2. «Visibile allo staff» aveva un bersaglio di 5,0 mm contro gli 8,5
//      di «Per me conta»;
//   3. data e «si ripete» erano alti 7,5 mm contro gli 8,5 degli altri;
//   4. a 390 punti «Non adesso» schiacciava il titolo di «Da sistemare»;
//   5. l'avviso delle letture incomplete ordinava di restringere periodo e
//      filtri e parlava di totali, in schermate che non ne hanno.
//
// ⚠️ Queste prove girano senza impaginazione (jsdom): non misurano
//    millimetri, guardano le regole che li producono — la classe
//    `tocco-campo` e le altezze scritte in centimetri veri. È la stessa
//    scelta delle altre prove di schermata di questo progetto, e il
//    limite è dichiarato: se qualcuno cambiasse il valore di
//    `.tocco-campo` nel foglio di stile, qui non se ne accorgerebbe
//    nessuno.

const finte = { getTask: vi.fn(), deleteTask: vi.fn() };

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
  deleteTask: (...a) => finte.deleteTask(...a),
  getTask: (...a) => finte.getTask(...a),
}));
vi.mock("../../src/lib/api/voce", () => ({ azioneAMano: vi.fn(), chiudiAMano: vi.fn() }));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isTitolare: true }) }));

const { default: TaskForm } = await import("../../src/pages/agenda/TaskForm");
const { Avvisi } = await import("../../src/pages/Dashboard");
const { default: AvvisoLettureTagliate } = await import("../../src/components/AvvisoLettureTagliate");
const { segnalaLetturaTagliata, dimenticaLettureTagliate } = await import("../../src/lib/lettureTagliate");

const TITOLO = "Rinnovo firma digitale";

const impegno = {
  id: "t-1",
  title: TITOLO,
  description: "",
  due_date: "2026-09-20",
  due_time: null,
  remind_at: null,
  priority: "media",
  status: "da_fare",
  category: "altro",
  visibile_staff: false,
  preferito: false,
  origine_modulo: null,
};

const mostraImpegno = async () => {
  render(
    <MemoryRouter initialEntries={["/agenda/t-1"]}>
      <Routes>
        <Route path="/agenda" element={<p>elenco agenda</p>} />
        <Route path="/agenda/:id" element={<TaskForm />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(document.querySelector("[data-elimina-impegno]")).toBeTruthy());
};

const tocca = async (el) => {
  await act(async () => {
    el.click();
  });
};

// L'altezza minima di un campo, in centimetri veri: o dalla classe
// comune dei campi (`.tocco-campo`, 0,85 cm in index.css) o da uno stile
// scritto in `calc(var(--pxcm) * X)`. Un campo senza nessuna delle due
// non ha un'altezza garantita e vale zero — cioè fa diventare rossa la
// prova invece di passarla.
const TOCCO_CAMPO_CM = 0.85;
const altezzaCm = (el) => {
  const dallaClasse = el.classList.contains("tocco-campo") ? TOCCO_CAMPO_CM : 0;
  const scritto = (el.getAttribute("style") ?? "").match(/min-height:\s*calc\(var\(--pxcm\)\s*\*\s*([\d.]+)\)/);
  return Math.max(dallaClasse, scritto ? Number(scritto[1]) : 0);
};

beforeEach(() => {
  finte.getTask.mockReset().mockResolvedValue(impegno);
  finte.deleteTask.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  vi.clearAllMocks();
  dimenticaLettureTagliate();
});

describe("🔴 in Agenda «Elimina» chiede conferma", () => {
  it("il primo tocco non cancella, e la conferma nomina l'impegno", async () => {
    await mostraImpegno();
    await tocca(document.querySelector("[data-elimina-impegno]"));
    expect(finte.deleteTask).not.toHaveBeenCalled();
    expect(screen.getByText(new RegExp(`Elimino l'impegno «${TITOLO}»\\?`))).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sì, elimina" })).toBeTruthy();
  });

  it("«Annulla» chiude la richiesta senza cancellare", async () => {
    await mostraImpegno();
    await tocca(document.querySelector("[data-elimina-impegno]"));
    await tocca(screen.getByRole("button", { name: "Annulla" }));
    expect(finte.deleteTask).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Sì, elimina" })).toBeNull();
    expect(document.querySelector("[data-elimina-impegno]")).toBeTruthy();
  });

  it("«Sì, elimina» cancella quell'impegno, una volta sola", async () => {
    await mostraImpegno();
    await tocca(document.querySelector("[data-elimina-impegno]"));
    await tocca(screen.getByRole("button", { name: "Sì, elimina" }));
    await waitFor(() => expect(screen.getByText("elenco agenda")).toBeTruthy());
    expect(finte.deleteTask).toHaveBeenCalledTimes(1);
    expect(finte.deleteTask).toHaveBeenCalledWith("t-1");
  });
});

describe("🔴 in Agenda i bersagli e le altezze sono quelli degli altri campi", () => {
  it("«Visibile allo staff» ha il bersaglio di «Per me conta»", async () => {
    await mostraImpegno();
    const staff = document.querySelector("[data-casella-staff]");
    const preferito = document.querySelector("[data-casella-preferito]");
    expect(staff.tagName).toBe("LABEL");
    expect(within(staff).getByRole("checkbox")).toBeTruthy();
    expect(altezzaCm(preferito)).toBe(TOCCO_CAMPO_CM);
    expect(altezzaCm(staff)).toBeGreaterThanOrEqual(altezzaCm(preferito));
  });

  it("le date e «si ripete» sono alti quanto il campo del titolo", async () => {
    await mostraImpegno();
    const titolo = screen.getByDisplayValue(TITOLO);
    const date = [...document.querySelectorAll('input[type="date"]')];
    const ripete = document.querySelector("[data-ripete] select");
    expect(date.length).toBe(2);
    expect(ripete).toBeTruthy();
    const riferimento = altezzaCm(titolo);
    expect(riferimento).toBe(TOCCO_CAMPO_CM);
    for (const c of [...date, ripete]) expect(altezzaCm(c)).toBeGreaterThanOrEqual(riferimento);
  });
});

describe("🔴 «Da sistemare» sul telefono non schiaccia il titolo", () => {
  const avviso = {
    chiave: "haccp",
    quanti: 2,
    titolo: "Non conformità aperte in HACCP",
    dettaglio: "BASE-Congelatore: -17,0 °C, fuori dal range -22,0/-18,0 °C",
    gravita: "alta",
    dove: "/haccp/non-conformita",
    rimandato_a: null,
  };

  it("sul telefono il testo e «Non adesso» stanno uno sotto l'altro; da sm in su, affiancati", () => {
    render(
      <MemoryRouter>
        <Avvisi avvisi={[avviso]} onVai={vi.fn()} onRimanda={vi.fn()} onRiprendi={vi.fn()} />
      </MemoryRouter>,
    );
    const riga = document.querySelector("[data-avviso-riga]");
    const classi = [...riga.classList];
    // Senza prefisso vale per il telefono: in colonna.
    expect(classi).toContain("flex-col");
    expect(classi).not.toContain("flex-row");
    // Dal tablet in su torna come prima.
    expect(classi).toContain("sm:flex-row");
    // E la descrizione sul telefono non si taglia.
    const dettaglio = screen.getByText(avviso.dettaglio);
    expect(dettaglio.classList.contains("truncate")).toBe(false);
    expect(dettaglio.classList.contains("sm:truncate")).toBe(true);
    expect(within(riga).getByRole("button", { name: "Non adesso" })).toBeTruthy();
  });
});

describe("🔴 l'avviso delle letture incomplete non chiede gesti che la schermata non ha", () => {
  it("dice che l'elenco è parziale, coi numeri, senza periodo, filtri o totali", () => {
    segnalaLetturaTagliata("ingredients", 1000, 1368);
    render(<AvvisoLettureTagliate />);
    const testo = document.querySelector("[data-avviso-letture-tagliate]").textContent;
    expect(testo).toMatch(/incompleto/);
    expect(testo).toMatch(/parziale/);
    expect(testo).toMatch(/1000/);
    expect(testo).toMatch(/1368/);
    expect(testo).not.toMatch(/periodo|filtri|totali|qui sopra|ristrett/i);
  });
});
