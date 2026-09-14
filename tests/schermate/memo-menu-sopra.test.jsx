import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// IL MENU LATERALE SOPRA «PREMI E PARLA» — 12/09/2026, mandato notturno,
// blocco C (dal collaudo sull'iPhone)
// =====================================================================
// 🔴 COSA SI PROVA:
//    · aperto da MEMO voce, il menu sta SOPRA la barra fissa di «Premi e
//      parla» (prima erano allo stesso livello, e la barra, che viene dopo
//      nella pagina, copriva le ultime voci del menu);
//    · se il microfono è acceso, toccare una voce del menu NON lascia la
//      pagina: chiede. «Continua a registrare» chiude il menu e il
//      microfono resta acceso; «Lascia perdere e vai» spegne senza
//      mandare niente e va. Prima la pagina si chiudeva e quello che si era
//      detto spariva in silenzio.
//
// ⚠️ SI MONTA IL TELAIO VERO e la pagina vera di MEMO, con le stesse
//    letture finte di `memo-lanciatore.test.jsx`. Questo file NON importa
//    moduli nuovi: sul codice di prima i casi diventano rossi per il
//    comportamento, non per un import mancante.
// ⚠️ Qui barra laterale e menu del telefono ci sono tutti e due (il CSS che
//    li nasconde secondo lo schermo non c'è): le voci del menu del telefono
//    sono le ULTIME trovate, perché il pannello si disegna dopo.

const finte = {
  auth: { isTitolare: true, isStaff: false, logout: vi.fn() },
  manda: vi.fn(),
};

vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => finte.auth }));
vi.mock("../../src/components/AvvisoLettureTagliate", () => ({ default: () => null }));
vi.mock("../../src/components/AvvisoAggiornamento", () => ({ default: () => null }));
vi.mock("../../src/components/RipresaBozza", () => ({ default: () => null }));
vi.mock("../../src/lib/api/voce", () => ({
  appuntiDaApprovare: vi.fn(() => Promise.resolve([])),
  mandaDettato: (...a) => finte.manda(...a),
  azioniDellaDettatura: vi.fn(() => Promise.resolve([])),
  approvaAppunto: vi.fn(),
  scartaAppunto: vi.fn(),
  scegliPerAzione: vi.fn(),
  chiaviVoce: vi.fn(() => Promise.resolve([])),
  creaChiaveVoce: vi.fn(),
  revocaChiaveVoce: vi.fn(),
}));
vi.mock("../../src/lib/api/assistenteFoto", () => ({
  spesaAiDelMese: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("../../src/lib/api/domandeMemo", () => ({
  rispondiA: vi.fn(() => Promise.resolve({ risposta: { testo: "" } })),
}));
vi.mock("../../src/lib/calcoli/domande", () => ({ titoloDellaDomanda: () => "Una domanda" }));
vi.mock("../../src/components/RispostaMemo", () => ({ default: () => null }));

let finto = null;
vi.mock("../../src/lib/calcoli/voce", async (vero) => {
  const dentro = await vero();
  return {
    ...dentro,
    riconoscitoreDisponibile: () => true,
    statoDettatura: () => ({ frase: "", cosaFare: "" }),
    creaRiconoscitore: () => {
      finto = { start: vi.fn(), stop: vi.fn() };
      return finto;
    },
  };
});

const { default: Layout } = await import("../../src/components/Layout");
const { default: Detta } = await import("../../src/pages/assistente/Detta");

function Qui({ nome }) {
  const { pathname } = useLocation();
  return (
    <p data-qui="">
      {nome} — {pathname}
    </p>
  );
}

const mostra = () =>
  render(
    <MemoryRouter initialEntries={["/detta"]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/agenda" element={<Qui nome="Agenda" />} />
          <Route path="/dashboard" element={<Qui nome="Dashboard" />} />
          <Route path="/detta" element={<Detta />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const dove = () => document.querySelector("[data-qui]")?.textContent ?? "(in MEMO)";
async function tocca(el) {
  await act(async () => {
    el.click();
  });
}
async function accendiEParla(testo) {
  await tocca(screen.getByRole("button", { name: /Premi e parla/i }));
  await act(async () => {
    finto.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: testo }], { isFinal: true })] });
  });
}
const apriMenu = () => tocca(screen.getByRole("button", { name: "Apri menu" }));
// La voce del menu del telefono: l'ultima, il pannello si disegna dopo.
const voceDelMenu = (nome) => screen.getAllByRole("link", { name: nome }).at(-1);
const menuAperto = () => screen.queryByRole("button", { name: "Chiudi menu" }) !== null;
const livello = (el) => Number(/(?:^|\s)z-(\d+)(?:\s|$)/.exec(el?.className ?? "")?.[1] ?? 0);

beforeEach(() => {
  finto = null;
  finte.auth = { isTitolare: true, isStaff: false, logout: vi.fn() };
  finte.manda.mockReset().mockResolvedValue({ dettatura_id: "d-1", esito: "capita" });
});
afterEach(() => vi.clearAllMocks());

