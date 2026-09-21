import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LA RESA SULLA RIGA DI RICETTA, DALLA SCHERMATA — R12, 22/09/2026
// =====================================================================
// 🔴 PERCHE' NON BASTANO LE PROVE PURE. `tests/unita/resa.test.js` prova che
//    la REGOLA risponde giusto; queste provano che la schermata la CHIAMA, e
//    soprattutto che quello che si scrive **arriva** dove deve arrivare. E'
//    la differenza che il progetto ha gia' pagato il 16/08, col menu del
//    mezzo di pagamento delle mance: si vedeva, si sceglieva, e il campo non
//    arrivava mai al database.
//
// ⚠️ QUI NON SI PARLA COL DATABASE: il collegamento e' finto e ogni prova
//    dichiara cosa gli fa rispondere. E questo strato NON E' UN OCCHIO: se i
//    due campi stiano comodi sul telefono resta un giudizio di Alessio.

vi.mock("../../src/lib/supabase", () => ({
  supabase: { from: vi.fn() },
  supabasePubblico: {},
}));

const spie = vi.hoisted(() => ({ aggiunta: null }));
const finto = vi.hoisted(() => ({ righe: [] }));
const vuoto = () => Promise.resolve([]);

vi.mock("../../src/lib/api/recipes", () => ({
  duplicaRicetta: vi.fn(),
  getRecipe: vi.fn(async () => ({
    id: "r1",
    name: "Sugo di cozze",
    category: "primo",
    recipe_type: "piatto_finito",
    pronta_per_carta: false,
    in_carta: false,
    ritirata_il: null,
    seasonality: [],
    portions_yield: 1,
    yield_quantity: null,
    yield_unit: null,
    menu_description: "",
  })),
  getRecipeAllergens: () =>
    Promise.resolve({ allergens: [], daVerificare: false, ingredienti: [], tracce: [] }),
  getRecipeCost: () => Promise.resolve({ food_cost_portion: 15, food_cost_base: 15 }),
  listPreparationUsage: vuoto,
  listPreparations: vuoto,
  listRecipeAllergensFor: () => Promise.resolve({}),
  listRecipeCostsFor: () => Promise.resolve({}),
  listRecipeStatusHistory: vuoto,
  prezzoBis: () => Promise.resolve(null),
  updateRecipe: vi.fn(async () => ({})),
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
  addRecipeIngredient: vi.fn(async (_id, payload) => {
    spie.aggiunta = payload;
    return {};
  }),
  getRecipeRowCosts: () => Promise.resolve({}),
  listRecipeIngredients: vi.fn(async () => finto.righe),
  removeRecipeIngredient: vi.fn(),
  updateRecipeIngredient: vi.fn(),
}));
vi.mock("../../src/lib/api/recipeSteps", () => ({
  addRecipeStep: vi.fn(),
  listRecipeSteps: vuoto,
  removeRecipeStep: vi.fn(),
  swapStepOrder: vi.fn(),
}));
vi.mock("../../src/lib/api/ingredients", () => ({
  listIngredients: vi.fn(async () => [
    { id: "i1", name: "Cozze", unit: "kg", current_price: 10, waste_percentage_default: 25 },
  ]),
  listUnita: vi.fn(async () => [
    { valore: "kg", etichetta: "kg" },
    { valore: "g", etichetta: "g" },
  ]),
}));
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
  menuDellaRicetta: vuoto,
  getMenu: vi.fn(),
  listMenuItemsFull: vuoto,
  listIngredientiDelMenu: vuoto,
  simulaPrezzoIngrediente: vuoto,
  setActiveMenu: vi.fn(),
  updateMenuItemPrice: vi.fn(),
}));

const { default: RicettaDetail } = await import("../../src/pages/ricettario/RicettaDetail");

const riga = (extra) => ({
  id: "ri1",
  ingredient_id: "i1",
  component_recipe_id: null,
  quantity: 0.4,
  quantita_lorda: 1.5,
  unit: "kg",
  waste_percentage: 275,
  prep_note: null,
  ingredient: { id: "i1", name: "Cozze", unit: "kg", current_price: 10, waste_percentage_default: 25 },
  component: null,
  ...extra,
});

async function apri() {
  const vista = render(
    <MemoryRouter initialEntries={["/ricettario/ricette/r1"]}>
      <Routes>
        <Route path="/ricettario/ricette/:id" element={<RicettaDetail />} />
      </Routes>
    </MemoryRouter>,
  );
  // Si aspetta il modulo della riga, non il titolo: il nome della ricetta
  // vive dentro un campo che si salva da solo, non in un testo.
  await waitFor(() => expect(bottoneAggiungi()).toBeTruthy());
  return vista;
}

const campo = (c, nome) => c.querySelector(`[data-prova="${nome}"]`);

