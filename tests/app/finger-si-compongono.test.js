import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, primaEntita } from "./aiuto";
import { duplicaRicetta, listPreparations, listRecipeCostsFor } from "../../src/lib/api/recipes";
// ⚠️ `listPreparations` usa il collegamento dell'APP, non quello della prova:
// senza entrare anche da lì risponderebbe «permission denied» e la prova
// direbbe una cosa falsa sul motivo. È la lezione del 18/08, ed è costata
// un giro anche stavolta.
import { listRecipeIngredients } from "../../src/lib/api/recipeIngredients";
import { supabase } from "../../src/lib/supabase";

// I FINGER SI COMPONGONO — blocco 1 del mandato dei finger food.
//
// ⚠️ La migrazione prova già queste regole, ma **gira come proprietaria del
// database**: lì la RLS non esiste e i permessi non si vedono (buco
// strutturale dichiarato il 16/08). Queste prove entrano col token di un
// utente vero, ed è l'unico modo di sapere che la cosa funziona anche
// **dall'app**.
//
// ⚠️ E la selezione è da SEI finger, non da due: è il numero di cui parla
// Alessio, e serve a distinguere le tre risposte possibili allo scarico di
// magazzino — 2 pezzi per tipo (giusto), 1 (le porzioni ignorate), 6 (i
// finger contati come porzioni).
// ⚠️ IL MARCHIO E' DI QUESTO GIRO, dal 01/09/2026: le pulizie e i
//    conteggi qui sotto usano questo valore in un modello `like`, e con
//    un valore fisso due esecuzioni insieme sullo stesso progetto di
//    prova si cancellano e si contano le righe a vicenda. Vedi la nota
//    in cima a `aiuto.js`.
const MARCA = marchio("TEST-AUTO finger");
const QUANTI = 6;
const GRAMMI = 0.010; // 10 g a finger, a 20 €/kg → 0,20 € l'uno

