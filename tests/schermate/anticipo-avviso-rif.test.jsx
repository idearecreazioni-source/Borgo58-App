import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// L AVVISO SUL RIFERIMENTO DEL DOCUMENTO — 01/11/2026
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

const AVVISO = /non si scarica/;
const campoRif = () => screen.getByPlaceholderText(/numero dello scontrino/);
const importo = (container, v) =>
  fireEvent.change(container.querySelector('input[type="number"]'), { target: { value: v } });
const registra = () => fireEvent.click(screen.getByRole("button", { name: /Registra$/ }));

describe("Anticipo · avviso sul riferimento del documento", () => {
  it("a modulo vuoto non c'e' nessun avviso", async () => {
    await apriAnticipi();
    expect(screen.queryByText(AVVISO)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("senza riferimento ne fattura, Registra NON salva: mostra l'avviso con due scelte", async () => {
    const { container } = await apriAnticipi();
    importo(container, "12");
    registra();
    const avviso = await screen.findByRole("alert");
    expect(avviso.textContent).toMatch(AVVISO);
    expect(spie.creaNota).toBeNull();
    expect(screen.getByRole("button", { name: "Aggiungo il riferimento" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Registra lo stesso" })).toBeTruthy();
  });

  it("«Aggiungo il riferimento» porta il cursore nel campo e non salva", async () => {
    const { container } = await apriAnticipi();
    importo(container, "12");
    registra();
    fireEvent.click(await screen.findByRole("button", { name: "Aggiungo il riferimento" }));
    expect(document.activeElement).toBe(campoRif());
    expect(spie.creaNota).toBeNull();
  });

  it("«Registra lo stesso» salva senza riferimento e poi l'avviso sparisce", async () => {
    const { container } = await apriAnticipi();
    importo(container, "12");
    registra();
    fireEvent.click(await screen.findByRole("button", { name: "Registra lo stesso" }));
    await waitFor(() => expect(spie.creaNota).toBeTruthy());
    expect(spie.creaNota.documento).toBe("");
    await waitFor(() => expect(screen.queryByText(AVVISO)).toBeNull());
    expect(container.querySelector('input[type="number"]').value).toBe("");
  });

  it("scrivendo il riferimento l'avviso sparisce e Registra salva subito", async () => {
    const { container } = await apriAnticipi();
    importo(container, "12");
    registra();
    await screen.findByRole("alert");
    fireEvent.change(campoRif(), { target: { value: "ZZ-123" } });
    expect(screen.queryByText(AVVISO)).toBeNull();
    registra();
    await waitFor(() => expect(spie.creaNota).toBeTruthy());
    expect(spie.creaNota.documento).toBe("ZZ-123");
  });

  it("con una fattura collegata salva direttamente, senza avviso", async () => {
    finto.daPagare = [FATTURA_ARUBA];
    const { container } = await apriAnticipi();
    const menu = [...container.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.value === "f1")
    );
    fireEvent.change(menu, { target: { value: "f1" } });
    registra();
    await waitFor(() => expect(spie.creaNota).toBeTruthy());
    expect(screen.queryByText(AVVISO)).toBeNull();
  });

  it("un riferimento di soli spazi vale come vuoto", async () => {
    const { container } = await apriAnticipi();
    importo(container, "12");
    fireEvent.change(campoRif(), { target: { value: "   " } });
    registra();
    await screen.findByRole("alert");
    expect(spie.creaNota).toBeNull();
  });
});
