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

// ⚠️ Il what-if «e se questo ingrediente rincarasse» lo calcola il
// DATABASE (16/08/2026, Blocco 2 del mandato di correzione). Prima era una
// terza copia della formula del food cost dentro la schermata, e non
// conosceva le preparazioni: su una riga-componente il dato è vuoto,
// quindi il simulatore si ROMPEVA su ogni piatto che contiene un
// semilavorato — e quando non si rompeva guardava un livello solo, cioè
// taceva sui rincari che arrivano attraverso una preparazione.
export async function simulaPrezzoIngrediente(menuId, ingredientId, variazionePct) {
  const { data, error } = await supabase.rpc("simula_prezzo_ingrediente", {
    p_menu_id: menuId,
    p_ingredient_id: ingredientId,
    p_variazione_pct: Number(variazionePct),
  });
  if (error) throw error;
  return data ?? [];
}

// Gli ingredienti che il menu consuma davvero, preparazioni attraversate.
// Anche questo era costruito nel browser su un livello solo: un ingrediente
// che sta unicamente dentro una preparazione non era nemmeno selezionabile.
export async function listIngredientiDelMenu(menuId) {
  const { data, error } = await supabase.rpc("ingredienti_del_menu", {
    p_menu_id: menuId,
  });
  if (error) throw error;
  return data ?? [];
}

// IN QUALI MENU STA QUESTA RICETTA (24/08/2026, blocco 2(c)).
//
// Alessio: *«aggiungi anche la possibilità di scegliere IN QUALE MENU va
// una ricetta»*. Fino a oggi la scheda della ricetta offriva un solo
// collegamento — «mettila nel menu attivo» — e per ogni altro menu
// bisognava passare dall'Editor Menu e cercarla lì.
//
// ⚠️ SI LEGGE, NON SI DUPLICA: la verità su chi sta in che menu resta
// `menu_items`, la stessa tabella da cui la legge l'Editor Menu. Questa
// funzione è una domanda posta da un'angolatura diversa — «dove sta questo
// piatto» invece di «cosa c'è in questo menu» — non un secondo registro.
// È anche la struttura su cui l'Editor Menu, quando verrà rifatto, potrà
// pescare i piatti da qui invece di farli riscrivere.
export async function menuDellaRicetta(recipeId) {
  const [{ data: menus, error: e1 }, { data: items, error: e2 }] = await Promise.all([
    // ⚠️ Le colonne si chiedono al database, non a memoria: la prima
    // versione di questa riga chiedeva `service_type`, che in `menus` non
    // esiste — PostgREST rispondeva **400** e la scheda della ricetta
    // restava a «Caricamento…» per sempre. Trovato aprendola, non
    // rileggendo: lint e build erano puliti.
    supabase.from("menus").select("id, name, is_active").order("name"),
    supabase.from("menu_items").select("id, menu_id, selling_price").eq("recipe_id", recipeId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const dentro = Object.fromEntries((items ?? []).map((i) => [i.menu_id, i]));
  return (menus ?? []).map((m) => ({
    ...m,
    voce: dentro[m.id] ?? null, // null = questo piatto non è in questo menu
  }));
}
