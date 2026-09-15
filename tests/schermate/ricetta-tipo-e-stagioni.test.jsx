import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LA SCHEDA SA CHE COSA È, E LE STAGIONI SONO ALTERNATIVE — 12/09/2026
// =====================================================================
// Mandato notturno, blocco A, dal collaudo sull'iPhone:
//   · una PREPARAZIONE (e un finger) mostrava gli stati di un piatto —
//     «Pronta per la carta», «In carta» — e un campo «Descrizione per il
//     menu», su una cosa che in un menu non può entrare;
//   · «Tutto l'anno» si accendeva insieme a Primavera/Estate/Autunno/
//     Inverno, cioè la scheda diceva due cose insieme.
//
// ⚠️ QUESTO FILE NON IMPORTA I MODULI NUOVI apposta, come
//    `finger-food-nel-menu.test.jsx`: rimesso il codice di prima, i casi
//    diventano rossi per il comportamento e non per un import mancante.
//    Le regole pure stanno in `tests/unita/stati-per-tipo.test.js` e in
//    `tests/unita/stagionalita.test.js`.

// --- il collegamento al database, finto ------------------------------------
vi.mock("../../src/lib/supabase", () => ({
  supabase: { from: vi.fn() },
  supabasePubblico: {},
}));

const f = {
  getRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  menuDellaRicetta: vi.fn(),
};
const vuoto = () => Promise.resolve([]);
vi.mock("../../src/lib/api/recipes", () => ({
  duplicaRicetta: vi.fn(),
  getRecipe: (...a) => f.getRecipe(...a),
  getRecipeAllergens: () => Promise.resolve({ allergens: [], daVerificare: false, ingredienti: [], tracce: [] }),
  getRecipeCost: () => Promise.resolve({ food_cost_portion: 3.2, food_cost_base: 6.4 }),
  listPreparationUsage: vuoto,
  listPreparations: vuoto,
  listRecipeAllergensFor: () => Promise.resolve({}),
  listRecipeCostsFor: () => Promise.resolve({}),
  listRecipeStatusHistory: vuoto,
  prezzoBis: () => Promise.resolve(null),
  updateRecipe: (...a) => f.updateRecipe(...a),
  allergeniDelPiatto: vuoto,
  catenaAllergeni: vuoto,
  dimenticaScelta: vi.fn(),
  salvaScelta: vi.fn(),
  salvaSostituzione: vi.fn(),
  togliSostituzione: vi.fn(),
  listRecipes: vuoto,
  listAllRecipeCosts: vuoto,
}));
vi.mock("../../src/lib/api/recipeIngredients", () => ({
  addRecipeIngredient: vi.fn(),
  getRecipeRowCosts: () => Promise.resolve({}),
  listRecipeIngredients: vuoto,
  removeRecipeIngredient: vi.fn(),
  updateRecipeIngredient: vi.fn(),
}));
vi.mock("../../src/lib/api/recipeSteps", () => ({
  addRecipeStep: vi.fn(),
  listRecipeSteps: vuoto,
  removeRecipeStep: vi.fn(),
  swapStepOrder: vi.fn(),
}));
vi.mock("../../src/lib/api/ingredients", () => ({ listIngredients: vuoto, listUnita: vuoto }));
vi.mock("../../src/lib/api/recipeVideos", () => ({
  addRecipeVideo: vi.fn(),
  listRecipeVideos: vuoto,
  removeRecipeVideo: vi.fn(),
}));
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ isTitolare: true, isStaff: false }),
}));
vi.mock("../../src/lib/api/menus", () => ({
  addMenuItem: vi.fn(),
  removeMenuItem: vi.fn(),
  listMenus: vuoto,
  menuDellaRicetta: (...a) => f.menuDellaRicetta(...a),
  getMenu: vi.fn(),
  listMenuItemsFull: vuoto,
  listIngredientiDelMenu: vuoto,
  simulaPrezzoIngrediente: vuoto,
  setActiveMenu: vi.fn(),
  updateMenuItemPrice: vi.fn(),
}));

