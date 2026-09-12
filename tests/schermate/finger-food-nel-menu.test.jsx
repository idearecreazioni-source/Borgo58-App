import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// UN FINGER FOOD NON SI SALVA IN UN MENU PER POI SPARIRE — 12/09/2026
// =====================================================================
// Mandato esteso, priorità 1 B. Il percorso misurato leggendo il codice:
//   · la scheda di un piatto di finger food offriva «+ <menu>» nel
//     pannello «Nei menu», e `addMenuItem` scriveva la voce;
//   · la scheda del menu (`MenuDetail`) e il foglio stampato
//     (`EditorMenuHome`) hanno solo antipasti, primi, secondi e dolci: la
//     voce c'era e non compariva da nessuna parte, senza nessun errore.
// Decisione di Alessio: finché non sceglie lui una sezione, un finger food
// non entra in un menu. Quelli già dentro non si toccano: si dichiarano.
//
// ⚠️ QUESTO FILE NON IMPORTA IL MODULO NUOVO apposta: così, rimesso il
//    codice di master, i casi diventano rossi per il comportamento e non per
//    un import mancante. La prova che le sezioni restino d'accordo col
//    divieto sta in `finger-food-sezioni.test.jsx`.

const FRASE = /I finger food non sono ancora previsti nel menu/;

// --- il collegamento al database, finto ------------------------------------
const db = { from: vi.fn() };
vi.mock("../../src/lib/supabase", () => ({
  supabase: { from: (...a) => db.from(...a) },
  supabasePubblico: {},
}));

