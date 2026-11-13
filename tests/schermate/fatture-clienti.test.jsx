import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// FATTURE AI CLIENTI — la pagina (13/11/2026, pezzo 2a)
// =====================================================================
// Nomi e numeri inventati: il repository è pubblico.

const { finto, spie } = vi.hoisted(() => ({
  finto: {
    fatture: [],
    clienti: [
      { id: "c1", denominazione: "Ditta Esempio srl", partita_iva: "01234567890", attivo: true },
    ],
    srls: { id: "e1", entity_type: "srls", legal_name: "Esempio S.r.l.s.", vat_number: null },
    ordine: null,
  },
  spie: {
    salvaBozzaFattura: null,
    salvaDatiSocieta: null,
    salvaClienteFattura: null,
  },
}));

vi.mock("../../src/lib/api/fattureEmesse", () => ({
  listFattureEmesse: vi.fn(async () => finto.fatture),
  listClientiFattura: vi.fn(async () => finto.clienti),
  salvaBozzaFattura: (...a) => spie.salvaBozzaFattura(...a),
  salvaClienteFattura: (...a) => spie.salvaClienteFattura(...a),
  eliminaBozzaFattura: vi.fn(async () => {}),
  emettiFattura: vi.fn(),
}));
vi.mock("../../src/lib/api/entities", () => ({
  getEntities: vi.fn(async () => ({ srls: finto.srls })),
  salvaDatiSocieta: (...a) => spie.salvaDatiSocieta(...a),
}));
vi.mock("../../src/lib/api/orders", () => ({
  getOrder: vi.fn(async () => finto.ordine),
  getServiceSettings: vi.fn(async () => ({ coperto_price: 2 })),
}));

const { default: FattureClientiHome } = await import("../../src/pages/fatture/FattureClientiHome");

function apri(url = "/fatture-clienti") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <FattureClientiHome />
    </MemoryRouter>
  );
}

beforeEach(() => {
  finto.fatture = [];
  finto.ordine = null;
  spie.salvaBozzaFattura = vi.fn(async () => "f-nuova");
  spie.salvaDatiSocieta = vi.fn(async () => ({}));
  spie.salvaClienteFattura = vi.fn(async (c) => ({ id: "c2", ...c }));
});

describe("Fatture ai clienti", () => {
  it("dice quali dati della società mancano, e li salva", async () => {
    apri();
    const scheda = await screen.findByText(/Per fare una fattura mancano: partita IVA/);
    expect(scheda).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Partita IVA"), { target: { value: "01234567890" } });
    fireEvent.change(screen.getByLabelText("Provincia"), { target: { value: "sa" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva i dati" }));
    await waitFor(() =>
      expect(spie.salvaDatiSocieta).toHaveBeenCalledWith(
        "e1",
        expect.objectContaining({ vat_number: "01234567890", sede_provincia: "SA" })
      )
    );
  });

  it("una bozza nuova: il totale si vede mentre scrivi, IVA inclusa scorporata, e si salva intera", async () => {
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "+ Nuova fattura" }));
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "c1" } });
    fireEvent.change(screen.getByLabelText("Cosa"), { target: { value: "Cena di lavoro" } });
    fireEvent.change(screen.getByLabelText("Quantità"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText(/^Prezzo/), { target: { value: "27,50" } });
    const totali = screen.getByText("Totale").closest("dl");
    // 4 × 27,50 = 110 IVA inclusa: 100 + 10.
    expect(within(totali).getByText(/110,00/)).toBeTruthy();
    expect(within(totali).getByText(/100,00.*IVA.*10,00/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salva la bozza" }));
    await waitFor(() =>
      expect(spie.salvaBozzaFattura).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ cliente_id: "c1", prezzi_ivati: true }),
        [{ descrizione: "Cena di lavoro", quantita: 4, prezzo_unitario: 27.5, aliquota_iva: 10, natura: null }]
      )
    );
  });

  it("niente «Emetti» in questo pezzo: il numero lo prende quando parte", async () => {
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "+ Nuova fattura" }));
    expect(screen.queryByRole("button", { name: /Emetti/ })).toBeNull();
  });

  it("l'errore del database si legge accanto al pulsante", async () => {
    spie.salvaBozzaFattura = vi.fn(async () => {
      throw new Error("Scegli il cliente della fattura.");
    });
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "+ Nuova fattura" }));
    fireEvent.change(screen.getByLabelText("Cosa"), { target: { value: "Pranzo" } });
    fireEvent.change(screen.getByLabelText(/^Prezzo/), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva la bozza" }));
    const bozza = screen.getByText("Nuova fattura").closest("section");
    expect(await within(bozza).findByRole("alert")).toHaveProperty("textContent", "Scegli il cliente della fattura.");
  });

  it("dal conto del tavolo: piatti (col supplemento) e coperto già scritti, totale uguale al conto", async () => {
    finto.ordine = {
      id: "o1",
      table_label: "7",
      coperti: 2,
      coperto_unit_price: 2,
      items: [
        { id: "i1", quantity: 2, unit_price: 12, sent_at: "x", recipe: { name: "Tagliatelle" }, sostituzioni: [] },
        {
          id: "i2",
          quantity: 1,
          unit_price: 18,
          sent_at: "x",
          recipe: { name: "Filetto" },
          sostituzioni: [{ costo_aggiuntivo: 1.5 }],
        },
        { id: "i3", quantity: 1, unit_price: 5, sent_at: "x", voided_at: "x", recipe: { name: "Tolto" } },
      ],
    };
    apri("/fatture-clienti?ordine=o1");
    expect(await screen.findByDisplayValue("Tagliatelle")).toBeTruthy();
    expect(screen.getByDisplayValue("19.5")).toBeTruthy();
    expect(screen.getByDisplayValue("Coperto")).toBeTruthy();
    expect(screen.queryByDisplayValue("Tolto")).toBeNull();
    const totali = screen.getByText("Totale").closest("dl");
    // 24 + 19,50 + 4 = 47,50: uguale al conto, nessun avviso.
    expect(within(totali).getByText(/47,50/)).toBeTruthy();
    expect(screen.queryByText(/Il conto del tavolo era/)).toBeNull();
  });
});
