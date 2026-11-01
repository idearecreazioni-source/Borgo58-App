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

const finto = vi.hoisted(() => ({ daPagare: [], pagate: [] }));
const spie = vi.hoisted(() => ({ creaNota: null, annulla: null }));

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
  listSupplierInvoices: vi.fn(async () => finto.daPagare),
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
  markInvoicePaid: vi.fn(async () => ({})),
  registraNotaCredito: vi.fn(async () => ({})),
  updateSupplierInvoice: vi.fn(async () => ({})),
}));

vi.mock("../../src/lib/api/documents", () => ({ listDocuments: vi.fn(async () => []) }));
vi.mock("../../src/lib/api/suppliers", () => ({ listSuppliers: vi.fn(async () => []) }));

vi.mock("../../src/lib/api/anticipazioni", () => ({
  annullaPareggioAnticipazione: vi.fn(async () => ({})),
  createAnticipazione: vi.fn(async (p) => {
    spie.creaNota = p;
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
  spie.creaNota = null;
  spie.annulla = null;
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