describe("i finger si compongono, e un piatto finito no", () => {
  let titolare;
  let ente;
  let ingrediente;
  let fingers = [];
  let selezione;
  let piatto;

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

    const { data: ing } = await titolare
      .from("ingredients")
      .insert({ entity_id: ente, name: `${MARCA} alice`, category: "pesce", unit: "kg", current_price: 20 })
      .select()
      .single();
    ingrediente = ing.id;

    const { data: creati, error } = await titolare
      .from("recipes")
      .insert(
        Array.from({ length: QUANTI }, (_, i) => ({
          name: `${MARCA} finger ${i}`,
          category: "antipasto",
          portions_yield: 1,
          recipe_type: "finger",
          yield_quantity: 1,
          yield_unit: "pz",
        }))
      )
      .select();
    expect(error, "non sono riuscito a creare i finger").toBeNull();
    fingers = creati.map((r) => r.id);

    const { data: sel } = await titolare
      .from("recipes")
      .insert({ name: `${MARCA} selezione`, category: "antipasto", portions_yield: 1, recipe_type: "piatto_finito" })
      .select()
      .single();
    selezione = sel.id;

    const { data: pia } = await titolare
      .from("recipes")
      .insert({ name: `${MARCA} altro piatto`, category: "secondo", portions_yield: 1, recipe_type: "piatto_finito" })
      .select()
      .single();
    piatto = pia.id;

    await titolare
      .from("recipe_ingredients")
      .insert(fingers.map((id) => ({ recipe_id: id, ingredient_id: ingrediente, quantity: GRAMMI, unit: "kg" })));
    const { error: eComp } = await titolare
      .from("recipe_ingredients")
      .insert(fingers.map((id) => ({ recipe_id: selezione, component_recipe_id: id, quantity: 1, unit: "pz" })));
    expect(eComp, "un finger non è potuto entrare nella selezione").toBeNull();
  });

  afterAll(async () => {
    await pulisci();
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
  });

  it("una selezione da sei finger costa la somma dei sei", async () => {
    const { data, error } = await titolare
      .from("v_recipe_costs")
      .select("food_cost_base")
      .eq("recipe_id", selezione)
      .single();
    expect(error).toBeNull();
    // 6 × 10 g × 20 €/kg = 1,20 €
    expect(Number(data.food_cost_base)).toBeCloseTo(QUANTI * GRAMMI * 20, 4);
  });

  // 🔴 LO SCARICO DI DUE PORZIONI — «due pezzi per tipo, non uno e non sei» —
  // È PROVATO DENTRO LA MIGRAZIONE, e non qui, per una ragione che va detta:
  // `fabbisogno_conto` NON è concessa all'app (permission denied), ed è
  // giusto così — la chiama `scarica_magazzino_conto` alla chiusura del
  // conto, non una schermata. Provarla da qui vorrebbe dire aprire una porta
  // per comodità di prova, che è precisamente ciò che il 16/08 si è deciso
  // di non fare.
  // ⚠️ Il prezzo di questa scelta, dichiarato: quella regola è provata come
  // proprietaria del database, dove la RLS non esiste.

  it("lo stesso finger non entra due volte nella stessa selezione", async () => {
    const { error } = await titolare
      .from("recipe_ingredients")
      .insert({ recipe_id: selezione, component_recipe_id: fingers[0], quantity: 1, unit: "pz" });
    expect(error, "lo stesso finger è entrato due volte").not.toBeNull();
  });

  it("un piatto finito NON entra dentro un altro piatto: la protezione si è ristretta, non tolta", async () => {
    const { error } = await titolare
      .from("recipe_ingredients")
      .insert({ recipe_id: selezione, component_recipe_id: piatto, quantity: 1, unit: "pz" });
    expect(error, "un piatto finito è entrato dentro un altro piatto").not.toBeNull();
  });

  it("un finger senza resa viene respinto", async () => {
    // ⚠️ È il buco che il tipo nuovo aprirebbe: senza resa il calcolo del
    // costo e dello scarico dà NULL, e la merce sparisce senza errore.
    const { error } = await titolare.from("recipes").insert({
      name: `${MARCA} senza resa`,
      category: "antipasto",
      portions_yield: 1,
      recipe_type: "finger",
    });
    expect(error, "un finger senza resa è stato accettato").not.toBeNull();
  });

  it("un finger NON si può produrre: resta fuori dalle Produzioni", async () => {
    const { error } = await titolare.rpc("registra_produzione", {
      p_recipe_id: fingers[0],
      p_dosi: 1,
      p_quantita_ottenuta: 1,
      p_scadenza: null,
      p_note: MARCA,
    });
    expect(error, "un finger è entrato nelle Produzioni").not.toBeNull();
  });

  it("il prezzo a pezzo sta sul finger, e vuoto resta vuoto", async () => {
    // ⚠️ Il prezzo a pezzo serve ai clienti che si scelgono i finger per
    // un evento. **Non è un secondo prezzo dello stesso oggetto** (decisione
    // di Alessio): quello della carta è di un piatto, questo di un finger.
    const { error: eOk } = await titolare
      .from("recipes")
      .update({ prezzo_al_pezzo: 2.5 })
      .eq("id", fingers[0]);
    expect(eOk, "un finger non ha accettato il prezzo a pezzo").toBeNull();

    const { data } = await titolare
      .from("recipes")
      .select("prezzo_al_pezzo")
      .eq("id", fingers[0])
      .single();
    expect(Number(data.prezzo_al_pezzo)).toBeCloseTo(2.5, 2);

    // Vuoto = «non l'ho ancora deciso», che è diverso da gratis.
    const { error: eVuoto } = await titolare
      .from("recipes")
      .update({ prezzo_al_pezzo: null })
      .eq("id", fingers[0]);
    expect(eVuoto).toBeNull();
  });

  it("un piatto finito NON può avere un prezzo a pezzo", async () => {
    // Lì sarebbe davvero un secondo prezzo accanto a quello della carta —
    // ed è la metà della contraddizione che si può impedire.
    const { error } = await titolare
      .from("recipes")
      .update({ prezzo_al_pezzo: 9 })
      .eq("id", piatto);
    expect(error, "un piatto finito ha accettato un prezzo a pezzo").not.toBeNull();
  });

  it("una riga di componente porta con sé il TIPO, o l'etichetta mente", async () => {
    // ⚠️ Senza `recipe_type` nell'incorporamento non ci sarebbe nessun
    // errore: la scheda scriverebbe «preparazione» sotto ogni finger.
    // È la famiglia di difetto vista tre volte in tre giorni — due parti
    // dello stesso programma che raccontano cose diverse dello stesso fatto.
    const righe = await listRecipeIngredients(selezione);
    const comp = righe.filter((r) => r.component);
    expect(comp.length, "la selezione non ha componenti").toBe(QUANTI);
    expect(
      comp.every((r) => r.component.recipe_type === "finger"),
      "il tipo del componente non arriva alla schermata"
    ).toBe(true);
  });

  it("il costo di ogni finger si legge in una volta sola", async () => {
    // Alimenta la cifra accanto a ogni spunta: senza, si compone al buio.
    const costi = await listRecipeCostsFor(fingers);
    expect(Object.keys(costi).length).toBe(QUANTI);
    for (const id of fingers) expect(costi[id]).toBeCloseTo(GRAMMI * 20, 4);
  });

  it("una selezione si copia INTERA, e la copia costa quanto l'originale", async () => {
    // 🔴 Passa dal corridoio: un'operazione non in elenco risponde 404, e
    // nessuna prova SQL se ne accorgerebbe.
    // ⚠️ E il controllo che conta è il COSTO, non il numero di righe: righe
    // copiate senza la quantità darebbero sei righe e zero euro.
    const esito = await duplicaRicetta(selezione, `${MARCA} copia`);
    expect(esito.righe, "la copia non ha portato tutte le righe").toBe(QUANTI);

    const [{ data: orig }, { data: copia }] = await Promise.all([
      titolare.from("v_recipe_costs").select("food_cost_base").eq("recipe_id", selezione).single(),
      titolare.from("v_recipe_costs").select("food_cost_base").eq("recipe_id", esito.id).single(),
    ]);
    expect(Number(copia.food_cost_base)).toBeCloseTo(Number(orig.food_cost_base), 4);
    expect(Number(orig.food_cost_base)).toBeGreaterThan(0);

    // «Pronta per carta» non si eredita: la copia non l'ha riletta nessuno.
    const { data: nuova } = await titolare
      .from("recipes")
      .select("name, pronta_per_carta")
      .eq("id", esito.id)
      .single();
    expect(nuova.pronta_per_carta).toBe(false);
    expect(nuova.name).toBe(`${MARCA} copia`);
  });

  it("i finger si possono scegliere come componente dall'app", async () => {
    // ⚠️ Senza questo il database permetterebbe una cosa che nessuna
    // schermata può fare: codice che nessuno chiama (lezione del 18/08).
    const elenco = await listPreparations({});
    const nomi = elenco.map((r) => r.name);
    expect(nomi, "i finger non compaiono fra i componenti proponibili").toContain(`${MARCA} finger 0`);
    expect(nomi, "un piatto finito è comparso fra i componenti proponibili").not.toContain(`${MARCA} altro piatto`);
  });
});