const { default: RicettaDetail } = await import("../../src/pages/ricettario/RicettaDetail");

const ricetta = (extra) => ({
  id: "r1",
  name: "Brodo di pesce",
  category: "primo",
  recipe_type: "preparazione",
  pronta_per_carta: false,
  in_carta: false,
  ritirata_il: null,
  seasonality: [],
  portions_yield: 1,
  yield_quantity: 2,
  yield_unit: "l",
  menu_description: "",
  ...extra,
});

const apri = () =>
  render(
    <MemoryRouter initialEntries={["/ricettario/ricette/r1"]}>
      <Routes>
        <Route path="/ricettario/ricette/:id" element={<RicettaDetail />} />
      </Routes>
    </MemoryRouter>,
  );

// Il pulsante di uno stato, per nome intero (non «Pronta per la carta»
// dentro «✓ Pronta per la carta» per sbaglio: si ancora alla fine).
const stato = (nome) => screen.queryByRole("button", { name: new RegExp(`^(✓ )?${nome}$`) });

// Una stagione è accesa quando ha il colore pieno. Si guarda la classe e
// non `aria-pressed` apposta: così la prova vale anche sul codice di prima,
// che quell'attributo non l'aveva, e diventa rossa per il comportamento.
const accesa = (nome) => screen.getByRole("button", { name: nome }).className.includes("bg-b58-olive ");

beforeEach(() => {
  Object.values(f).forEach((x) => x.mockReset());
  f.menuDellaRicetta.mockResolvedValue([]);
  f.updateRecipe.mockImplementation((_id, campi) => Promise.resolve({ ...ricetta(), ...campi }));
});

