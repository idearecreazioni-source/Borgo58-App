import { supabase } from "../supabase";

const SELECT =
  "*, ingredient:ingredient_id(id, name, unit, current_price, waste_percentage_default, allergens), " +
  "component:component_recipe_id(id, name, yield_quantity, yield_unit)";

export async function listRecipeIngredients(recipeId) {
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .select(SELECT)
    .eq("recipe_id", recipeId)
    .order("id");
  if (error) throw error;
  return data;
}

export async function addRecipeIngredient(recipeId, payload) {
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .insert({ recipe_id: recipeId, ...payload })
    .select(SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function updateRecipeIngredient(id, payload) {
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .update(payload)
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function removeRecipeIngredient(id) {
  const { error } = await supabase.from("recipe_ingredients").delete().eq("id", id);
  if (error) throw error;
}

// Vista "display" per lo staff: nomi, quantità e allergeni senza prezzi
// (§3.5). La vista è SECURITY DEFINER e non espone alcuna colonna economica.
export async function listRecipeIngredientsDisplay(recipeId) {
  const { data, error } = await supabase
    .from("recipe_ingredients_display")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("ingredient_name");
  if (error) throw error;
  return data;
}

// Per il simulatore what-if: tutti gli ingredienti di più ricette in una
// sola query, per poter ricalcolare il food cost con un prezzo ipotetico
// senza fare N richieste separate.
export async function listRecipeIngredientsForRecipes(recipeIds) {
  if (recipeIds.length === 0) return [];
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .select(SELECT)
    .in("recipe_id", recipeIds);
  if (error) throw error;
  return data;
}

// ⚠️ Quanto costa ogni riga di ricetta, LETTO DAL DATABASE (16/08/2026,
// Blocco 2 del mandato di correzione). Prima la schermata della ricetta lo
// ricalcolava nel browser, accanto a `v_recipe_costs` che lo sapeva già:
// due posti per la stessa moltiplicazione, e alla prossima modifica
// bisognava ricordarsi di tutti e due. Restituisce { id riga: costo }.
export async function getRecipeRowCosts(recipeId) {
  const { data, error } = await supabase
    .from("v_recipe_row_costs")
    .select("recipe_ingredient_id, costo")
    .eq("recipe_id", recipeId);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.recipe_ingredient_id, Number(r.costo)]));
}
