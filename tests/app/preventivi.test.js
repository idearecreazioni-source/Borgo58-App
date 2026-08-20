import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita } from "./aiuto";
import {
  fabbisognoPreventivo,
  getPreventivo,
  nuovaVersionePreventivo,
  prezzoPreventivo,
  salvaPreventivo,
} from "../../src/lib/api/preventivi";
import { supabase } from "../../src/lib/supabase";

// I PREVENTIVI — blocco 1 del mandato.
//
// 🔴 I NUMERI SONO SCELTI PERCHÉ DISTINGUANO. 10 persone, un piatto da 4
// porzioni preso a MEZZA porzione a testa = 1,25 dosi × 2 kg × 4 €/kg =
// 10,00 € di cibo. Più un extra da 120 €. Food cost obiettivo 25%: il cibo
// pesa un QUARTO del prezzo, quindi 10 € di cibo si vendono a 40 €.
//   ✅ giusto: 10 / 0,25 = 40 di cibo venduto, + 120 = 160 → 16,00 a persona
//   ✗ porzioni ignorate:           il costo raddoppia → 20,00
//   ✗ food cost anche sugli extra: (10+120)/0,25 → 52,00
//   ✗ letto come «+25%»:           10 × 1,25 + 120 → 13,25
//   ✗ costo da un secondo posto:    0,00
// Sono tutte diverse: con numeri comodi avrebbero coinciso.
const MARCA = "TEST-AUTO preventivo";
const PERSONE = 10;
const FOOD_COST = 25;
const EXTRA = 120;
const COSTO_CIBO = 10;

