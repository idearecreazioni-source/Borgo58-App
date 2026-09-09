import { MemoryRouter } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// L'APPUNTO APPENA DETTO SI VEDE SUBITO — 09/09/2026
// =====================================================================
// 🔴 IL DIFETTO, dal collaudo col telefono: finita una dettatura, il
//    riquadro diceva «Ne ho fatto un appunto» e mandava a guardare **qui
//    sotto** — ma l'elenco di sotto quell'appunto lo **escludeva apposta**
//    (per non ripetere la stessa riga in due riquadri, regola del 27/08).
//    Per vedere la scheda bisognava uscire da MEMO e rientrare.
//    *Una schermata che dice dove guardare e non ci mette niente è peggio di
//    una che tace.*
//
// ⚠️ SI MONTA LA PAGINA INTERA, ed è un'eccezione dichiarata: il difetto vive
//    nel raccordo fra la risposta della voce e la lista del server, non
//    dentro la scheda — montare solo il componente non lo vedrebbe.
//    Per non ripetere il caso del 06/09 (la pagina MEMO montata faceva
//    scadere il tempo alle prove degli altri file di questa cartella)
//    **tutto ciò che pesa è finto**: le chiamate al gestionale, la pagina
//    delle risposte, e il modulo delle domande — che da solo è il più grosso
//    del progetto.
//
// ⚠️ NIENTE DI VERO VIENE TOCCATO: nessun database, nessun appunto e nessun
//    impegno di Alessio. Le righe sono inventate qui dentro.

const finte = { appunti: vi.fn(), manda: vi.fn(), azioni: vi.fn() };

vi.mock("../../src/lib/api/voce", () => ({
  appuntiDaApprovare: (...a) => finte.appunti(...a),
  mandaDettato: (...a) => finte.manda(...a),
  azioniDellaDettatura: (...a) => finte.azioni(...a),
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
  rispondiA: vi.fn(() => Promise.resolve({ risposta: { testo: "Sono le tre." } })),
}));
vi.mock("../../src/lib/calcoli/domande", () => ({ titoloDellaDomanda: () => "Una domanda" }));
vi.mock("../../src/components/RispostaMemo", () => ({
  default: ({ titolo }) => <div data-risposta="">{titolo}</div>,
}));

// Il riconoscitore: in jsdom non esiste, e qui non serve — quello che si
// prova è cosa succede DOPO che si è smesso di parlare.
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

// --- Le righe di prova, tutte nostre --------------------------------------
const elemento = (id, extra = {}) => ({
  id,
  frase: `frase di ${id}`,
  dati: { titolo: `titolo di ${id}` },
  sicuro: true,
  motivo: null,
  alternative: [],
  stato: "in_attesa",
  domanda: null,
  scelte: [],
  percorso: null,
  ...extra,
});

const appunto = (id, { eseguibile = true, titolo = "Annota in Agenda", elementi } = {}) => {
  const dentro = elementi ?? [elemento(`el-${id}`)];
  return {
    id,
    destinazione: "promemoria",
    titolo,
    eseguibile,
    quanti: dentro.length,
    incerto: false,
    aperto_da_ore: 0,
    aperto_da_giorni: 0,
    elementi: dentro,
  };
};

/** L'azione come la restituisce la porta della schermata. */
const azioneInAttesa = (id) => ({ id, frase: `frase di ${id}`, stato: "in_attesa" });

// ⚠️ Quello che aspettava da prima NON è approvabile: così «Approva» sulla
//    pagina può essere solo quello della scheda nuova, ed è la sua presenza a
//    dimostrare che la scheda c'è.
const VECCHIO = appunto("app-vecchio", { eseguibile: false, elementi: [elemento("el-vecchio")] });

/**
 * QUANTE SCHEDE CI SONO A SCHERMO.
 *
 * ⚠️ Si contano i pulsanti «Butta l'appunto», uno per scheda, e non le
 * occorrenze di un testo: dentro una scheda lo stesso titolo compare **due
 * volte** — nel riassunto in cima e fra i dati concreti. Contare il testo
 * direbbe «due schede» dove ce n'è una, ed è un metro che mente.
 */
