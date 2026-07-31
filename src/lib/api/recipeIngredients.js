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
