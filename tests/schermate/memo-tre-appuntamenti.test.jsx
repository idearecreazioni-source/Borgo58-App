import { MemoryRouter } from "react-router-dom";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// TRE APPUNTAMENTI IN UNA DETTATURA SOLA — 11/09/2026, mandato «MEMO affidabile»
// =====================================================================
// 🔴 COSA SI PROVA: una frase unica con tre impegni nuovi diventa TRE
//    appunti, ognuno col suo titolo, il suo giorno e il suo avviso; e ogni
//    appunto si approva o si butta DA SOLO, senza toccare gli altri due.
//
// ⚠️ QUELLO CHE QUESTA PROVA NON PUÒ DIRE: se il modello, sentendo la
//    frase, restituisce davvero tre azioni. Quello si prova contro il
//    progetto di prova (vedi il riepilogo). Qui si prova la schermata, a
//    partire da tre appunti già nati — cioè il pezzo che il gestionale
//    controlla per intero.
//
// ⚠️ NIENTE DI VERO VIENE TOCCATO: le chiamate al gestionale sono finte e
//    le righe inventate qui dentro, come in `memo-appunto-subito`.

const finte = {
  appunti: vi.fn(),
  manda: vi.fn(),
  azioni: vi.fn(),
  approva: vi.fn(),
  scarta: vi.fn(),
  scegli: vi.fn(),
};

