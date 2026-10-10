import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, primaEntita } from "./aiuto";

// Blocco 2 del mandato di correzione: un solo calcolo per ogni numero.
//
// Il food cost è ora in tre pezzi che si conoscono in un verso solo — la
// ricorsione (`espansione_costo_ricetta`), la formula (`v_recipe_row_costs`)
// e la somma (`v_recipe_costs`, che non ha più formule proprie). Questo
// file esiste per tenere ferma quella struttura: **se qualcuno rimette una
// seconda moltiplicazione da qualche parte, la somma delle righe smette di
// essere il food cost della ricetta e la prova diventa rossa da sola.**
//
// La ricetta di prova è a tre livelli apposta: il difetto curato era che
// il simulatore si rompeva proprio sui piatti con un semilavorato, e che
// un rincaro dentro una preparazione non mostrava nessun piatto.
// ⚠️ IL MARCHIO E' DI QUESTO GIRO, dal 01/09/2026: le pulizie e i
//    conteggi qui sotto usano questo valore in un modello `like`, e con
//    un valore fisso due esecuzioni insieme sullo stesso progetto di
//    prova si cancellano e si contano le righe a vicenda. Vedi la nota
//    in cima a `aiuto.js`.
const MARCA = marchio("TEST-AUTO food cost");

