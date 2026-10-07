import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// LA BOZZA DI RICETTA A SCHERMO (Fase 1A, 06/10/2026).
//
// Cosa si guarda: che i buchi si vedano PRIMA della conferma, che «crea la
// ricetta» resti spenta finché ce ne sono, e che il doppio tocco mandi UN
// gesto solo — e lo stesso gesto se si riprova dopo un errore.
// ⚠️ Il database qui è finto: cosa fa davvero la promozione lo prova la
//    verifica della migrazione 20261006000001 (non ancora applicata).

const api = vi.hoisted(() => ({
  getBozzaRicetta: vi.fn(),
  promuoviBozza: vi.fn(),
}));

vi.mock("../../src/lib/api/bozzeRicetta", () => ({
  getBozzaRicetta: api.getBozzaRicetta,
  promuoviBozza: api.promuoviBozza,
  aggiornaBozza: vi.fn(),
  aggiornaIngredienteBozza: vi.fn(),
  aggiornaPassaggioBozza: vi.fn(),
  aggiungiIngredienteBozza: vi.fn(),
  aggiungiPassaggioBozza: vi.fn(),
  cambiaStatoBozza: vi.fn(),
  eliminaBozza: vi.fn(),
  togliIngredienteBozza: vi.fn(),
  togliPassaggioBozza: vi.fn(),
}));
vi.mock("../../src/lib/api/ingredients", () => ({
  listIngredients: vi.fn().mockResolvedValue([{ id: "i1", name: "Guanciale", unit: "g" }]),
}));
vi.mock("../../src/lib/unita", () => ({
  useUnita: () => [{ value: "g", label: "grammi" }],
}));

import BozzaDetail from "../../src/pages/ricettario/BozzaDetail";

const BOZZA = {
  id: "b1",
  titolo: "Amatriciana",
  origine_tipo: "manuale",
  origine_riferimento: null,
  sunto: null,
  categoria: "primo",
  porzioni: 4,
  buchi_dichiarati: [],
  stato: "in_revisione",
  promossa_il: null,
  ricetta_id: null,
};
const RIGA = { id: "r1", posizione: 1, nome: "guanciale", ingredient_id: "i1", quantita: 200, unita: "g" };
const PASSO = { id: "p1", posizione: 1, fase: "cottura", descrizione: "rosolare" };

const completa = () => ({ bozza: { ...BOZZA }, ingredienti: [{ ...RIGA }], passaggi: [{ ...PASSO }] });

const mostra = () =>
  render(
    <MemoryRouter initialEntries={["/ricettario/bozze/b1"]}>
      <Routes>
        <Route path="/ricettario/bozze/:id" element={<BozzaDetail />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  api.getBozzaRicetta.mockReset();
  api.promuoviBozza.mockReset();
});

describe("i buchi si vedono prima della conferma", () => {
  it("🔴 elenca cosa manca, e «Crea la ricetta» resta spenta", async () => {
    api.getBozzaRicetta.mockResolvedValue({
      bozza: { ...BOZZA, porzioni: null },
      ingredienti: [{ ...RIGA, id: "r2", nome: "pecorino", ingredient_id: null, quantita: null, unita: "cucchiaio" }],
      passaggi: [{ ...PASSO, fase: null }],
    });
    mostra();

    expect(await screen.findByText(/Cosa manca per diventare una ricetta \(5\)/)).toBeTruthy();
    expect(screen.getByText("mancano le porzioni")).toBeTruthy();
    expect(screen.getByText("«pecorino»: non collegato a un ingrediente dell'anagrafica")).toBeTruthy();
    expect(screen.getByText("«pecorino»: quantita' mancante")).toBeTruthy();
    expect(screen.getByText("«pecorino»: unita' non compresa («cucchiaio»)")).toBeTruthy();
    expect(screen.getByText("passaggio 1: manca la fase")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Crea la ricetta" }).disabled).toBe(true);
    // ⚠️ L'unità che non conosce non sparisce: resta scelta, e dichiarata.
    expect(screen.getByText("«cucchiaio» — non compresa")).toBeTruthy();
  });

  it("una bozza senza buchi lo dice, e si può confermare", async () => {
    api.getBozzaRicetta.mockResolvedValue(completa());
    mostra();
    expect(await screen.findByText("Non manca niente: può diventare una ricetta.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Crea la ricetta" }).disabled).toBe(false);
  });
});

