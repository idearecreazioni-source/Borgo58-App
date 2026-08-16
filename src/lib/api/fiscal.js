import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// --- Impostazioni fiscali (aliquote, ricavi stimati) ---
export async function getFiscalSettings(entityId) {
  const { data, error } = await supabase
    .from("fiscal_settings")
    .select("*")
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ⚠️ Dal 14/08/2026 questa riga non contiene più solo due aliquote: è
// l'UNICO posto dove vivono aliquote, agevolazioni e scadenze degli
// acconti (mandato «un solo motore fiscale»). Simulatore e Proiezione
// leggono da qui attraverso `calcola_imposte()`, e nessuna schermata
// rifà il conto per conto suo.
export async function upsertFiscalSettings(entityId, campi) {
  const patch = { entity_id: entityId, updated_at: new Date().toISOString() };
  const mappa = {
    annualRevenueEstimate: "annual_revenue_estimate",
    iresRate: "ires_rate",
    irapRate: "irap_rate",
    maxideduzioneAttiva: "maxideduzione_attiva",
    maxideduzionePercento: "maxideduzione_percento",
    accontoPercento: "acconto_percento",
    accontoPrimaRataPercento: "acconto_prima_rata_percento",
    accontoSogliaMinima: "acconto_soglia_minima",
    primaScadenzaMese: "prima_scadenza_mese",
    primaScadenzaGiorno: "prima_scadenza_giorno",
    secondaScadenzaMese: "seconda_scadenza_mese",
    secondaScadenzaGiorno: "seconda_scadenza_giorno",
    parametriConfermatiDaLaura: "parametri_confermati_da_laura",
  };
  for (const [chiave, colonna] of Object.entries(mappa)) {
    if (campi[chiave] !== undefined) patch[colonna] = campi[chiave];
  }

  const { data, error } = await supabase.from("fiscal_settings").upsert(patch).select().single();
  if (error) throw error;
  return data;
}

// --- Spese deducibili ---
export async function listDeductibleExpenses({ entityId, year } = {}) {
  let query = supabase
    .from("deductible_expenses")
    .select("*")
    .order("expense_date", { ascending: false });
  if (entityId) query = query.eq("entity_id", entityId);
  if (year) {
    query = query.gte("expense_date", `${year}-01-01`).lte("expense_date", `${year}-12-31`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createDeductibleExpense(payload) {
  const { data, error } = await supabase
    .from("deductible_expenses")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ⚠️ Correggere invece di «cancella e rifai» (Blocco 5.2 del mandato di
// correzione, 16/08/2026). Non è una comodità: rifare una spesa le cambia
// la data di creazione e le fa perdere il posto nell'ordine in cui è
// stata registrata — e una riga cancellata finisce comunque nel registro
// delle cancellazioni, dove resta a raccontare una spesa che non è mai
// esistita.
export async function updateDeductibleExpense(id, patch) {
  const { error } = await supabase.from("deductible_expenses").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteDeductibleExpense(id) {
  const { error } = await supabase.from("deductible_expenses").delete().eq("id", id);
  if (error) throw error;
}

// --- Catalogo strumenti fiscali (§3.7) ---
export async function listFiscalTools() {
  const { data, error } = await supabase
    .from("fiscal_tools")
    .select("*")
    .order("status")
    .order("name");
  if (error) throw error;
  return data;
}

// Con una scadenza, crea anche il promemoria in Agenda (§3.7), come le fatture.
// Strumento fiscale + eventuale promemoria di scadenza nella STESSA
// transazione (funzione Postgres create_fiscal_tool, Contratto B4).
// Restituisce l'id dello strumento.
export async function createFiscalTool(payload) {
  return eseguiOperazione("create_fiscal_tool", {
    p_name: payload.name,
    p_category: payload.category,
    p_description: payload.description ?? null,
    p_applicability: payload.applicability ?? null,
    p_status: payload.status || "da_verificare",
    p_normative_reference: payload.normative_reference ?? null,
    p_last_verified_date: payload.last_verified_date ?? null,
    p_in_use: Boolean(payload.in_use),
    p_deadline: payload.deadline ?? null,
  });
}

export async function updateFiscalTool(id, patch) {
  const { data, error } = await supabase
    .from("fiscal_tools")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Promemoria completato e strumento cancellato nella STESSA transazione
// (funzione Postgres delete_fiscal_tool). Il task_id lo legge il database
// dalla riga: il secondo parametro resta per compatibilità coi chiamanti.
export async function deleteFiscalTool(id, _taskId) {
  return eseguiOperazione("delete_fiscal_tool", { p_tool_id: id });
}