describe("🔴 gli stati dicono che cosa è la scheda", () => {
  it("preparazione: niente «Pronta per la carta» né «In carta», e i suoi tre stati", async () => {
    f.getRecipe.mockResolvedValue(ricetta());
    apri();
    await screen.findByText(/^Stato:/);
    expect(stato("Pronta per la carta")).toBeNull();
    expect(stato("In carta")).toBeNull();
    expect(stato("In sviluppo")).toBeTruthy();
    expect(stato("Pronta per l'uso")).toBeTruthy();
    expect(stato("Ritirata")).toBeTruthy();
    // L'etichetta dice lo stato con parole sue, e nessuna parola di carta.
    expect(screen.getByText(/^Stato:/).textContent).toMatch(/In sviluppo/);
    expect(screen.getByText(/^Stato:/).textContent).not.toMatch(/carta/i);
  });

  it("un finger resta da piatto (decisione di Alessio, 12/09): quattro stati, «In carta» compreso", async () => {
    f.getRecipe.mockResolvedValue(
      ricetta({ recipe_type: "finger", name: "Bocconcino di tonno", pronta_per_carta: true }),
    );
    apri();
    await screen.findByText(/^Stato:/);
    expect(stato("Pronta per la carta")).toBeTruthy();
    expect(stato("In carta")).toBeTruthy();
    expect(stato("Pronta per l'uso")).toBeNull();
    expect(screen.getByText(/^Stato:/).textContent).toMatch(/Pronta per la carta/);
  });

  it("una preparazione segnata pronta si legge «Pronta per l'uso»", async () => {
    f.getRecipe.mockResolvedValue(ricetta({ pronta_per_carta: true }));
    apri();
    await screen.findByText(/^Stato:/);
    expect(screen.getByText(/^Stato:/).textContent).toMatch(/Pronta per l'uso/);
  });

  it("una preparazione rimasta in un menu da prima: si capisce, e nessuno stato di carta", async () => {
    // Il database dal 20/08 lo impedisce; una riga di prima può esserci
    // ancora. Non si riscrive niente: si dice.
    f.getRecipe.mockResolvedValue(ricetta({ pronta_per_carta: true, in_carta: true }));
    apri();
    await screen.findByText(/^Stato:/);
    expect(screen.getByText(/^Stato:/).textContent).toMatch(/Pronta per l'uso/);
    expect(stato("In carta")).toBeNull();
    expect(screen.getByText(/risulta ancora dentro un menu/i)).toBeTruthy();
    expect(f.updateRecipe).not.toHaveBeenCalled();
  });

  it("un piatto ha ancora i suoi quattro stati", async () => {
    f.getRecipe.mockResolvedValue(ricetta({ recipe_type: "piatto_finito", name: "Tagliolini al limone" }));
    apri();
    await screen.findByText(/^Stato:/);
    expect(stato("In sviluppo")).toBeTruthy();
    expect(stato("Pronta per la carta")).toBeTruthy();
    expect(stato("In carta")).toBeTruthy();
    expect(stato("Ritirata")).toBeTruthy();
    expect(stato("Pronta per l'uso")).toBeNull();
  });

  it("una selezione di finger è un piatto: stati da piatto", async () => {
    f.getRecipe.mockResolvedValue(
      ricetta({ recipe_type: "piatto_finito", category: "finger_food", name: "Tagliere di quattro" }),
    );
    apri();
    await screen.findByText(/^Stato:/);
    expect(stato("Pronta per la carta")).toBeTruthy();
    expect(stato("Pronta per l'uso")).toBeNull();
  });
});

describe("🔴 il costo di una preparazione si legge per unità di resa", () => {
  it("preparazione: € al litro (totale ÷ resa), mai «/ porzione», e il totale resta", async () => {
    // Totale 6,40 € per 2 litri: 3,20 €/l. Il finto dà 3,20 anche come costo
    // a porzione, quindi il numero da solo non basta: conta l'unità.
    f.getRecipe.mockResolvedValue(ricetta({ yield_quantity: 2, yield_unit: "l" }));
    apri();
    await screen.findByText(/^Stato:/);
    await waitFor(() => expect(screen.getByText(/totale della preparazione/)).toBeTruthy());
    expect(screen.queryByText(/\/ porzione/)).toBeNull();
    expect(screen.getByText("/ l")).toBeTruthy();
    expect(document.body.textContent).toMatch(/3,20\s*€\s*\/ l/);
    expect(document.body.textContent).toMatch(/6,40\s*€\s*totale della preparazione/);
  });

  it("un piatto resta a porzione", async () => {
    f.getRecipe.mockResolvedValue(ricetta({ recipe_type: "piatto_finito", yield_quantity: null, yield_unit: null }));
    apri();
    await screen.findByText(/^Stato:/);
    await waitFor(() => expect(screen.getByText(/\/ porzione/)).toBeTruthy());
  });
});

describe("🔴 la descrizione per il menu sta solo dove c'è un menu", () => {
  it("su una preparazione diventa una nota interna, e il testo che c'era resta", async () => {
    f.getRecipe.mockResolvedValue(ricetta({ menu_description: "Si tiene in frigo due giorni" }));
    apri();
    await screen.findByText(/^Stato:/);
    expect(screen.queryByText("Descrizione per il menu")).toBeNull();
    expect(screen.getByText("Nota interna")).toBeTruthy();
    expect(screen.getByDisplayValue("Si tiene in frigo due giorni")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Come appare sul menu")).toBeNull();
  });

  it("salvando una preparazione la nota resta nello stesso campo, senza perdersi", async () => {
    f.getRecipe.mockResolvedValue(ricetta({ menu_description: "Si tiene in frigo due giorni" }));
    apri();
    await screen.findByText(/^Stato:/);
    fireEvent.click(screen.getByRole("button", { name: "Salva modifiche" }));
    await waitFor(() => expect(f.updateRecipe).toHaveBeenCalled());
    expect(f.updateRecipe.mock.calls[0][1].menu_description).toBe("Si tiene in frigo due giorni");
  });

  it("su un finger resta «Descrizione per il menu»: si vende", async () => {
    f.getRecipe.mockResolvedValue(ricetta({ recipe_type: "finger", name: "Bocconcino di tonno" }));
    apri();
    await screen.findByText(/^Stato:/);
    expect(screen.getByText("Descrizione per il menu")).toBeTruthy();
    expect(screen.queryByText("Nota interna")).toBeNull();
  });

  it("su un piatto resta «Descrizione per il menu»", async () => {
    f.getRecipe.mockResolvedValue(ricetta({ recipe_type: "piatto_finito", name: "Tagliolini al limone" }));
    apri();
    await screen.findByText(/^Stato:/);
    expect(screen.getByText("Descrizione per il menu")).toBeTruthy();
    expect(screen.queryByText("Nota interna")).toBeNull();
  });
});

describe("🔴 «Tutto l'anno» è l'alternativa alle quattro stagioni", () => {
  for (const tipo of ["preparazione", "piatto_finito", "finger"]) {
    it(`${tipo}: accendere «Tutto l'anno» spegne le stagioni, e una stagione spegne «Tutto l'anno»`, async () => {
      f.getRecipe.mockResolvedValue(ricetta({ recipe_type: tipo, seasonality: ["estate", "autunno"] }));
      apri();
      await screen.findByText(/^Stato:/);
      expect(accesa("Estate")).toBe(true);

      fireEvent.click(screen.getByRole("button", { name: "Tutto l'anno" }));
      expect(accesa("Tutto l'anno")).toBe(true);
      expect(accesa("Estate")).toBe(false);
      expect(accesa("Autunno")).toBe(false);

      fireEvent.click(screen.getByRole("button", { name: "Inverno" }));
      expect(accesa("Inverno")).toBe(true);
      expect(accesa("Tutto l'anno")).toBe(false);
      // Le stagioni spente da «Tutto l'anno» non tornano da sole.
      expect(accesa("Estate")).toBe(false);
    });
  }

  it("quattro stagioni accese si vedono come «Tutto l'anno», e così si salvano", async () => {
    f.getRecipe.mockResolvedValue(ricetta({ seasonality: ["primavera", "estate", "autunno"] }));
    apri();
    await screen.findByText(/^Stato:/);
    fireEvent.click(screen.getByRole("button", { name: "Inverno" }));
    expect(accesa("Tutto l'anno")).toBe(true);
    expect(accesa("Inverno")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Salva modifiche" }));
    await waitFor(() => expect(f.updateRecipe).toHaveBeenCalled());
    expect(f.updateRecipe.mock.calls[0][1].seasonality).toEqual(["tutto_anno"]);
  });

  it("dati di prima con le quattro stagioni scritte una per una: si vede «Tutto l'anno»", async () => {
    f.getRecipe.mockResolvedValue(ricetta({ seasonality: ["primavera", "estate", "autunno", "inverno"] }));
    apri();
    await screen.findByText(/^Stato:/);
    expect(accesa("Tutto l'anno")).toBe(true);
    expect(accesa("Estate")).toBe(false);
    expect(f.updateRecipe).not.toHaveBeenCalled();
  });

  it("dati di prima con le due forme insieme: a schermo vince «Tutto l'anno», e il database non si tocca finché non si salva", async () => {
    f.getRecipe.mockResolvedValue(ricetta({ seasonality: ["tutto_anno", "estate"] }));
    apri();
    await screen.findByText(/^Stato:/);
    expect(accesa("Tutto l'anno")).toBe(true);
    expect(accesa("Estate")).toBe(false);
    expect(f.updateRecipe).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Salva modifiche" }));
    await waitFor(() => expect(f.updateRecipe).toHaveBeenCalled());
    // Si salva quello che si vede.
    expect(f.updateRecipe.mock.calls[0][1].seasonality).toEqual(["tutto_anno"]);
  });
});
