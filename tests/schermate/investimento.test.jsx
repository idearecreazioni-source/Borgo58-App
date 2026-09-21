import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  note: [],
  rifiutoNota: null,
}));

const spie = vi.hoisted(() => ({
  crea: null,
  segna: null,
  creaNota: null,
  segnaNota: null,
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
  finto.note = [];
  finto.rifiutoNota = null;
  spie.crea = null;
  spie.segna = null;
  spie.creaNota = null;
  spie.segnaNota = null;
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

// =====================================================================
// «ANTICIPO IO, POI MI RIMBORSO» — LA SECONDA FONTE, DALLE SCHERMATE
// =====================================================================
// 🔴 Il difetto che chiude: la prima stesura contava queste spese **zero
//    volte**, perche' l'etichetta esisteva solo sui movimenti di cassa e la
//    spesa vive altrove. Qui si prova che la casella c'e' dove la spesa vive,
//    che quello che si spunta ARRIVA, e che il rifiuto del database si legge
//    sulla riga toccata invece che in cima alla pagina.

const TAG = { id: "t1", etichetta: "Fornitore urgente", attivo: true };

const notaAperta = (extra) => ({
  id: "n1",
  importo: "300.00",
  pagata_il: "2026-09-01",
  tag: { etichetta: TAG.etichetta },
  tag_id: TAG.id,
  fondi: "contanti",
  supplier_invoice_id: null,
  documento_riferimento: "DOC-1",
  nota: null,
  pareggiata_il: null,
  e_investimento: false,
  ...extra,
});

const notaChiusa = (extra) =>
  notaAperta({ id: "n2", pareggiata_il: "2026-09-10", ...extra });

vi.mock("../../src/lib/api/supplierInvoices", () => ({
  listSupplierInvoices: vi.fn(async () => []),
}));

vi.mock("../../src/lib/api/anticipazioni", () => ({
  annullaPareggioAnticipazione: vi.fn(async () => ({})),
  createAnticipazione: vi.fn(async (p) => {
    spie.creaNota = p;
    return { id: "nuova" };
  }),
  createTagAnticipazione: vi.fn(async () => TAG),
  deleteAnticipazione: vi.fn(async () => ({})),
  getSaldoAnticipazioni: vi.fn(async () => ({
    ti_deve: 300,
    note_aperte: 1,
    piu_vecchia_il: "2026-09-01",
    totale_anno: 300,
    avvertenza: "",
  })),
  listAnticipazioni: vi.fn(async () => finto.note),
  listAnticipazioniPerTag: vi.fn(async () => []),
  listDaComunicare: vi.fn(async () => []),
  listTagAnticipazioni: vi.fn(async () => [TAG]),
  pareggiaAnticipazione: vi.fn(async () => ({})),
  segnaInvestimentoAnticipazione: vi.fn(async (id, valore) => {
    spie.segnaNota = [id, valore];
    if (finto.rifiutoNota) throw new Error(finto.rifiutoNota);
    const n = finto.note.find((x) => x.id === id);
    return { ...n, e_investimento: valore };
  }),
}));

async function apriAnticipazioni() {
  const { default: SezionePersonale } = await import("../../src/pages/cassa/SezionePersonale.jsx");
  const vista = render(
    <MemoryRouter initialEntries={["/cassa/personale"]}>
      <SezionePersonale />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText("Ancora da rimborsare")).toBeTruthy());
  return vista;
}

describe("13-bis · l'etichetta c'e' dove la spesa vive", () => {
  it("nel modulo di una nota nuova la casella c'e'", async () => {
    const { container } = await apriAnticipazioni();
    expect(container.querySelector('[data-prova="investimento-nota-nuova"]')).toBeTruthy();
  });

  it("2 · senza toccare niente la nota nasce NON marcata", async () => {
    const { container } = await apriAnticipazioni();
    const importo = container.querySelector('input[type="number"]');
    fireEvent.change(importo, { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: /Registra/ }));
    await waitFor(() => expect(spie.creaNota).toBeTruthy());
    expect(spie.creaNota.eInvestimento).toBe(false);
  });

  it("3 · spuntata, arriva al salvataggio", async () => {
    const { container } = await apriAnticipazioni();
    fireEvent.change(container.querySelector('input[type="number"]'), { target: { value: "300" } });
    fireEvent.click(container.querySelector('[data-prova="investimento-nota-nuova"] input'));
    fireEvent.click(screen.getByRole("button", { name: /Registra/ }));
    await waitFor(() => expect(spie.creaNota).toBeTruthy());
    expect(spie.creaNota.eInvestimento).toBe(true);
  });
});

describe("7 · una nota gia' scritta si marca e si smarca", () => {
  it("il gesto c'e' sulla nota aperta, e manda SOLO l'etichetta", async () => {
    finto.note = [notaAperta()];
    const { container } = await apriAnticipazioni();
    const caselle = tutti(container, '[data-prova="investimento-nota"] input');
    expect(caselle.length).toBeGreaterThan(0);
    fireEvent.click(caselle[0]);
    await waitFor(() => expect(spie.segnaNota).toEqual(["n1", true]));
  });

  it("🔴 e l'elenco si aggiorna SOLO sulla riga toccata", async () => {
    // 🔴 QUESTA PROVA NASCE DA UNA ROTTURA CHE NON HA ROTTO NIENTE
    //    (21/09): sostituendo l'aggiornamento della sola riga con una
    //    ricarica completa, nessuna prova diventava rossa. Una ricarica
    //    butterebbe via quello che si sta scrivendo nel modulo sopra — e'
    //    la trappola del 12/08, pagata una volta.
    const api = await import("../../src/lib/api/anticipazioni");
    finto.note = [notaAperta()];
    const { container } = await apriAnticipazioni();
    const letturePrima = api.listAnticipazioni.mock.calls.length;
    fireEvent.click(tutti(container, '[data-prova="investimento-nota"] input')[0]);
    await waitFor(() => expect(spie.segnaNota).toBeTruthy());
    expect(api.listAnticipazioni.mock.calls.length).toBe(letturePrima);
  });

  it("🔴 e anche su una nota GIA' RIMBORSATA", async () => {
    // Il costo del progetto e' lo stesso prima e dopo il rimborso: il
    // rimborso chiude un debito, non annulla una spesa.
    finto.note = [notaChiusa({ e_investimento: true })];
    const { container } = await apriAnticipazioni();
    const caselle = tutti(container, '[data-prova="investimento-nota-chiusa"] input');
    expect(caselle.length).toBeGreaterThan(0);
    expect(caselle[0].checked).toBe(true);
    fireEvent.click(caselle[0]);
    await waitFor(() => expect(spie.segnaNota).toEqual(["n2", false]));
  });

  it("🔴 il rifiuto del database si legge SULLA RIGA TOCCATA", async () => {
    // Un rifiuto in cima alla pagina e' un rifiuto che non c'e': lo si e'
    // gia' pagato una volta in Cassa, il 17/08.
    finto.note = [notaAperta({ supplier_invoice_id: "f1" })];
    finto.rifiutoNota = "La fattura ZZ-1 e' gia' contata nel costo del progetto.";
    const { container } = await apriAnticipazioni();
    fireEvent.click(tutti(container, '[data-prova="investimento-nota"] input')[0]);
    await waitFor(() =>
      expect(container.querySelector('[data-prova="investimento-nota-errore"]')).toBeTruthy()
    );
    expect(
      container.querySelector('[data-prova="investimento-nota-errore"]').textContent
    ).toMatch(/gia' contata/);
  });

  it("⚠️ la frase sulla fattura dice DI QUALE conteggio parla", async () => {
    // Prima diceva «la spesa e' contata li'» senza dire dove: da oggi e'
    // vero per il fisco e non per il costo del progetto, e una frase che
    // vale per un conteggio e non per l'altro va detta intera.
    finto.note = [notaAperta({ supplier_invoice_id: "f1" })];
    const { container } = await apriAnticipazioni();
    expect(container.textContent).toMatch(/il costo fiscale è contato sulla fattura/);
  });
});

describe("la vista mostra la seconda fonte", () => {
  const conAnticipo = () => {
    finto.totali = [
      { entity_id: "id-srls", tipo: "srls", soggetto: "Borgo 58", quante: 2, totale: "6300.00" },
      { entity_id: "id-tasca", tipo: "tasca", soggetto: "La tasca di Alessio", quante: 0, totale: "0" },
    ];
    finto.righe = [
      {
        id: "m1", fonte: "prima_nota", data: "2026-09-02", tipo: "srls", soggetto: "Borgo 58",
        causale: "Attrezzature", mezzo: "banca", fondi: null, descrizione: "Forno", nota: null,
        fattura: null, rimborso: null, importo: "6000.00",
      },
      {
        id: "a1", fonte: "anticipazione", data: "2026-09-01", tipo: "srls", soggetto: "Borgo 58",
        causale: "Fornitore urgente", mezzo: null, fondi: "conto_personale", descrizione: null,
        nota: "acconto al fabbro", fattura: "Fattura 12 — Ferramenta Rossi",
        rimborso: "rimborsata il 10/09/2026", importo: "300.00",
      },
    ];
  };

  it("l'anticipo si riconosce, e non si chiama «tasca»", async () => {
    conAnticipo();
    const { container } = await apriCosto();
    expect(tutti(container, '[data-prova="segno-anticipo"]').length).toBeGreaterThan(0);
    expect(container.textContent).toMatch(/Anticipo rimborsabile/);
    expect(container.textContent).toMatch(/il titolare, dal suo conto personale/);
  });

  it("dice la fattura collegata e lo stato del rimborso", async () => {
    conAnticipo();
    const { container } = await apriCosto();
    expect(container.textContent).toMatch(/Fattura 12 — Ferramenta Rossi/);
    expect(container.textContent).toMatch(/rimborsata il 10\/09\/2026/);
  });

  it("🔴 entra nel totale di Borgo 58, non in quello della tasca", async () => {
    conAnticipo();
    const { container } = await apriCosto();
    expect(container.querySelector('[data-prova="totale-srls"]').textContent).toMatch(/6\.300,00/);
    expect(container.querySelector('[data-prova="totale-tasca"]').textContent).toMatch(/0,00/);
    expect(container.querySelector('[data-prova="totale-progetto"]').textContent).toMatch(/6\.300,00/);
    expect(container.querySelector('[data-prova="dettaglio-parziale"]')).toBeNull();
  });

  it("⚠️ e i codici del database non escono a schermo", async () => {
    conAnticipo();
    const { container } = await apriCosto();
    expect(container.textContent).not.toMatch(/conto_personale/);
    expect(container.textContent).not.toMatch(/prima_nota/);
  });
});

// =====================================================================
// 🔴 L'AIUTO SEGUE LA SOCIETÀ SCELTA — 21/09/2026
// =====================================================================
// IL DIFETTO CHE CHIUDE: in questa schermata il soggetto si sceglie da un
// menu — Borgo 58 **oppure** Orto Borgo 58 — e l'aiuto dell'etichetta diceva
// sempre «entra sotto Borgo 58». Su una nota dell'orto era **falso**: quella
// spesa finisce sotto l'orto, e l'orto sta FUORI dal totale del progetto.
//
// ⚠️ La regola di CALCOLO era già giusta (si raggruppa per soggetto): a
//    essere sbagliata era la spiegazione. Due parti dello stesso programma
//    che dicono cose diverse dello stesso fatto — la famiglia di difetti che
//    questo progetto insegue da agosto.
//
// ⚠️ E LA PROVA PURA NON BASTA: `tests/unita/investimento.test.js` prova che
//    la REGOLA risponde giusto; questa prova che la schermata la CHIAMA, e
//    che le parole a schermo cambiano davvero.
describe("🔴 l'aiuto dell'etichetta dice la società giusta", () => {
  const AIUTO = "Cosa vuol dire «investimento per il progetto»";

  const apriAiuto = async () => {
    const q = await waitFor(() => screen.getByRole("button", { name: AIUTO }));
    await act(async () => {
      q.click();
    });
    return screen.getByRole("tooltip");
  };

  const scegli = async (container, id) => {
    const menu = container.querySelector("select");
    await act(async () => {
      fireEvent.change(menu, { target: { value: id } });
    });
    // Cambiando società la schermata rilegge: si aspetta che il modulo torni.
    await waitFor(() => expect(screen.getByText("Ancora da rimborsare")).toBeTruthy());
  };

  it("su Borgo 58 nomina Borgo 58, e dice che conta nel totale", async () => {
    await apriAnticipazioni();
    const spiega = await apriAiuto();
    expect(spiega.textContent).toMatch(/sotto Borgo 58/);
    expect(spiega.textContent).toMatch(/nel totale del progetto/);
    expect(spiega.textContent).not.toMatch(/fuori dal totale/);
    expect(spiega.textContent).not.toMatch(/Orto/);
  });

  it("🔴 sull'orto nomina l'ORTO, e dice che resta FUORI dal totale", async () => {
    const { container } = await apriAnticipazioni();
    await scegli(container, AGRICOLA.id);
    const spiega = await apriAiuto();
    expect(spiega.textContent).toMatch(/sotto Orto Borgo 58/);
    expect(spiega.textContent).toMatch(/fuori dal totale del progetto/);
    // 🔴 LA RIGA CHE IMPEDISCE IL RITORNO DEL TESTO SBAGLIATO: con l'orto
    //    selezionato, «sotto Borgo 58» non deve più comparire.
    expect(spiega.textContent).not.toMatch(/sotto Borgo 58/);
    // ⚠️ E non deve nemmeno promettere che conta: «non conta nel totale» e
    //    «conta nel totale» differiscono di una parola, e una prova che
    //    cercasse solo «nel totale» passerebbe su tutt'e due.
    expect(spiega.textContent).not.toMatch(/conta nel totale del progetto/);
  });

  it("⚠️ e non sparisce: la nota dell'orto si vede lo stesso, dichiarata a parte", async () => {
    const { container } = await apriAnticipazioni();
    await scegli(container, AGRICOLA.id);
    const spiega = await apriAiuto();
    expect(spiega.textContent).toMatch(/non sparisce/);
  });

  it("la frase sul rimborso vale per tutt'e due", async () => {
    // Il rimborso non è una spesa nuova: è un debito che si chiude. Vale
    // sotto qualunque società, e non deve sparire cambiando menu.
    const { container } = await apriAnticipazioni();
    expect((await apriAiuto()).textContent).toMatch(/dopo che ti sei rimborsato/);
    await scegli(container, AGRICOLA.id);
    expect((await apriAiuto()).textContent).toMatch(/dopo che ti sei rimborsato/);
  });
});
