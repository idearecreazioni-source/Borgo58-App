import { supabase } from "../supabase";

const SELECT = "*, ingredient:ingredient_id(id, name, unit, current_price, waste_percentage_default, allergens)";

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
