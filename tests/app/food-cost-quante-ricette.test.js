import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";

// SU QUANTE RICETTE POGGIA LA GARANZIA DEL FOOD COST — 28/08/2026.
//
// 🔴 NASCE DA UN RILIEVO DI ALESSIO, non da un sospetto tecnico. Il
// riepilogo del 27/08 diceva due numeri per la stessa cosa: in apertura
// «la prova ha 116 ricette», e poi la misura di garanzia — «il food cost
// non si è mosso» — dichiarata su **106 ricette, 481,7078**. Dieci di
// differenza, mai spiegate. Ed è la garanzia su cui poggiava tutto il
// blocco della separazione prodotto / ingrediente.
//
// LA MISURA, rifatta il 28/08 sul progetto di prova:
//
//   ricette totali .................................. 116
//   righe di `v_recipe_costs` ....................... 116  ← nessuna esclusa
//   ricette con almeno una riga di ingredienti ...... 106
//   ricette senza nessuna riga di ingredienti ....... 10
//   somma dei food_cost_base su tutte e 116 ......... 481,7078
//   somma sulle sole 106 ............................ 481,7078
//
// ⚠️ I DUE NUMERI NON ERANO IN CONTRADDIZIONE: erano due conteggi diversi
// — le ricette che esistono e le ricette che hanno qualcosa da costare —
// e nessuno diceva quale fosse quale. Il totale non cambia includendo le
// dieci, **perché contribuiscono zero**.
//
// 🔴 E LA CONSEGUENZA È QUELLA CHE ALESSIO HA NOMINATO: *una ricetta a
// costo zero non è una ricetta verificata*. Le dieci sono ricette **senza
// ingredienti** — Anelletti al forno, Cassata siciliana, Sarde a
// beccafico e altre sette — e il loro zero è uno zero **per costruzione**,
// non una misura. Quindi la garanzia «il food cost non si è mosso» vale
// su **106 ricette**, non su 116: sulle altre dieci non c'era niente da
// muovere.
describe("su quante ricette poggia il food cost", () => {
  let titolare;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
  });

  afterAll(async () => {
    await titolare?.auth.signOut({ scope: "local" });
  });

  it("nessuna ricetta è esclusa dal calcolo: la vista ne ha quante ne esistono", async () => {
    // ⚠️ È la prima metà della risposta, e da sola non basta: dice che il
    // calcolo non perde nessuno, non che risponde per tutti.
    const { count: ricette } = await titolare
      .from("recipes")
      .select("*", { count: "exact", head: true });
    const { count: calcolate } = await titolare
      .from("v_recipe_costs")
      .select("*", { count: "exact", head: true });

    expect(calcolate).toBe(ricette);
  });

  it("🔴 uno zero nel food cost è solo una ricetta senza ingredienti", async () => {
    // È la proprietà che vale più del totale, e il totale non la mostra:
    // uno zero si somma come niente, quindi una ricetta il cui costo
    // crollasse a zero **non farebbe cambiare nessun numero di garanzia**
    // se già fosse zero, e ne farebbe cambiare uno solo se non lo era.
    //
    // ⚠️ Qui si guarda il MOTIVO dello zero, non la sua quantità: se una
    // ricetta CON ingredienti costa zero, o un ingrediente non ha prezzo o
    // il calcolo l'ha perso — e in tutti e due i casi quel numero si legge
    // «piatto economico» ed è invece «non lo so».
    const { data: costi, error } = await titolare
      .from("v_recipe_costs")
      .select("recipe_id, food_cost_base");
    expect(error).toBeNull();

    const { data: righe } = await titolare.from("recipe_ingredients").select("recipe_id");
    const conIngredienti = new Set((righe ?? []).map((r) => r.recipe_id));

    const zeriSospetti = (costi ?? [])
      .filter((c) => Number(c.food_cost_base ?? 0) === 0)
      .filter((c) => conIngredienti.has(c.recipe_id))
      .map((c) => c.recipe_id);

    expect(
      zeriSospetti,
      `ricette con ingredienti e food cost zero: ${zeriSospetti.join(", ")}`
    ).toEqual([]);
  });

  it("e nessuna riga di ricetta punta a un ingrediente senza prezzo", async () => {
    // ⚠️ È il caso che la prova qui sopra NON prende: un ingrediente senza
    // prezzo dentro una ricetta che ne ha altri quattro non porta il
    // totale a zero — lo porta **più in basso del vero**, in silenzio.
    // Misurato il 28/08: 133 ingredienti, nessuno senza prezzo, 16 a
    // prezzo zero, e **nessuno dei 16 compare in una ricetta**.
    const { data: righe, error } = await titolare
      .from("recipe_ingredients")
      .select("recipe_id, ingredient_id");
    expect(error).toBeNull();

    const { data: ingredienti } = await titolare.from("ingredients").select("id, current_price");
    const senzaPrezzo = new Set(
      (ingredienti ?? []).filter((i) => !Number(i.current_price)).map((i) => i.id)
    );

    const scoperte = (righe ?? [])
      .filter((r) => senzaPrezzo.has(r.ingredient_id))
      .map((r) => r.recipe_id);

    expect(
      scoperte,
      `ricette che contengono un ingrediente senza prezzo: ${[...new Set(scoperte)].join(", ")}`
    ).toEqual([]);
  });
});
