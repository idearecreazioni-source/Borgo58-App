import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

export async function listRecipeSteps(recipeId) {
  const { data, error } = await supabase
    .from("recipe_steps")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("step_number");
  if (error) throw error;
  return data;
}

export async function addRecipeStep(recipeId, payload) {
  const { data, error } = await supabase
    .from("recipe_steps")
    .insert({ recipe_id: recipeId, ...payload })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRecipeStep(id, payload) {
  const { data, error } = await supabase
    .from("recipe_steps")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeRecipeStep(id) {
  const { error } = await supabase.from("recipe_steps").delete().eq("id", id);
  if (error) throw error;
}

// Scambia step_number tra due fasi adiacenti (riordino su/giù), in UNA
// transazione dentro la funzione Postgres swap_recipe_steps (Contratto
// B4). La versione precedente faceva tre update dal browser SENZA
// controllare gli errori: un fallimento a metà lasciava una fase
// parcheggiata su un numero temporaneo, in silenzio.
export async function swapStepOrder(stepA, stepB) {
  return eseguiOperazione("swap_recipe_steps", {
    p_step_a: stepA.id,
    p_step_b: stepB.id,
  });
}
