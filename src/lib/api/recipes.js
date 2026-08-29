import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// statusFilter: "in_carta" | "pronta" | "in_sviluppo" | undefined (tutte)
// 🔴 `selezioni` — 30/08/2026. Una SELEZIONE di finger è un `piatto_finito`
// di categoria `finger_food`: nel database non è un quarto tipo, ma per chi
// guarda è un'altra cosa e vuole un altro elenco. Tre valori e non due:
//   · `true`  → solo le selezioni;
//   · `false` → i piatti che NON sono selezioni (l'elenco «Piatti»);
//   · assente → non filtra (è così che si chiedono i finger singoli, dove
//     la distinzione non esiste).
// ⚠️ Senza il caso `false` una selezione comparirebbe in DUE elenchi, e chi
// la corregge in uno non saprebbe di averla corretta anche nell'altro.
export async function listRecipes({ search, category, statusFilter, tipo, selezioni } = {}) {
  let query = supabase.from("recipes").select("*").order("name");
  if (search) query = query.ilike("name", `%${search}%`);
  if (category) query = query.eq("category", category);
  if (tipo) query = query.eq("recipe_type", tipo);
  if (selezioni === true) query = query.eq("category", "finger_food");
  if (selezioni === false) query = query.neq("category", "finger_food");
  // ⚠️ I QUATTRO STATI (24/08): «ritirata» non è un quinto caso appiccicato
  // — entra anche nei filtri degli altri tre, perché un piatto ritirato NON
  // è «in sviluppo» solo perché non è pronto. Senza queste esclusioni una
  // ricetta ritirata ricomparirebbe fra quelle da lavorare, e l'elenco «in
  // sviluppo» direbbe che c'è del lavoro dove non ce n'è.
  if (statusFilter === "in_carta") query = query.eq("in_carta", true);
  if (statusFilter === "pronta")
    query = query.eq("pronta_per_carta", true).eq("in_carta", false).is("ritirata_il", null);
  if (statusFilter === "in_sviluppo")
    query = query.eq("pronta_per_carta", false).is("ritirata_il", null);
  if (statusFilter === "ritirata") query = query.not("ritirata_il", "is", null);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// GLI ALLERGENI DI TUTTE LE RICETTE, per filtrare l'elenco (24/08/2026).
//
// 🔴 SI LEGGONO INSIEME, non una ricetta per volta: l'elenco ne mostra
// decine e una lettura per riga sarebbe decine di richieste per aprire una
// schermata.
//
// ⚠️ E VIENE VIA ANCHE `allergeni_da_verificare`, che è la metà che conta:
// una ricetta i cui allergeni nessuno ha confermato **non si può dichiarare
// «senza glutine»**. È la lezione del 13/08 — un elenco allergeni vuoto si
// legge «non contiene allergeni», e su un'allergia quella lettura è un
// problema di salute prima che di software.
export async function listAllRecipeAllergens() {
  const { data, error } = await supabase
    .from("v_recipe_allergens")
    .select("recipe_id, allergens, allergeni_da_verificare");
  if (error) throw error;
  return data ?? [];
}

export async function getRecipe(id) {
  const { data, error } = await supabase.from("recipes").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createRecipe(payload) {
  const { data, error } = await supabase.from("recipes").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateRecipe(id, payload) {
  const { data, error } = await supabase
    .from("recipes")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Viste derivate (migrazione 0001): food cost e allergeni calcolati dal DB,
// non ricalcolati lato client — unica fonte di verità.
export async function getRecipeCost(recipeId) {
  const { data, error } = await supabase
    .from("v_recipe_costs")
    .select("*")
    .eq("recipe_id", recipeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ⚠️ Restituisce anche SE gli allergeni sono verificati, non solo quali.
// Un elenco vuoto può voler dire «non ne contiene» oppure «nessuno l'ha
// mai guardato»: in cucina, davanti a un cliente che chiede se un piatto
// contiene glutine, le due cose sono opposte e chi risponde deve saperlo.
export async function getRecipeAllergens(recipeId) {
  const { data, error } = await supabase
    .from("v_recipe_allergens")
    .select("*")
    .eq("recipe_id", recipeId)
    .maybeSingle();
  if (error) throw error;
  return {
    allergens: data?.allergens ?? [],
    // Nessuna riga = la ricetta non ha ingredienti: non c'è niente di
    // verificato, e nemmeno niente da verificare.
    daVerificare: data ? data.allergeni_da_verificare === true : false,
    ingredienti: data?.ingredienti_da_verificare ?? [],
    // «Può contenere tracce» è un'informazione diversa da «contiene», e
    // resta una lista a parte: sommarle rovinerebbe tutte e due.
    tracce: data?.tracce ?? [],
  };
}

export async function listRecipeStatusHistory(recipeId) {
  const { data, error } = await supabase
    .from("recipe_status_history")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listAllRecipeCosts() {
  const { data, error } = await supabase.from("v_recipe_costs").select("*");
  if (error) throw error;
  return data;
}

// Cosa può entrare dentro un'altra ricetta: le preparazioni **e i finger**.
//
// 🔴 I finger si sono aggiunti il 19/08/2026 (blocco 1 del mandato). Senza
// questa riga il database permetterebbe di comporre una selezione e nessuna
// schermata potrebbe farlo: *codice che nessuno chiama*, che è il difetto
// dichiarato il 18/08 sul legame conto-prenotazione.
//
// ⚠️ L'elenco dei tipi ammessi vive qui E nel trigger `check_recipe_component`,
// e i due dicono cose diverse: questo dice **cosa proporre**, quello dice
// **cosa è legale**. Non è un doppione da togliere — è il discriminante del
// 17/08: se dicessero esattamente la stessa cosa se ne toglierebbe uno.
// ⚠️ Ma se divergessero, la schermata proporrebbe qualcosa che il database
// rifiuta: si vedrebbe subito, con un errore rosso, e non in silenzio.
//
// excludeId: la ricetta corrente non può usare se stessa (già bloccato anche
// dal DB, ma niente di male a non proporla nella lista).
export async function listPreparations({ excludeId } = {}) {
  let query = supabase
    .from("recipes")
    .select("id, name, yield_quantity, yield_unit, recipe_type")
    .in("recipe_type", ["preparazione", "finger"])
    .order("name");
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// "Dove è usata questa preparazione" — solo uso diretto (§4 del brief).
export async function listPreparationUsage(recipeId) {
  const { data, error } = await supabase
    .from("v_preparation_usage")
    .select("*")
    .eq("preparation_id", recipeId);
  if (error) throw error;
  return data;
}

// Copiare una ricetta con dentro le sue righe e i suoi passi (20/08/2026,
// blocco 2 del mandato dei finger food, richiesta di Alessio: «Selezione da
// 6» e «Selezione da 8» si somigliano).
//
// ⚠️ PASSA DAL CORRIDOIO perché tocca tre tabelle ed è tutto-o-niente per
// senso: a metà resterebbe una ricetta col nome giusto e dentro niente —
// nessun errore, e un food cost di zero euro che ha l'aria di essere un
// numero.
//
// ⚠️ Restituisce anche QUANTE righe e quanti passi ha copiato, e la
// schermata li dice: un «fatto» che non porta i numeri è la stessa forma di
// una lettura tagliata che non si denuncia.
export async function duplicaRicetta(recipeId, nome) {
  return eseguiOperazione("duplica_ricetta", {
    p_recipe_id: recipeId,
    p_nome: nome ?? null,
  });
}

// Quanto costa OGNI ricetta di un elenco, in una lettura sola (20/08/2026).
//
// ⚠️ Serve al pannello dei finger, dove accanto a ogni spunta si vede
// quanto costa quel finger: senza, si compone un piatto al buio e il
// totale si scopre solo alla fine.
// ⚠️ Chiede solo gli identificativi che le servono, mai la vista intera: una
// lettura senza confini torna con al massimo mille righe e nessun errore
// (misurato il 19/08).
export async function listRecipeCostsFor(recipeIds) {
  if (recipeIds.length === 0) return {};
  const { data, error } = await supabase
    .from("v_recipe_costs")
    .select("recipe_id, food_cost_base")
    .in("recipe_id", recipeIds);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.recipe_id, Number(r.food_cost_base)]));
}

// IL PREZZO DI UN BIS (24/08/2026, blocco 2(e) del collaudo).
//
// ⚠️ IL CALCOLO STA NEL DATABASE e non qui: food cost, obiettivo e
// avvertenza escono insieme dalla stessa funzione, così il numero e il suo
// limite non possono separarsi — è la stessa regola di `calcola_imposte()`
// (15/08). Rifarlo nella schermata vorrebbe dire una seconda formula per
// lo stesso prezzo.
export async function prezzoBis(fingerId) {
  const { data, error } = await supabase.rpc("prezzo_bis", { p_finger_id: fingerId });
  if (error) throw error;
  return data?.[0] ?? null;
}

// I finger di un piatto, col loro prezzo: quelli di cui si può chiedere il
// bis. ⚠️ Li può leggere anche la sala — lì c'è solo il prezzo di VENDITA,
// che il cameriere legge già sul menu, non il food cost.
export async function fingerBissabili(piattoId) {
  const { data, error } = await supabase.rpc("finger_bissabili", { p_piatto_id: piattoId });
  if (error) throw error;
  return data ?? [];
}

// GLI ALLERGENI DI UN PIATTO, allergene per allergene (24/08/2026, blocco 1
// del mandato del collaudo).
//
// ⚠️ TRE STATI, non due: `eliminabile`, `non_eliminabile` e `non_deciso` —
// e il terzo è l'assenza di una dichiarazione, non un valore predefinito.
// Su una materia di salute, «esaminato e non si può» e «mai guardato» non
// sono la stessa cosa, e la scheda del piatto lo dice.
export async function allergeniDelPiatto(recipeId) {
  const { data, error } = await supabase.rpc("allergeni_del_piatto", {
    p_recipe_id: recipeId,
  });
  if (error) throw error;
  return data ?? [];
}

// La dichiarazione: questo allergene si può togliere, sì o no.
// ⚠️ Non si passa `eliminabile: false` come valore di comodo per «non lo so»:
// per non decidere si CANCELLA la riga (vedi `dimenticaScelta`).
export async function salvaScelta(recipeId, allergene, { eliminabile, nota } = {}) {
  const { data, error } = await supabase
    .from("scelte_allergene")
    .upsert(
      { recipe_id: recipeId, allergene, eliminabile, nota: nota || null },
      { onConflict: "recipe_id,allergene" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function dimenticaScelta(recipeId, allergene) {
  const { error } = await supabase
    .from("scelte_allergene")
    .delete()
    .eq("recipe_id", recipeId)
    .eq("allergene", allergene);
  if (error) throw error;
}

// Come si toglie: quale ingrediente esce, quale entra, quanto costa in più.
// ⚠️ `sostitutoId` vuoto vuol dire «si toglie e basta» — è un caso vero
// («senza noci»), non un campo dimenticato.
export async function salvaSostituzione(
  recipeId,
  allergene,
  { ingredienteId, sostitutoId, costoAggiuntivo, nota } = {}
) {
  const { data, error } = await supabase
    .from("sostituzioni_allergene")
    .upsert(
      {
        recipe_id: recipeId,
        allergene,
        ingrediente_id: ingredienteId,
        sostituto_id: sostitutoId || null,
        costo_aggiuntivo: Number(costoAggiuntivo ?? 0),
        nota: nota || null,
      },
      { onConflict: "recipe_id,allergene,ingrediente_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function togliSostituzione(id) {
  const { error } = await supabase.from("sostituzioni_allergene").delete().eq("id", id);
  if (error) throw error;
}

// GLI ALLERGENI DI PIÙ RICETTE IN UNA LETTURA SOLA (24/08/2026, blocco 3(g)
// del mandato del collaudo).
//
// ⚠️ Serve alla scheda di un piatto di finger food, dove Alessio ha chiesto
// di vedere **l'elenco dei finger, ognuno coi suoi allergeni**: *«così vedo
// subito DOVE sta l'allergene e quindi quale finger togliere o
// sostituire»*. Un elenco piatto degli allergeni del piatto intero non
// risponde a quella domanda.
//
// ⚠️ Chiede solo gli identificativi che le servono, mai la vista intera: una
// lettura senza confini torna con al massimo mille righe e nessun errore.
export async function listRecipeAllergensFor(recipeIds) {
  if (recipeIds.length === 0) return {};
  const { data, error } = await supabase
    .from("v_recipe_allergens")
    .select("recipe_id, allergens, allergeni_da_verificare, ingredienti_da_verificare, tracce")
    .in("recipe_id", recipeIds);
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((r) => [
      r.recipe_id,
      {
        allergens: r.allergens ?? [],
        daVerificare: r.allergeni_da_verificare === true,
        ingredienti: r.ingredienti_da_verificare ?? [],
        tracce: r.tracce ?? [],
      },
    ])
  );
}

/**
 * DA DOVE VIENE OGNI ALLERGENE DI UNA RICETTA.
 *
 * 🔴 Le parole di Alessio: *«come mai è presente l'uovo in questo piatto di
 * tortellini in brodo se la pasta è acqua e farina?»* — l'uovo è nel brodo.
 * Il gestionale sommava gli allergeni dai pezzi e non diceva **da quale**,
 * e un elenco senza provenienza davanti a un cliente non si può spiegare:
 * si può solo ripetere.
 *
 * ⚠️ Serve nella RICETTA, dove Alessio guarda quando gli chiedono. **In
 * comanda no**: lì si vede l'allergene e basta, con gli eliminabili
 * premibili (decisione del 24/08). Le spiegazioni le dà lui di persona.
 */
export async function catenaAllergeni(recipeId) {
  const { data, error } = await supabase.rpc("catena_allergeni", { p_recipe_id: recipeId });
  if (error) throw error;
  return data ?? [];
}
