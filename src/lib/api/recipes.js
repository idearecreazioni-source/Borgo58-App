import { supabase } from "../supabase";

export async function listRecipes({ search, category, status } = {}) {
  let query = supabase.from("recipes").select("*").order("name");
  if (search) query = query.ilike("name", `%${search}%`);
  if (category) query = query.eq("category", category);
  if (status) query = query.eq("status", status);
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

export async function getRecipeAllergens(recipeId) {
  const { data, error } = await supabase
    .from("v_recipe_allergens")
    .select("*")
    .eq("recipe_id", recipeId)
    .maybeSingle();
  if (error) throw error;
  return data?.allergens ?? [];
}

export async function listAllRecipeCosts() {
  const { data, error } = await supabase.from("v_recipe_costs").select("*");
  if (error) throw error;
  return data;
}
