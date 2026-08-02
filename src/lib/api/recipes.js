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

export async function getRecipeAllergens(recipeId) {
  const { data, error } = await supabase
    .from("v_recipe_allergens")
    .select("*")
    .eq("recipe_id", recipeId)
    .maybeSingle();
  if (error) throw error;
  return data?.allergens ?? [];
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

// Preparazioni disponibili come componente di un'altra ricetta.
// excludeId: la ricetta corrente non può usare se stessa (già bloccato anche
// dal DB, ma niente di male a non proporla nella lista).
export async function listPreparations({ excludeId } = {}) {
  let query = supabase
    .from("recipes")
    .select("id, name, yield_quantity, yield_unit")
    .eq("recipe_type", "preparazione")
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