describe("la conferma è esplicita, e il doppio tocco non duplica", () => {
  it("🔴 due tocchi di fila mandano UNA richiesta", async () => {
    api.getBozzaRicetta.mockResolvedValue(completa());
    let rispondi;
    api.promuoviBozza.mockImplementation(() => new Promise((r) => (rispondi = r)));
    mostra();

    fireEvent.click(await screen.findByRole("button", { name: "Crea la ricetta" }));
    expect(screen.getByText(/Stai per creare nel Ricettario la ricetta «Amatriciana»/)).toBeTruthy();
    const si = screen.getByRole("button", { name: "Sì, crea la ricetta" });
    fireEvent.click(si);
    fireEvent.click(si);
    expect(api.promuoviBozza).toHaveBeenCalledTimes(1);
    expect(api.promuoviBozza.mock.calls[0][0]).toBe("b1");
    expect(api.promuoviBozza.mock.calls[0][1]).toBe("ricetta");
    rispondi({ esito: "ricetta", ricetta_id: "rec1", gia_fatto: false });
    await waitFor(() => expect(api.getBozzaRicetta).toHaveBeenCalledTimes(2));
  });

  it("🔴 riprovando dopo un errore si manda LO STESSO gesto", async () => {
    api.getBozzaRicetta.mockResolvedValue(completa());
    api.promuoviBozza
      .mockRejectedValueOnce(new Error("rete caduta"))
      .mockResolvedValueOnce({ esito: "ricetta", ricetta_id: "rec1", gia_fatto: true });
    mostra();

    fireEvent.click(await screen.findByRole("button", { name: "Crea la ricetta" }));
    fireEvent.click(screen.getByRole("button", { name: "Sì, crea la ricetta" }));
    expect(await screen.findByText("rete caduta")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sì, crea la ricetta" }));
    await waitFor(() => expect(api.promuoviBozza).toHaveBeenCalledTimes(2));
    const [primo, secondo] = api.promuoviBozza.mock.calls;
    expect(primo[2]).toBeTruthy();
    expect(secondo[2]).toBe(primo[2]);
  });

  it("l'ispirazione si sceglie a parte, e non tocca il Ricettario", async () => {
    api.getBozzaRicetta.mockResolvedValue(completa());
    api.promuoviBozza.mockResolvedValue({ esito: "ispirazione", ricetta_id: null, gia_fatto: false });
    mostra();

    fireEvent.click(await screen.findByRole("button", { name: "Tienila come ispirazione" }));
    expect(screen.getByText(/nel Ricettario non cambia niente/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sì, salvala come ispirazione" }));
    await waitFor(() => expect(api.promuoviBozza).toHaveBeenCalledTimes(1));
    expect(api.promuoviBozza.mock.calls[0][1]).toBe("ispirazione");
  });

  it("una bozza già diventata ricetta non offre più nessuna conferma", async () => {
    const d = completa();
    d.bozza.promossa_il = "2026-10-06T10:00:00Z";
    d.bozza.ricetta_id = "rec1";
    api.getBozzaRicetta.mockResolvedValue(d);
    mostra();

    expect(await screen.findByText(/È diventata ricetta il/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Crea la ricetta" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tienila come ispirazione" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Elimina la bozza" })).toBeNull();
  });

  it("una bozza scartata non si conferma: si riapre prima", async () => {
    const d = completa();
    d.bozza.stato = "scartata";
    api.getBozzaRicetta.mockResolvedValue(d);
    mostra();

    expect(await screen.findByRole("button", { name: "Riapri la bozza" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Crea la ricetta" })).toBeNull();
  });
});
