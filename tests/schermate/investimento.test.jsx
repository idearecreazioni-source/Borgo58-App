import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// L'ETICHETTA «INVESTIMENTO», GUARDATA DALLE SCHERMATE — C11, 21/09/2026
// =====================================================================
// 🔴 PERCHE' NON BASTANO LE PROVE PURE. `tests/unita/investimento.test.js`
//    prova che la REGOLA risponde giusto; queste provano che la schermata la
//    CHIAMA, e che quello che si spunta **arriva** dove deve arrivare. Sono
//    due cose diverse, e il progetto ha gia' pagato la differenza: il 16/08
//    il menu del mezzo di pagamento delle mance si vedeva, si sceglieva, e
//    il campo non arrivava al database — nessuna prova sul database poteva
//    accorgersene, perche' il difetto stava nel tratto in mezzo.
//
// ⚠️ QUI NON SI PARLA COL DATABASE (condizione di questo strato): il
//    collegamento e' finto e ogni prova dichiara cosa gli fa rispondere.
//
// ⚠️ E QUESTO STRATO NON E' UN OCCHIO: che il segno si distingua con le luci
//    basse, e che la casella sia comoda col dito, restano giudizi di Alessio.

const SRLS = { id: "id-srls", entity_type: "srls", name: "Borgo 58" };
const AGRICOLA = { id: "id-orto", entity_type: "azienda_agricola", name: "Orto Borgo 58" };
const TASCA = { id: "id-tasca", entity_type: "tasca", name: "La tasca di Alessio" };

const CAUSALE = { id: "c1", label: "Attrezzature", di_sistema: false };
const DI_SISTEMA = { id: "c9", label: "Rimborso al titolare", di_sistema: true };

const finto = vi.hoisted(() => ({
  movimenti: [],
  totali: [],
  righe: [],
  rompiTotali: false,
}));

const spie = vi.hoisted(() => ({
  crea: null,
  segna: null,
}));

vi.mock("../../src/lib/api/entities", () => ({
  getEntities: vi.fn(async () => ({ srls: SRLS, agricola: AGRICOLA, tasca: TASCA })),
}));

vi.mock("../../src/lib/api/cash", () => ({
  listCausali: vi.fn(async (verso) => (verso === "uscita" ? [CAUSALE] : [])),
  listCashMovements: vi.fn(async () => finto.movimenti),
  getCashBalance: vi.fn(async () => ({ balance: 0, saldo_banca: 0 })),
  spesoDallaTasca: vi.fn(async () => []),
  createCashMovement: vi.fn(async (p) => {
    spie.crea = p;
    return { id: "nuovo", ...p };
  }),
  deleteCashMovement: vi.fn(async () => ({})),
  segnaInvestimento: vi.fn(async (id, valore) => {
    spie.segna = [id, valore];
    const riga = finto.movimenti.find((m) => m.id === id);
    return { ...riga, e_investimento: valore };
  }),
  costoDelProgetto: vi.fn(async () => {
    if (finto.rompiTotali) throw new Error("niente rete");
    return finto.totali;
  }),
  righeCostoDelProgetto: vi.fn(async () => {
    if (finto.rompiTotali) throw new Error("niente rete");
    return finto.righe;
  }),
}));

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    rpc: async () => ({ data: null, error: null }),
  },
  supabasePubblico: {},
}));

const movimento = (extra) => ({
  id: "m1",
  direction: "uscita",
  amount: "100.00",
  movement_date: "2026-09-10",
  mezzo: "cassa",
  tipo_documento: "non_documentato",
  causale: CAUSALE,
  e_investimento: false,
  ...extra,
});

async function apriPrimaNota(indirizzo = "/cassa/prima-nota") {
  const { default: PrimaNota } = await import("../../src/pages/cassa/PrimaNota.jsx");
  const vista = render(
    <MemoryRouter initialEntries={[indirizzo]}>
      <PrimaNota />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText("Causale")).toBeTruthy());
  return vista;
}

async function apriCosto() {
  const { default: CostoProgetto } = await import("../../src/pages/cassa/CostoProgetto.jsx");
  const vista = render(
    <MemoryRouter initialEntries={["/cassa/costo-progetto"]}>
      <CostoProgetto />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.queryByText("Caricamento…")).toBeNull());
  return vista;
}

// Le due forme dell'elenco (blocchetti sul telefono, tabella sul computer)
// vivono tutt'e due nel documento: senza CSS non ne sparisce nessuna.
const tutti = (contenitore, selettore) => [...contenitore.querySelectorAll(selettore)];

