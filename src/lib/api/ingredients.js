import { supabase } from "../supabase";

const SELECT = "*, supplier:supplier_id(id, name), producer_entity:producer_entity_id(id, name)";

export async function listIngredients({ search, category } = {}) {
  let query = supabase
    .from("ingredients")
    .select(SELECT)
    .eq("active", true)
    .order("name");

  if (search) query = query.ilike("name", `%${search}%`);
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getIngredient(id) {
  const { data, error } = await supabase
    .from("ingredients")
    .select(SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// Crea l'ingrediente e registra il prezzo iniziale nello storico (fonte "manuale").
export async function createIngredient(payload) {
  const { current_price, ...rest } = payload;

  const { data: ingredient, error } = await supabase
    .from("ingredients")
    .insert({ ...rest, current_price })
    .select(SELECT)
    .single();
  if (error) throw error;

  const { error: historyError } = await supabase.from("price_history").insert({
    ingredient_id: ingredient.id,
    price: current_price,
    supplier_id: payload.supplier_id ?? null,
    source: "manuale",
    note: "Prezzo iniziale",
  });
  if (historyError) throw historyError;

  return ingredient;
}

// Aggiorna gli attributi dell'ingrediente SENZA toccare current_price/storico
// (per quello vedi updateIngredientPrice, che passa dalla funzione DB dedicata).
export async function updateIngredientFields(id, fields) {
  const { current_price, ...rest } = fields;
  const { data, error } = await supabase
    .from("ingredients")
    .update(rest)
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function updateIngredientPrice(id, newPrice, { source = "manuale", note, supplierId } = {}) {
  const { error } = await supabase.rpc("update_ingredient_price", {
    p_ingredient_id: id,
    p_new_price: newPrice,
    p_source: source,
    p_note: note ?? null,
    p_supplier_id: supplierId ?? null,
  });
  if (error) throw error;
  return getIngredient(id);
}

export async function listPriceHistory(ingredientId) {
  const { data, error } = await supabase
    .from("price_history")
    .select("*")
    .eq("ingredient_id", ingredientId)
    .order("recorded_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function deactivateIngredient(id) {
  const { error } = await supabase
    .from("ingredients")
    .update({ active: false })
    .eq("id", id);
  if (error) throw error;
}
