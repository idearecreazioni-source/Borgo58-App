import { supabase } from "../supabase";
import { oggiLocale } from "../constants";
import { listRecipeIngredientsForRecipes } from "./recipeIngredients";

export async function listReservations({ status, type, search, date } = {}) {
  let query = supabase
    .from("reservations")
    .select("*")
    .order("reservation_date", { ascending: true })
    .order("reservation_time", { ascending: true });

  if (date) query = query.eq("reservation_date", date);
  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);
  if (search) {
    query = query.or(
      `customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,customer_email.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Le richieste ancora da confermare, da oggi in avanti.
 *
 * Esiste perché l'elenco del Calendario si apre sul giorno corrente: una
 * richiesta per una data futura non si vedeva aprendo la pagina, e l'unico
 * posto dove compariva era la notifica su Telegram (trovato dal vivo
 * l'11/08/2026). Una richiesta che nessuno vede è una richiesta che nessuno
 * risponde — e il cliente resta in attesa mentre il posto resta bloccato.
 *
 * Nessun `.limit()`: sono poche per definizione, e troncarle
 * significherebbe nascondere proprio quella che manca.
 */
export async function listRichiesteDaConfermare() {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("status", "richiesta_in_attesa")
    .gte("reservation_date", oggiLocale())
    .order("reservation_date", { ascending: true })
    .order("reservation_time", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getReservation(id) {
  const { data, error } = await supabase
    .from("reservations")
    .select("*, event_menu:event_menu_id(id, name)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createReservation(payload) {
  const { data, error } = await supabase.from("reservations").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateReservation(id, payload) {
  const { data, error } = await supabase
    .from("reservations")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Caparra: tabella separata visibile solo al titolare (§3.5) — la tabella
// reservations non contiene più dati economici, così è condivisibile con lo staff.
export async function getReservationDeposit(reservationId) {
  const { data, error } = await supabase
    .from("reservation_deposits")
    .select("amount")
    .eq("reservation_id", reservationId)
    .maybeSingle();
  if (error) throw error;
  return data?.amount ?? null;
}

export async function setReservationDeposit(reservationId, amount) {
  if (amount == null || amount === "") {
    const { error } = await supabase
      .from("reservation_deposits")
      .delete()
      .eq("reservation_id", reservationId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("reservation_deposits")
    .upsert({ reservation_id: reservationId, amount: Number(amount) });
  if (error) throw error;
}

// Simulatore fabbisogno ingredienti per un evento: scala le quantità delle
// ricette del menu scelto sul numero di ospiti (assume che ogni ospite
// consumi ogni piatto del menu evento — coerente con un menu fisso da
// evento, diverso dall'à la carte).
export async function computeEventIngredientNeeds(menuId, partySize) {
  const { data: menuItems, error } = await supabase
    .from("menu_items")
    .select("recipe_id, recipe:recipe_id(id, name, portions_yield)")
    .eq("menu_id", menuId);
  if (error) throw error;

  const recipeIds = menuItems.map((mi) => mi.recipe_id);
  const recipeIngredients = await listRecipeIngredientsForRecipes(recipeIds);
  const portionsByRecipe = Object.fromEntries(
    menuItems.map((mi) => [mi.recipe_id, mi.recipe.portions_yield || 1])
  );

  const needs = {};
  recipeIngredients
    .filter((ri) => !ri.is_optional)
    .forEach((ri) => {
      const portions = portionsByRecipe[ri.recipe_id] || 1;
      const scaledQty = ri.quantity * (partySize / portions);
      const key = ri.ingredient_id;
      if (!needs[key]) {
        needs[key] = {
          ingredient: ri.ingredient,
          quantity: 0,
        };
      }
      needs[key].quantity += scaledQty;
    });

  return Object.values(needs)
    .map((n) => ({
      ...n,
      estimatedCost: n.quantity * n.ingredient.current_price,
    }))
    .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name));
}
