import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// MEMO VOCE DA QUALUNQUE MODULO, E IL RITORNO — 11/09/2026
// =====================================================================
// 🔴 COSA SI PROVA, per intero e da più moduli: dalla testata si apre MEMO,
//    e da MEMO si torna ESATTAMENTE dove si era — domanda nell'indirizzo
//    compresa — sia cambiando idea (anche a microfono acceso), sia dopo
//    aver detto la cosa.
//
// ⚠️ SI MONTA IL TELAIO VERO (`Layout`, con la barra laterale vera) e la
//    pagina vera di MEMO: il difetto possibile vive nel raccordo fra i due,
//    non dentro nessuno dei due. Tutto ciò che parla col gestionale è finto.
//
// ⚠️ IN QUESTO AMBIENTE TESTATA E BARRA LATERALE SI VEDONO INSIEME: le
//    classi che le nascondono secondo lo schermo sono CSS, che qui non
//    c'è. È un vantaggio: si provano le due porte nella stessa prova.

const finte = {
  auth: { isTitolare: true, isStaff: false, logout: vi.fn() },
  manda: vi.fn(),
  azioni: vi.fn(),
  appunti: vi.fn(),
  approva: vi.fn(),
};

vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => finte.auth }));
vi.mock("../../src/components/AvvisoLettureTagliate", () => ({ default: () => null }));
vi.mock("../../src/components/AvvisoAggiornamento", () => ({ default: () => null }));
vi.mock("../../src/components/RipresaBozza", () => ({ default: () => null }));
vi.mock("../../src/lib/api/voce", () => ({
  appuntiDaApprovare: (...a) => finte.appunti(...a),
  mandaDettato: (...a) => finte.manda(...a),
  azioniDellaDettatura: (...a) => finte.azioni(...a),
  approvaAppunto: (...a) => finte.approva(...a),
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

/** Una schermata finta che dice dove si trova, domanda compresa. */
function Qui({ nome }) {
  const { pathname, search } = useLocation();
  return (
    <p data-qui="">
      {nome} — {pathname}
      {search}
    </p>
  );
}

const mostra = (inizio) =>
  render(
    <MemoryRouter initialEntries={[inizio]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Qui nome="Dashboard" />} />
          <Route path="/cassa/prima-nota" element={<Qui nome="Prima nota" />} />
          <Route path="/agenda" element={<Qui nome="Agenda" />} />
          <Route path="/magazzino" element={<Qui nome="Magazzino" />} />
          <Route path="/detta" element={<Detta />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const dove = () => document.querySelector("[data-qui]")?.textContent ?? "(in MEMO)";
const inMemo = () => screen.queryByRole("heading", { name: "MEMO voce" }) !== null;

async function tocca(el) {
  await act(async () => {
    el.click();
  });
}

beforeEach(() => {
  finte.auth = { isTitolare: true, isStaff: false, logout: vi.fn() };
  finte.manda.mockReset().mockResolvedValue({ dettatura_id: "d-1", esito: "capita" });
  finte.azioni
    .mockReset()
    .mockResolvedValue([{ id: "el-1", frase: "Promemoria: dentista", stato: "in_attesa" }]);
  finte.appunti.mockReset().mockResolvedValue([]);
  finte.approva.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("🔴 MEMO si apre da qualunque modulo e si torna dove si era", () => {
  for (const [inizio, nomeModulo, attesa] of [
    ["/cassa/prima-nota?dal=2026-09-01", "Cassa, Banca e Prima Nota", "Prima nota — /cassa/prima-nota?dal=2026-09-01"],
    ["/agenda", "Agenda", "Agenda — /agenda"],
    ["/magazzino", "Magazzino", "Magazzino — /magazzino"],
    ["/dashboard", "Dashboard", "Dashboard — /dashboard"],
  ]) {
    it(`da ${inizio}: testata → MEMO → «Torna in ${nomeModulo}»`, async () => {
      mostra(inizio);
      expect(dove()).toBe(attesa);

      await tocca(screen.getByRole("link", { name: "Apri MEMO voce" }));
      expect(inMemo()).toBe(true);

      await tocca(screen.getByRole("link", { name: `← Torna in ${nomeModulo}` }));
      // 🔴 ESATTAMENTE dove si era: stesso percorso, stessa domanda.
      expect(dove()).toBe(attesa);
    });
  }

  it("⚠️ la voce «MEMO voce» della barra laterale porta con sé la stessa partenza", async () => {
    mostra("/magazzino");
    await tocca(screen.getByRole("link", { name: "MEMO voce" }));
    expect(inMemo()).toBe(true);
    await tocca(screen.getByRole("link", { name: "← Torna in Magazzino" }));
    expect(dove()).toBe("Magazzino — /magazzino");
  });

  it("⚠️ e ritoccarla da dentro MEMO non fa perdere la partenza", async () => {
    mostra("/agenda");
    await tocca(screen.getByRole("link", { name: "Apri MEMO voce" }));
    await tocca(screen.getByRole("link", { name: "MEMO voce" }));
    expect(screen.getByRole("link", { name: "← Torna in Agenda" })).toBeTruthy();
  });
});

describe("🔴 un pulsante in più, non un microfono in più", () => {
  it("in MEMO la testata non ha il pulsante, e «Premi e parla» è UNO solo", async () => {
    mostra("/agenda");
    await tocca(screen.getByRole("link", { name: "Apri MEMO voce" }));
    expect(screen.queryByRole("link", { name: "Apri MEMO voce" })).toBeNull();
    expect(screen.getAllByRole("button", { name: /Premi e parla/ })).toHaveLength(1);
  });

  it("aprire MEMO NON accende il microfono: si accende solo col tocco in MEMO", async () => {
    mostra("/agenda");
    await tocca(screen.getByRole("link", { name: "Apri MEMO voce" }));
    expect(finto).toBeNull();
    expect(finte.manda).not.toHaveBeenCalled();
  });

  it("⚠️ lo staff non lo vede (MEMO voce è solo del titolare)", () => {
    finte.auth = { isTitolare: false, isStaff: true, logout: vi.fn() };
    mostra("/agenda");
    expect(screen.queryByRole("link", { name: "Apri MEMO voce" })).toBeNull();
    expect(screen.queryByRole("link", { name: "MEMO voce" })).toBeNull();
  });

  it("arrivando senza partenza (indirizzo scritto a mano) nessun «Torna»", () => {
    mostra("/detta");
    expect(inMemo()).toBe(true);
    expect(screen.queryByRole("link", { name: /^← Torna/ })).toBeNull();
  });
});

describe("🔴 annullare e concludere: si torna, e niente viene scritto", () => {
  async function accendiEParla(testo) {
    await tocca(screen.getByRole("button", { name: /Premi e parla/i }));
    await act(async () => {
      finto.onresult({
        resultIndex: 0,
        results: [Object.assign([{ transcript: testo }], { isFinal: true })],
      });
    });
  }

  it("ANNULLARE a microfono acceso: si torna, il microfono si spegne e NON parte niente", async () => {
    mostra("/agenda");
    await tocca(screen.getByRole("link", { name: "Apri MEMO voce" }));
    await accendiEParla("ricordami il dentista lunedì");

    await tocca(screen.getByRole("link", { name: "← Annulla e torna in Agenda" }));

    expect(dove()).toBe("Agenda — /agenda");
    expect(finto.stop).toHaveBeenCalled();
    expect(finte.manda).not.toHaveBeenCalled();
  });

  it("CONCLUDERE: detta la cosa, torna con un tocco — e l'appunto resta da approvare", async () => {
    mostra("/cassa/prima-nota?dal=2026-09-01");
    await tocca(screen.getByRole("link", { name: "Apri MEMO voce" }));
    await accendiEParla("ricordami il dentista lunedì");
    await tocca(screen.getByRole("button", { name: /Ferma e manda/i }));

    await waitFor(() => expect(screen.getByText(/Gli appunti restano da approvare/)).toBeTruthy());
    const ritorni = screen.getAllByRole("link", { name: "← Torna in Cassa, Banca e Prima Nota" });
    expect(ritorni).toHaveLength(2); // in cima e sotto il riscontro
    await tocca(ritorni[1]);

    expect(dove()).toBe("Prima nota — /cassa/prima-nota?dal=2026-09-01");
    // 🔴 Nessun doppio salvataggio: una dettatura, zero approvazioni.
    expect(finte.manda).toHaveBeenCalledTimes(1);
    expect(finte.approva).not.toHaveBeenCalled();
  });
});
