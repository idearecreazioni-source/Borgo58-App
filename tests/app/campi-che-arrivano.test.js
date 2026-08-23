import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import { createIngredient, getIngredient } from "../../src/lib/api/ingredients";

// 🔴 I CAMPI DELLA SCHEDA ARRIVANO DAVVERO AL DATABASE (23/08/2026).
//
// Perché questa prova esiste, e perché guarda TUTTI i campi insieme invece
// che uno per uno. Il 23/08 si è misurato che `create_ingredient` non aveva
// mai avuto il parametro `alimentare`: la casella «È un alimento» si vedeva
// sulla scheda dal 12/08, si toglieva, si salvava **senza errore**, e ogni
// prodotto nuovo nasceva alimentare lo stesso. Undici giorni, e nessuno se
// n'era accorto — perché un campo che non arriva non fa rumore.
//
// È la trappola del 16/08 alla terza ricomparsa (le mance su carta che
// finivano nel contante): *un valore che si vede nella schermata non è un
// valore che arriva al database*. E l'unica rete che la prende è una prova
// che passa dal **client vero**, con tutti i campi in uno stato diverso dal
// predefinito — perché con i predefiniti il risultato è giusto per caso.
const NOME = "TEST-AUTO campi che arrivano";

describe("i campi della scheda prodotto arrivano al database", () => {
  let titolare;
  let ente;
  let creato;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    ente = await primaEntita(titolare);
    // Le funzioni di api/ingredients.js passano dal corridoio, che usa il
    // collegamento dell'APP: con un client proprio parlerebbe da anonima.
    await supabase.auth.signInWithPassword(credenziali().titolare);
    const { data: vecchi } = await titolare.from("ingredients").select("id").eq("name", NOME);
    for (const v of vecchi ?? []) {
      await titolare.from("price_history").delete().eq("ingredient_id", v.id);
      await titolare.from("ingredients").delete().eq("id", v.id);
    }
  });

  afterAll(async () => {
    if (creato) {
      await titolare.from("price_history").delete().eq("ingredient_id", creato);
      await titolare.from("ingredients").delete().eq("id", creato);
    }
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
  });

  it("ogni campo scritto sulla scheda si rilegge uguale", async () => {
    // ⚠️ TUTTI diversi dal predefinito. Con i valori di partenza questa
    // prova passerebbe anche se il filo fosse staccato: è esattamente il
    // motivo per cui il difetto è vissuto undici giorni.
    const scritto = {
      entity_id: ente,
      name: NOME,
      category: "altro",
      unit: "pz",
      current_price: 3.5,
      allergens: ["glutine", "soia"],
      seasonality: ["mar", "apr"],
      storage_type: "freezer",
      shelf_life_days: 17,
      waste_percentage_default: 7,
      stock_minimum_threshold: 4,
      temperatura_attesa: "-18 °C",
      haccp_notes: "TEST-AUTO nota",
      alimentare: false,
      tenuto_in_magazzino: false,
    };

    const r = await createIngredient(scritto);
    creato = r.id;
    const letto = await getIngredient(creato);

    const differenze = [];
    for (const [campo, atteso] of Object.entries(scritto)) {
      if (campo === "entity_id") continue;
      const trovato = letto[campo];
      const uguale = Array.isArray(atteso)
        ? JSON.stringify([...(trovato ?? [])].sort()) === JSON.stringify([...atteso].sort())
        : String(trovato) === String(atteso);
      if (!uguale) differenze.push(`${campo}: scritto ${JSON.stringify(atteso)}, riletto ${JSON.stringify(trovato)}`);
    }
    // Un elenco invece di un'asserzione per campo: quando si rompe, dice
    // TUTTO quello che non arriva, non solo il primo.
    expect(differenze).toEqual([]);
  });
});