beforeEach(() => {
  finto.movimenti = [];
  finto.totali = [];
  finto.righe = [];
  finto.rompiTotali = false;
  spie.crea = null;
  spie.segna = null;
  vi.clearAllMocks();
});

// =====================================================================
describe("13 · la Prima nota mostra e nasconde la scelta", () => {
  it("su un'uscita la casella c'e'", async () => {
    await apriPrimaNota();
    expect(screen.getAllByText("Investimento per il progetto").length).toBeGreaterThan(0);
  });

  it("🔴 su un'entrata NON c'e', e non e' spenta: non c'e' proprio", async () => {
    const { container } = await apriPrimaNota();
    fireEvent.click(screen.getByRole("button", { name: "Entrata" }));
    await waitFor(() =>
      expect(container.querySelector('[data-prova="investimento-creazione"]')).toBeNull()
    );
    // ⚠️ Non si spegne un pulsante, si toglie una scelta che non esiste:
    //    un gesto premibile per essere respinto e' un vicolo cieco.
    expect(screen.queryByText("Investimento per il progetto")).toBeNull();
  });

  it("sulla tasca la casella c'e': e' il soggetto piu' investito di tutti", async () => {
    const { container } = await apriPrimaNota("/cassa/prima-nota?soggetto=tasca");
    await waitFor(() =>
      expect(container.querySelector('[data-prova="investimento-creazione"]')).toBeTruthy()
    );
  });
});

describe("2-3 · la scelta nasce spenta e si conserva", () => {
  it("2 · senza toccare niente, il movimento nasce NON marcato", async () => {
    const { container } = await apriPrimaNota();
    fireEvent.change(container.querySelector('input[type="number"]'), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: /Registra movimento/ }));
    await waitFor(() => expect(spie.crea).toBeTruthy());
    expect(spie.crea.e_investimento).toBe(false);
  });

  it("3 · spuntata, arriva al salvataggio", async () => {
    const { container } = await apriPrimaNota();
    fireEvent.change(container.querySelector('input[type="number"]'), { target: { value: "6000" } });
    fireEvent.click(container.querySelector('[data-prova="investimento-creazione"] input'));
    fireEvent.click(screen.getByRole("button", { name: /Registra movimento/ }));
    await waitFor(() => expect(spie.crea).toBeTruthy());
    expect(spie.crea.e_investimento).toBe(true);
  });

  it("🔴 cambiando verso dopo averla spuntata, non arriva un «sì» su un'entrata", async () => {
    // Il database lo rifiuterebbe (vincolo `investimento_solo_su_uscita`), e
    // il rifiuto parlerebbe di una scelta fatta PRIMA di cambiare verso —
    // cioe' un rifiuto che non c'entra col gesto.
    const { container } = await apriPrimaNota();
    fireEvent.change(container.querySelector('input[type="number"]'), { target: { value: "40" } });
    fireEvent.click(container.querySelector('[data-prova="investimento-creazione"] input'));
    fireEvent.click(screen.getByRole("button", { name: "Entrata" }));
    fireEvent.click(screen.getByRole("button", { name: /Registra movimento/ }));
    await waitFor(() => expect(spie.crea).toBeTruthy());
    expect(spie.crea.direction).toBe("entrata");
    expect(spie.crea.e_investimento).toBe(false);
  });
});

