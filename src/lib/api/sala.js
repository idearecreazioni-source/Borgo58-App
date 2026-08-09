import { supabase } from "../supabase";

// Capienza e orari del locale — i numeri che il form pubblico usa per dire
// a un cliente se c'è posto.
//
// Stanno nel database e non nel codice per la stessa ragione del prezzo del
// coperto: cambiano nella vita del locale (una chiusura, un tavolo in più,
// un orario spostato d'estate) e non devono richiedere una modifica al
// software. Scrittura riservata al titolare dalla RLS: qui non c'è nessun
// controllo di ruolo, la barriera è nel database (§6).
//
// Sono tutte scritture su UNA tabella: categoria A del Contratto, quindi
// dirette. Nessuna di queste operazioni ha conseguenze su altre tabelle.

export const GIORNI = [
  { weekday: 1, nome: "Lunedì" },
  { weekday: 2, nome: "Martedì" },
  { weekday: 3, nome: "Mercoledì" },
  { weekday: 4, nome: "Giovedì" },
  { weekday: 5, nome: "Venerdì" },
  { weekday: 6, nome: "Sabato" },
  { weekday: 0, nome: "Domenica" },
];

// --- Tavoli e coperti ---

export async function listDiningTables() {
  const { data, error } = await supabase
    .from("dining_tables")
    .select("id, label, seats, active, position")
    .order("position");
  if (error) throw error;
  return data;
}

export async function updateTableSeats(id, seats) {
  const { error } = await supabase
    .from("dining_tables")
    .update({ seats: Number(seats) })
    .eq("id", id);
  if (error) throw error;
}

// --- Orari di servizio ---

export async function listServiceHours() {
  const { data, error } = await supabase
    .from("service_hours")
    .select("id, weekday, servizio, apertura, ultimo_ingresso, attivo")
    .order("weekday")
    .order("apertura");
  if (error) throw error;
  return data;
}

export async function updateServiceHour(id, payload) {
  const { error } = await supabase
    .from("service_hours")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// --- Chiusure straordinarie ---

export async function listClosures() {
  const { data, error } = await supabase
    .from("service_closures")
    .select("id, dal, al, motivo")
    .order("dal", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createClosure({ dal, al, motivo }) {
  const { error } = await supabase
    .from("service_closures")
    .insert({ dal, al: al || dal, motivo: motivo?.trim() || null });
  if (error) throw error;
}

export async function deleteClosure(id) {
  const { error } = await supabase.from("service_closures").delete().eq("id", id);
  if (error) throw error;
}

// --- Regole di prenotazione (la riga unica di service_settings) ---

export async function getRegolePrenotazione() {
  const { data, error } = await supabase
    .from("service_settings")
    .select(
      "durata_tavolo_minuti, max_coperti_contemporanei, giorni_prenotabili, preavviso_minuti, prenotazioni_online_attive"
    )
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data;
}

export async function updateRegolePrenotazione(payload) {
  const { error } = await supabase
    .from("service_settings")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}
