import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LA CHIUSURA DELL'ANNO, GUARDATA DALLA SCHERMATA — C5, 23/09/2026
// =====================================================================
// 🔴 PERCHE' NON BASTANO LE PROVE PURE. `tests/unita/chiusura-anno.test.js`
//    prova che la REGOLA risponde giusto; queste provano che la schermata
//    la CHIAMA, e soprattutto che **la conferma arriva fino al database**.
//    Sono due cose diverse, e il progetto ha gia' pagato la differenza: il
//    16/08 il menu del mezzo di pagamento delle mance si vedeva, si
//    sceglieva, e il campo non arrivava — nessuna prova sul database poteva
//    accorgersene, perche' il difetto stava nel tratto in mezzo.
//
// ⚠️ QUI NON SI PARLA COL DATABASE: il collegamento e' finto e ogni prova
//    dichiara cosa gli fa rispondere.
//
// ⚠️ E QUESTO STRATO NON E' UN OCCHIO: che l'avviso si distingua con le
//    luci basse resta un giudizio di Alessio.

const SRLS = { id: "id-srls", entity_type: "srls", name: "Borgo 58" };
const AGRICOLA = { id: "id-orto", entity_type: "azienda_agricola", name: "Orto Borgo 58" };
const TASCA = { id: "id-tasca", entity_type: "tasca", name: "La tasca di Alessio" };

const finto = vi.hoisted(() => ({
  misure: null,
  storico: [],
  senzaDocumento: [],
  rompiElenco: false,
  rifiuto: null,
}));

const spie = vi.hoisted(() => ({ chiusure: [], cancellate: [] }));

vi.mock("../../src/lib/api/entities", () => ({
  getEntities: vi.fn(async () => ({ srls: SRLS, agricola: AGRICOLA, tasca: TASCA })),
}));

vi.mock("../../src/lib/api/proiezione", () => ({
  misureDellAnno: vi.fn(async () => finto.misure),
  listaChiusureAnnuali: vi.fn(async () => finto.storico),
  chiudiAnno: vi.fn(async (entityId, anno, conferma, note) => {
    spie.chiusure.push({ entityId, anno, conferma, note });
    if (finto.rifiuto) throw new Error(finto.rifiuto);
    return "nuova";
  }),
  cancellaChiusuraAnnuale: vi.fn(async (id) => {
    spie.cancellate.push(id);
  }),
}));

vi.mock("../../src/lib/api/cash", () => ({
  listContiDaFiscalizzare: vi.fn(async () => {
    if (finto.rompiElenco) throw new Error("niente rete");
    return finto.senzaDocumento;
  }),
}));

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    rpc: async () => ({ data: null, error: null }),
  },
  supabasePubblico: {},
}));

const misure = (extra = {}) => ({
  anno_finito: true,
  coperti: null,
  ricavi: null,
  food_cost: null,
  fissi: null,
  omaggi_costo: 0,
  omaggi_quanti: 0,
  conti_chiusi: 0,
  origine_coperti: "assente",
  origine_ricavi: "assente",
  origine_food_cost: "assente",
  origine_fissi: "assente",
  mesi_fotografati: 0,
  conti_senza_documento: 0,
  incasso_senza_documento: 0,
  ...extra,
});

async function apri() {
  const { default: ChiusuraAnnuale } = await import("../../src/pages/fiscale/ChiusuraAnnuale.jsx");
  const vista = render(
    <MemoryRouter initialEntries={["/fiscale/chiusura-anno"]}>
      <ChiusuraAnnuale />
    </MemoryRouter>
  );
  // ⚠️ SI ASPETTA IL DATO, NON LA SPARIZIONE DI «Sto leggendo…»: la prima
  //    versione aspettava quella, e i soggetti arrivano dopo — quindi la
  //    prova proseguiva su una schermata ancora vuota e falliva a caso, a
  //    volte in quattro punti e a volte in sette. *Una prova intermittente
  //    insegna a rilanciare invece che a guardare.*
  await waitFor(() => expect(vista.container.querySelector('[data-prova="ricavi"]')).toBeTruthy());
  return vista;
}

beforeEach(() => {
  finto.misure = misure();
  finto.storico = [];
  finto.senzaDocumento = [];
  finto.rompiElenco = false;
  finto.rifiuto = null;
  spie.chiusure = [];
  spie.cancellate = [];
  vi.clearAllMocks();
});

// =====================================================================
describe("una chiusura pulita si fa in un gesto solo", () => {
  it("il pulsante c'è, e non chiede nessuna conferma", async () => {
    const { container } = await apri();
    expect(container.querySelector('[data-prova="chiudi-pulita"]')).toBeTruthy();
    expect(container.querySelector('[data-prova="avviso-senza-documento"]')).toBeNull();
  });

  it("🔴 e chiude dichiarando al database che NON c'era niente da confermare", async () => {
    const { container } = await apri();
    fireEvent.click(container.querySelector('[data-prova="chiudi-pulita"]'));
    await waitFor(() => expect(spie.chiusure).toHaveLength(1));
    expect(spie.chiusure[0].conferma).toBe(false);
    expect(spie.chiusure[0].entityId).toBe(SRLS.id);
  });

  it("⚠️ e i numeri non misurati si vedono come non misurati, non come zero", async () => {
    const { container } = await apri();
    expect(container.querySelector('[data-prova="ricavi"]').textContent).toMatch(/non misurato/i);
  });
});