describe("4 · un'uscita gia' scritta si marca e si smarca", () => {
  it("il gesto c'e' sulla riga, e manda SOLO l'etichetta", async () => {
    finto.movimenti = [movimento()];
    const { container } = await apriPrimaNota();
    await waitFor(() =>
      expect(tutti(container, '[data-prova="investimento-riga"] input').length).toBeGreaterThan(0)
    );
    fireEvent.click(tutti(container, '[data-prova="investimento-riga"] input')[0]);
    await waitFor(() => expect(spie.segna).toBeTruthy());
    // 🔴 Due argomenti e basta: l'identificativo e il valore. Rileggere la
    //    riga e rimandarla intera sovrascriverebbe con dati vecchi quello che
    //    fosse cambiato nel frattempo (trappola del 12/08).
    expect(spie.segna).toEqual(["m1", true]);
  });

  it("e si smarca, senza cancellare e rifare la riga", async () => {
    finto.movimenti = [movimento({ e_investimento: true })];
    const { container } = await apriPrimaNota();
    await waitFor(() =>
      expect(tutti(container, '[data-prova="investimento-riga"] input').length).toBeGreaterThan(0)
    );
    const casella = tutti(container, '[data-prova="investimento-riga"] input')[0];
    expect(casella.checked).toBe(true);
    fireEvent.click(casella);
    await waitFor(() => expect(spie.segna).toEqual(["m1", false]));
  });

  it("🔴 e l'elenco si aggiorna SOLO sulla riga toccata", async () => {
    // Una ricarica completa butterebbe via quello che si sta scrivendo nel
    // modulo sopra: e' il difetto del 12/08, pagato una volta.
    const api = await import("../../src/lib/api/cash");
    finto.movimenti = [movimento()];
    const { container } = await apriPrimaNota();
    await waitFor(() =>
      expect(tutti(container, '[data-prova="investimento-riga"] input').length).toBeGreaterThan(0)
    );
    const letturePrima = api.listCashMovements.mock.calls.length;
    fireEvent.click(tutti(container, '[data-prova="investimento-riga"] input')[0]);
    await waitFor(() => expect(spie.segna).toBeTruthy());
    expect(api.listCashMovements.mock.calls.length).toBe(letturePrima);
  });

  it("5 · una riga marcata si riconosce nell'elenco", async () => {
    finto.movimenti = [movimento({ e_investimento: true })];
    const { container } = await apriPrimaNota();
    await waitFor(() =>
      expect(tutti(container, '[data-prova="segno-investimento"]').length).toBeGreaterThan(0)
    );
  });

  it("e una riga non marcata non porta nessun segno", async () => {
    finto.movimenti = [movimento()];
    const { container } = await apriPrimaNota();
    await waitFor(() =>
      expect(tutti(container, '[data-prova="investimento-riga"]').length).toBeGreaterThan(0)
    );
    expect(tutti(container, '[data-prova="segno-investimento"]')).toHaveLength(0);
  });
});

describe("1-8 · sulle righe che non la possono portare, il gesto non c'e' e si dice perche'", () => {
  it("su un'entrata", async () => {
    finto.movimenti = [movimento({ direction: "entrata", causale: null })];
    const { container } = await apriPrimaNota();
    await waitFor(() =>
      expect(tutti(container, '[data-prova="investimento-no"]').length).toBeGreaterThan(0)
    );
    expect(tutti(container, '[data-prova="investimento-riga"]')).toHaveLength(0);
    expect(tutti(container, '[data-prova="investimento-no"]')[0].textContent).toMatch(/entrata/i);
  });

  it("🔴 su un rimborso al titolare — la riga che il gestionale scrive da sé", async () => {
    finto.movimenti = [movimento({ causale: DI_SISTEMA })];
    const { container } = await apriPrimaNota();
    await waitFor(() =>
      expect(tutti(container, '[data-prova="investimento-no"]').length).toBeGreaterThan(0)
    );
    expect(tutti(container, '[data-prova="investimento-riga"]')).toHaveLength(0);
    expect(tutti(container, '[data-prova="investimento-no"]')[0].textContent).toMatch(/due volte/i);
  });
});