vi.mock("../../src/lib/api/voce", () => ({
  appuntiDaApprovare: (...a) => finte.appunti(...a),
  mandaDettato: (...a) => finte.manda(...a),
  azioniDellaDettatura: (...a) => finte.azioni(...a),
  approvaAppunto: (...a) => finte.approva(...a),
  scartaAppunto: (...a) => finte.scarta(...a),
  scegliPerAzione: (...a) => finte.scegli(...a),
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

const { default: Detta } = await import("../../src/pages/assistente/Detta");

// --- I tre appuntamenti, come li restituirebbe il database ------------
const DETTO =
  "Ricordami il dentista lunedì 14 e avvisami domenica alle 18, " +
  "poi la riunione col commercialista martedì e ritirare le tovaglie mercoledì";

const impegno = (id, dati) => ({
  id: `el-${id}`,
  frase: `Promemoria: ${dati.titolo}`,
  dati,
  sicuro: true,
  motivo: null,
  alternative: [],
  stato: "in_attesa",
  domanda: null,
  scelte: [],
  percorso: "/agenda/nuovo",
});

const appunto = (id, elementi, extra = {}) => ({
  id,
  destinazione: "promemoria",
  titolo: "Annota in Agenda",
  eseguibile: true,
  quanti: elementi.length,
  incerto: false,
  aperto_da_ore: 0,
  aperto_da_giorni: 0,
  elementi,
  ...extra,
});

const DENTISTA = appunto("A1", [
  impegno("A1", {
    titolo: "Dentista",
    data: "2026-09-14",
    ora: "10:00",
    avviso_data: "2026-09-13",
    avviso_ora: "18:00",
  }),
]);
const RIUNIONE = appunto("A2", [
  impegno("A2", { titolo: "Riunione col commercialista", data: "2026-09-15", ora: "15:30" }),
]);
const TOVAGLIE = appunto("A3", [
  impegno("A3", { titolo: "Ritirare le tovaglie", data: "2026-09-16" }),
]);

/** Le azioni della dettatura come le dà la porta della schermata. */
const inAttesa = (...appunti) =>
  appunti.flatMap((a) => a.elementi.map((e) => ({ id: e.id, frase: e.frase, stato: "in_attesa" })));

/**
 * 🔴 LA LETTURA DELLE AZIONI RIFIUTA UNA DETTATURA SENZA NUMERO, come fa il
 * database: chiesta senza identificativo, la funzione non si trova. Se il
 * finto rispondesse lo stesso, questa prova non vedrebbe mai una rilettura
 * fatta col numero sbagliato.
 */
function azioniDi(lista) {
  finte.azioni.mockImplementation((id) =>
    id === "d-1"
      ? Promise.resolve(lista)
      : Promise.reject(new Error("la funzione azioni_della_dettatura non si trova senza il suo numero")),
  );
}

const mostra = () =>
  render(
    <MemoryRouter>
      <Detta />
    </MemoryRouter>,
  );

async function parla(testo = DETTO) {
  await act(async () => {
    screen.getByRole("button", { name: /Premi e parla/i }).click();
  });
  await act(async () => {
    const risultati = [Object.assign([{ transcript: testo }], { isFinal: true })];
    finto.onresult({ resultIndex: 0, results: risultati });
  });
  await act(async () => {
    screen.getByRole("button", { name: /Ferma e manda/i }).click();
  });
}

/** Le schede a schermo, una per «Butta l'appunto». */
const schede = () =>
  screen.queryAllByRole("button", { name: /Butta l'appunto/i }).map((b) => b.closest("li"));

const schedaDi = (testo) => schede().find((s) => within(s).queryAllByText(new RegExp(testo)).length > 0);

beforeEach(() => {
  for (const f of Object.values(finte)) f.mockReset();
  finte.manda.mockResolvedValue({ dettatura_id: "d-1", esito: "capita" });
  finte.approva.mockResolvedValue({ ok: true });
  finte.scarta.mockResolvedValue({ ok: true });
  finte.scegli.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("🔴 tre appuntamenti detti insieme restano tre", () => {
  it("nascono TRE schede, ognuna col suo titolo, il suo giorno e il suo avviso", async () => {
    azioniDi(inAttesa(DENTISTA, RIUNIONE, TOVAGLIE));
    finte.appunti.mockResolvedValueOnce([]).mockResolvedValue([DENTISTA, RIUNIONE, TOVAGLIE]);
    mostra();
    await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));

    await parla();

    await waitFor(() => expect(screen.getByText(/Ne ho fatti 3 appunti/i)).toBeTruthy());
    await waitFor(() => expect(schede()).toHaveLength(3));
    // 🔴 Nessuna fusione: ogni scheda ha il SUO impegno e nessuno degli altri.
    const dentista = schedaDi("Dentista");
    expect(within(dentista).queryAllByText(/commercialista|tovaglie/i)).toHaveLength(0);
    // ⚠️ L'avviso è di UNO solo dei tre, e sta sulla sua scheda.
    expect(within(dentista).getByText(/Ti mando una notifica su Telegram/)).toBeTruthy();
    expect(within(schedaDi("commercialista")).queryByText(/Ti mando una notifica/)).toBeNull();
    expect(within(schedaDi("tovaglie")).queryByText(/Ti mando una notifica/)).toBeNull();
    // 🔴 Ognuno la SUA ora, prima di firmare; chi non l'ha detta non ne ha.
    expect(within(dentista).getByText(/ora: 10:00/)).toBeTruthy();
    expect(within(schedaDi("commercialista")).getByText(/ora: 15:30/)).toBeTruthy();
    expect(within(schedaDi("tovaglie")).queryByText(/ora: /)).toBeNull();
    // 🔴 E niente è stato scritto: si è solo parlato.
    expect(finte.approva).not.toHaveBeenCalled();
    expect(finte.scarta).not.toHaveBeenCalled();
  });

  it("🔴 una frase mista che non si separa: la scheda DA CHIARIRE non si approva e dice perché", async () => {
    const CHIARIRE = appunto(
      "C1",
      [
        {
          ...impegno("C1", { titolo: "Dentista", data: "2026-09-14", ora: "10:00" }),
          motivo:
            "In questa frase c'erano insieme cose nuove da segnare e un impegno da spostare o da " +
            "chiudere, e non sono riuscito a capire con certezza quale parte va con quale.",
          percorso: "/agenda",
        },
      ],
      { destinazione: "agenda_da_chiarire", titolo: "Da chiarire in Agenda", eseguibile: false },
    );
    azioniDi(inAttesa(CHIARIRE));
    finte.appunti.mockResolvedValueOnce([]).mockResolvedValue([CHIARIRE]);
    mostra();
    await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));
    await parla("ricordami il dentista lunedì alle 10 e sposta la riunione");
    await waitFor(() => expect(schede()).toHaveLength(1));

    const s = schedaDi("Dentista");
    expect(within(s).queryByRole("button", { name: /^Approva/ })).toBeNull();
    expect(within(s).getAllByText(/non sono riuscito a capire con certezza/).length).toBeGreaterThan(0);
    // ⚠️ E l'uscita è l'Agenda, dove si decide guardando gli impegni veri.
    expect(within(s).getByRole("link", { name: /Fallo a mano/ }).getAttribute("href")).toBe(
      "/agenda?daVoce=el-C1",
    );
    expect(finte.approva).not.toHaveBeenCalled();
  });

  it("🔴 approvarne UNO non tocca gli altri due, e buttarne un altro nemmeno", async () => {
    azioniDi(inAttesa(DENTISTA, RIUNIONE, TOVAGLIE));
    finte.appunti.mockResolvedValueOnce([]).mockResolvedValue([DENTISTA, RIUNIONE, TOVAGLIE]);
    mostra();
    await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));
    await parla();
    await waitFor(() => expect(schede()).toHaveLength(3));

    // Si approva il SECONDO.
    finte.appunti.mockResolvedValue([DENTISTA, TOVAGLIE]);
    await act(async () => {
      within(schedaDi("commercialista")).getByRole("button", { name: /^Approva/ }).click();
    });
    await waitFor(() => expect(schede()).toHaveLength(2));
    expect(finte.approva).toHaveBeenCalledTimes(1);
    expect(finte.approva).toHaveBeenCalledWith("A2");

    // Si butta il TERZO.
    finte.appunti.mockResolvedValue([DENTISTA]);
    await act(async () => {
      within(schedaDi("tovaglie")).getByRole("button", { name: /Butta l'appunto/i }).click();
    });
    await waitFor(() => expect(schede()).toHaveLength(1));
    expect(finte.scarta).toHaveBeenCalledTimes(1);
    expect(finte.scarta).toHaveBeenCalledWith("A3");

    // 🔴 Il PRIMO è ancora lì, intero e approvabile: nessuno l'ha toccato.
    const resta = schedaDi("Dentista");
    expect(within(resta).getByRole("button", { name: /^Approva$/ }).disabled).toBe(false);
    expect(within(resta).getByText(/Ti mando una notifica su Telegram/)).toBeTruthy();
    expect(finte.approva).not.toHaveBeenCalledWith("A1");
    expect(finte.scarta).not.toHaveBeenCalledWith("A1");
  });

  it("⚠️ ognuno ha la sua via per correggerlo a mano, e porta a LUI solo", async () => {
    azioniDi(inAttesa(DENTISTA, RIUNIONE, TOVAGLIE));
    finte.appunti.mockResolvedValueOnce([]).mockResolvedValue([DENTISTA, RIUNIONE, TOVAGLIE]);
    mostra();
    await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));
    await parla();
    await waitFor(() => expect(schede()).toHaveLength(3));

    const indirizzi = schede().map(
      (s) => within(s).getByRole("link", { name: /Fallo a mano/ }).getAttribute("href"),
    );
    expect(indirizzi).toEqual([
      "/agenda/nuovo?daVoce=el-A1",
      "/agenda/nuovo?daVoce=el-A2",
      "/agenda/nuovo?daVoce=el-A3",
    ]);
  });
});

/** L'appunto che chiede QUALE: «segna fatto il commercialista», e in Agenda ce ne sono due. */
const quale = () =>
  appunto(
    "Q1",
    [
      {
        ...impegno("Q1", { titolo: "commercialista" }),
        domanda: "scegli",
        scelte: [
          { id: "t-a", nome: "Andare dal commercialista — 15/09/2026" },
          { id: "t-b", nome: "Chiamare il commercialista — 16/09/2026" },
        ],
      },
    ],
    { destinazione: "agenda_da_segnare_fatto", titolo: "Quale impegno?", eseguibile: false },
  );

// =====================================================================
// LE GARE TROVATE DALLA REVISIONE DEL DIFF — 11/09/2026
// =====================================================================
// ⚠️ Tutte e tre vivono fra una scrittura riuscita e la rilettura che viene
//    dopo. Ognuna di queste prove è stata fatta girare PRIMA della cura, ed
//    era rossa: vedi il riepilogo del mandato.
describe("⚠️ fra la scrittura e la rilettura", () => {
  it("🔴 una scelta RIFIUTATA si dice sulla scheda, non sparisce", async () => {
    const Q = quale();
    azioniDi(inAttesa(Q));
    finte.appunti.mockResolvedValueOnce([]).mockResolvedValue([Q]);
    finte.scegli.mockRejectedValue(new Error("Quell'impegno non c'è più in Agenda."));
    mostra();
    await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));
    await parla("segna fatto il commercialista");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Andare dal commercialista/ })).toBeTruthy(),
    );

    await act(async () => {
      screen.getByRole("button", { name: /Andare dal commercialista/ }).click();
    });

    await waitFor(() => expect(screen.getByText(/Quell'impegno non c'è più in Agenda/)).toBeTruthy());
    expect(screen.getByText(/Non è stato scritto niente/)).toBeTruthy();
  });

  it("⚠️ finché la rilettura dopo una scelta non è tornata, un secondo tocco non parte", async () => {
    const Q = quale();
    let sblocca = () => {};
    let giri = 0;
    finte.azioni.mockImplementation((id) => {
      if (id !== "d-1") return Promise.reject(new Error("senza numero"));
      giri += 1;
      // Il primo giro è il riscontro della dettatura; il secondo è la
      // rilettura DOPO la scelta, e resta in volo.
      if (giri === 1) return Promise.resolve(inAttesa(Q));
      return new Promise((r) => {
        sblocca = () => r(inAttesa(Q));
      });
    });
    finte.appunti.mockResolvedValueOnce([]).mockResolvedValue([Q]);
    mostra();
    await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));
    await parla("segna fatto il commercialista");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Andare dal commercialista/ })).toBeTruthy(),
    );

    await act(async () => {
      screen.getByRole("button", { name: /Andare dal commercialista/ }).click();
    });
    await waitFor(() => expect(finte.scegli).toHaveBeenCalledTimes(1));
    await act(async () => {
      screen.getByRole("button", { name: /Chiamare il commercialista/ }).click();
    });
    expect(finte.scegli).toHaveBeenCalledTimes(1);

    await act(async () => {
      sblocca();
    });
  });

  it("🔴 una rilettura vecchia non sovrascrive il riscontro di una dettatura NUOVA", async () => {
    const FABBRO = appunto("B1", [impegno("B1", { titolo: "Chiamare il fabbro", data: "2026-09-20" })]);
    let sblocca = () => {};
    let giriD1 = 0;
    finte.azioni.mockImplementation((id) => {
      if (id === "d-1") {
        giriD1 += 1;
        if (giriD1 === 1) return Promise.resolve(inAttesa(DENTISTA, RIUNIONE, TOVAGLIE));
        return new Promise((r) => {
          sblocca = () => r(inAttesa(DENTISTA, RIUNIONE, TOVAGLIE));
        });
      }
      if (id === "d-2") return Promise.resolve(inAttesa(FABBRO));
      return Promise.reject(new Error("senza numero"));
    });
    finte.appunti.mockResolvedValueOnce([]).mockResolvedValue([DENTISTA, RIUNIONE, TOVAGLIE]);
    mostra();
    await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));
    await parla();
    await waitFor(() => expect(screen.getByText(/Ne ho fatti 3 appunti/i)).toBeTruthy());
    await waitFor(() => expect(schede()).toHaveLength(3));

    // Si approva il secondo: la rilettura della dettatura d-1 resta in volo…
    finte.appunti.mockResolvedValue([DENTISTA, TOVAGLIE, FABBRO]);
    await act(async () => {
      within(schedaDi("commercialista")).getByRole("button", { name: /^Approva/ }).click();
    });
    await waitFor(() => expect(giriD1).toBe(2));

    // …e intanto si detta un'altra cosa.
    finte.manda.mockResolvedValue({ dettatura_id: "d-2", esito: "capita" });
    await parla("ricordami di chiamare il fabbro");
    await waitFor(() => expect(screen.getByText(/Ne ho fatto un appunto/i)).toBeTruthy());

    // Adesso torna, in ritardo, la rilettura della dettatura di prima.
    await act(async () => {
      sblocca();
    });
    expect(screen.getByText(/Ne ho fatto un appunto/i)).toBeTruthy();
    expect(screen.queryByText(/Ne ho fatti 3 appunti/i)).toBeNull();
  });
});

describe("🔴 una scelta riuscita non si racconta come fallita", () => {
  it("scegliere l'impegno giusto, con il riscontro aperto, non dice «non è stato scritto niente»", async () => {
    const QUALE = quale();
    azioniDi(inAttesa(QUALE));
    finte.appunti.mockResolvedValueOnce([]).mockResolvedValue([QUALE]);
    mostra();
    await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));
    await parla("segna fatto il commercialista");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Andare dal commercialista/ })).toBeTruthy(),
    );

    await act(async () => {
      screen.getByRole("button", { name: /Andare dal commercialista/ }).click();
    });
    await waitFor(() => expect(finte.scegli).toHaveBeenCalledWith("el-Q1", "t-a"));

    // 🔴 La scelta è RIUSCITA: la rilettura dopo non può trasformarla in un
    //    fallimento, e deve essere fatta col numero della dettatura vera.
    await waitFor(() => expect(finte.azioni).toHaveBeenLastCalledWith("d-1"));
    expect(screen.queryByText(/Non è stato scritto niente/i)).toBeNull();
  });
});
