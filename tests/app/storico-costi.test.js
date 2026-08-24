import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita } from "./aiuto";
import { costoRicettaAllaData, storicoCostoRicetta } from "../../src/lib/api/storicoCosti";
import { supabase } from "../../src/lib/supabase";

// LO STORICO DEI COSTI — blocco 3 del mandato dei finger food.
//
// ⚠️ La migrazione prova già queste regole, ma gira **come proprietaria del
// database**, dove la RLS non esiste. Qui si entra col token di un utente
// vero, e si passa dalle funzioni che usa l'app.
//
// 🔴 LA CATENA È A QUATTRO LIVELLI — ingrediente → preparazione →
// preparazione → finger → selezione — perché è lì che questo genere di
// lavoro si rompe: una prova a un livello solo non distinguerebbe una catena
// che funziona da una che si ferma al primo passaggio.
//
// 🔴 E LA SELEZIONE PORTA SEI BOCCONCINI, non due: con due, le risposte
// sbagliate (catena che perde un livello, moltiplicatore ignorato)
// coinciderebbero col numero giusto. Con sei si separano — 12,00 contro
// 2,00 contro 4,00.
const MARCA = "TEST-AUTO storico";
const QUANTI = 6;
const PREZZO = 2.0;

describe("lo storico dei costi registra i cambiamenti veri", () => {
  let titolare;
  let ente;
  let ing;
  let base;
  let comp;
  let finger;
  let selez;
  let rigaSelez;

  async function pulisci() {
    const { data: ricette } = await titolare.from("recipes").select("id").like("name", `${MARCA}%`);
    const ids = (ricette ?? []).map((r) => r.id);
    if (ids.length) {
      await titolare.from("recipe_ingredients").delete().in("recipe_id", ids);
      await titolare.from("recipe_ingredients").delete().in("component_recipe_id", ids);
      await titolare.from("recipes").delete().in("id", ids);
    }
    await titolare.from("ingredients").delete().like("name", `${MARCA}%`);
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    await supabase.auth.signInWithPassword({
      email: credenziali().titolare.email,
      password: credenziali().titolare.password,
    });
    ente = await primaEntita(titolare);
    await pulisci();

    const { data: i } = await titolare
      .from("ingredients")
      .insert({ entity_id: ente, name: `${MARCA} melanzana`, category: "verdura", unit: "kg", current_price: PREZZO })
      .select()
      .single();
    ing = i.id;

    const comune = { category: "antipasto", portions_yield: 1 };
    const { data: b } = await titolare
      .from("recipes")
      .insert({ ...comune, name: `${MARCA} base`, recipe_type: "preparazione", yield_quantity: 1, yield_unit: "kg" })
      .select()
      .single();
    base = b.id;
    await titolare.from("recipe_ingredients").insert({ recipe_id: base, ingredient_id: ing, quantity: 1, unit: "kg" });

    const { data: c } = await titolare
      .from("recipes")
      .insert({ ...comune, name: `${MARCA} comp`, recipe_type: "preparazione", yield_quantity: 1, yield_unit: "kg" })
      .select()
      .single();
    comp = c.id;
    await titolare
      .from("recipe_ingredients")
      .insert({ recipe_id: comp, component_recipe_id: base, quantity: 1, unit: "kg" });

    const { data: f } = await titolare
      .from("recipes")
      .insert({ ...comune, name: `${MARCA} finger`, recipe_type: "finger", yield_quantity: 1, yield_unit: "pz" })
      .select()
      .single();
    finger = f.id;
    await titolare
      .from("recipe_ingredients")
      .insert({ recipe_id: finger, component_recipe_id: comp, quantity: 1, unit: "kg" });

    const { data: s } = await titolare
      .from("recipes")
      .insert({ ...comune, name: `${MARCA} selezione`, recipe_type: "piatto_finito" })
      .select()
      .single();
    selez = s.id;
    const { data: riga } = await titolare
      .from("recipe_ingredients")
      .insert({ recipe_id: selez, component_recipe_id: finger, quantity: QUANTI, unit: "pz" })
      .select()
      .single();
    rigaSelez = riga.id;
  });

  afterAll(async () => {
    await pulisci();
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
  });

  it("comporre la selezione ha già scritto la sua storia, e il numero è quello giusto", async () => {
    const voci = await storicoCostoRicetta(selez);
    expect(voci.length, "la selezione non ha nessuna voce").toBeGreaterThan(0);
    // 6 finger × 1 kg × 2,00 = 12,00
    expect(Number(voci[0].food_cost_base)).toBeCloseTo(QUANTI * PREZZO, 4);
  });

  it("il rincaro dell'ingrediente arriva in cima alla catena, con la ragione", async () => {
    await titolare.from("ingredients").update({ current_price: 3.0 }).eq("id", ing);
    const voci = await storicoCostoRicetta(selez);
    expect(Number(voci[0].food_cost_base)).toBeCloseTo(QUANTI * 3.0, 4);
    expect(voci[0].causa).toBe("prezzo");
    expect(voci[0].dettaglio, "la voce non dice cosa l'ha causata").toContain("melanzana");
  });

  it("salvare senza cambiare niente NON scrive nessuna voce", async () => {
    // 🔴 È la prova che distingue «registra i cambiamenti» da «registra i
    // salvataggi»: senza, il registro si riempie di righe identiche e la
    // domanda «quanto costava a ottobre» affoga.
    const prima = (await storicoCostoRicetta(selez)).length;
    await titolare.from("recipe_ingredients").update({ quantity: QUANTI }).eq("id", rigaSelez);
    await titolare.from("ingredients").update({ current_price: 3.0 }).eq("id", ing);
    const dopo = (await storicoCostoRicetta(selez)).length;
    expect(dopo, "un salvataggio senza modifiche ha scritto una voce").toBe(prima);
  });

  it("il costo di prima resta quello di prima, e quello di adesso cambia", async () => {
    // ⚠️ Si leggono ENTRAMBE le date: guardando solo l'ultima, un registro
    // che riscrivesse la storia passata sembrerebbe corretto.
    // 🔴 L ISTANTE SI CHIEDE AL DATABASE, NON ALL OROLOGIO DEL BROWSER.
    // Con `new Date()` questa prova e diventata rossa dicendo 12 invece di
    // 18: i due orologi non sono lo stesso orologio, e bastano pochi
    // millisecondi di scarto perche il confronto scelga la voce di prima.
    // Stessa famiglia di «un numero si chiede al database».
    const quando = (await storicoCostoRicetta(selez))[0].rilevato_il;
    await new Promise((r) => setTimeout(r, 50));
    await titolare.from("recipe_ingredients").update({ quantity: 3 }).eq("id", rigaSelez);

    const allora = await costoRicettaAllaData(selez, quando);
    expect(allora, "di quel momento non risulta niente").not.toBeNull();
    expect(Number(allora.food_cost_base)).toBeCloseTo(QUANTI * 3.0, 4);

    const adesso = await storicoCostoRicetta(selez);
    expect(Number(adesso[0].food_cost_base)).toBeCloseTo(3 * 3.0, 4);
    expect(adesso[0].causa).toBe("quantita");
  });

  it("prima che la ricetta esistesse la risposta è VUOTA, non zero", async () => {
    // ⚠️ «Non lo so» e «costava zero» sono due cose diverse: è la regola
    // applicata quattro volte in questi giorni.
    const allora = await costoRicettaAllaData(selez, "1995-01-01T00:00:00Z");
    expect(allora).toBeNull();
  });

  it("un ingrediente senza prezzo rende il costo PARZIALE, e si vede", async () => {
    const { data: i2 } = await titolare
      .from("ingredients")
      .insert({ entity_id: ente, name: `${MARCA} mai comprato`, category: "verdura", unit: "kg", current_price: 5 })
      .select()
      .single();
    await titolare
      .from("recipe_ingredients")
      .insert({ recipe_id: base, ingredient_id: i2.id, quantity: 1, unit: "kg" });
    await titolare.from("ingredients").update({ current_price: 0 }).eq("id", i2.id);

    const voci = await storicoCostoRicetta(selez);
    expect(voci[0].parziale, "un costo parziale non è dichiarato").toBe(true);
    expect(voci[0].righe_senza_prezzo).toBeGreaterThan(0);
  });

  it("lo staff non può leggere lo storico dei costi", async () => {
    const staff = await clientAutenticato(credenziali().staff);
    const { error } = await staff.rpc("storico_costo_ricetta", { p_recipe_id: selez });
    expect(error, "lo staff ha letto i costi").not.toBeNull();
    await staff.auth.signOut({ scope: "local" });
  });
});