describe("🔴 il menu copre «Premi e parla»", () => {
  it("aperto da MEMO voce, il menu sta a un livello più alto della barra del pulsante", async () => {
    mostra();
    await apriMenu();
    const menu = screen.getByRole("button", { name: "Chiudi menu" }).closest(".fixed");
    const barra = document.querySelector("[data-barra-pollice]");
    expect(barra).toBeTruthy();
    expect(livello(menu)).toBeGreaterThan(livello(barra));
  });

  it("richiuso il menu, «Premi e parla» c'è di nuovo, e il menu non c'è più", async () => {
    mostra();
    await apriMenu();
    await tocca(screen.getByRole("button", { name: "Chiudi menu" }));
    expect(menuAperto()).toBe(false);
    expect(screen.getByRole("button", { name: /Premi e parla/i }).disabled).toBe(false);
  });
});

describe("🔴 a microfono acceso il menu non butta via quello che si è detto", () => {
  it("toccare una voce del menu NON lascia la pagina: chiede, e non spegne né manda", async () => {
    mostra();
    await accendiEParla("ricordami il dentista lunedì");
    await apriMenu();
    await tocca(voceDelMenu("Agenda"));

    expect(dove()).toBe("(in MEMO)");
    expect(finto.stop).not.toHaveBeenCalled();
    expect(finte.manda).not.toHaveBeenCalled();
    expect(screen.getByText(/Stai registrando/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ferma e manda/i })).toBeTruthy();
  });

  it("«Continua a registrare»: il menu si chiude, il microfono resta acceso, niente parte", async () => {
    mostra();
    await accendiEParla("ricordami il dentista lunedì");
    await apriMenu();
    await tocca(voceDelMenu("Agenda"));
    await tocca(screen.getByRole("button", { name: "Continua a registrare" }));

    expect(menuAperto()).toBe(false);
    expect(dove()).toBe("(in MEMO)");
    expect(finto.stop).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Ferma e manda/i })).toBeTruthy();
    // E «Ferma e manda» funziona come prima: manda quello che si era detto.
    await tocca(screen.getByRole("button", { name: /Ferma e manda/i }));
    expect(finte.manda).toHaveBeenCalledTimes(1);
  });

  it("«Lascia perdere e vai»: spegne SENZA mandare, e va dove si era toccato", async () => {
    mostra();
    await accendiEParla("ricordami il dentista lunedì");
    await apriMenu();
    await tocca(voceDelMenu("Agenda"));
    await tocca(screen.getByRole("button", { name: "Lascia perdere e vai" }));

    expect(dove()).toBe("Agenda — /agenda");
    expect(finto.stop).toHaveBeenCalled();
    expect(finte.manda).not.toHaveBeenCalled();
  });

  it("«Esci» a microfono acceso chiede anche lui, invece di uscire subito", async () => {
    mostra();
    await accendiEParla("ricordami il dentista lunedì");
    await apriMenu();
    await tocca(screen.getAllByRole("button", { name: "Esci" }).at(-1));
    expect(finte.auth.logout).not.toHaveBeenCalled();
    expect(screen.getByText(/Stai registrando/)).toBeTruthy();
  });

  // 🔴 IL LOGO IN ALTO — decisione di Alessio del 12/09/2026: anche lui
  //    porta via da MEMO, quindi anche lui chiede.
  it("il logo a microfono acceso chiede, e «Continua» resta in MEMO col microfono acceso", async () => {
    mostra();
    await accendiEParla("ricordami il dentista lunedì");
    await tocca(screen.getByRole("link", { name: "Torna alla schermata iniziale" }));
    expect(dove()).toBe("(in MEMO)");
    expect(screen.getByText(/Stai registrando/)).toBeTruthy();
    await tocca(screen.getByRole("button", { name: "Continua a registrare" }));
    expect(screen.queryByText(/Stai registrando/)).toBeNull();
    expect(finto.stop).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Ferma e manda/i })).toBeTruthy();
  });

  it("il logo, «Lascia perdere e vai»: spegne senza mandare e porta alla Dashboard", async () => {
    mostra();
    await accendiEParla("ricordami il dentista lunedì");
    await tocca(screen.getByRole("link", { name: "Torna alla schermata iniziale" }));
    await tocca(screen.getByRole("button", { name: "Lascia perdere e vai" }));
    expect(dove()).toBe("Dashboard — /dashboard");
    expect(finto.stop).toHaveBeenCalled();
    expect(finte.manda).not.toHaveBeenCalled();
  });

  it("il logo a microfono spento porta alla Dashboard, senza chiedere", async () => {
    mostra();
    await tocca(screen.getByRole("link", { name: "Torna alla schermata iniziale" }));
    expect(dove()).toBe("Dashboard — /dashboard");
  });

  it("a microfono spento il menu porta dove si tocca, senza chiedere niente", async () => {
    mostra();
    await apriMenu();
    await tocca(voceDelMenu("Agenda"));
    expect(dove()).toBe("Agenda — /agenda");
    expect(screen.queryByText(/Stai registrando/)).toBeNull();
  });
});