// =====================================================================
describe("6-7-10 · la vista «quanto e' costato il progetto»", () => {
  const conDati = () => {
    finto.totali = [
      { entity_id: "id-srls", tipo: "srls", soggetto: "Borgo 58", quante: 2, totale: "6000.00" },
      { entity_id: "id-tasca", tipo: "tasca", soggetto: "La tasca di Alessio", quante: 1, totale: "250.50" },
    ];
    finto.righe = [
      { id: "r1", data: "2026-09-01", tipo: "srls", soggetto: "Borgo 58", causale: "Attrezzature", mezzo: "banca", descrizione: "Forno", nota: null, importo: "5000.00" },
      { id: "r2", data: "2026-09-02", tipo: "srls", soggetto: "Borgo 58", causale: "Attrezzature", mezzo: "cassa", descrizione: "Abbattitore", nota: null, importo: "1000.00" },
      { id: "r3", data: "2026-08-15", tipo: "tasca", soggetto: "La tasca di Alessio", causale: null, mezzo: "cassa", descrizione: "Insegna", nota: null, importo: "250.50" },
    ];
  };

  it("6 · i tre numeri, e il totale e' la somma visibile dei due", async () => {
    conDati();
    const { container } = await apriCosto();
    expect(container.querySelector('[data-prova="totale-srls"]').textContent).toMatch(/6\.000,00/);
    expect(container.querySelector('[data-prova="totale-tasca"]').textContent).toMatch(/250,50/);
    expect(container.querySelector('[data-prova="totale-progetto"]').textContent).toMatch(/6\.250,50/);
  });

  it("7 · l'orto non entra nel totale, e non sparisce", async () => {
    conDati();
    finto.totali.push({
      entity_id: "id-orto",
      tipo: "azienda_agricola",
      soggetto: "Orto Borgo 58",
      quante: 1,
      totale: "900.00",
    });
    finto.righe.push({
      id: "r4", data: "2026-07-01", tipo: "azienda_agricola", soggetto: "Orto Borgo 58",
      causale: "Attrezzature", mezzo: "cassa", descrizione: "Serra", nota: null, importo: "900.00",
    });
    const { container } = await apriCosto();
    // Il totale non e' cambiato: 6.250,50, non 7.150,50.
    expect(container.querySelector('[data-prova="totale-progetto"]').textContent).toMatch(/6\.250,50/);
    // Ma l'orto e' dichiarato, col suo importo.
    const fuori = container.querySelector('[data-prova="fuori-dal-totale"]');
    expect(fuori).toBeTruthy();
    expect(fuori.textContent).toMatch(/Orto Borgo 58/);
    expect(fuori.textContent).toMatch(/900,00/);
  });

  it("e senza soggetti fuori, quel riquadro non c'e'", async () => {
    conDati();
    const { container } = await apriCosto();
    expect(container.querySelector('[data-prova="fuori-dal-totale"]')).toBeNull();
  });

  it("10 · il dettaglio compone i numeri, riga per riga", async () => {
    conDati();
    const { container } = await apriCosto();
    expect(container.textContent).toMatch(/Forno/);
    expect(container.textContent).toMatch(/Abbattitore/);
    expect(container.textContent).toMatch(/Insegna/);
    // Il controllo incrociato si vede: 3 righe nel totale, 6.250,50.
    expect(container.textContent).toMatch(/3 nel totale/);
    expect(container.querySelector('[data-prova="dettaglio-parziale"]')).toBeNull();
  });

  it("🔴 11 · un dettaglio tagliato si DICHIARA, e il totale resta quello vero", async () => {
    finto.totali = [
      { tipo: "srls", soggetto: "Borgo 58", quante: 1200, totale: "50000.00" },
      { tipo: "tasca", soggetto: "La tasca di Alessio", quante: 0, totale: "0" },
    ];
    finto.righe = Array.from({ length: 1000 }, (_, i) => ({
      id: `r${i}`, data: "2026-09-01", tipo: "srls", soggetto: "Borgo 58",
      causale: "Attrezzature", mezzo: "cassa", descrizione: `Spesa ${i}`, nota: null, importo: "1.00",
    }));
    const { container } = await apriCosto();
    const avviso = container.querySelector('[data-prova="dettaglio-parziale"]');
    expect(avviso).toBeTruthy();
    expect(avviso.textContent).toMatch(/1000 righe delle 1200/);
    // 🔴 E il totale NON e' la somma delle mille righe arrivate: e' il numero
    //    che il database ha aggregato, che non si puo' tagliare.
    expect(container.querySelector('[data-prova="totale-progetto"]').textContent).toMatch(/50\.000,00/);
  });

  it("12 · senza nessun dato le due voci ci sono lo stesso, e si dice cosa fare", async () => {
    const { container } = await apriCosto();
    expect(container.querySelector('[data-prova="totale-srls"]').textContent).toMatch(/0,00/);
    expect(container.querySelector('[data-prova="totale-tasca"]').textContent).toMatch(/0,00/);
    expect(container.textContent).toMatch(/Non hai ancora segnato nessuna spesa/);
    // La strada per farci qualcosa, non un riquadro vuoto e basta.
    expect(screen.getByRole("link", { name: "Prima nota" })).toBeTruthy();
  });

  it("🔴 se la lettura fallisce NON si disegna uno zero", async () => {
    // «Totale progetto 0,00 €» si legge «non e' costato niente»: e' una
    // risposta, ed e' falsa. Regola del 19/08 — *non vuol dire che e' vuota,
    // vuol dire che non lo so*.
    finto.rompiTotali = true;
    const { container } = await apriCosto();
    expect(container.querySelector('[data-prova="totale-progetto"]')).toBeNull();
    expect(container.textContent).toMatch(/non lo so/i);
    // E la via d'uscita per riprovare: un rifiuto senza gesto d'uscita e' un
    // vicolo cieco.
    expect(screen.getByRole("button", { name: /Riprova/i })).toBeTruthy();
  });

  it("il periodo parte VUOTO: la domanda e' «da sempre»", async () => {
    conDati();
    const api = await import("../../src/lib/api/cash");
    await apriCosto();
    expect(api.costoDelProgetto).toHaveBeenCalledWith("", "");
  });
});
