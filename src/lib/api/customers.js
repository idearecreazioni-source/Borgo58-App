import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";
import { filtroRicerca } from "../calcoli/ricerca";

// Stessa normalizzazione minima della funzione DB normalize_phone(): solo
// cifre e un eventuale + iniziale, per restare coerenti col trigger che
// collega automaticamente le prenotazioni (§3.14).
export function normalizePhone(phone) {
  if (!phone) return null;
  const trimmed = phone.trim().replace(/[^0-9+]/g, "");
  return trimmed || null;
}

// v_customer_stats è una vista: PostgREST fa embedding automatico solo via
// foreign key reali, che una vista non ha (stesso motivo di stock_lots_display
// in Magazzino) — due query separate, unite qui per id.
export async function listCustomers({ search } = {}) {
  let query = supabase.from("customers").select("*").eq("active", true).order("name");
  if (search) query = query.or(filtroRicerca(["name", "phone"], search));
  const [{ data, error }, { data: stats, error: statsError }] = await Promise.all([
    query,
    supabase.from("v_customer_stats").select("*"),
  ]);
  if (error) throw error;
  if (statsError) throw statsError;
  const statsById = Object.fromEntries(stats.map((s) => [s.customer_id, s]));
  return data.map((c) => ({ ...c, stats: statsById[c.id] ?? null }));
}

export async function getCustomer(id) {
  const { data, error } = await supabase.from("customers").select("*").eq("id", id).single();
  if (error) throw error;
  const { data: stats, error: statsError } = await supabase
    .from("v_customer_stats")
    .select("*")
    .eq("customer_id", id)
    .maybeSingle();
  if (statsError) throw statsError;
  return { ...data, stats };
}

export async function listCustomerReservations(customerId) {
  const { data, error } = await supabase
    .from("reservations")
    .select("id, reservation_date, reservation_time, party_size, type, status")
    .eq("customer_id", customerId)
    .order("reservation_date", { ascending: false });
  if (error) throw error;
  return data;
}

// Storico sconti/omaggi ricevuti dal cliente (§3.14). RISERVATO AL TITOLARE,
// ma senza alcun controllo di ruolo qui: `discounts_gifts` ha già una policy
// titolare-only (§3.4), quindi allo staff questa query torna vuota da sola —
// il permesso resta dove è definito (§3.18), non riscritto lato client.
// causale è una FK vera, quindi l'embedding PostgREST funziona (a differenza
// delle viste — vedi nota in cima a questo file).
export async function listCustomerDiscounts(customerId) {
  const { data, error } = await supabase
    .from("discounts_gifts")
    .select("id, type, full_amount, collected_amount, movement_date, note, causale:causale_id(label)")
    .eq("customer_id", customerId)
    .order("movement_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createCustomer({ name, phone, email, notes }) {
  const { data, error } = await supabase
    .from("customers")
    .insert({ name: name || null, phone: normalizePhone(phone), email: email || null, notes: notes || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomer(id, { name, phone, email, notes }) {
  const { data, error } = await supabase
    .from("customers")
    .update({ name: name || null, phone: normalizePhone(phone), email: email || null, notes: notes || null })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCustomer(id) {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
}

// ⚠️ Sposta le prenotazioni sulla scheda che resta E cancella quella
// doppia: due tabelle, quindi corridoio (Contratto B4, 16/08/2026).
// Era già atomica dentro — a metà, un cliente sarebbe sparito portandosi
// via la sua storia.
export async function mergeCustomers(keepId, mergeId) {
  return eseguiOperazione("merge_customers", { p_keep_id: keepId, p_merge_id: mergeId });
}

// LA POSTA DEI CLIENTI — 20/08/2026, blocco 1 del suo mandato.
//
// 🔴 LA DISTINZIONE CHE REGGE TUTTO, ed è di Alessio: scrivere a chi ha
// prenotato per confermargli il tavolo **non ha bisogno di niente**; mandare
// il menu del mese a duecento persone **sì**.
//
// ⚠️ E le due strade non sono la stessa funzione con un parametro diverso:
// sono due nomi diversi, e quella commerciale **pretende il consenso nel
// database**. Una sola «manda mail» prima o poi lascia uscire una
// comunicazione commerciale dalla porta di servizio.

// ⚠️ Si pretende COME l'ha dato: fra un anno «c'è la spunta» non risponde a
// nessuna contestazione, «me l'ha detto al telefono il 3 marzo» sì.
export async function registraConsenso(customerId, come) {
  const { data, error } = await supabase.rpc("registra_consenso", {
    p_customer_id: customerId,
    p_come: come,
  });
  if (error) throw error;
  return data;
}

// ⚠️ TOGLIE DAVVERO, non registra una richiesta: è la stessa colonna che il
// calcolo legge, quindi il caso «registrata e non applicata» non esiste —
// e quel caso è peggio di nessuna cancellazione, perché resta la prova
// scritta che l'aveva chiesto.
export async function revocaConsenso(customerId) {
  const { data, error } = await supabase.rpc("revoca_consenso", {
    p_customer_id: customerId,
  });
  if (error) throw error;
  return data;
}

// ⚠️ Dice anche CHI RESTA FUORI e perché: un elenco di destinatari senza gli
// esclusi si legge «sono tutti».
export async function destinatariCommerciali() {
  const { data, error } = await supabase.rpc("destinatari_commerciali");
  if (error) throw error;
  return data ?? [];
}

// 🔴 IL RIFIUTO ARRIVA DAL DATABASE, non da qui: una schermata che filtra è
// una schermata che qualcuno può scavalcare.
export async function registraInvioCommerciale(customerId, oggetto) {
  const { data, error } = await supabase.rpc("registra_invio_commerciale", {
    p_customer_id: customerId,
    p_oggetto: oggetto,
  });
  if (error) throw error;
  return data;
}

// Cosa gli è stato mandato, cosa ha scritto lui, e le sue prenotazioni.
export async function storiaCliente(customerId) {
  const { data, error } = await supabase.rpc("storia_cliente", { p_customer_id: customerId });
  if (error) throw error;
  return data ?? [];
}

// 🔴 IL GESTIONALE NON MANDA LISTE WHATSAPP — misurato prima di prometterlo.
// Prepara l'elenco dei numeri da copiare, che è la parte noiosa del lavoro a
// mano. ⚠️ E l'avvertenza sul limite della rubrica viaggia INSIEME
// all'elenco: un broadcast non arriva a chi non ha il numero di Alessio
// salvato, e WhatsApp non lo segnala.
export async function numeriPerBroadcast() {
  const { data, error } = await supabase.rpc("numeri_per_broadcast");
  if (error) throw error;
  return data?.[0] ?? null;
}
