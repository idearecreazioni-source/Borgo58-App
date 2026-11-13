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
      { id: "c1", denominazione: "Ditta Esempio srl", partita_iva: "01234567897", attivo: true },
    ],
    srls: { id: "e1", entity_type: "srls", legal_name: "Esempio S.r.l.s.", vat_number: null },
    ordine: null,
  },
  spie: {
    salvaBozzaFattura: null,
    salvaDatiSocieta: null,
    salvaClienteFattura: null,
    spedisciFattura: null,
    sbloccaInvioFattura: null,
  },
}));

vi.mock("../../src/lib/api/fattureEmesse", () => ({
  listFattureEmesse: vi.fn(async () => finto.fatture),
  listClientiFattura: vi.fn(async () => finto.clienti),
  salvaBozzaFattura: (...a) => spie.salvaBozzaFattura(...a),
  salvaClienteFattura: (...a) => spie.salvaClienteFattura(...a),
  eliminaBozzaFattura: vi.fn(async () => {}),
  spedisciFattura: (...a) => spie.spedisciFattura(...a),
  sbloccaInvioFattura: (...a) => spie.sbloccaInvioFattura(...a),
  provaLaPec: vi.fn(async () => ({ simulato: true, messaggio: "Qui siamo su Prova o a casa: la PEC non si usa." })),
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
  spie.spedisciFattura = vi.fn(async () => ({ numero: "1/2027", nome_file: "IT01234567897_00001.xml", destinatario: "sdi01@pec.fatturapa.it", simulato: true }));
});

describe("Fatture ai clienti", () => {
  it("dice quali dati della società mancano, e li salva", async () => {
    apri();
    const scheda = await screen.findByText(/Per fare una fattura mancano: partita IVA/);
    expect(scheda).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Partita IVA"), { target: { value: "01234567897" } });
    fireEvent.change(screen.getByLabelText("Provincia"), { target: { value: "sa" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva i dati" }));
    await waitFor(() =>
      expect(spie.salvaDatiSocieta).toHaveBeenCalledWith(
        "e1",
        expect.objectContaining({ vat_number: "01234567897", sede_provincia: "SA" })
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

  it("«Emetti e manda»: chiede conferma, salva quello che si vede, poi manda; su Prova dice che non parte davvero (pezzo 3)", async () => {
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "+ Nuova fattura" }));
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "c1" } });
    fireEvent.change(screen.getByLabelText("Cosa"), { target: { value: "Cena" } });
    fireEvent.change(screen.getByLabelText(/^Prezzo/), { target: { value: "55" } });
    fireEvent.click(screen.getByRole("button", { name: "Emetti e manda" }));
    expect(spie.salvaBozzaFattura).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sì, emetti e manda" }));
    await waitFor(() => expect(spie.spedisciFattura).toHaveBeenCalledWith("f-nuova"));
    expect(spie.salvaBozzaFattura).toHaveBeenCalledTimes(1);
    expect(spie.salvaBozzaFattura.mock.invocationCallOrder[0]).toBeLessThan(spie.spedisciFattura.mock.invocationCallOrder[0]);
    expect((await screen.findByText(/Fattura 1\/2027 pronta/)).textContent).toMatch(/PROVA: qui non parte davvero/);
  });

  it("se la spedizione non riesce, la bozza si chiude, la lista si rilegge e l'errore resta in cima (revisione 13/11)", async () => {
    spie.spedisciFattura = vi.fn(async () => {
      throw new Error("La fattura 1/2027 ha il suo numero ma NON è partita: la PEC non risponde.");
    });
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "+ Nuova fattura" }));
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "c1" } });
    fireEvent.change(screen.getByLabelText("Cosa"), { target: { value: "Cena" } });
    fireEvent.change(screen.getByLabelText(/^Prezzo/), { target: { value: "55" } });
    fireEvent.click(screen.getByRole("button", { name: "Emetti e manda" }));
    fireEvent.click(screen.getByRole("button", { name: "Sì, emetti e manda" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/NON è partita/);
    expect(screen.queryByText("Nuova fattura")).toBeNull();
  });

  it("un invio rimasto a metà: si dice se è nella posta inviata, e si sblocca", async () => {
    spie.sbloccaInvioFattura = vi.fn(async () => null);
    finto.fatture = [{
      id: "f8", numero: 2, anno: 2027, data: "2027-01-18", stato: "da_inviare", totale: 50, prezzi_ivati: true,
      cliente: { id: "c1", denominazione: "Ditta Esempio srl" }, righe: [],
      invii: [{ id: "i1", stato: "in_partenza", nome_file: "IT01234567897_0000A.xml", creato_il: "2027-01-18T10:00:00Z" }],
    }];
    apri();
    expect((await screen.findByText(/si è fermato a metà/)).textContent).toMatch(/IT01234567897_0000A\.xml/);
    expect(screen.queryByRole("button", { name: "Manda" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Non c'è" }));
    fireEvent.click(screen.getByRole("button", { name: "Sì, non c'è" }));
    await waitFor(() => expect(spie.sbloccaInvioFattura).toHaveBeenCalledWith("i1", false));
    expect(await screen.findByText(/ora puoi premere «Manda»/)).toBeTruthy();
  });

  it("una fattura «da inviare» ha «Manda», che la fa ripartire", async () => {
    finto.fatture = [{
      id: "f9", numero: 3, anno: 2027, data: "2027-01-20", stato: "da_inviare", totale: 80, prezzi_ivati: true,
      cliente: { id: "c1", denominazione: "Ditta Esempio srl" }, righe: [],
    }];
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "Manda" }));
    await waitFor(() => expect(spie.spedisciFattura).toHaveBeenCalledWith("f9"));
    expect(await screen.findByText(/Fattura 1\/2027 pronta/)).toBeTruthy();
  });

  it("«Prova la PEC» dice com'è andata", async () => {
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "Prova la PEC" }));
    expect(await screen.findByText("Qui siamo su Prova o a casa: la PEC non si usa.")).toBeTruthy();
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
    expect(screen.getByDisplayValue("19,50")).toBeTruthy();
    expect(screen.getByDisplayValue("Coperto")).toBeTruthy();
    expect(screen.queryByDisplayValue("Tolto")).toBeNull();
    const totali = screen.getByText("Totale").closest("dl");
    // 24 + 19,50 + 4 = 47,50: uguale al conto, nessun avviso.
    expect(within(totali).getByText(/47,50/)).toBeTruthy();
    expect(screen.queryByText(/Il conto del tavolo era/)).toBeNull();
  });
