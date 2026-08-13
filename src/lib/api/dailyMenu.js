import { supabase } from "../supabase";

export async function listDailyMenus() {
  const { data, error } = await supabase
    .from("daily_menus")
    .select("*")
    .order("service_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createDailyMenu({ serviceDate, title, note }) {
  const { data, error } = await supabase
    .from("daily_menus")
    .insert({ service_date: serviceDate, title: title || null, note: note || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDailyMenu(id) {
  const { error } = await supabase.from("daily_menus").delete().eq("id", id);
  if (error) throw error;
}

export async function listDailyMenuItems(dailyMenuId) {
  const { data, error } = await supabase
    .from("daily_menu_items")
    .select("*, recipe:recipe_id(id, name)")
    .eq("daily_menu_id", dailyMenuId)
    .order("position", { ascending: true, nullsFirst: false })
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function addDailyMenuItem(dailyMenuId, payload) {
  const { data, error } = await supabase
    .from("daily_menu_items")
    .insert({ daily_menu_id: dailyMenuId, ...payload })
    .select("*, recipe:recipe_id(id, name)")
    .single();
  if (error) throw error;
  return data;
}

export async function removeDailyMenuItem(id) {
  const { error } = await supabase.from("daily_menu_items").delete().eq("id", id);
  if (error) throw error;
}

// Allergeni per un gruppo di ricette (per il menu stampato): una sola query.
//
// ⚠️ Non restituisce solo QUALI allergeni, ma anche se sono stati
// verificati. Un elenco vuoto non vuol dire «non ne contiene»: può voler
// dire «nessuno l'ha mai guardato», e le due cose in mano a un cliente
// celiaco sono opposte. Chi stampa il menu deve poterle distinguere.
export async function listAllergensForRecipes(recipeIds) {
  if (!recipeIds || recipeIds.length === 0) return {};
  const { data, error } = await supabase
    .from("v_recipe_allergens")
    .select("recipe_id, allergens, allergeni_da_verificare, ingredienti_da_verificare")
    .in("recipe_id", recipeIds);
  if (error) throw error;
  return Object.fromEntries(
    data.map((r) => [
      r.recipe_id,
      {
        allergens: r.allergens ?? [],
        daVerificare: r.allergeni_da_verificare === true,
        ingredienti: r.ingredienti_da_verificare ?? [],
      },
    ])
  );
}
