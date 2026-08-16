import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";
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

// --- I tavoli di una prenotazione (14/08/2026) ---
//
// Nessuna entità "gruppo": una prenotazione tiene semplicemente l'elenco
// dei tavoli che occupa, e l'accostamento è dove Alessio li ha messi
// sulla pianta. L'etichetta è fotografata al momento della conferma —
// se fra sei mesi la sala viene rinumerata, una prenotazione di oggi
// continua a mostrare il tavolo che aveva.

export async function listTavoliPrenotazione(reservationId) {
  const { data, error } = await supabase
    .from("prenotazione_tavoli")
    .select("dining_table_id, etichetta_al_momento")
    .eq("reservation_id", reservationId);
  if (error) throw error;
  return data;
}

// Tutti gli abbinamenti di una giornata, per colorare la pianta: quale
// tavolo è già promesso a chi.
export async function listTavoliPrenotatiPerData(data) {
  const { data: righe, error } = await supabase
    .from("prenotazione_tavoli")
    .select(
      "dining_table_id, etichetta_al_momento, reservation:reservation_id!inner(id, customer_name, party_size, reservation_time, reservation_date, status)"
    )
    .eq("reservation.reservation_date", data)
    .in("reservation.status", ["richiesta_in_attesa", "confermata"]);
  if (error) throw error;
  return righe;
}

// Assegna la prenotazione a uno o più tavoli e, se richiesto, la conferma.
//
// Tocca lo stato della prenotazione E N righe di collegamento: due
// tabelle, quindi corridoio obbligatorio (Contratto §5, rilievo del
// validatore del 14/08). Se la conferma passasse e i tavoli no, resterebbe
// una prenotazione confermata che non dice dove far sedere nessuno — e
// nessuno se ne accorgerebbe fino alla sera.
//
// Due prenotazioni sullo stesso tavolo la stessa sera a orari diversi
// restano ammesse — è la procedura che Alessio usa al telefono. Dal
// 14/08 non si spunta più niente: lo dice il colore della sagoma, giallo
// per chi arriva presto e verde per chi arriva tardi.
export async function assegnaPrenotazione(reservationId, tavoliIds, { conferma = true } = {}) {
  return eseguiOperazione("assegna_prenotazione", {
    p_reservation_id: reservationId,
    p_tavoli: tavoliIds,
    p_conferma: conferma,
  });
}

// Prende una prenotazione guardando la sala: si toccano i tavoli, si
// scrive il nome, e nasce già confermata su quei tavoli.
//
// ⚠️ Nessuna email al cliente e nessun avviso su Telegram, per decisione
// di Alessio del 14/08: al telefono la conferma gliel'ha appena data a
// voce. Non serve un interruttore — la prenotazione nasce `confermata`
// senza passare da un cambio di stato, e l'email parte solo sul cambio di
// stato; l'avviso guarda le richieste dal sito, e questa è interna.
//
// Prenotazione + righe dei tavoli: due tabelle, corridoio (B4).
export async function creaPrenotazioneSuTavoli({
  data,
  ora,
  persone,
  nome,
  telefono,
  email,
  note,
  tavoliIds,
}) {
  return eseguiOperazione("crea_prenotazione_su_tavoli", {
    p_data: data,
    p_ora: ora,
    p_persone: Number(persone),
    p_nome: nome,
    p_tavoli: tavoliIds,
    p_telefono: telefono || null,
    p_email: email || null,
    p_note: note || null,
  });
}

export async function togliAssegnazione(reservationId) {
  const { error } = await supabase
    .from("prenotazione_tavoli")
    .delete()
    .eq("reservation_id", reservationId);
  if (error) throw error;
}

// «Ha disdetto», e anche «rifiuta» dalla scheda della prenotazione.
//
// ⚠️ Lo stato E i tavoli in una transazione sola (Contratto B4, Blocco 3
// del mandato di correzione, 16/08/2026). Sulla pianta erano due scritture
// separate dal browser — al fallimento a metà restava una prenotazione
// annullata che teneva i suoi tavoli, e quella riga non si vede da nessuna
// schermata: al telefono si dice «non c'è posto» per un tavolo libero.
// Nella scheda della prenotazione era anche peggio: i tavoli non venivano
// liberati mai.
export async function annullaPrenotazione(reservationId, stato = "annullata") {
  return eseguiOperazione("annulla_prenotazione", {
    p_reservation_id: reservationId,
    p_stato: stato,
  });
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