describe("il preventivo esiste, e tiene separati il prezzo e il costo", () => {
  let titolare;
  let ente;
  let ing;
  let prep;
  let piatto;
  let prev;

  async function pulisci() {
    const { data: p } = await titolare.from("preventivi").select("id").like("cliente_nome", `${MARCA}%`);
    // ⚠️ Le versioni si cancellano prima delle originali: il collegamento è
    // `restrict`, ed è proprio la protezione che questo file verifica.
    for (const r of p ?? []) await titolare.from("preventivi").delete().eq("id", r.id).not("versione_di", "is", null);
    for (const r of p ?? []) await titolare.from("preventivi").delete().eq("id", r.id);
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
      .insert({
        entity_id: ente,
        name: `${MARCA} alice`,
        category: "pesce",
        unit: "kg",
        current_price: 4,
        waste_percentage_default: 0,
      })
      .select()
      .single();
    ing = i.id;

    const { data: p } = await titolare
      .from("recipes")
      .insert({
        name: `${MARCA} base`,
        category: "antipasto",
        portions_yield: 1,
        recipe_type: "preparazione",
        yield_quantity: 1,
        yield_unit: "kg",
      })
      .select()
      .single();
    prep = p.id;
    await titolare.from("recipe_ingredients").insert({ recipe_id: prep, ingredient_id: ing, quantity: 1, unit: "kg" });

    const { data: d } = await titolare
      .from("recipes")
      .insert({
        name: `${MARCA} piatto`,
        category: "antipasto",
        portions_yield: 4,
        recipe_type: "piatto_finito",
        pronta_per_carta: true,
      })
      .select()
      .single();
    piatto = d.id;
    await titolare
      .from("recipe_ingredients")
      .insert({ recipe_id: piatto, component_recipe_id: prep, quantity: 2, unit: "kg" });

    prev = await salvaPreventivo({
      testata: {
        entity_id: ente,
        cliente_nome: `${MARCA} cliente`,
        data_evento: "1995-09-10",
        persone: PERSONE,
        food_cost_obiettivo_percento: FOOD_COST,
      },
      righe: [
        { natura: "cibo", recipe_id: piatto, porzioni_per_persona: 0.5 },
        { natura: "extra", descrizione: "Cameriere in più", quantita: 1, prezzo: EXTRA },
      ],
    });
  });

  afterAll(async () => {
    await pulisci();
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
  });

  it("il costo arriva dalla catena e viene FOTOGRAFATO, con la sua data", async () => {
    const p = await getPreventivo(prev);
    expect(Number(p.costo_cibo)).toBeCloseTo(COSTO_CIBO, 2);
    // ⚠️ Senza la data, il numero non risponde più a «quanto costava allora».
    expect(p.costo_rilevato_il, "il costo è scritto senza dire quando").toBeTruthy();
  });

  it("il fabbisogno del preventivo è lo stesso numero del magazzino", async () => {
    // 🔴 Stessa funzione, stesso numero: se nascessero in due posti diversi,
    // prima o poi divergerebbero — e la differenza la vedrebbe un ospite.
    const righe = await fabbisognoPreventivo(prev);
    const mia = righe.find((r) => r.ingredient_id === ing);
    expect(mia, "l'ingrediente non compare").toBeTruthy();
    // 1,25 dosi × 2 kg = 2,5 kg
    expect(Number(mia.quantita)).toBeCloseTo(2.5, 4);
    expect(Number(mia.costo)).toBeCloseTo(COSTO_CIBO, 2);
  });

  it("la ricetta in carta resta INTATTA", async () => {
    // 🔴 È la prova che distingue «vale per l'evento» da «ho modificato la
    // ricetta»: le porzioni modificate vivono sul preventivo.
    const { data: r } = await titolare
      .from("recipes")
      .select("portions_yield")
      .eq("id", piatto)
      .single();
    expect(r.portions_yield).toBe(4);
    const { data: riga } = await titolare
      .from("recipe_ingredients")
      .select("quantity")
      .eq("recipe_id", piatto)
      .eq("component_recipe_id", prep)
      .single();
    expect(Number(riga.quantity)).toBe(2);
  });

  it("il food cost obiettivo vale sul SOLO cibo, e l'avvertenza dice il risultato", async () => {
    const p = await prezzoPreventivo(prev);
    // 10 / 0,25 = 40 di cibo venduto, + 120 di extra = 160 / 10 = 16,00.
    // ⚠️ 25 NON vuol dire «aggiungi il 25%»: vuol dire che il cibo pesa un
    // quarto del prezzo. Letto nell'altro modo farebbe 13,25.
    expect(Number(p.prezzo_a_persona)).toBeCloseTo(16, 2);
    expect(p.scavalcato).toBe(false);
    expect(p.avvertenza, "l'avvertenza non viaggia col numero").toContain("SOLO cibo");
    // ⚠️ E dice il RISULTATO, non solo la percentuale: una percentuale si
    // legge in due modi, un prezzo no.
    expect(p.avvertenza, "l'avvertenza non dice come si legge").toContain("40,00");
  });

  it("il prezzo scritto a mano vince, e resta anche cambiando il food cost dopo", async () => {
    await salvaPreventivo({
      id: prev,
      testata: {
        entity_id: ente,
        cliente_nome: `${MARCA} cliente`,
        data_evento: "1995-09-10",
        persone: PERSONE,
        prezzo_a_persona_scavalcato: 55,
      },
      righe: [
        { natura: "cibo", recipe_id: piatto, porzioni_per_persona: 0.5 },
        { natura: "extra", descrizione: "Cameriere in più", quantita: 1, prezzo: EXTRA },
      ],
    });
    const { data: prima } = await titolare
      .from("service_settings")
      .select("food_cost_obiettivo_percento")
      .eq("id", 1)
      .single();
    await titolare.from("service_settings").update({ food_cost_obiettivo_percento: 10 }).eq("id", 1);

    const p = await prezzoPreventivo(prev);

    await titolare
      .from("service_settings")
      .update({ food_cost_obiettivo_percento: prima.food_cost_obiettivo_percento })
      .eq("id", 1);

    expect(Number(p.prezzo_a_persona)).toBeCloseTo(55, 2);
    expect(p.scavalcato).toBe(true);
  });

  it("una versione nuova è COLLEGATA alla vecchia, e porta le righe", async () => {
    const nuova = await nuovaVersionePreventivo(prev);
    const p = await getPreventivo(nuova);
    expect(p.versione_di, "la versione nuova non è collegata: la storia è persa").toBe(prev);
    expect(p.righe.length).toBe(2);
    // ⚠️ Il costo si rifotografa: la versione nuova nasce oggi.
    expect(p.costo_rilevato_il).toBeTruthy();
  });

  it("il preventivo vecchio non si può cancellare lasciando la nuova orfana", async () => {
    const { error } = await titolare.from("preventivi").delete().eq("id", prev);
    expect(error, "la storia delle versioni è perdibile").not.toBeNull();
  });

  it("il nome del piatto arriva INSIEME alle righe", async () => {
    // ⚠️ Se l incorporamento smettesse di funzionare non ci sarebbe nessun
    // errore rosso: comparirebbe un trattino su ogni riga, cioe una
    // schermata che dice con calma che il menu e vuoto. Stessa forma del
    // difetto del 18/08 sulle prenotazioni senza tavolo.
    const p = await getPreventivo(prev);
    const cibo = p.righe.find((r) => r.natura === "cibo");
    expect(cibo.recipe, "il nome del piatto non arriva con la riga").toBeTruthy();
    expect(cibo.recipe.name).toContain("piatto");
  });

  it("lo staff non vede i preventivi", async () => {
    // Dentro c'è il costo, e il prezzo promesso a un cliente.
    const staff = await clientAutenticato(credenziali().staff);
    const { data } = await staff.from("preventivi").select("id").eq("id", prev);
    expect(data ?? []).toHaveLength(0);
    await staff.auth.signOut({ scope: "local" });
  });
});
