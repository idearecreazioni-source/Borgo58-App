import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// L'ANTICIPO PAGA LA FATTURA, GUARDATO DALLE SCHERMATE — 01/11/2026
// =====================================================================
// ⚠️ QUI NON SI PARLA COL DATABASE: il collegamento e' finto. Queste prove
//    dicono che la schermata delle fatture legge «pagata (anticipo)» e non
//    offre il gesto sbagliato, e che quella degli anticipi propone la cifra
//    giusta e consegna alla funzione la fattura scelta.

const SRLS = { id: "id-srls", entity_type: "srls", name: "Borgo 58" };
const TAG = { id: "t1", etichetta: "Fornitore urgente", attivo: true };

const finto = vi.hoisted(() => ({ daPagare: [], pagate: [], rompiDopoLaNota: false, rotto: false }));
const spie = vi.hoisted(() => ({ creaNota: null, annulla: null, erroreNota: null, pagate: 0 }));

const FATTURA_ARUBA = {
  id: "f1",
  entity_id: "id-srls",
  invoice_number: "ZZ-ARUBA-1",
  invoice_date: "2026-10-30",
  due_date: null,
  amount: "1.22",
  da_pagare: "1.22",
  note_scalate: "0",
  status: "da_pagare",
  paid_at: null,
  payment_method: null,
  supplier: { id: "s1", name: "ZZ Fornitore di prova" },
  utilizzi: [],
  documenti: [],
};

vi.mock("../../src/lib/api/entities", () => ({
  getEntities: vi.fn(async () => ({ srls: SRLS, agricola: null, tasca: null })),
}));

vi.mock("../../src/lib/api/supplierInvoices", () => ({
  listSupplierInvoices: vi.fn(async () => {
    if (finto.rotto) throw new Error("connessione persa");
    return finto.daPagare;
  }),
  ultimeFatturePagate: vi.fn(async () => ({ righe: finto.pagate, quante: finto.pagate.length })),
  annullaPagamentoFattura: vi.fn(async (id) => {
    spie.annulla = id;
  }),
  anteprimaPagamento: vi.fn(async () => null),
  collegaDocumentoAFattura: vi.fn(async () => ({})),
  createSupplierInvoice: vi.fn(async () => ({})),
  creditiFornitore: vi.fn(async () => []),
  creditiPerFattura: vi.fn(async () => []),
  deleteSupplierInvoice: vi.fn(async () => ({})),
  eliminaNotaCredito: vi.fn(async () => ({})),
  markInvoicePaid: vi.fn(async () => {
    spie.pagate += 1;
    return {};
  }),
  registraNotaCredito: vi.fn(async () => ({})),
  updateSupplierInvoice: vi.fn(async () => ({})),
}));

vi.mock("../../src/lib/api/documents", () => ({ listDocuments: vi.fn(async () => []) }));
vi.mock("../../src/lib/api/suppliers", () => ({ listSuppliers: vi.fn(async () => []) }));

vi.mock("../../src/lib/api/anticipazioni", () => ({
  annullaPareggioAnticipazione: vi.fn(async () => ({})),
  createAnticipazione: vi.fn(async (p) => {
    if (spie.erroreNota) throw new Error(spie.erroreNota);
    spie.creaNota = p;
    if (finto.rompiDopoLaNota) finto.rotto = true;
    return { id: "nuova" };
  }),
  createTagAnticipazione: vi.fn(async () => TAG),
  deleteAnticipazione: vi.fn(async () => ({})),
  getSaldoAnticipazioni: vi.fn(async () => ({
    ti_deve: 0,
    note_aperte: 0,
    piu_vecchia_il: null,
    totale_anno: 0,
    avvertenza: "",
  })),
  listAnticipazioni: vi.fn(async () => []),
  listAnticipazioniPerTag: vi.fn(async () => []),
  listDaComunicare: vi.fn(async () => []),
  listTagAnticipazioni: vi.fn(async () => [TAG]),
  pareggiaAnticipazione: vi.fn(async () => ({})),
  segnaInvestimentoAnticipazione: vi.fn(async () => ({})),
}));

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    rpc: async () => ({ data: null, error: null }),
  },
  supabasePubblico: {},
}));

