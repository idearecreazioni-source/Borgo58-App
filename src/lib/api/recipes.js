import { supabase } from "../supabase";

// statusFilter: "in_carta" | "pronta" | "in_sviluppo" | undefined (tutte)
export async function listRecipes({ search, category, statusFilter } = {}) {
  let query = supabase.from("recipes").select("*").order("name");
  if (search) query = query.ilike("name", `%${search}%`);
  if (category) query = query.eq("category", category);
  if (statusFilter === "in_carta") query = query.eq("in_carta", true);
  if (statusFilter === "pronta") query = query.eq("pronta_per_carta", true).eq("in_carta", false);
  if (statusFilter === "in_sviluppo") query = query.eq("pronta_per_carta", false);
  const { data, error } = await query;
  if (error) throw error;
  return data;
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
