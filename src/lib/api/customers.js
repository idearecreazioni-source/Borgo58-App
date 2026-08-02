import { supabase } from "../supabase";

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
  if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
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

export async function mergeCustomers(keepId, mergeId) {
  const { error } = await supabase.rpc("merge_customers", { p_keep_id: keepId, p_merge_id: mergeId });
  if (error) throw error;
}