// --- le letture delle schermate, finte -------------------------------------
const f = {
  getRecipe: vi.fn(),
  menuDellaRicetta: vi.fn(),
  listMenus: vi.fn(),
  getMenu: vi.fn(),
  listMenuItemsFull: vi.fn(),
  listRecipes: vi.fn(),
};
const vuoto = () => Promise.resolve([]);
vi.mock("../../src/lib/api/recipes", () => ({
  duplicaRicetta: vi.fn(),
  getRecipe: (...a) => f.getRecipe(...a),
  getRecipeAllergens: () => Promise.resolve({ allergens: [], daVerificare: false, ingredienti: [], tracce: [] }),
  getRecipeCost: () => Promise.resolve({ food_cost_portion: 3.2 }),
  listPreparationUsage: vuoto,
  listPreparations: vuoto,
  listRecipeAllergensFor: () => Promise.resolve({}),
  listRecipeCostsFor: () => Promise.resolve({}),
  listRecipeStatusHistory: vuoto,
  prezzoBis: () => Promise.resolve(null),
  updateRecipe: vi.fn(),
  allergeniDelPiatto: vuoto,
  catenaAllergeni: vuoto,
  dimenticaScelta: vi.fn(),
  salvaScelta: vi.fn(),
  salvaSostituzione: vi.fn(),
  togliSostituzione: vi.fn(),
  listRecipes: (...a) => f.listRecipes(...a),
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

// `menus.js` è VERO nel primo gruppo (è lì il divieto) e finto negli altri:
// si importa due volte, una col suo nome e una attraverso lo scambio.
const veroMenus = await vi.importActual("../../src/lib/api/menus");
vi.mock("../../src/lib/api/menus", () => ({
  addMenuItem: vi.fn(),
  removeMenuItem: vi.fn(),
  listMenus: (...a) => f.listMenus(...a),
  menuDellaRicetta: (...a) => f.menuDellaRicetta(...a),
  getMenu: (...a) => f.getMenu(...a),
  listMenuItemsFull: (...a) => f.listMenuItemsFull(...a),
  listIngredientiDelMenu: vuoto,
  simulaPrezzoIngrediente: vuoto,
  setActiveMenu: vi.fn(),
  updateMenuItemPrice: vi.fn(),
}));

const { default: RicettaDetail } = await import("../../src/pages/ricettario/RicettaDetail");
const { default: MenuDetail } = await import("../../src/pages/ricettario/MenuDetail");

const ricetta = (category, name) => ({
  id: "r9",
  name,
  category,
  recipe_type: "piatto_finito",
  pronta_per_carta: true,
  in_carta: false,
  ritirata_il: null,
  seasonality: [],
  portions_yield: 1,
  menu_description: "",
});
const MENU = [
  { id: "m1", name: "Carta dei due mesi", is_active: true, voce: null },
  { id: "m2", name: "Menu degli eventi", is_active: false, voce: { id: "v2", menu_id: "m2", selling_price: 9 } },
];

beforeEach(() => {
  db.from.mockReset();
  Object.values(f).forEach((x) => x.mockReset());
  f.listMenus.mockResolvedValue(MENU.map(({ voce: _v, ...m }) => m));
  f.menuDellaRicetta.mockResolvedValue(MENU);
});

describe("🔴 il punto da cui si scrive una voce di menu", () => {
  it("rifiuta un finger food, con la frase, SENZA scrivere niente", async () => {
    await expect(
      veroMenus.addMenuItem("m1", { recipe_id: "r9", category: "finger_food", selling_price: 9 }),
    ).rejects.toThrow(FRASE);
    expect(db.from).not.toHaveBeenCalled();
  });

  it("un primo lo scrive come prima", async () => {
    const catena = { insert: () => catena, select: () => catena, single: () => Promise.resolve({ data: { id: "v9" }, error: null }) };
    db.from.mockReturnValue(catena);
    await expect(
      veroMenus.addMenuItem("m1", { recipe_id: "r1", category: "primo", selling_price: 12 }),
    ).resolves.toEqual({ id: "v9" });
    expect(db.from).toHaveBeenCalledWith("menu_items");
  });
});

const apriRicetta = () =>
  render(
    <MemoryRouter initialEntries={["/ricettario/ricette/r9"]}>
      <Routes>
        <Route path="/ricettario/ricette/:id" element={<RicettaDetail />} />
      </Routes>
    </MemoryRouter>,
  );

describe("🔴 la scheda di un piatto, pannello «Nei menu»", () => {
  it("un finger food: nessun «+ menu», il menu dove sta già resta toglibile, e la frase dice perché", async () => {
    f.getRecipe.mockResolvedValue(ricetta("finger_food", "Selezione di mare"));
    apriRicetta();
    await screen.findByText("Nei menu");
    await waitFor(() => expect(screen.getByRole("button", { name: /✓ Menu degli eventi/ })).toBeTruthy());
    expect(screen.queryByRole("button", { name: /\+ Carta dei due mesi/ })).toBeNull();
    expect(screen.getAllByText(FRASE).length).toBeGreaterThan(0);
  });

  it("un primo: il «+ menu» c'è come prima, e la frase no", async () => {
    f.getRecipe.mockResolvedValue(ricetta("primo", "Tagliolini al limone"));
    apriRicetta();
    await screen.findByText("Nei menu");
    await waitFor(() => expect(screen.getByRole("button", { name: /\+ Carta dei due mesi/ })).toBeTruthy());
    expect(screen.queryByText(FRASE)).toBeNull();
  });
});

const apriMenu = (indirizzo = "/ricettario/menu/m1") =>
  render(
    <MemoryRouter initialEntries={[indirizzo]}>
      <Routes>
        <Route path="/ricettario/menu/:id" element={<MenuDetail />} />
      </Routes>
    </MemoryRouter>,
  );

describe("🔴 la scheda del menu", () => {
  beforeEach(() => {
    f.getMenu.mockResolvedValue({ id: "m1", name: "Carta dei due mesi", is_active: true });
    f.listRecipes.mockResolvedValue([ricetta("finger_food", "Selezione di mare")]);
  });

  it("un finger food già nel menu non sparisce in silenzio: si dichiara, col suo nome", async () => {
    f.listMenuItemsFull.mockResolvedValue([
      { id: "v1", recipe_id: "r1", category: "primo", selling_price: 12, recipe: { id: "r1", name: "Tagliolini al limone", seasonality: [] } },
      { id: "v9", recipe_id: "r9", category: "finger_food", selling_price: 9, recipe: { id: "r9", name: "Selezione di mare", seasonality: [] } },
    ]);
    apriMenu();
    const avviso = await screen.findByText(/Non compaiono in questa scheda né nel foglio stampato/);
    expect(avviso.closest("p").textContent).toMatch(/Selezione di mare/);
  });

  it("arrivando per mettere in carta un finger food, lo dice invece di non fare niente", async () => {
    f.listMenuItemsFull.mockResolvedValue([]);
    apriMenu("/ricettario/menu/m1?aggiungi=r9");
    await waitFor(() => expect(screen.getByText(FRASE)).toBeTruthy());
  });
});
