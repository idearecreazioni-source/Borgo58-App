import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

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

// Un solo menu attivo alla volta (vincolo DB): spegni-poi-accendi vivono
// nella STESSA transazione dentro la funzione Postgres set_active_menu
// (Contratto B4). Prima erano due update separate: se la seconda falliva
// NESSUN menu restava attivo — comande e sala senza carta, in silenzio.
// Restituisce la riga del menu attivato.
export async function setActiveMenu(id) {
  return eseguiOperazione("set_active_menu", { p_menu_id: id });
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
