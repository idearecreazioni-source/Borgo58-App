import { supabase } from "../supabase";

export async function listMenus() {
  const { data, error } = await supabase
    .from("menus")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMenu(id) {
  const { data, error } = await supabase.from("menus").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createMenu(payload) {
  const { data, error } = await supabase.from("menus").insert(payload).select().single();
  if (error) throw error;
  return data;
}

// Un solo menu attivo alla volta (vincolo DB): disattiva gli altri prima di
// attivare quello scelto, per non violare l'indice unico su is_active.
export async function setActiveMenu(id) {
  const { error: deactivateError } = await supabase
    .from("menus")
    .update({ is_active: false })
    .eq("is_active", true);
  if (deactivateError) throw deactivateError;

  const { data, error } = await supabase
    .from("menus")
    .update({ is_active: true })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Unisce v_menu_item_economics (numeri calcolati dal DB) con i dati della
// ricetta (nome, categoria, stagionalità) necessari per la vista strutturata.
export async function listMenuItemsFull(menuId) {
  const [{ data: economics, error: e1 }, { data: items, error: e2 }] = await Promise.all([
    supabase.from("v_menu_item_economics").select("*").eq("menu_id", menuId),
    supabase
      .from("menu_items")
      .select("*, recipe:recipe_id(id, name, category, seasonality, menu_description)")
      .eq("menu_id", menuId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const economicsByItem = Object.fromEntries(economics.map((e) => [e.menu_item_id, e]));
  return items
    .map((item) => ({ ...item, economics: economicsByItem[item.id] }))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

export async function addMenuItem(menuId, payload) {
  const { data, error } = await supabase
    .from("menu_items")
    .insert({ menu_id: menuId, ...payload })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMenuItemPrice(id, sellingPrice) {
  const { error } = await supabase
    .from("menu_items")
    .update({ selling_price: sellingPrice })
    .eq("id", id);
  if (error) throw error;
}

export async function removeMenuItem(id) {
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) throw error;
}
