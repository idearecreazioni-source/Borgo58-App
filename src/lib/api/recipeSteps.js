import { supabase } from "../supabase";

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

// Scambia step_number tra due fasi adiacenti (riordino su/giù).
export async function swapStepOrder(stepA, stepB) {
  // 1) sposta stepA su un numero temporaneo per evitare la violazione del
  //    vincolo unique(recipe_id, step_number) durante lo scambio.
  await supabase.from("recipe_steps").update({ step_number: -1 }).eq("id", stepA.id);
  await supabase
    .from("recipe_steps")
    .update({ step_number: stepA.step_number })
    .eq("id", stepB.id);
  await supabase
    .from("recipe_steps")
    .update({ step_number: stepB.step_number })
    .eq("id", stepA.id);
}
