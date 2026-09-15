import { MemoryRouter } from "react-router-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// GLI ALLERGENI NEL MENU STAMPATO — 12/09/2026, mandato esteso, priorità 1
// =====================================================================
// 🔴 COSA SI PROVA, e perché:
//    · il riquadro rosso dell'Editor menu diceva «allergeni solo stimati»
//      e «finché non li confermi». Dal 25/08/2026 un allergene dedotto vale
//      come confermato (decisione di Alessio): la vista `v_recipe_allergens`
//      blocca solo un prodotto con l'origine VUOTA, cioè che non ha guardato
//      nessuno. La frase raccontava una regola che il gestionale non applica;
//    · se la lettura degli allergeni falliva, la copia «con gli allergeni»
//      si disegnava lo stesso, senza allergeni e senza asterischi: un foglio
//      che dice «questi piatti non ne hanno».
//
// ⚠️ IL LIMITE, dichiarato: qui gli allergeni arrivano già come li calcola
//    il database (`daVerificare`). Che un dedotto valga come confermato lo
//    decide la vista, e questa prova non la guarda: la definizione viva è
//    stata letta in sola lettura il 12/09/2026 (vedi il riepilogo).

const finte = { menu: vi.fn(), piatti: vi.fn(), allergeni: vi.fn() };
vi.mock("../../src/lib/api/menus", () => ({
  listMenus: (...a) => finte.menu(...a),
  listMenuItemsFull: (...a) => finte.piatti(...a),
}));
vi.mock("../../src/lib/api/dailyMenu", () => ({
  listAllergensForRecipes: (...a) => finte.allergeni(...a),
}));

const { default: EditorMenuHome } = await import("../../src/pages/menu-editor/EditorMenuHome");

const PIATTI = [
  { id: "i1", recipe_id: "r1", category: "primo", selling_price: 12, recipe: { name: "Tagliolini al limone" } },
  { id: "i2", recipe_id: "r2", category: "secondo", selling_price: 18, recipe: { name: "Ricciola scottata" } },
];

// Come arriva dalla vista: `daVerificare` è vero SOLO se un ingrediente ha
// l'origine vuota. Un ingrediente «dedotto dal nome» arriva uguale a uno
// guardato da Alessio.
const guardato = (allergens) => ({ allergens, daVerificare: false, ingredienti: [], tracce: [] });
const maiGuardato = (allergens, ingredienti) => ({ allergens, daVerificare: true, ingredienti, tracce: [] });

const FRASE_VECCHIA = [/solo stimati/, /finché non li confermi/, /non confermati/];

const apri = async () => {
  render(
    <MemoryRouter>
      <EditorMenuHome />
    </MemoryRouter>,
  );
  await screen.findByText(/Si stampano tutti e 2 i piatti/);
};

const mostraAllergeni = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("checkbox", { name: /Mostra allergeni/ }));
  });

beforeEach(() => {
  finte.menu.mockReset().mockResolvedValue([{ id: "m1", name: "Carta", is_active: true }]);
  finte.piatti.mockReset().mockResolvedValue(PIATTI);
  finte.allergeni.mockReset();
});

describe("lettura riuscita", () => {
  it("allergeni guardati (da una persona o da MEMO): si stampano, niente riquadro rosso, niente asterisco", async () => {
    finte.allergeni.mockResolvedValue({ r1: guardato(["glutine"]), r2: guardato(["pesce"]) });
    await apri();
    await mostraAllergeni();
    expect(screen.getByText("Glutine")).toBeTruthy();
    expect(screen.getByText("Pesce")).toBeTruthy();
    expect(screen.queryByText(/nessuno ha guardato/)).toBeNull();
    expect(screen.queryByText(/I piatti con/)).toBeNull();
  });

  it("🔴 un prodotto che nessuno ha guardato: il riquadro dice QUESTO, non «stimati» né «confermi»", async () => {
    finte.allergeni.mockResolvedValue({
      r1: guardato(["glutine"]),
      r2: maiGuardato(["soia"], ["Salsa di soia"]),
    });
    await apri();
    await mostraAllergeni();

    const riquadro = screen.getByText(/non li ha ancora visti né una persona né MEMO/).closest("div");
    for (const vecchia of FRASE_VECCHIA) expect(riquadro.textContent).not.toMatch(vecchia);
    expect(riquadro.textContent).toMatch(/Salsa di soia/);
    expect(riquadro.textContent).toMatch(/non stampano l'elenco allergeni/);

    // E il foglio fa quello che il riquadro dice: il piatto non guardato
    // porta l'asterisco e NON l'elenco; quello guardato stampa il suo.
    expect(screen.queryByText("Soia")).toBeNull();
    expect(screen.getByText("Glutine")).toBeTruthy();
    expect(screen.getByText(/I piatti con/)).toBeTruthy();
  });
});

describe("lettura non riuscita", () => {
  it("🔴 con «Mostra allergeni»: dice che non li ha letti, invece di stampare piatti senza allergeni; e si riprova", async () => {
    finte.allergeni.mockRejectedValueOnce(new Error("rete assente"));
    await apri();
    await mostraAllergeni();

    expect(screen.getByText(/Non riesco a leggere gli allergeni dei piatti/)).toBeTruthy();
    expect(screen.getByText(/Non vuol dire che i piatti non ne hanno/)).toBeTruthy();
    // La nota in fondo al foglio promette «l'elenco completo»: non deve
    // comparire sotto piatti di cui non si sa niente.
    expect(screen.queryByText(/teniamo l'elenco completo/)).toBeNull();

    finte.allergeni.mockResolvedValueOnce({ r1: guardato(["glutine"]), r2: guardato(["pesce"]) });
    await act(async () => {
      screen.getByRole("button", { name: "Riprova" }).click();
    });
    await waitFor(() => expect(screen.getByText("Glutine")).toBeTruthy());
    expect(screen.queryByText(/Non riesco a leggere/)).toBeNull();
    expect(screen.getByText(/teniamo l'elenco completo/)).toBeTruthy();
  });

  it("senza «Mostra allergeni»: la carta si stampa lo stesso, perché non li usa", async () => {
    finte.allergeni.mockRejectedValueOnce(new Error("rete assente"));
    await apri();
    expect(screen.getByText("Primi")).toBeTruthy();
    expect(screen.getByText("Secondi")).toBeTruthy();
    expect(screen.queryByText(/Non riesco a leggere/)).toBeNull();
  });
});
