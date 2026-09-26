import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LA RESA STANDARD SULLA SCHEDA DEL PRODOTTO — R12, 22/09/2026
// =====================================================================
// 🔴 PERCHE' ESISTE QUESTA PROVA, e non basta quella pura. `scartoDaResa`
//    risponde giusto: qui si prova che la schermata la CHIAMA, e che il
//    numero ARRIVA al salvataggio nella forma che il database si aspetta.
//    E' la lezione del 16/08 pagata col mezzo di pagamento delle mance: il
//    menu si vedeva, si sceglieva, e il campo non arrivava mai al database.
//
// 🔴 E LA COSA PIU' IMPORTANTE E' IL VUOTO. Se un campo vuoto arrivasse
//    come **zero**, il database leggerebbe «di questo prodotto non si butta
//    niente» — una risposta al posto di un'assenza di risposta — e ogni
//    riga di ricetta nuova nascerebbe col lordo uguale al netto senza che
//    nessuno l'abbia deciso.

vi.mock("../../src/lib/supabase", () => ({
  supabase: { from: vi.fn() },
  supabasePubblico: {},
}));

const spie = vi.hoisted(() => ({ creato: null }));
const vuoto = () => Promise.resolve([]);

vi.mock("../../src/lib/api/ingredients", () => ({
  confermaCampiProdotto: vi.fn(),
  createIngredient: vi.fn(async (p) => {
    spie.creato = p;
    return { id: "nuovo" };
  }),
  eliminaIngrediente: vi.fn(),
  getIngredient: vi.fn(),
  ingredienteConQuestoNome: vi.fn(async () => null),
  listPriceHistory: vuoto,
  mettiDaParteIngrediente: vi.fn(),
  updateIngredientFields: vi.fn(),
  updateIngredientPrice: vi.fn(),
  usiDellIngrediente: vi.fn(async () => ({ ricette: [], lotti: 0 })),
  listCategorieIngrediente: vi.fn(async () => [{ valore: "pesce", etichetta: "Pesce" }]),
  listUnita: vi.fn(async () => [{ valore: "kg", etichetta: "kg" }]),
  aggiungiCategoriaIngrediente: vi.fn(),
}));
vi.mock("../../src/lib/api/entities", () => ({
  getEntities: vi.fn(async () => ({
    srls: { id: "e1", name: "Borgo 58" },
    agricola: { id: "e2", name: "Orto" },
  })),
}));
vi.mock("../../src/lib/api/suppliers", () => ({
  listSuppliers: vuoto,
  createSupplier: vi.fn(),
}));
vi.mock("../../src/lib/api/assistente", () => ({
  assegnaFornitoreArticolo: vi.fn(),
  collegaArticoli: vi.fn(),
  variantiIngrediente: vuoto,
}));
vi.mock("../../src/lib/api/assistenteFoto", () => ({
  applicaLetturaEtichetta: vi.fn(),
  marcaCampiDallAssistente: vi.fn(),
  registraProdottoLetto: vi.fn(),
}));

const { default: IngredienteForm } = await import("../../src/pages/ricettario/IngredienteForm");

const campo = (c, nome) => c.querySelector(`[data-prova="${nome}"]`);

async function apri() {
  const vista = render(
    <MemoryRouter initialEntries={["/ricettario/ingredienti/nuovo"]}>
      <Routes>
        <Route path="/ricettario/ingredienti/nuovo" element={<IngredienteForm />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(campo(vista.container, "resa-standard")).toBeTruthy());
  return vista;
}

beforeEach(() => {
  spie.creato = null;
  vi.clearAllMocks();
});

describe("🔴 il campo c'e' ancora, e adesso e' una resa", () => {
  it("si chiama resa, non scarto, e nasce VUOTO", async () => {
    const { container } = await apri();
    const input = campo(container, "resa-standard");
    expect(input.value).toBe("");
    // ⚠️ Vuoto, non «0»: zero vorrebbe dire «non si butta niente», che e'
    //    una risposta.
    expect(input.value).not.toBe("0");
    expect(container.textContent).toMatch(/Resa standard/);
    expect(container.textContent).toMatch(/da 1 kg ne restano/);
  });

  it("scrivendo 30 si legge «da 1 kg ne restano 0.3 kg»", async () => {
    const { container } = await apri();
    fireEvent.change(campo(container, "resa-standard"), { target: { value: "30" } });
    await waitFor(() => expect(campo(container, "resa-standard-esempio")).toBeTruthy());
    expect(campo(container, "resa-standard-esempio").textContent).toMatch(
      /da 1 kg ne restano 0\.3 kg/,
    );
  });

  it("🔴 una resa sopra 100 si rifiuta PRIMA di provarci, e lo dice", async () => {
    const { container } = await apri();
    fireEvent.change(campo(container, "resa-standard"), { target: { value: "150" } });
    await waitFor(() => expect(campo(container, "resa-standard-rifiuto")).toBeTruthy());
    expect(campo(container, "resa-standard-rifiuto").textContent).toMatch(/fra 0 e 100/);
  });

  it("⚠️ ma il campo vuoto NON e' un errore: e' facoltativo", async () => {
    const { container } = await apri();
    expect(campo(container, "resa-standard-rifiuto")).toBeNull();
    expect(campo(container, "resa-standard-esempio")).toBeNull();
  });
});

describe("🔴 e il numero ARRIVA al salvataggio come SCARTO, non come resa", () => {
  const compilaMinimo = (container) => {
    // I campi che il modulo pretende per poter salvare.
    const nome = container.querySelector('input[name="name"]');
    if (nome) fireEvent.change(nome, { target: { value: "ZZ Cozze" } });
    const categoria = [...container.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.textContent === "Pesce"),
    );
    if (categoria) fireEvent.change(categoria, { target: { value: "pesce" } });
  };

  it("resa 30% → il database riceve uno scarto di 233,33", async () => {
    const { container } = await apri();
    compilaMinimo(container);
    fireEvent.change(campo(container, "resa-standard"), { target: { value: "30" } });
    fireEvent.submit(container.querySelector("form"));

    await waitFor(() => expect(spie.creato).toBeTruthy());
    // 🔴 Sopra si scrive una resa, sotto arriva uno scarto: e' lo stesso
    //    numero detto nelle due lingue, e la conversione vive in un posto
    //    solo.
    expect(spie.creato.waste_percentage_default).toBe(233.33);
  });

  it("🔴 e il campo VUOTO arriva come «non lo so», mai come zero", async () => {
    // ⚠️ E' il controllo che vale di piu' di tutta questa prova: uno zero
    //    qui si leggerebbe «di questo prodotto non si butta niente», e ogni
    //    riga nuova nascerebbe col lordo uguale al netto senza che nessuno
    //    l'abbia deciso.
    const { container } = await apri();
    compilaMinimo(container);
    fireEvent.submit(container.querySelector("form"));

    await waitFor(() => expect(spie.creato).toBeTruthy());
    expect(spie.creato.waste_percentage_default).toBeNull();
    expect(spie.creato.waste_percentage_default).not.toBe(0);
  });
});
