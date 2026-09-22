import { readdirSync } from "node:fs";
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
// ---------------------------------------------------------------------
// 🔴 QUESTE PROVE GIRANO SOLO DOVE R12 E' APPLICATA, E LO DICHIARANO
// ---------------------------------------------------------------------
// La migrazione `20260922000001` non e' ancora applicata su Prova (per
// mandato). Senza questa guardia le cinque prove qui sotto girerebbero su
// un database che non ha `recipe_ingredients.quantita_lorda`, e
// fallirebbero — ma **per il motivo sbagliato**: non perche' una regola sia
// rotta, perche' la regola non esiste ancora.
//
// ⚠️ E' la differenza fra una prova ROSSA e una prova che NON SI PUO'
//    ANCORA FARE. Confonderle ha un costo preciso: cinque rossi permanenti
//    in fondo alla suite sono cinque rossi che si impara a scavalcare, e il
//    giorno che uno di loro diventa rosso DAVVERO nessuno se ne accorge.
//
// ⚠️ SI SALTA, NON SI ADDOLCISCE. Le cinque prove restano identiche e
//    discriminanti: nessuna e' stata resa permissiva, nessuna e' diventata
//    una lettura del file della migrazione. Si riaccendono **da sole** il
//    giorno che la versione compare nel registro — e allora, se una regola
//    non regge, diventano rosse.
//
// Il modello e' quello di `silenzio-notifiche.test.js`; la lettura del
// registro e' quella di `vocabolari.test.js`.
const VERSIONE = "20260922000001";
const MARCA = marchio("TEST-AUTO resa vecchio client");

// 🔴 PRIMA DI TUTTO: LA VERSIONE ESISTE DAVVERO COME MIGRAZIONE?
//    Una versione scritta male qui non darebbe nessun errore: darebbe
//    «migrazione assente» per sempre, cioe' cinque prove spente in
//    silenzio — che e' precisamente il difetto che questo file esiste per
//    non creare. *Un interruttore che non si puo' piu' riaccendere non e'
//    un interruttore.*
const MIGRAZIONI = readdirSync("supabase/migrations").filter((f) => f.startsWith(VERSIONE));
if (MIGRAZIONI.length !== 1) {
  throw new Error(
    `Non trovo UNA migrazione ${VERSIONE} in supabase/migrations (ne ho trovate ` +
      `${MIGRAZIONI.length}). Finche' questa versione non corrisponde a un file, ` +
      `le prove di R12 resterebbero saltate per sempre senza che nessuno lo sappia.`
  );
}

// La sonda: un client autenticato che LEGGE e basta — nessuna riga scritta,
// nessuna tabella toccata, e la sessione si chiude subito.
const sonda = await clientAutenticato(credenziali().titolare);
const registro = await sonda.from("applied_migrations").select("version");
await sonda.auth.signOut({ scope: "local" });

// ⚠️ DUE MODI DI FALLIRE, E SI SOMIGLIANO. Il primo e' rumoroso.
if (registro.error) {
  throw new Error(
    `Non riesco a leggere il registro delle migrazioni: ${registro.error.message}. ` +
      `Non so in quale dei due momenti si trova questo database, e NON tiro a indovinare: ` +
      `dedurre «migrazione assente» da un errore di lettura spegnerebbe le prove di R12 ` +
      `proprio quando servono.`
  );
}

// 🔴 E IL SECONDO E' MUTO, ed e' quello pericoloso: quando una lettura non
//    e' permessa, PostgREST non risponde con un errore — risponde con ZERO
//    RIGHE. Zero righe si leggerebbe «nessuna migrazione applicata», cioe'
//    «salta tutto»: plausibile e falso. In un database vero quel registro ne
//    ha centinaia. *Vuoto non e' zero* (19/08).
if ((registro.data ?? []).length === 0) {
  throw new Error(
    "Il registro delle migrazioni e' tornato VUOTO. In un database vero non puo' " +
      "esserlo: vuol dire che non si e' potuto leggere. Mi fermo invece di dedurre " +
      "che R12 non sia applicata."
  );
}

const APPLICATA = registro.data.some((r) => r.version === VERSIONE);
if (!APPLICATA) {
  console.warn(
    `⚠️  resa-vecchio-client: la migrazione ${VERSIONE} (R12) non è applicata su ` +
      `questo database, le 5 prove sono SALTATE. Non è un difetto: la colonna ` +
      `quantita_lorda e il trigger del riflesso non esistono ancora. Si riaccendono ` +
      `da sole quando la migrazione viene applicata.`
  );
}

describe.skipIf(!APPLICATA)("R12: il vecchio formato e il nuovo, discriminati", () => {
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