it("il file di prova: prima dice cosa manca, poi si scarica col numero BOZZA (pezzo 2b)", async () => {
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "+ Nuova fattura" }));
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "c1" } });
    fireEvent.change(screen.getByLabelText("Cosa"), { target: { value: "Cena" } });
    fireEvent.change(screen.getByLabelText(/^Prezzo/), { target: { value: "55" } });
    fireEvent.click(screen.getByRole("button", { name: "Scarica il file di prova" }));
    const problemi = await screen.findByText("Il file non si può fare ancora:");
    expect(problemi.closest("[role=alert]").textContent).toMatch(/partita IVA sono 11 cifre/);
  });

  it("con tutti i dati il file di prova si scarica", async () => {
    const prima = { srls: finto.srls, clienti: finto.clienti };
    finto.srls = {
      id: "e1", entity_type: "srls", legal_name: "Esempio S.r.l.s.", vat_number: "01234567897",
      vat_regime: "ordinario", sede_indirizzo: "Via Esempio 1", sede_cap: "84043", sede_comune: "Agropoli",
      sede_provincia: "SA", sede_nazione: "IT", iban: "IT60X0542811101000000123456",
    };
    finto.clienti = [{
      id: "c1", denominazione: "Ditta Esempio srl", partita_iva: "01234567897", indirizzo: "Via Due 2",
      cap: "80100", comune: "Napoli", provincia: "NA", nazione: "IT", attivo: true,
    }];
    const blobs = [];
    const originale = { crea: URL.createObjectURL, togli: URL.revokeObjectURL };
    URL.createObjectURL = vi.fn((b) => (blobs.push(b), "blob:prova"));
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      apri();
      fireEvent.click(await screen.findByRole("button", { name: "+ Nuova fattura" }));
      fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "c1" } });
      fireEvent.change(screen.getByLabelText("Cosa"), { target: { value: "Cena" } });
      fireEvent.change(screen.getByLabelText(/^Prezzo/), { target: { value: "55" } });
      fireEvent.click(screen.getByRole("button", { name: "Scarica il file di prova" }));
      expect(await screen.findByText(/File di prova scaricato/)).toBeTruthy();
      expect(click).toHaveBeenCalledTimes(1);
      // il Blob di jsdom non ha .text(): si legge come nel browser vecchio
      const xml = await new Promise((fatto) => {
        const lettore = new FileReader();
        lettore.onload = () => fatto(lettore.result);
        lettore.readAsText(blobs[0]);
      });
      expect(xml).toContain("<Numero>BOZZA</Numero>");
      expect(xml).toContain("<ImportoTotaleDocumento>55.00</ImportoTotaleDocumento>");
    } finally {
      click.mockRestore();
      URL.createObjectURL = originale.crea;
      URL.revokeObjectURL = originale.togli;
      finto.srls = prima.srls;
      finto.clienti = prima.clienti;
    }
  });
});
