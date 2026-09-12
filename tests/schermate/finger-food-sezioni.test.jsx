import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RECIPE_CATEGORIES } from "../../src/lib/constants";
import { entraNelMenu } from "../../src/lib/calcoli/sezioniMenu";

// =====================================================================
// «PUÒ ENTRARE» E «HA UN POSTO» DEVONO DARE LA STESSA RISPOSTA — 12/09/2026
// =====================================================================
// La guardia contro il ritorno di «si salva ma sparisce». Per OGNI portata
// del Ricettario, una voce di menu di quella portata:
//   · se il divieto la lascia entrare, compare in una sezione della scheda
//     del menu E nel foglio stampato;
//   · se non la lascia entrare, non compare in nessuna sezione.
// ⚠️ Diventa rossa il giorno che nasce una portata nuova (un «contorno») o
//    che una sezione viene aggiunta in una sola delle due schermate: è lì
//    che il difetto tornerebbe, senza nessun errore.

vi.mock("../../src/lib/supabase", () => ({ supabase: {}, supabasePubblico: {} }));

const VOCI = RECIPE_CATEGORIES.map((c, n) => ({
  id: `v${n}`,
  recipe_id: `r${n}`,
  category: c.value,
  selling_price: 10,
  recipe: { id: `r${n}`, name: `Piatto di prova ${c.value}`, seasonality: [], menu_description: null },
}));
const vuoto = () => Promise.resolve([]);

vi.mock("../../src/lib/api/menus", () => ({
  listMenus: () => Promise.resolve([{ id: "m1", name: "Carta", is_active: true }]),
  getMenu: () => Promise.resolve({ id: "m1", name: "Carta", is_active: true }),
  listMenuItemsFull: () => Promise.resolve(structuredClone(VOCI)),
  listIngredientiDelMenu: vuoto,
  simulaPrezzoIngrediente: vuoto,
  addMenuItem: vi.fn(),
  removeMenuItem: vi.fn(),
  setActiveMenu: vi.fn(),
  updateMenuItemPrice: vi.fn(),
}));
vi.mock("../../src/lib/api/recipes", () => ({ listRecipes: vuoto, listAllRecipeCosts: vuoto }));
vi.mock("../../src/lib/api/dailyMenu", () => ({ listAllergensForRecipes: () => Promise.resolve({}) }));

const { default: MenuDetail } = await import("../../src/pages/ricettario/MenuDetail");
const { default: EditorMenuHome } = await import("../../src/pages/menu-editor/EditorMenuHome");

// Nella scheda del menu una sezione è un riquadro con la sua intestazione;
// l'avviso delle voci senza posto non ne ha una.
const inUnaSezioneDelMenu = (el) => {
  const riquadro = el.closest("div.rounded-xl");
  return Boolean(riquadro?.querySelector("h2"));
};

describe("ogni portata che entra in un menu ha un posto, e viceversa", () => {
  it("nella scheda del menu", async () => {
    render(
      <MemoryRouter initialEntries={["/ricettario/menu/m1"]}>
        <Routes>
          <Route path="/ricettario/menu/:id" element={<MenuDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findAllByText(VOCI[0].recipe.name);
    for (const v of VOCI) {
      const trovati = screen.queryAllByText(v.recipe.name);
      expect(trovati.some(inUnaSezioneDelMenu), `${v.category} nella scheda del menu`).toBe(entraNelMenu(v.category));
    }
  });

  it("nel foglio stampato", async () => {
    render(
      <MemoryRouter>
        <EditorMenuHome />
      </MemoryRouter>,
    );
    await screen.findAllByText(VOCI[0].recipe.name);
    for (const v of VOCI) {
      const trovati = screen.queryAllByText(v.recipe.name);
      expect(trovati.some((el) => el.closest("section")), `${v.category} nel foglio`).toBe(entraNelMenu(v.category));
    }
  });
});
