import { supabase } from "../supabase";
import { createTask, updateTask } from "./tasks";

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

export async function upsertFiscalSettings(entityId, { annualRevenueEstimate, iresRate, irapRate }) {
  const { data, error } = await supabase
    .from("fiscal_settings")
    .upsert({
      entity_id: entityId,
      annual_revenue_estimate: annualRevenueEstimate ?? null,
      ires_rate: iresRate,
      irap_rate: irapRate,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
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
export async function createFiscalTool(payload) {
  const { data: tool, error } = await supabase
    .from("fiscal_tools")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  if (payload.deadline) {
    const task = await createTask({
      title: `Strumento fiscale: ${payload.name}`,
      due_date: payload.deadline,
      category: "Fiscale",
      origine_modulo: "proiezione_fiscale",
    });
    const { data: updated, error: upErr } = await supabase
      .from("fiscal_tools")
      .update({ task_id: task.id })
      .eq("id", tool.id)
      .select()
      .single();
    if (upErr) throw upErr;
    return updated;
  }
  return tool;
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

export async function deleteFiscalTool(id, taskId) {
  if (taskId) {
    // il task collegato non serve più: completalo per non lasciarlo pendente
    try {
      await updateTask(taskId, { status: "completato" });
    } catch {
      /* task già rimosso o non accessibile: non bloccare l'eliminazione */
    }
  }
  const { error } = await supabase.from("fiscal_tools").delete().eq("id", id);
  if (error) throw error;
}