const quanteSchede = () => screen.queryAllByRole("button", { name: /Butta l'appunto/i }).length;

const mostra = () =>
  render(
    <MemoryRouter>
      <Detta />
    </MemoryRouter>,
  );

/** Il giro del pulsante: accende, sente una frase, spegne e manda. */
async function parla(testo = "ricordami di chiamare Tiziana") {
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

/**
 * Apparecchia il giro: all'apertura la lista NON ha l'appunto (non esiste
 * ancora), dopo la dettatura ce l'ha. È esattamente l'ordine vero.
 */
function apparecchia(nuovo) {
  finte.azioni.mockResolvedValue(nuovo.elementi.map((e) => azioneInAttesa(e.id)));
  finte.appunti.mockResolvedValueOnce([VECCHIO]).mockResolvedValue([VECCHIO, nuovo]);
}

beforeEach(() => {
  finte.appunti.mockReset();
  finte.manda.mockReset();
  finte.azioni.mockReset();
  finte.appunti.mockResolvedValue([VECCHIO]);
  finte.manda.mockResolvedValue({ dettatura_id: "d-1" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("🔴 la scheda dell'appunto appena detto compare subito", () => {
  it("APPROVABILE: la scheda e «Approva» si vedono senza uscire e rientrare", async () => {
    const nuovo = appunto("app-nuovo");
    apparecchia(nuovo);
    mostra();
    await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));

    await parla();

    await waitFor(() => expect(screen.getByText(/Ne ho fatto un appunto/i)).toBeTruthy());
    // 🔴 La scheda intera, non la sola frase: «Approva» è la prova che c'è.
    await waitFor(() => expect(screen.getByRole("button", { name: /^Approva/ })).toBeTruthy());
    expect(screen.getAllByText(/titolo di el-app-nuovo/).length).toBeGreaterThan(0);
  });

  it("AMBIGUO: si vedono subito anche i candidati da toccare", async () => {
    const nuovo = appunto("app-quale", {
      eseguibile: false,
      titolo: "Quale impegno?",
      elementi: [
        elemento("el-quale", {
          domanda: "scegli",
          scelte: [
            { id: "t-a", nome: "Andare dal commercialista — 28/08/2026" },
            { id: "t-b", nome: "Passare dal commercialista — 28/08/2026" },
          ],
        }),
      ],
    });
    apparecchia(nuovo);
    mostra();
    await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));

    await parla("segna come fatto il commercialista");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Andare dal commercialista/ })).toBeTruthy(),
    );
    expect(screen.getByRole("button", { name: /Passare dal commercialista/ })).toBeTruthy();
    // ⚠️ E la regola della #46 resta intera: finché non si sceglie, niente «Approva».
    expect(screen.queryByRole("button", { name: /^Approva/ })).toBeNull();
    expect(quanteSchede()).toBe(2);
  });

  it("NON approvabile: la scheda si vede lo stesso, col suo perché", async () => {
    const nuovo = appunto("app-no", {
      eseguibile: false,
      titolo: "Quale impegno?",
      elementi: [elemento("el-no", { motivo: "Non l'ho trovato fra quelli aperti in Agenda." })],
    });
    apparecchia(nuovo);
    mostra();
    await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));

    await parla();

    await waitFor(() =>
      expect(screen.getByText(/Non l'ho trovato fra quelli aperti in Agenda/i)).toBeTruthy(),
    );
    expect(screen.queryByRole("button", { name: /^Approva/ })).toBeNull();
    expect(quanteSchede()).toBe(2);
  });

  it("🔴 e NON compare due volte: nessun doppione nell'elenco di sotto", async () => {
    const nuovo = appunto("app-nuovo");
    apparecchia(nuovo);
    mostra();
    await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));
    await parla();
    await waitFor(() => expect(screen.getByText(/Ne ho fatto un appunto/i)).toBeTruthy());

    // 🔴 DUE schede in tutto: quella di prima e quella nuova. Se l'appunto
    //    nuovo comparisse anche nell'elenco di sotto sarebbero tre — ed è la
    //    regola del 27/08, che questo lavoro non rovescia.
    await waitFor(() => expect(quanteSchede()).toBe(2));

    // ⚠️ E resta così anche dopo un altro giro della lista: è il momento in
    //    cui un doppione comparirebbe.
    await act(async () => {
      await Promise.resolve();
    });
    expect(quanteSchede()).toBe(2);
    expect(screen.getByRole("button", { name: /^Approva/ })).toBeTruthy();
  });

  it("🔴 una RISPOSTA non fa comparire nessuna scheda", async () => {
    finte.manda.mockResolvedValue({
      esito: "domanda",
      domanda: { tipo: "ora" },
      testo: "che ore sono",
    });
    mostra();
    await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));

    await parla("che ore sono");

    await waitFor(() => expect(screen.getByText("Una domanda")).toBeTruthy());
    expect(screen.queryByText(/Ne ho fatto un appunto/i)).toBeNull();
    // ⚠️ Resta solo quello che aspettava da prima: nessuna scheda inventata.
    expect(quanteSchede()).toBe(1);
  });

  it("🔴 LA GARA: una lettura vecchia in ritardo non fa sparire la scheda", async () => {
    // 🔴 È il caso che nessuno vedrebbe arrivare: due letture della stessa
    //    lista in volo insieme. Se quella partita PRIMA — senza l'appunto —
    //    torna per ULTIMA, la scheda compare e sparisce un istante dopo,
    //    senza nessun errore.
    const nuovo = appunto("app-nuovo");
    finte.azioni.mockResolvedValue([azioneInAttesa("el-app-nuovo")]);

    let sblocca;
    const lenta = new Promise((r) => {
      sblocca = () => r([VECCHIO]); // la lista di PRIMA: senza il nuovo
    });
    finte.appunti.mockReturnValueOnce(lenta).mockResolvedValue([VECCHIO, nuovo]);

    mostra();
    await parla();
    await waitFor(() => expect(screen.getByRole("button", { name: /^Approva/ })).toBeTruthy());

    // Adesso arriva, in ritardo, la lettura vecchia.
    await act(async () => {
      sblocca();
      await lenta;
    });

    // 🔴 La scheda dev'essere ancora lì.
    expect(screen.getByRole("button", { name: /^Approva/ })).toBeTruthy();
    expect(quanteSchede()).toBe(2);
  });

  it("⚠️ finché la lista non è tornata, dice che sta rileggendo", async () => {
    // Non si inventa una scheda: quello che si sa in quel momento è la frase.
    const nuovo = appunto("app-nuovo");
    finte.azioni.mockResolvedValue([azioneInAttesa("el-app-nuovo")]);
    let sblocca;
    finte.appunti.mockResolvedValueOnce([VECCHIO]).mockReturnValue(
      new Promise((r) => {
        sblocca = () => r([VECCHIO, nuovo]);
      }),
    );

    mostra();
    await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));
    await parla();

    await waitFor(() =>
      expect(screen.getByText(/Sto rileggendo quello che ho scritto/i)).toBeTruthy(),
    );
    expect(screen.queryByRole("button", { name: /^Approva/ })).toBeNull();

    await act(async () => {
      sblocca();
    });
    await waitFor(() => expect(screen.getByRole("button", { name: /^Approva/ })).toBeTruthy());
  });

  it("🔴 la pagina porta l'occhio dove è comparsa, e dall'ALTO", async () => {
    const visto = [];
    const prima = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = function (opzioni) {
      visto.push({ testo: this.textContent, opzioni });
    };
    try {
      const nuovo = appunto("app-nuovo");
      apparecchia(nuovo);
      mostra();
      await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));
      await parla();
      await waitFor(() => expect(screen.getByRole("button", { name: /^Approva/ })).toBeTruthy());

      expect(visto.length).toBeGreaterThan(0);
      expect(visto[0].testo).toMatch(/Ne ho fatto un appunto/);
      // ⚠️ Dall'ALTO, e non è un dettaglio: portare in fondo lascerebbe
      //    «Approva» e i candidati sotto la barra fissa del microfono, che è
      //    precisamente il difetto da evitare.
      expect(visto[0].opzioni.block).toBe("start");
    } finally {
      window.HTMLElement.prototype.scrollIntoView = prima;
    }
  });

  it("⚠️ e la barra fissa del microfono è comunque sulla pagina", async () => {
    // La misura di quanto copre si fa nel browser: qui si congela che la
    // barra ci sia, perché è la ragione del «dall'alto» qui sopra.
    const nuovo = appunto("app-nuovo");
    apparecchia(nuovo);
    const r = mostra();
    await waitFor(() => expect(finte.appunti).toHaveBeenCalledTimes(1));
    await parla();
    expect(r.container.querySelector("[data-barra-pollice]")).toBeTruthy();
  });
});
