import { supabase } from "../supabase";
import { oggiLocale } from "../constants";

// Gli impegni aperti con la loro corsia — in ritardo, questa settimana,
// più avanti, quando capita — e da quanti giorni sono lì.
//
// La corsia la calcola il database, non la schermata: il badge del modulo
// e la lista devono contare la stessa cosa. Due conteggi diversi sullo
// stesso schermo sono la lezione dei rincari, dove schermo e Telegram
// dicevano due numeri.
export async function agendaCorsie() {
  const { data, error } = await supabase.rpc("agenda_corsie");
  if (error) throw error;
  return data ?? [];
}

// Chiudere un impegno che torna genera il successivo, nella stessa
// transazione: se la chiusura passasse e la rigenerazione no, un
// adempimento annuale sparirebbe per riapparire come dimenticanza.
export async function completaTask(id) {
  const { data, error } = await supabase.rpc("completa_task", { p_id: id });
  if (error) throw error;
  return data;
}

// Rimanda / promuovi a data: una riga sola, la RLS come barriera.
export async function spostaTask(id, dueDate) {
  return updateTask(id, { due_date: dueDate });
}

export async function stellaTask(id, preferito) {
  return updateTask(id, { preferito });
}

export async function listTasks({ status, priority, category, search } = {}) {
  let query = supabase
    .from("tasks")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: true });

  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (category) query = query.eq("category", category);
  if (search) query = query.ilike("title", `%${search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Task del giorno + task senza data (§3.12, per la Dashboard home).
export async function listDashboardTasks() {
  const today = oggiLocale();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .neq("status", "completato")
    .or(`due_date.eq.${today},due_date.is.null`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listTasksForMonth(year, month) {
  // month: 1-12
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .gte("due_date", from)
    .lte("due_date", to)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getTask(id) {
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createTask(payload) {
  const { data, error } = await supabase.from("tasks").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateTask(id, payload) {
  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTask(id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

// Pulizia periodica dei task già evasi. Solo il titolare può cancellare
// (policy tasks_delete_titolare): allo staff la richiesta tornerebbe
// semplicemente senza righe eliminate, non con un errore — per questo il
// pulsante non gli viene nemmeno mostrato.
// I task generati da altri moduli si possono eliminare senza danni: i
// record d'origine hanno `task_id ... on delete set null`, quindi perdono
// il collegamento al promemoria ma restano intatti.
export async function deleteCompletedTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("status", "completato")
    .select("id");
  if (error) throw error;
  return data.length;
}
