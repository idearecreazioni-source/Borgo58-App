import { supabase } from "../supabase";
import { createTask, updateTask } from "./tasks";

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

// Eliminazione completa: documenti/ferie/buste paga vanno via a cascata.
// Bloccata dal DB (RESTRICT) se il dipendente ha ricevuto mance in una
// distribuzione — in quel caso va prima rimossa la distribuzione.
export async function deleteEmployee(id) {
  // Prima chiudi i promemoria Agenda collegati ai documenti: il cascade
  // rimuove i documenti ma lascerebbe i task pendenti in Agenda.
  const docs = await listEmployeeDocuments(id);
  for (const d of docs) {
    if (d.task_id) {
      try {
        await updateTask(d.task_id, { status: "completato" });
      } catch {
        /* task già rimosso: non bloccare */
      }
    }
  }
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error(
        "Impossibile eliminare: il dipendente ha ricevuto mance in una distribuzione. Rimuovi prima la distribuzione dalla sezione Mance."
      );
    }
    throw error;
  }
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

export async function createEmployeeDocument(employeeId, employeeName, payload) {
  const { data: doc, error } = await supabase
    .from("employee_documents")
    .insert({ employee_id: employeeId, ...payload })
    .select()
    .single();
  if (error) throw error;

  if (payload.expiry_date) {
    const task = await createTask({
      title: `Rinnovo documento — ${employeeName}: ${payload.description || payload.doc_type}`,
      due_date: payload.expiry_date,
      category: "Personale",
      origine_modulo: "personale",
    });
    const { data: updated, error: upErr } = await supabase
      .from("employee_documents")
      .update({ task_id: task.id })
      .eq("id", doc.id)
      .select()
      .single();
    if (upErr) throw upErr;
    return updated;
  }
  return doc;
}

export async function deleteEmployeeDocument(id, taskId) {
  if (taskId) {
    try {
      await updateTask(taskId, { status: "completato" });
    } catch {
      /* task già rimosso: non bloccare */
    }
  }
  const { error } = await supabase.from("employee_documents").delete().eq("id", id);
  if (error) throw error;
}

// Documenti in scadenza (tutti i dipendenti) — per l'overview.
export async function listExpiringDocuments(withinDays = 60) {
  const limit = new Date(Date.now() + withinDays * 86400000).toISOString().slice(0, 10);
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

// Registra una distribuzione: crea l'intestazione + le righe per dipendente.
export async function createTipDistribution({ entityId, periodMonth, note, lines }) {
  const total = lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const { data: dist, error } = await supabase
    .from("tip_distributions")
    .insert({ entity_id: entityId, period_month: periodMonth, total_amount: total, note: note || null })
    .select()
    .single();
  if (error) throw error;

  const rows = lines
    .filter((l) => Number(l.amount) > 0)
    .map((l) => ({ distribution_id: dist.id, employee_id: l.employee_id, amount: Number(l.amount) }));
  if (rows.length > 0) {
    const { error: linesError } = await supabase.from("tip_distribution_lines").insert(rows);
    if (linesError) throw linesError;
  }
  return dist;
}

export async function deleteTipDistribution(id) {
  const { error } = await supabase.from("tip_distributions").delete().eq("id", id);
  if (error) throw error;
}