// ⚠️ La schermata ha piu' di un pulsante che dice «Aggiungi» (le fasi, i
//    video): quello del modulo delle righe si riconosce dal suo segno, non
//    dal testo — due pulsanti con lo stesso nome si distinguono male, e una
//    prova che ne prende uno a caso e' una prova che un giorno cade da sola.
const bottoneAggiungi = () => document.querySelector('[data-prova="riga-aggiungi"]');

beforeEach(() => {
  finto.righe = [];
  spie.aggiunta = null;
  vi.clearAllMocks();
});

// =====================================================================
describe("🔴 la riga si scrive in lordo e netto, non in percentuale", () => {
  it("il campo «quanto ne prendi» c'e', e quello dello scarto NON c'e' piu'", async () => {
    const { container } = await apri();
    expect(campo(container, "riga-lordo")).toBeTruthy();
    // ⚠️ La percentuale non si scrive piu': nel database e' un riflesso, e
    //    scriverla verrebbe rifiutata.
    expect(container.querySelector('input[placeholder*="scarto"]')).toBeNull();
  });

  it("🔴 quello che si scrive ARRIVA al salvataggio, come lordo", async () => {
    const { container } = await apri();
    fireEvent.change(campo(container, "riga-netto"), {
      target: { value: "0.4" },
    });
    fireEvent.change(campo(container, "riga-lordo"), { target: { value: "1.5" } });
    // L'ingrediente va scelto perche' il pulsante si accenda: si prende il
    // menu che offre «Seleziona…», non il primo <select> che capita.
    const scelta = [...container.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.textContent === "Cozze"),
    );
    expect(scelta, "il menu degli ingredienti non c'e'").toBeTruthy();
    fireEvent.change(scelta, { target: { value: "i1" } });
    const bottone = bottoneAggiungi();
    fireEvent.click(bottone);
    await waitFor(() => expect(spie.aggiunta).toBeTruthy());
    expect(spie.aggiunta.quantita_lorda).toBe(1.5);
    // 🔴 E lo scarto NON viene mandato: il database lo rifiuterebbe.
    expect("waste_percentage" in spie.aggiunta).toBe(false);
  });
});

describe("la resa si vede mentre si scrive, e il rifiuto sta dove sta il dubbio", () => {
  const scrivi = (container, lordo, netto) => {
    fireEvent.change(campo(container, "riga-netto"), { target: { value: netto } });
    fireEvent.change(campo(container, "riga-lordo"), { target: { value: lordo } });
  };

  it("«da 1.5 ne restano 0.4: resa 26.7%»", async () => {
    const { container } = await apri();
    scrivi(container, "1.5", "0.4");
    await waitFor(() => expect(campo(container, "riga-resa")).toBeTruthy());
    expect(campo(container, "riga-resa").textContent).toMatch(/resa 26\.7%/);
  });

  it("🔴 il netto maggiore del lordo si rifiuta PRIMA di provarci, e lo dice", async () => {
    const { container } = await apri();
    scrivi(container, "0.5", "1");
    await waitFor(() => expect(campo(container, "riga-resa-rifiuto")).toBeTruthy());
    expect(campo(container, "riga-resa-rifiuto").textContent).toMatch(/non può restarne di più/);
    // ⚠️ E il gesto e' spento CON LA RAGIONE accanto, non premibile per
    //    essere respinto (regola del 17/08).
    expect(bottoneAggiungi().disabled).toBe(true);
  });

  it("senza lordo non si dice niente: vuoto non è zero", async () => {
    const { container } = await apri();
    fireEvent.change(campo(container, "riga-netto"), { target: { value: "0.4" } });
    expect(campo(container, "riga-resa")).toBeNull();
    expect(campo(container, "riga-resa-rifiuto")).toBeNull();
  });
});

describe("🔴 nell'elenco si legge la resa, non la percentuale di scarto", () => {
  it("«1.5 kg → 0.4 kg netti (26.7%)» al posto di «275%»", async () => {
    finto.righe = [riga()];
    const { container } = await apri();
    await waitFor(() => expect(container.textContent).toMatch(/1\.5 kg → 0\.4 kg netti/));
    expect(container.textContent).toMatch(/26\.7%/);
    // Lo scarto in quella forma non compare: e' il numero piu' difficile da
    // leggere dei due, e da solo non dice niente a chi cucina.
    expect(container.textContent).not.toMatch(/275%/);
  });

  it("una riga senza scarto si legge come una quantità e basta", async () => {
    finto.righe = [riga({ quantity: 0.2, quantita_lorda: 0.2, waste_percentage: 0 })];
    const { container } = await apri();
    await waitFor(() => expect(container.textContent).toMatch(/0\.2 kg/));
    expect(container.textContent).not.toMatch(/→/);
  });
});
