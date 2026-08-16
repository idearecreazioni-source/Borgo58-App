import { supabase } from "../supabase";
import { traGiorniLocale } from "../constants";
import { eseguiOperazione } from "../operazioni";

// --- Anagrafica dipendenti ---
export async function listEmployees({ includeInactive } = {}) {
  let query = supabase.from("employees").select("*").order("last_name").order("first_name");
  if (!includeInactive) query = query.eq("status", "attivo");
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getEmployee(id) {
  const { data, error } = await supabase.from("employees").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createEmployee(payload) {
  const { data, error } = await supabase.from("employees").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateEmployee(id, patch) {
  const { data, error } = await supabase.from("employees").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

// Eliminazione completa: documenti/ferie/buste paga vanno via a cascata,
// e i promemoria dei documenti vengono completati NELLA STESSA transazione
// (funzione Postgres delete_employee). Se la cancellazione è respinta dal
// vincolo sulle mance ricevute, anche i completamenti si annullano — prima
// restavano promemoria chiusi per un dipendente ancora nel sistema. Il
// messaggio per il caso mance arriva già leggibile dal database.
export async function deleteEmployee(id) {
  return eseguiOperazione("delete_employee", { p_employee_id: id });
}

// --- Documenti compliance (scadenza → promemoria in Agenda) ---
export async function listEmployeeDocuments(employeeId) {
  const { data, error } = await supabase
    .from("employee_documents")
    .select("*")
    .eq("employee_id", employeeId)
    .order("expiry_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

// Documento del dipendente + eventuale promemoria di rinnovo nella STESSA
// transazione (funzione Postgres create_employee_document, Contratto B4).
// Il nome nel titolo del promemoria lo legge il database dal dipendente
// vero: il secondo parametro resta per compatibilità coi chiamanti ma non
// viene più usato. Restituisce l'id del documento.
export async function createEmployeeDocument(employeeId, _employeeName, payload) {
  return eseguiOperazione("create_employee_document", {
    p_employee_id: employeeId,
    p_doc_type: payload.doc_type,
    p_description: payload.description ?? null,
    p_expiry_date: payload.expiry_date ?? null,
    p_document_reference: payload.document_reference ?? null,
    p_issue_date: payload.issue_date ?? null,
  });
}

// Promemoria completato e documento cancellato nella STESSA transazione
// (funzione Postgres delete_employee_document). Il task_id lo legge il
// database dalla riga: il secondo parametro resta per compatibilità.
export async function deleteEmployeeDocument(id, _taskId) {
  return eseguiOperazione("delete_employee_document", { p_document_id: id });
}

// Documenti in scadenza (tutti i dipendenti) — per l'overview.
export async function listExpiringDocuments(withinDays = 60) {
  const limit = traGiorniLocale(withinDays);
  const { data, error } = await supabase
    .from("employee_documents")
    .select("*, employee:employee_id(id, first_name, last_name)")
    .not("expiry_date", "is", null)
    .lte("expiry_date", limit)
    .order("expiry_date");
  if (error) throw error;
  return data;
}

// --- Ferie / permessi ---
export async function listEmployeeLeaves(employeeId) {
  const { data, error } = await supabase
    .from("employee_leaves")
    .select("*")
    .eq("employee_id", employeeId)
    .order("start_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createEmployeeLeave(payload) {
  const { data, error } = await supabase.from("employee_leaves").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEmployeeLeave(id) {
  const { error } = await supabase.from("employee_leaves").delete().eq("id", id);
  if (error) throw error;
}

// --- Buste paga (archivio, non calcolo) ---
export async function listPayslips(employeeId) {
  const { data, error } = await supabase
    .from("payslips")
    .select("*")
    .eq("employee_id", employeeId)
    .order("period_month", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPayslip(payload) {
  const { data, error } = await supabase.from("payslips").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deletePayslip(id) {
  const { error } = await supabase.from("payslips").delete().eq("id", id);
  if (error) throw error;
}

// --- Mance ---
export async function getTipsBalance(entityId) {
  const { data, error } = await supabase
    .from("v_tips_balance")
    .select("*")
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listTipsCollected(entityId) {
  const { data, error } = await supabase
    .from("tips_collected")
    .select("*")
    .eq("entity_id", entityId)
    .order("collected_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createTipCollected(payload) {
  const { data, error } = await supabase.from("tips_collected").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTipCollected(id) {
  const { error } = await supabase.from("tips_collected").delete().eq("id", id);
  if (error) throw error;
}

export async function listTipDistributions(entityId) {
  const { data, error } = await supabase
    .from("tip_distributions")
    .select("*, lines:tip_distribution_lines(id, employee_id, amount)")
    .eq("entity_id", entityId)
    .order("period_month", { ascending: false });
  if (error) throw error;
  return data;
}

// Mance già ricevute per dipendente nell'anno (per il tetto 30%, §6).
export async function listTipsPerEmployeeYear(year) {
  const { data, error } = await supabase
    .from("v_tips_per_employee_year")
    .select("*")
    .eq("year", year);
  if (error) throw error;
  return data;
}

// Registra una distribuzione: intestazione + righe per dipendente nella
// STESSA transazione, dentro la funzione Postgres create_tip_distribution.
// Prima erano due scritture separate dal browser: un fallimento a metà
// lasciava un totale "distribuito" senza destinatari, e il totale era
// calcolato dal client sommando anche importi che poi non inseriva. Ora
// il totale lo calcola il database dalle sole righe che inserisce davvero.
// La chiamata passa dal corridoio (Contratto B4, 09/08/2026).
// Restituisce l'id della distribuzione.
export async function createTipDistribution({ entityId, periodMonth, note, lines, mezzo }) {
  return eseguiOperazione("create_tip_distribution", {
    p_entity_id: entityId,
    p_period_month: periodMonth,
    p_note: note || null,
    // In che forma si paga: senza, il conteggio delle mance rimaste nel
    // cassetto sarebbe un'ipotesi.
    p_mezzo: mezzo || "contanti",
    p_lines: (lines ?? [])
      .filter((l) => Number(l.amount) > 0)
      .map((l) => ({ employee_id: l.employee_id, amount: Number(l.amount) })),
  });
}

export async function deleteTipDistribution(id) {
  const { error } = await supabase.from("tip_distributions").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Le mance raccolte e non ancora distribuite, separate per forma
 * (16/08/2026).
 *
 * ⚠️ Non sono un ricavo: sono un DEBITO verso il personale. La divisione
 * fra contanti e carta non è un dettaglio — quelle in contanti stanno nel
 * cassetto e quelle su carta arrivano in banca insieme agli incassi.
 */
export async function manceDaDistribuire(entityId) {
  const { data, error } = await supabase.rpc("mance_da_distribuire", {
    p_entity_id: entityId,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}
