import { supabase } from "../supabase";

// --- Causali (editabili dal titolare, §3.4) ---
export async function listCausali(kind) {
  let query = supabase.from("cash_causali").select("*").eq("active", true).order("label");
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listAllCausali() {
  const { data, error } = await supabase.from("cash_causali").select("*").order("kind").order("label");
  if (error) throw error;
  return data;
}

export async function createCausale({ label, kind }) {
  const { data, error } = await supabase
    .from("cash_causali")
    .insert({ label: label.trim(), kind })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deactivateCausale(id) {
  const { error } = await supabase.from("cash_causali").update({ active: false }).eq("id", id);
  if (error) throw error;
}

// --- Movimenti di cassa (prima nota) ---
const MOVEMENT_SELECT = "*, causale:causale_id(id, label)";

// ⚠️ NIENTE `.limit()` qui: alimenta anche l'export CSV della prima nota
// (PrimaNota.jsx usa lo stesso array per la tabella e per il file), quindi
// un limite produrrebbe un export fiscale incompleto ma dall'aspetto
// normale. È già contenuta dai filtri di periodo `from`/`to`, che sono la
// strada giusta. Stessa avvertenza estesa in cima a haccp.js.
export async function listCashMovements({ entityId, from, to, direction } = {}) {
  let query = supabase
    .from("cash_movements")
    .select(MOVEMENT_SELECT)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (entityId) query = query.eq("entity_id", entityId);
  if (direction) query = query.eq("direction", direction);
  if (from) query = query.gte("movement_date", from);
  if (to) query = query.lte("movement_date", to);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createCashMovement(payload) {
  const { data, error } = await supabase
    .from("cash_movements")
    .insert(payload)
    .select(MOVEMENT_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCashMovement(id) {
  const { error } = await supabase.from("cash_movements").delete().eq("id", id);
  if (error) throw error;
}

// Saldo di cassa (contante atteso) per entità.
export async function getCashBalance(entityId) {
  const { data, error } = await supabase
    .from("v_cash_balance")
    .select("*")
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Cosa non torna fra le fatture fornitore e la prima nota.
//
// Il grosso è impedito per costruzione (pagare una fattura scrive da sé
// l'uscita, e una fattura non può produrre due movimenti): qui restano i
// casi che nessun vincolo può prevenire — fatture pagate prima che quel
// collegamento esistesse, e uscite battute a mano che non agganciano
// niente. Quando arriveranno gli estratti conto, è lo stesso elenco che
// si riempirà con le righe della banca senza corrispondenza.
export async function listQuadraturaPagamenti({ from, to } = {}) {
  const { data, error } = await supabase.rpc("quadratura_pagamenti", {
    p_dal: from || null,
    p_al: to || null,
  });
  if (error) throw error;
  return data ?? [];
}

// --- Device (tablet) — segnalazione silenziosa sconti/omaggi (§3.4) ---
export async function listPosDevices() {
  const { data, error } = await supabase.from("pos_devices").select("*").eq("active", true).order("name");
  if (error) throw error;
  return data;
}

export async function createPosDevice({ name, isOwnerDevice }) {
  const { data, error } = await supabase
    .from("pos_devices")
    .insert({ name: name.trim(), is_owner_device: !!isOwnerDevice })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --- Sconti e omaggi ---
const DG_SELECT =
  "*, causale:causale_id(id, label), customer:customer_id(id, name, phone), device:device_id(id, name, is_owner_device)";

export async function listDiscountsGifts({ entityId, from, to } = {}) {
  let query = supabase
    .from("discounts_gifts")
    .select(DG_SELECT)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (entityId) query = query.eq("entity_id", entityId);
  if (from) query = query.gte("movement_date", from);
  if (to) query = query.lte("movement_date", to);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createDiscountGift(payload) {
  const { data, error } = await supabase
    .from("discounts_gifts")
    .insert(payload)
    .select(DG_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDiscountGift(id) {
  const { error } = await supabase.from("discounts_gifts").delete().eq("id", id);
  if (error) throw error;
}

// Aggregazione mensile (base TD27 per gli omaggi).
export async function listDiscountsGiftsMonthly(entityId) {
  let query = supabase
    .from("v_discounts_gifts_monthly")
    .select("*")
    .order("month", { ascending: false });
  if (entityId) query = query.eq("entity_id", entityId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