describe("il food cost si calcola in un posto solo", () => {
  let titolare;
  let ente;
  let ids = {};

  async function pulisci() {
    const { data: menus } = await titolare.from("menus").select("id").like("name", `${MARCA}%`);
    for (const m of menus ?? []) {
      await titolare.from("menu_items").delete().eq("menu_id", m.id);
      await titolare.from("menus").delete().eq("id", m.id);
    }
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

    // CIPOLLA 2,00/kg con 20% di scarto — sta nel piatto solo passando
    // per DUE preparazioni.
    const cipolla = await inserisci("ingredients", {
      entity_id: ente, name: `${MARCA} cipolla`, category: "verdura",
      unit: "kg", current_price: 2.0, waste_percentage_default: 20,
    });
    const carne = await inserisci("ingredients", {
      entity_id: ente, name: `${MARCA} carne`, category: "carne_rossa",
      unit: "kg", current_price: 10.0, waste_percentage_default: 0,
    });

    const soffritto = await inserisci("recipes", {
      name: `${MARCA} soffritto`, category: "antipasto", portions_yield: 1,
      recipe_type: "preparazione", yield_quantity: 2, yield_unit: "kg",
    });
    const ragu = await inserisci("recipes", {
      name: `${MARCA} ragu`, category: "antipasto", portions_yield: 1,
      recipe_type: "preparazione", yield_quantity: 4, yield_unit: "kg",
    });
    const piatto = await inserisci("recipes", {
      name: `${MARCA} piatto`, category: "primo", portions_yield: 4,
    });

    // 🔴 IL LORDO SI DICHIARA SULLA RIGA (R12, 23/09). Prima questa riga
    //    scriveva solo il netto e si prendeva il 20% di scarto dalla scheda
    //    del prodotto: era l'EREDITA' VIVA, che R12 toglie apposta.
    //    La realta' fisica e' la stessa — 1 kg di cipolla pulita se ne
    //    prende 1,2 dalla cella — ma adesso e' la riga a dirlo.
    // ⚠️ E il numero atteso del food cost NON e' stato toccato: torna 2,65
    //    perche' la riga dichiara lo stesso scarto che prima ereditava.
    const rigaCipolla = await inserisci("recipe_ingredients", { recipe_id: soffritto.id, ingredient_id: cipolla.id, quantity: 1, quantita_lorda: 1.2, unit: "kg" });
    await inserisci("recipe_ingredients", { recipe_id: ragu.id, component_recipe_id: soffritto.id, quantity: 1, unit: "kg" });
    await inserisci("recipe_ingredients", { recipe_id: ragu.id, ingredient_id: carne.id, quantity: 2, unit: "kg" });
    const rigaRagu = await inserisci("recipe_ingredients", { recipe_id: piatto.id, component_recipe_id: ragu.id, quantity: 0.5, unit: "kg" });

    const menu = await inserisci("menus", { name: `${MARCA} menu`, valid_from: "2094-01-01" });
    const voce = await inserisci("menu_items", {
      menu_id: menu.id, recipe_id: piatto.id, category: "primo", selling_price: 10.0,
    });

    ids = {
      cipolla: cipolla.id, piatto: piatto.id, rigaRagu: rigaRagu.id,
      menu: menu.id, voce: voce.id, rigaCipolla: rigaCipolla.id,
    };
  });

  afterAll(async () => {
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
  });

  // ===================================================================
  // 🔴 DA DOVE VIENE IL NUMERO — R12, 23/09/2026
  // ===================================================================
  // Prima di R12 queste prove scrivevano il solo netto e il 20% di scarto
  // arrivava dalla scheda del prodotto, a ogni lettura. Adesso la riga lo
  // dichiara. I tre controlli qui sotto tengono ferma quella differenza.
  it("🔴 il food cost legge la RIGA, non la scheda del prodotto", async () => {
    const { data: riga } = await titolare
      .from("recipe_ingredients")
      .select("quantity, quantita_lorda, waste_percentage")
      .eq("id", ids.rigaCipolla)
      .single();
    // 1 kg netto da 1,2 lordi: lo scarto è il riflesso dei due numeri.
    expect(Number(riga.quantity)).toBeCloseTo(1, 4);
    expect(Number(riga.quantita_lorda)).toBeCloseTo(1.2, 4);
    expect(Number(riga.waste_percentage)).toBeCloseTo(20, 2);

    // E il costo di quella riga è il LORDO per il prezzo: 1,2 × 2,00.
    const { data: costo } = await titolare
      .from("v_recipe_row_costs")
      .select("costo")
      .eq("recipe_ingredient_id", ids.rigaCipolla)
      .single();
    expect(Number(costo.costo)).toBeCloseTo(2.4, 4);
  });

  it("🔴 e il valore standard del prodotto NON torna a ereditarsi", async () => {
    // ⚠️ È il cuore di R12: cambiando il numero sulla scheda, una riga già
    //    scritta non si muove. Prima, questo stesso gesto spostava il food
    //    cost di ogni ricetta che usa la cipolla.
    const prima = await titolare
      .from("v_recipe_costs")
      .select("food_cost_base")
      .eq("recipe_id", ids.piatto)
      .single();

    await titolare.from("ingredients").update({ waste_percentage_default: 90 }).eq("id", ids.cipolla);

    const { data: riga } = await titolare
      .from("recipe_ingredients")
      .select("quantita_lorda, waste_percentage")
      .eq("id", ids.rigaCipolla)
      .single();
    const dopo = await titolare
      .from("v_recipe_costs")
      .select("food_cost_base")
      .eq("recipe_id", ids.piatto)
      .single();

    await titolare.from("ingredients").update({ waste_percentage_default: 20 }).eq("id", ids.cipolla);

    expect(Number(riga.quantita_lorda)).toBeCloseTo(1.2, 4);
    expect(Number(riga.waste_percentage)).toBeCloseTo(20, 2);
    expect(Number(dopo.data.food_cost_base)).toBeCloseTo(Number(prima.data.food_cost_base), 4);
  });

  it("⚠️ e il numero atteso si RICAVA dai numeri scritti nella riga", async () => {
    // 🔴 Non è un numero copiato: si rifà il conto dai due valori che la
    //    riga porta, così se domani qualcuno cambiasse la riga senza
    //    cambiare l'atteso, questa prova lo direbbe.
    const { data: riga } = await titolare
      .from("recipe_ingredients")
      .select("quantita_lorda")
      .eq("id", ids.rigaCipolla)
      .single();
    const { data: cipolla } = await titolare
      .from("ingredients")
      .select("current_price")
      .eq("id", ids.cipolla)
      .single();

    // soffritto = lordo × prezzo; nel ragù entra per 1 kg su una resa di 2;
    // il ragù = quello + 2 kg di carne a 10,00; nel piatto entra 0,5 kg su
    // una resa di 4.
    const soffritto = Number(riga.quantita_lorda) * Number(cipolla.current_price);
    const ragu = soffritto / 2 + 2 * 10.0;
    const atteso = (0.5 / 4) * ragu;

    const { data: ricetta } = await titolare
      .from("v_recipe_costs")
      .select("food_cost_base")
      .eq("recipe_id", ids.piatto)
      .single();
    expect(Number(ricetta.food_cost_base)).toBeCloseTo(atteso, 4);
    // E fa 2,65, cioè lo stesso numero di prima di R12: la realtà fisica
    // non è cambiata, è cambiato chi la dichiara.
    expect(atteso).toBeCloseTo(2.65, 4);
  });

  it("la somma delle righe È il food cost della ricetta, non un secondo conto", async () => {
    const { data: righe } = await titolare
      .from("v_recipe_row_costs")
      .select("recipe_ingredient_id, costo")
      .eq("recipe_id", ids.piatto);
    const somma = righe.reduce((s, r) => s + Number(r.costo), 0);

    const { data: ricetta } = await titolare
      .from("v_recipe_costs")
      .select("food_cost_base, food_cost_portion")
      .eq("recipe_id", ids.piatto)
      .single();

    // 0,5 kg di ragù su una resa di 4 kg, e il ragù costa 21,20
    // (2,40 di soffritto scarto compreso, diviso 2, più 20,00 di carne).
    expect(Number(ricetta.food_cost_base)).toBeCloseTo(2.65, 4);
    expect(somma).toBeCloseTo(Number(ricetta.food_cost_base), 4);
    expect(Number(righe.find((r) => r.recipe_ingredient_id === ids.rigaRagu).costo)).toBeCloseTo(2.65, 4);
  });

  it("il simulatore segue la cascata invece di rompersi sul semilavorato", async () => {
    const { data, error } = await titolare.rpc("simula_prezzo_ingrediente", {
      p_menu_id: ids.menu,
      p_ingredient_id: ids.cipolla,
      p_variazione_pct: 100,
    });
    expect(error).toBeNull();
    // La vecchia versione qui non trovava NIENTE: la cipolla nel piatto
    // non c'è, è dentro un soffritto dentro un ragù.
    expect(data).toHaveLength(1);
    expect(data[0].via_preparazione).toBe(true);
    // Raddoppiando la cipolla (2,00 → 4,00) il soffritto passa da 2,40 a
    // 4,80, quindi nel ragù vale 2,40 invece di 1,20 e il ragù passa da
    // 21,20 a 22,40; la riga del piatto vale (0,5/4) × 22,40 = 2,80, e su
    // 4 porzioni fa 0,70 contro gli attuali 0,6625.
    expect(Number(data[0].food_cost_simulato)).toBeCloseTo(0.7, 4);
    expect(Number(data[0].food_cost_attuale)).toBeCloseTo(0.6625, 4);
  });

  it("la simulazione sposta il numero, non se lo inventa", async () => {
    // ⚠️ È il controllo che vale più degli altri: se il simulatore e il
    // food cost vero si allontanassero, nessuna delle due schermate
    // sembrerebbe sbagliata — direbbero solo due numeri diversi.
    const { data: simulato } = await titolare.rpc("simula_prezzo_ingrediente", {
      p_menu_id: ids.menu,
      p_ingredient_id: ids.cipolla,
      p_variazione_pct: 100,
    });

    await titolare.from("ingredients").update({ current_price: 4.0 }).eq("id", ids.cipolla);
    const { data: vero } = await titolare
      .from("v_recipe_costs")
      .select("food_cost_portion")
      .eq("recipe_id", ids.piatto)
      .single();
    await titolare.from("ingredients").update({ current_price: 2.0 }).eq("id", ids.cipolla);

    expect(Number(vero.food_cost_portion)).toBeCloseTo(Number(simulato[0].food_cost_simulato), 4);
  });

  it("un ingrediente che sta solo dentro una preparazione è comunque selezionabile", async () => {
    const { data } = await titolare.rpc("ingredienti_del_menu", { p_menu_id: ids.menu });
    const cipolla = data.find((i) => i.ingredient_id === ids.cipolla);
    expect(cipolla).toBeTruthy();
    expect(cipolla.solo_in_preparazioni).toBe(true);
  });
});
