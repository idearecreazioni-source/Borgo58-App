import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { credenziali, righeMie } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import { getEntities } from "../../src/lib/api/entities";
import {
  createIngredient,
  eliminaIngrediente,
  listIngredients,
  mettiDaParteIngrediente,
  usiDellIngrediente,
} from "../../src/lib/api/ingredients";
import { createRecipe } from "../../src/lib/api/recipes";

// TOGLIERE UN INGREDIENTE: le due strade, provate dal CLIENT.
//
// ⚠️ PERCHE' NON BASTA LA VERIFICA DENTRO LA MIGRAZIONE: quella gira come
// proprietaria del database e **scavalca la RLS**, quindi non può
// accorgersi di un difetto di permessi (§8, 16/08 — il caso di
// `log_recipe_status_change`, che per due settimane ha impedito a tutti di
// marcare una ricetta pronta senza che nessuna verifica lo vedesse).
//
// ⚠️ E si passa dalle funzioni VERE dell'app, non da query scritte qui: è
// l'unico modo di esercitare il tratto fra schermata e database, che è
// dove si nascondono i campi dimenticati e i permessi sbagliati.

describe("un ingrediente si può togliere", () => {
  const mie = righeMie(supabase);
  let entityId;

  beforeAll(async () => {
    const { error } = await supabase.auth.signInWithPassword(credenziali().titolare);
    if (error) throw new Error(`Non riesco a entrare come titolare: ${error.message}`);
    entityId = (await getEntities()).srls.id;
  });

  afterAll(async () => {
    await mie.pulisci();
    await supabase.auth.signOut({ scope: "local" });
  });

  const nuovo = async (prefisso) => {
    const ing = await createIngredient({
      entity_id: entityId,
      name: `${prefisso}-${Date.now()}`,
      unit: "kg",
      category: "altro",
    });
    return ing;
  };

  it("uno appena creato non risulta usato da nessuno", async () => {
    const ing = await nuovo("prova-libero");
    mie.segna("ingredients", ing.id);
    expect(await usiDellIngrediente(ing.id)).toEqual([]);
  });

  it("uno mai usato si cancella davvero, e sparisce", async () => {
    const ing = await nuovo("prova-cancella");
    const esito = await eliminaIngrediente(ing.id);
    expect(esito.cancellati).toBe(1);
    // ⚠️ Anche accendendo la casella: cancellato vuol dire cancellato.
    expect(await listIngredients({ search: ing.name, includiNonAttivi: true })).toHaveLength(0);
  });

  it("messo da parte sparisce dagli elenchi, ma si ritrova", async () => {
    const ing = await nuovo("prova-daparte");
    mie.segna("ingredients", ing.id);

    await mettiDaParteIngrediente(ing.id, false);
    // Sparisce da dove lo si cerca…
    expect(await listIngredients({ search: ing.name })).toHaveLength(0);
    // ⚠️ …ma si ritrova, altrimenti «mettere da parte» sarebbe cancellare
    // con un altro nome — e sarebbe un gesto che non si può disfare.
    const visibili = await listIngredients({ search: ing.name, includiNonAttivi: true });
    expect(visibili).toHaveLength(1);
    expect(visibili[0].active).toBe(false);

    await mettiDaParteIngrediente(ing.id, true);
    expect(await listIngredients({ search: ing.name })).toHaveLength(1);
  });

  it("🔴 uno già usato NON si cancella, e il rifiuto dice dove e cosa fare", async () => {
    // ⚠️ È il caso che conta: senza qualcosa che lo usa, questa prova
    // girerebbe sul CASO VUOTO e passerebbe anche se il controllo non
    // guardasse niente (§8, 17/08).
    const ing = await nuovo("prova-usato");
    mie.segna("ingredients", ing.id);

    const ricetta = await createRecipe({
      name: `prova-ricetta-${Date.now()}`,
      category: "antipasto",
      recipe_type: "piatto_finito",
    });
    mie.segna("recipes", ricetta.id);

    const { error } = await supabase
      .from("recipe_ingredients")
      .insert({ recipe_id: ricetta.id, ingredient_id: ing.id, quantity: 1, unit: "kg" });
    if (error) throw error;

    const usi = await usiDellIngrediente(ing.id);
    expect(usi.map((u) => u.dove)).toContain("recipe_ingredients");

    // Il rifiuto è in italiano e nomina il posto: «recipe_ingredients»
    // per chi sta davanti alla schermata non è un'informazione.
    await expect(eliminaIngrediente(ing.id)).rejects.toThrow(/ricette/i);
    // ⚠️ E indica la via d'uscita: un rifiuto senza gesto d'uscita è un
    // vicolo cieco (regola del 16/08).
    await expect(eliminaIngrediente(ing.id)).rejects.toThrow(/metterlo da parte/i);

    // ⚠️ E la via d'uscita FUNZIONA, e non stacca niente: è la metà della
    // regola che nessuno prova, perché il rifiuto sembra già il risultato.
    await mettiDaParteIngrediente(ing.id, false);
    const { count } = await supabase
      .from("recipe_ingredients")
      .select("*", { count: "exact", head: true })
      .eq("ingredient_id", ing.id);
    expect(count).toBe(1);
  });
});
