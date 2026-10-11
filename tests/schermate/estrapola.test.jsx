import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// «ESTRAPOLA» A SCHERMO (R11, 11/10/2026).
// Si guarda il giro intero con un database finto: si scelgono le ricette,
// la proposta compare, e in lista va SOLO quello che si tiene — una volta
// sola anche toccando due volte. Il calcolo vero lo prova la verifica della
// migrazione 20261011000001.

const api = vi.hoisted(() => ({ estrapola: vi.fn(), aggiungi: vi.fn() }));

vi.mock("../../src/lib/api/recipes", () => ({
  listRecipes: vi.fn(async () => [{ id: "r1", name: "Amatriciana", portions_yield: 4 }]),
}));
vi.mock("../../src/lib/api/bozzeRicetta", () => ({
  listBozzeRicetta: vi.fn(async () => [
    { id: "b1", titolo: "Gricia", porzioni: 2, stato: "in_revisione", promossa_il: null },
    { id: "b2", titolo: "Già ricetta", porzioni: 2, stato: "in_revisione", promossa_il: "2026-10-01" },
  ]),
}));
vi.mock("../../src/lib/api/estrapola", () => ({
  estrapolaRicette: (...a) => api.estrapola(...a),
  aggiungiEstrapolazione: (...a) => api.aggiungi(...a),
}));

import Estrapola from "../../src/pages/ricettario/Estrapola";

const PROPOSTA = [
  { chiave: "g|g", ingredient_id: "g", nome: "guanciale", unita: "g", quantita: 600, da: ["Amatriciana", "Gricia"], problema: null, gia_in_lista: 100 },
  { chiave: "nome:sale|", ingredient_id: null, nome: "sale", unita: null, quantita: null, da: ["Gricia"], problema: "non collegato al magazzino; quantità non indicata", gia_in_lista: null },
];

const mostra = () =>
  render(
    <MemoryRouter>
      <Estrapola />
    </MemoryRouter>
  );

beforeEach(() => {
  api.estrapola.mockReset().mockResolvedValue(PROPOSTA);
  api.aggiungi.mockReset();
});

describe("Estrapola la spesa", () => {
  it("una bozza già diventata ricetta non compare due volte", async () => {
    mostra();
    expect(await screen.findByText("Gricia")).toBeTruthy();
    expect(screen.queryByText("Già ricetta")).toBeNull();
  });

  it("le porzioni partono da quelle della ricetta, e senza porzioni non si estrapola", async () => {
    mostra();
    fireEvent.click(await screen.findByRole("checkbox", { name: /Amatriciana/ }));
    expect(screen.getByLabelText("Porzioni di Amatriciana").value).toBe("4");
    fireEvent.change(screen.getByLabelText("Porzioni di Amatriciana"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Estrapola" }).disabled).toBe(true);
  });

  it("🔴 in lista va solo quello che si tiene, con le ricette da cui viene", async () => {
    let rispondi;
    api.aggiungi.mockImplementation(() => new Promise((r) => (rispondi = r)));
    mostra();
    fireEvent.click(await screen.findByRole("checkbox", { name: /Amatriciana/ }));
    fireEvent.change(screen.getByLabelText("Porzioni di Amatriciana"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Gricia/ }));
    fireEvent.click(screen.getByRole("button", { name: "Estrapola" }));

    await waitFor(() => expect(api.estrapola).toHaveBeenCalled());
    expect(api.estrapola.mock.calls[0][0]).toEqual([
      { tipo: "ricetta", id: "r1", porzioni: 8 },
      { tipo: "bozza", id: "b1", porzioni: 2 },
    ]);

    // Ciò che il gestionale non sa si legge, e quello che c'è già in lista anche.
    expect(await screen.findByText("non collegato al magazzino; quantità non indicata")).toBeTruthy();
    expect(screen.getByText("Già in lista: 100 g.")).toBeTruthy();

    // Il sale non si tiene; il guanciale si corregge a mano.
    fireEvent.click(screen.getByRole("checkbox", { name: "Metti in lista sale" }));
    fireEvent.change(screen.getByLabelText("Quantità di guanciale"), { target: { value: "500" } });

    const metti = screen.getByRole("button", { name: "Metti in lista 1 riga" });
    fireEvent.click(metti);
    fireEvent.click(metti);
    expect(api.aggiungi).toHaveBeenCalledTimes(1);
    expect(api.aggiungi.mock.calls[0][0]).toEqual([
      { ingredient_id: "g", nome: "guanciale", quantita: 500, unita: "g", nota: "Dalle ricette: Amatriciana, Gricia" },
    ]);
    rispondi(1);
    expect(await screen.findByText(/Una riga è entrata/)).toBeTruthy();
  });
});