// =====================================================================
describe("🔴 con conti senza documento la schermata avvisa PRIMA", () => {
  beforeEach(() => {
    finto.misure = misure({ conti_senza_documento: 2, incasso_senza_documento: 145.5 });
    finto.senzaDocumento = [
      { order_id: "o1", chiuso_il: "2026-06-02T19:00:00Z", tavolo: "T1", incasso: 45.5, stato: "da dire" },
      { order_id: "o2", chiuso_il: "2026-07-07T19:00:00Z", tavolo: "T3", incasso: 100, stato: "da dire" },
    ];
  });

  it("l'avviso dice quanti sono e quanto valgono", async () => {
    const { container } = await apri();
    const avviso = container.querySelector('[data-prova="avviso-senza-documento"]');
    expect(avviso).toBeTruthy();
    expect(avviso.textContent).toMatch(/2 conti senza documento fiscale/);
    expect(avviso.textContent).toContain("145,50");
  });

  it("🔴 e dice che restano dove sono: confermare non vuol dire sistemarli", async () => {
    const { container } = await apri();
    const avviso = container.querySelector('[data-prova="avviso-senza-documento"]');
    expect(avviso.textContent).toMatch(/restano esattamente dove sono/i);
  });

  it("🔴 e L21 è dichiarata aperta, lì dove il dubbio c'è", async () => {
    const { container } = await apri();
    expect(container.querySelector('[data-prova="quesito-aperto"]').textContent).toContain("L21");
  });

  it("porta all'elenco vero dei conti, non a un numero e basta", async () => {
    const { container } = await apri();
    fireEvent.click(container.querySelector('[data-prova="apri-elenco"]'));
    await waitFor(() =>
      expect(container.querySelector('[data-prova="elenco-senza-documento"]')).toBeTruthy()
    );
    const elenco = container.querySelector('[data-prova="elenco-senza-documento"]');
    expect(elenco.textContent).toContain("T1");
    expect(elenco.textContent).toContain("T3");
  });

  it("🔴 il pulsante di chiusura diventa una conferma, e NON chiude al primo tocco", async () => {
    const { container } = await apri();
    expect(container.querySelector('[data-prova="chiudi-pulita"]')).toBeNull();
    fireEvent.click(container.querySelector('[data-prova="chiudi-con-avviso"]'));
    // ⚠️ Il primo tocco apre la domanda: niente è ancora stato scritto.
    expect(spie.chiusure).toHaveLength(0);
    expect(screen.getByText(/lasciando indietro 2 conti/i)).toBeTruthy();
  });

  it("🔴 ANNULLARE non scrive niente", async () => {
    const { container } = await apri();
    fireEvent.click(container.querySelector('[data-prova="chiudi-con-avviso"]'));
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    await waitFor(() => expect(screen.queryByText(/lasciando indietro/i)).toBeNull());
    expect(spie.chiusure, "annullare ha chiuso l'anno").toHaveLength(0);
    expect(spie.cancellate).toHaveLength(0);
  });

  it("🔴 e la conferma ARRIVA AL DATABASE, non si ferma nella schermata", async () => {
    // È il difetto del 16/08 letto qui: un campo che si vede, si sceglie, e
    // non arriva dove viene preteso.
    const { container } = await apri();
    fireEvent.click(container.querySelector('[data-prova="chiudi-con-avviso"]'));
    fireEvent.click(screen.getByRole("button", { name: "Sì, li ho visti: chiudi" }));
    await waitFor(() => expect(spie.chiusure).toHaveLength(1));
    expect(spie.chiusure[0].conferma, "la conferma non è arrivata al database").toBe(true);
  });

  it("⚠️ e se l'elenco non si legge lo DICE, invece di far sembrare che non ce ne siano", async () => {
    finto.rompiElenco = true;
    const { container } = await apri();
    // L'avviso col conteggio resta: quello è arrivato.
    expect(container.querySelector('[data-prova="avviso-senza-documento"]')).toBeTruthy();
    expect(screen.getByText(/Non riesco a leggere l'elenco dei conti senza documento/i)).toBeTruthy();
    expect(container.querySelector('[data-prova="apri-elenco"]')).toBeNull();
  });
});

// =====================================================================
describe("gli anni che non si possono chiudere", () => {
  it("un anno non finito lo dice, e non offre il pulsante", async () => {
    finto.misure = misure({ anno_finito: false });
    const { container } = await apri();
    expect(container.querySelector('[data-prova="non-finito"]')).toBeTruthy();
    expect(container.querySelector('[data-prova="chiudi-pulita"]')).toBeNull();
    expect(container.querySelector('[data-prova="chiudi-con-avviso"]')).toBeNull();
  });

  it("🔴 e un anno già chiuso nemmeno: non si offre un gesto che verrà respinto", async () => {
    const annoScorso = new Date().getFullYear() - 1;
    finto.storico = [
      {
        id: "c1",
        anno: annoScorso,
        chiusa_il: "2027-01-05T10:00:00Z",
        ricavi: null,
        coperti: null,
        food_cost: null,
        fissi: null,
        conti_senza_documento: 0,
        chiusure_precedenti: 0,
      },
    ];
    const { container } = await apri();
    expect(container.querySelector('[data-prova="gia-chiuso"]')).toBeTruthy();
    expect(container.querySelector('[data-prova="chiudi-pulita"]')).toBeNull();
  });

  it("⚠️ e anche con conti senza documento un anno non finito non chiede conferma", async () => {
    // Chiedere una conferma per un gesto che verrà rifiutato comunque
    // insegna a premere «sì» senza leggere.
    finto.misure = misure({ anno_finito: false, conti_senza_documento: 3 });
    const { container } = await apri();
    expect(container.querySelector('[data-prova="chiudi-con-avviso"]')).toBeNull();
    expect(container.querySelector('[data-prova="non-finito"]')).toBeTruthy();
  });
});

// =====================================================================
describe("lo storico distingue una chiusura pulita da una con avviso", () => {
  const riga = (extra) => ({
    id: "c1",
    anno: 2027,
    chiusa_il: "2028-01-05T10:00:00Z",
    ricavi: "1000",
    coperti: "50",
    food_cost: null,
    fissi: null,
    conti_senza_documento: 0,
    incasso_senza_documento: 0,
    chiusure_precedenti: 0,
    ...extra,
  });

  it("pulita: lo dice, e non nomina L21", async () => {
    finto.storico = [riga()];
    const { container } = await apri();
    expect(container.querySelector('[data-prova="storico-pulita"]')).toBeTruthy();
    expect(container.querySelector('[data-prova="storico-con-avviso"]')).toBeNull();
    expect(container.querySelector('[data-prova="storico"]').textContent).not.toContain("L21");
  });

  it("🔴 con avviso: dice quanti erano, e che L21 è ancora aperta", async () => {
    finto.storico = [riga({ conti_senza_documento: 3, incasso_senza_documento: 210 })];
    const { container } = await apri();
    const r = container.querySelector('[data-prova="storico-con-avviso"]');
    expect(r).toBeTruthy();
    expect(r.textContent).toMatch(/3 conti senza documento/);
    expect(r.textContent).toContain("L21");
  });

  it("⚠️ e una chiusura rifatta lo dichiara", async () => {
    finto.storico = [riga({ chiusure_precedenti: 2, prima_chiusura_il: "2028-01-02T09:00:00Z" })];
    const { container } = await apri();
    expect(container.querySelector('[data-prova="rifatto"]').textContent).toMatch(/2 volte/);
  });
});

// =====================================================================
describe("🔴 i soggetti restano separati, e la tasca non c'è", () => {
  it("il menu offre la società e l'azienda agricola", async () => {
    const { container } = await apri();
    const opzioni = [...container.querySelectorAll('[data-prova="soggetto"] option')].map(
      (o) => o.textContent
    );
    expect(opzioni).toEqual(["Borgo 58", "Orto Borgo 58"]);
  });

  it("🔴 e la tasca NON è fra le scelte: non è una società e non ha un anno fiscale", async () => {
    const { container } = await apri();
    expect(container.querySelector('[data-prova="soggetto"]').textContent).not.toContain("tasca");
  });

  it("⚠️ cambiando soggetto si chiude QUELLO, non sempre la società", async () => {
    const { container } = await apri();
    fireEvent.change(container.querySelector('[data-prova="soggetto"]'), {
      target: { value: "agricola" },
    });
    await waitFor(() => expect(container.querySelector('[data-prova="chiudi-pulita"]')).toBeTruthy());
    fireEvent.click(container.querySelector('[data-prova="chiudi-pulita"]'));
    await waitFor(() => expect(spie.chiusure).toHaveLength(1));
    expect(spie.chiusure[0].entityId).toBe(AGRICOLA.id);
  });
});

// =====================================================================
describe("il rifiuto del database si vede", () => {
  it("⚠️ e non sparisce dietro un successo finto", async () => {
    finto.rifiuto = "Restano 2 conti del 2027 senza documento fiscale, per 145,50 €.";
    const { container } = await apri();
    fireEvent.click(container.querySelector('[data-prova="chiudi-pulita"]'));
    await waitFor(() => expect(container.querySelector('[data-prova="errore"]')).toBeTruthy());
    expect(container.querySelector('[data-prova="errore"]').textContent).toContain("2 conti");
  });
});
