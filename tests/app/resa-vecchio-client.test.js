import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, primaEntita } from "./aiuto";

// =====================================================================
// R12, RILASCIO IN DUE FASI — il vecchio client e il nuovo, sulla stessa
// riga (22/09/2026)
// =====================================================================
// 🔴 QUESTA PROVA ESISTE PER IL RISCHIO VERO: il database di R12 puo'
//    essere pubblicato prima del sito. Il sito vecchio scrive ancora
//    `waste_percentage` da solo, senza sapere che `quantita_lorda`
//    esiste — se il trigger lo rifiutasse, ogni salvataggio del sito
//    vecchio si romperebbe nell'intervallo fra le due pubblicazioni.
//
// ⚠️ NON VERIFICATO CONTRO UN DATABASE: la migrazione `20260922000001`
//    non e' mai stata applicata da nessuna parte (nemmeno sul progetto di
//    prova), per mandato — la sua stessa migrazione lo dichiara in cima.
//    Questo file gira solo dopo l'applicazione.
const MARCA = marchio("TEST-AUTO resa vecchio client");

describe("R12: il vecchio formato e il nuovo, discriminati", () => {
  let titolare;
  let ente;
  let ids = {};

  async function pulisci() {
    const { data: ricette } = await titolare.from("recipes").select("id").like("name", `${MARCA}%`);
    for (const r of ricette ?? []) {
      await titolare.from("recipe_ingredients").delete().eq("recipe_id", r.id);
    }
    for (const r of ricette ?? []) {
      await titolare.from("recipes").delete().eq("id", r.id);
    }
    const { data: ingr } = await titolare.from("ingredients").select("id").like("name", `${MARCA}%`);
    for (const i of ingr ?? []) {
      await titolare.from("price_history").delete().eq("ingredient_id", i.id);
      await titolare.from("ingredients").delete().eq("id", i.id);
    }
  }

  const inserisci = async (tabella, riga) => {
    const { data, error } = await titolare.from(tabella).insert(riga).select().single();
    if (error) throw new Error(`${tabella}: ${error.message}`);
    return data;
  };

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    ente = await primaEntita(titolare);
    await pulisci();

    const cozze = await inserisci("ingredients", {
      entity_id: ente, name: `${MARCA} cozze`, category: "pesce",
      unit: "kg", current_price: 3.0, waste_percentage_default: 20,
    });
    const ricetta = await inserisci("recipes", {
      name: `${MARCA} impepata`, category: "antipasto", portions_yield: 1,
    });

    ids = { cozze: cozze.id, ricetta: ricetta.id };
  });

  afterAll(async () => {
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
  });

  it("🔴 il vecchio client scrive SOLO lo scarto: la riga si crea, il lordo si ricava", async () => {
    // Il sito vecchio non conosce `quantita_lorda`: la colonna non compare
    // nell'insert, come farebbe davvero un client scritto prima di R12.
    const riga = await inserisci("recipe_ingredients", {
      recipe_id: ids.ricetta, ingredient_id: ids.cozze, quantity: 0.4, unit: "kg",
      waste_percentage: 275,
    });
    // Da 0,4 kg netti con scarto 275 il lordo atteso e' 0,4 * 3,75 = 1,5.
    expect(Number(riga.quantita_lorda)).toBeCloseTo(1.5, 4);
    expect(Number(riga.waste_percentage)).toBeCloseTo(275, 2);
  });

  it("🔴 il vecchio client CORREGGE lo scarto senza toccare il lordo: si ricalcola, non si rifiuta", async () => {
    const riga = await inserisci("recipe_ingredients", {
      recipe_id: ids.ricetta, ingredient_id: ids.cozze, quantity: 0.4, unit: "kg",
      waste_percentage: 275,
    });
    const { data: aggiornata, error } = await titolare
      .from("recipe_ingredients")
      .update({ waste_percentage: 100 })
      .eq("id", riga.id)
      .select()
      .single();
    expect(error).toBeNull();
    // Da 0,4 kg netti con scarto 100 il lordo atteso e' 0,4 * 2 = 0,8.
    expect(Number(aggiornata.quantita_lorda)).toBeCloseTo(0.8, 4);
    expect(Number(aggiornata.waste_percentage)).toBeCloseTo(100, 2);
  });

  it("il nuovo client scrive lordo e netto: restano autorevoli, lo scarto e' il loro riflesso", async () => {
    const riga = await inserisci("recipe_ingredients", {
      recipe_id: ids.ricetta, ingredient_id: ids.cozze, quantity: 0.4, unit: "kg",
      quantita_lorda: 1.5,
    });
    expect(Number(riga.quantita_lorda)).toBeCloseTo(1.5, 4);
    expect(Number(riga.waste_percentage)).toBeCloseTo(275, 2);
  });

  it("🔴 un lordo scritto e uno scarto che non torna restano rifiutati: non e' il ramo del vecchio client", async () => {
    const { error } = await titolare.from("recipe_ingredients").insert({
      recipe_id: ids.ricetta, ingredient_id: ids.cozze, quantity: 0.4, unit: "kg",
      quantita_lorda: 1.5, waste_percentage: 50,
    });
    expect(error).toBeTruthy();
    expect(error.message).toMatch(/non si scrive piu'/);
  });

  it("🔴 lo standard del prodotto, cambiato DOPO, non muove una riga gia' scritta ne' il suo costo", async () => {
    const riga = await inserisci("recipe_ingredients", {
      recipe_id: ids.ricetta, ingredient_id: ids.cozze, quantity: 0.4, unit: "kg",
      waste_percentage: 275,
    });
    const { data: primaDelCambio } = await titolare
      .from("v_recipe_row_costs")
      .select("costo")
      .eq("recipe_ingredient_id", riga.id)
      .single();

    // Lo standard del prodotto cambia da 20 a 90: se ci fosse ancora
    // un'eredita' viva, il lordo e il costo della riga si sposterebbero.
    await titolare.from("ingredients").update({ waste_percentage_default: 90 }).eq("id", ids.cozze);

    const { data: dopoIlCambio } = await titolare
      .from("recipe_ingredients")
      .select("quantita_lorda, waste_percentage")
      .eq("id", riga.id)
      .single();
    const { data: costoDopo } = await titolare
      .from("v_recipe_row_costs")
      .select("costo")
      .eq("recipe_ingredient_id", riga.id)
      .single();

    await titolare.from("ingredients").update({ waste_percentage_default: 20 }).eq("id", ids.cozze);

    expect(Number(dopoIlCambio.quantita_lorda)).toBeCloseTo(1.5, 4);
    expect(Number(dopoIlCambio.waste_percentage)).toBeCloseTo(275, 2);
    expect(Number(costoDopo.costo)).toBeCloseTo(Number(primaDelCambio.costo), 4);
  });
});
