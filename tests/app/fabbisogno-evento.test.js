import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita } from "./aiuto";
import { fabbisognoEvento } from "../../src/lib/api/reservations";
import { supabase } from "../../src/lib/supabase";

// IL FABBISOGNO DI UN EVENTO — blocco 0 del mandato dei preventivi.
//
// 🔴 QUESTA PROVA È STATA SCRITTA PRIMA DELLA RIPARAZIONE, ed è stata vista
// diventare rossa: altrimenti non si sa se si sta riparando quello che si
// crede. Il difetto era che il fabbisogno di un evento si calcolava nel
// browser guardando i soli ingredienti diretti — su un piatto con dentro una
// preparazione non dava un numero sbagliato, **si rompeva**.
//
// 🔴 LA CATENA È A QUATTRO LIVELLI, perché Alessio scompone sempre:
//   ingrediente → preparazione → preparazione → bocconcino → piatto → menu
//
// ⚠️ E I NUMERI SONO SCELTI PERCHÉ DISTINGUANO. Con 8 persone su un piatto da
// 4 porzioni, cioè 2 dosi:
//   · dal bocconcino: 2 × 6 pz × 1 kg = 12,000 kg
//   · dall'ingrediente diretto: 2 × 0,5 kg + 20% di scarto = 1,200 kg
//   · totale giusto 13,200 kg → 26,40 €
// Le risposte sbagliate danno numeri tutti diversi: 1,200 (catena persa),
// 13,000 (scarto ignorato), 52,800 (porzioni ignorate).
const MARCA = "TEST-AUTO evento";
const PERSONE = 8;
const PORZIONI = 4;
const PEZZI = 6;
const DIRETTO = 0.5;
const SCARTO = 20;
const PREZZO = 2;
const ATTESO_KG = 13.2;

describe("il fabbisogno di un evento regge tutta la catena", () => {
  let titolare;
  let ente;
  let ing;
  let menu;

  async function pulisci() {
    const { data: menus } = await titolare.from("menus").select("id").like("name", `${MARCA}%`);
    for (const m of menus ?? []) {
      await titolare.from("menu_items").delete().eq("menu_id", m.id);
      await titolare.from("menus").delete().eq("id", m.id);
    }
    const { data: ricette } = await titolare.from("recipes").select("id").like("name", `${MARCA}%`);
    const ids = (ricette ?? []).map((r) => r.id);
    if (ids.length) {
      await titolare.from("recipe_ingredients").delete().in("recipe_id", ids);
      await titolare.from("recipe_ingredients").delete().in("component_recipe_id", ids);
      await titolare.from("recipes").delete().in("id", ids);
    }
    await titolare.from("ingredients").delete().like("name", `${MARCA}%`);
  }

  async function ricetta(nome, campi) {
    const { data, error } = await titolare
      .from("recipes")
      .insert({ name: `${MARCA} ${nome}`, category: "antipasto", ...campi })
      .select()
      .single();
    expect(error, `non ho potuto creare ${nome}`).toBeNull();
    return data.id;
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
      .insert({
        entity_id: ente,
        name: `${MARCA} alice`,
        category: "pesce",
        unit: "kg",
        current_price: PREZZO,
        waste_percentage_default: 0,
      })
      .select()
      .single();
    ing = i.id;

    const p1 = await ricetta("base", {
      portions_yield: 1,
      recipe_type: "preparazione",
      yield_quantity: 1,
      yield_unit: "kg",
    });
    await titolare
      .from("recipe_ingredients")
      .insert({ recipe_id: p1, ingredient_id: ing, quantity: 1, unit: "kg" });

    const p2 = await ricetta("comp", {
      portions_yield: 1,
      recipe_type: "preparazione",
      yield_quantity: 1,
      yield_unit: "kg",
    });
    await titolare
      .from("recipe_ingredients")
      .insert({ recipe_id: p2, component_recipe_id: p1, quantity: 1, unit: "kg" });

    const finger = await ricetta("finger", {
      portions_yield: 1,
      recipe_type: "finger",
      yield_quantity: 1,
      yield_unit: "pz",
    });
    await titolare
      .from("recipe_ingredients")
      .insert({ recipe_id: finger, component_recipe_id: p2, quantity: 1, unit: "kg" });

    const piatto = await ricetta("piatto", {
      portions_yield: PORZIONI,
      recipe_type: "piatto_finito",
      pronta_per_carta: true,
    });
    await titolare.from("recipe_ingredients").insert([
      { recipe_id: piatto, component_recipe_id: finger, quantity: PEZZI, unit: "pz" },
      // ⚠️ Con lo scarto: senza questa riga la prova non guarderebbe lo scarto.
      { recipe_id: piatto, ingredient_id: ing, quantity: DIRETTO, unit: "kg", waste_percentage: SCARTO },
    ]);

    const { data: m } = await titolare
      .from("menus")
      .insert({ name: `${MARCA} menu`, structure: "alla_carta", is_active: false })
      .select()
      .single();
    menu = m.id;
    await titolare
      .from("menu_items")
      .insert({ menu_id: menu, recipe_id: piatto, category: "antipasto", selling_price: 30 });
  });

  afterAll(async () => {
    await pulisci();
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
  });

  it("un piatto con dentro una preparazione dà un numero, e quel numero è giusto", async () => {
    // 🔴 È LA PROVA CHE PRIMA DELLA RIPARAZIONE FALLIVA, e non con un numero
    // sbagliato: con «Cannot read properties of null», perché la riga del
    // componente non ha nessun ingrediente di cui leggere il prezzo.
    const righe = await fabbisognoEvento(menu, PERSONE);
    const mia = righe.find((r) => r.ingredient_id === ing);
    expect(mia, "l'ingrediente non compare nel fabbisogno").toBeTruthy();
    expect(Number(mia.quantita)).toBeCloseTo(ATTESO_KG, 3);
    expect(Number(mia.costo)).toBeCloseTo(ATTESO_KG * PREZZO, 2);
  });

  it("nessuna riga senza ingrediente esce dal calcolo", async () => {
    // ⚠️ Il difetto vecchio produceva una voce con l'ingrediente vuoto: se
    // ricomparisse, il totale sarebbe giusto e l'elenco mostrerebbe una riga
    // senza nome — il modo silenzioso di rompersi.
    const righe = await fabbisognoEvento(menu, PERSONE);
    expect(righe.every((r) => r.ingredient_id && r.nome)).toBe(true);
  });

  it("lo scarto cambia il risultato", async () => {
    // ⚠️ Senza questo confronto la prova non starebbe guardando lo scarto:
    // passerebbe anche un calcolo che lo ignora del tutto.
    const conScarto = await fabbisognoEvento(menu, PERSONE);
    const prima = Number(conScarto.find((r) => r.ingredient_id === ing).quantita);

    const { data: riga } = await titolare
      .from("recipe_ingredients")
      .select("id")
      .eq("ingredient_id", ing)
      .not("waste_percentage", "is", null)
      .single();
    await titolare.from("recipe_ingredients").update({ waste_percentage: 0 }).eq("id", riga.id);

    const senzaScarto = await fabbisognoEvento(menu, PERSONE);
    const dopo = Number(senzaScarto.find((r) => r.ingredient_id === ing).quantita);

    await titolare.from("recipe_ingredients").update({ waste_percentage: SCARTO }).eq("id", riga.id);

    expect(dopo, "lo scarto non cambia niente: il calcolo non lo guarda").toBeLessThan(prima);
    expect(dopo).toBeCloseTo(ATTESO_KG - DIRETTO * (PERSONE / PORZIONI) * (SCARTO / 100), 3);
  });
});