beforeEach(() => {
  finto.daPagare = [];
  finto.pagate = [];
  finto.rompiDopoLaNota = false;
  finto.rotto = false;
  spie.creaNota = null;
  spie.annulla = null;
  spie.erroreNota = null;
  spie.pagate = 0;
  vi.clearAllMocks();
});

async function apriFatture() {
  const { default: FattureFornitoriHome } = await import("../../src/pages/fatture/FattureFornitoriHome.jsx");
  const vista = render(
    <MemoryRouter initialEntries={["/fatture"]}>
      <FattureFornitoriHome />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByRole("button", { name: /Pagate \(/ })).toBeTruthy());
  return vista;
}

async function apriAnticipi() {
  const { default: SezionePersonale } = await import("../../src/pages/cassa/SezionePersonale.jsx");
  const vista = render(
    <MemoryRouter initialEntries={["/cassa/personale"]}>
      <SezionePersonale />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText("Ancora da rimborsare")).toBeTruthy());
  return vista;
}

describe("Fatture fornitori · una fattura pagata con l'anticipo", () => {
  const pagataAnticipo = {
    ...FATTURA_ARUBA,
    status: "pagata",
    paid_at: "2026-10-30T10:00:00Z",
    payment_method: "anticipo",
  };

  it("si legge «pagata (anticipo)»", async () => {
    finto.pagate = [pagataAnticipo];
    await apriFatture();
    fireEvent.click(screen.getByRole("button", { name: /Pagate \(/ }));
    await waitFor(() => expect(screen.getByText(/pagata \(anticipo\)/)).toBeTruthy());
  });

  it("🔴 non offre «Annulla il pagamento» (non c'e' nessuna uscita da togliere) e indica la strada", async () => {
    finto.pagate = [pagataAnticipo];
    const { container } = await apriFatture();
    fireEvent.click(screen.getByRole("button", { name: /Pagate \(/ }));
    await waitFor(() => expect(container.querySelector('[data-prova="anticipo-niente-annulla"]')).toBeTruthy());
    expect(screen.queryByText("Annulla il pagamento")).toBeNull();
    expect(container.querySelector('[data-prova="anticipo-niente-annulla"]').textContent).toMatch(/elimina l.anticipo/);
  });

  it("una pagata con un bonifico mantiene il suo nome e il gesto di annullo", async () => {
    finto.pagate = [{ ...pagataAnticipo, payment_method: "bonifico" }];
    await apriFatture();
    fireEvent.click(screen.getByRole("button", { name: /Pagate \(/ }));
    await waitFor(() => expect(screen.getByText("Annulla il pagamento")).toBeTruthy());
    expect(screen.queryByText(/pagata \(anticipo\)/)).toBeNull();
    expect(screen.getByText(/Bonifico/)).toBeTruthy();
  });
});

describe("Anticipo da rimborsarmi · collegare una fattura", () => {
  const scegliFattura = (container) => {
    const menu = [...container.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.value === "f1")
    );
    fireEvent.change(menu, { target: { value: "f1" } });
    return menu;
  };

  it("scelta la fattura, propone la cifra che resta da pagare e dice cosa succede", async () => {
    finto.daPagare = [FATTURA_ARUBA];
    const { container } = await apriAnticipi();
    scegliFattura(container);
    await waitFor(() => expect(container.querySelector('[data-prova="anticipo-paga-fattura"]')).toBeTruthy());
    expect(container.querySelector('input[type="number"]').value).toBe("1.22");
    expect(container.querySelector('[data-prova="anticipo-paga-fattura"]').textContent).toMatch(/pagata \(anticipo\)/);
    expect(container.querySelector('[data-prova="anticipo-importo-diverso"]')).toBeNull();
  });

  it("una cifra diversa viene segnalata PRIMA di premere Registra", async () => {
    finto.daPagare = [FATTURA_ARUBA];
    const { container } = await apriAnticipi();
    scegliFattura(container);
    fireEvent.change(container.querySelector('input[type="number"]'), { target: { value: "5" } });
    await waitFor(() => expect(container.querySelector('[data-prova="anticipo-importo-diverso"]')).toBeTruthy());
  });

  it("senza fattura non compare nessuna frase sul pagamento", async () => {
    finto.daPagare = [FATTURA_ARUBA];
    const { container } = await apriAnticipi();
    expect(container.querySelector('[data-prova="anticipo-paga-fattura"]')).toBeNull();
  });

  it("registrando, la fattura scelta arriva alla funzione che salva", async () => {
    finto.daPagare = [FATTURA_ARUBA];
    const { container } = await apriAnticipi();
    scegliFattura(container);
    fireEvent.click(screen.getByRole("button", { name: /Registra/ }));
    await waitFor(() => expect(spie.creaNota).toBeTruthy());
    expect(spie.creaNota.supplierInvoiceId).toBe("f1");
    expect(Number(spie.creaNota.importo)).toBe(1.22);
  });
});

// =====================================================================
// «HO PAGATO IO» DAL MENU «COME PAGHI» — 13/11/2026
// =====================================================================
// Richiesta di Alessio (Fabio Lorito 1992/2026, 235 €, contanti suoi): la
// scelta fa ESATTAMENTE quello del riquadro in /cassa/personale, cioè
// consegna la fattura alla STESSA funzione che salva l'anticipo — e non
// passa mai da «Segna pagata» (che scriverebbe un'uscita di cassa).
describe("Fatture fornitori · Come paghi → Ho pagato io", () => {
  const scegliHoPagatoIo = async (container) => {
    fireEvent.click(screen.getByRole("button", { name: "Segna pagata" }));
    const menu = await waitFor(() => {
      const m = [...container.querySelectorAll("select")].find((s) =>
        [...s.options].some((o) => o.value === "ho_pagato_io")
      );
      expect(m).toBeTruthy();
      return m;
    });
    fireEvent.change(menu, { target: { value: "ho_pagato_io" } });
    await waitFor(() => expect(container.querySelector('[data-prova="ho-pagato-io-fattura"]')).toBeTruthy());
  };

  it("propone quanto resta da pagare, dice cosa succede, e niente «Usciranno»", async () => {
    finto.daPagare = [FATTURA_ARUBA];
    const { container } = await apriFatture();
    await scegliHoPagatoIo(container);
    const riquadro = container.querySelector('[data-prova="ho-pagato-io-fattura"]');
    expect(riquadro.textContent).toMatch(/1,22/);
    expect(container.querySelector('[data-prova="anticipo-paga-fattura"]').textContent).toMatch(/pagata \(anticipo\)/);
    expect(screen.queryByText(/Usciranno/)).toBeNull();
    expect(screen.getByRole("button", { name: /Registra «Ho pagato io»/ })).toBeTruthy();
  });

  it("col mio conto compare lo stesso avviso del riquadro in Cassa", async () => {
    finto.daPagare = [FATTURA_ARUBA];
    const { container } = await apriFatture();
    await scegliHoPagatoIo(container);
    expect(container.querySelector('[data-prova="avviso-conto-personale"]')).toBeNull();
    fireEvent.change(container.querySelector('[data-prova="scelta-fondi"]'), { target: { value: "conto_personale" } });
    await waitFor(() =>
      expect(container.querySelector('[data-prova="avviso-conto-personale"]').textContent).toMatch(/commercialista/)
    );
  });

  it("🔴 salva con la funzione degli anticipi, la fattura scelta e il motivo — mai «Segna pagata»", async () => {
    finto.daPagare = [FATTURA_ARUBA];
    const { container } = await apriFatture();
    await scegliHoPagatoIo(container);
    fireEvent.change(container.querySelector('[data-prova="scelta-fondi"]'), { target: { value: "conto_personale" } });
    fireEvent.click(screen.getByRole("button", { name: /Registra «Ho pagato io»/ }));
    await waitFor(() => expect(spie.creaNota).toBeTruthy());
    expect(spie.creaNota).toMatchObject({
      entityId: "id-srls",
      supplierInvoiceId: "f1",
      tagId: "t1",
      fondi: "conto_personale",
      eInvestimento: false,
    });
    expect(Number(spie.creaNota.importo)).toBe(1.22);
    expect(spie.pagate).toBe(0);
  });

  it("🔴 il rifiuto compare sotto il pulsante, non in cima alla pagina", async () => {
    finto.daPagare = [FATTURA_ARUBA];
    spie.erroreNota = "La fattura vale 1,22 € da pagare e la nota 5,00 €";
    const { container } = await apriFatture();
    await scegliHoPagatoIo(container);
    fireEvent.click(screen.getByRole("button", { name: /Registra «Ho pagato io»/ }));
    const errore = await waitFor(() => {
      const e = container.querySelector('[data-prova="errore-ho-pagato-io"]');
      expect(e).toBeTruthy();
      return e;
    });
    expect(errore.textContent).toMatch(/1,22/);
    expect(errore.getAttribute("role")).toBe("alert");
    // Nello stesso pannello del pulsante, e una volta sola.
    const pulsante = screen.getByRole("button", { name: /Registra «Ho pagato io»/ });
    expect(pulsante.closest("div.mt-3").contains(errore)).toBe(true);
    expect(screen.getAllByText(/La fattura vale 1,22/)).toHaveLength(1);
  });

  it("🔴 salvato ma l'elenco non si aggiorna: dice che è registrato, e il pannello si chiude", async () => {
    finto.daPagare = [FATTURA_ARUBA];
    finto.rompiDopoLaNota = true;
    const { container } = await apriFatture();
    await scegliHoPagatoIo(container);
    fireEvent.click(screen.getByRole("button", { name: /Registra «Ho pagato io»/ }));
    await waitFor(() => expect(screen.getByText(/è registrato, ma non riesco ad aggiornare l'elenco/)).toBeTruthy());
    expect(screen.getByRole("status").textContent).toMatch(/pagata \(anticipo\)/);
    expect(screen.queryByRole("button", { name: /Registra «Ho pagato io»/ })).toBeNull();
    expect(container.querySelector('[data-prova="errore-ho-pagato-io"]')).toBeNull();
  });

  it("la tasca non offre «Ho pagato io»: non anticipa niente per nessuno", async () => {
    finto.daPagare = [{ ...FATTURA_ARUBA, entity_id: "id-tasca" }];
    const { container } = await apriFatture();
    fireEvent.click(screen.getByRole("button", { name: "Segna pagata" }));
    await waitFor(() => expect(screen.getByText("Come paghi")).toBeTruthy());
    const opzioni = [...container.querySelectorAll("option")].map((o) => o.value);
    expect(opzioni).toContain("bonifico");
    expect(opzioni).not.toContain("ho_pagato_io");
  });
});

describe("Ho messo di tasca mia · il rifiuto di «Ho pagato io» sta sotto il pulsante", () => {
  it("🔴 l'errore del salvataggio compare sotto «Registra», non in cima", async () => {
    finto.daPagare = [FATTURA_ARUBA];
    spie.erroreNota = "record \"new\" has no field \"direction\"";
    const { container } = await apriAnticipi();
    const menu = [...container.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.value === "f1")
    );
    fireEvent.change(menu, { target: { value: "f1" } });
    fireEvent.click(screen.getByRole("button", { name: /Registra/ }));
    const errore = await waitFor(() => {
      const e = container.querySelector('[data-prova="errore-ho-pagato-io"]');
      expect(e).toBeTruthy();
      return e;
    });
    expect(errore.textContent).toMatch(/direction/);
    // Subito dopo la riga del pulsante, e una volta sola.
    const pulsante = screen.getByRole("button", { name: /Registra/ });
    expect(pulsante.parentElement.nextElementSibling).toBe(errore);
    expect(screen.getAllByText(/direction/)).toHaveLength(1);
  });
});
