// Le fatture ai clienti (13/11/2026) — l'archivio nel database.
//
// Pezzo 1 di 5 del piano approvato da Alessio il 13/11: qui solo leggere,
// salvare il cliente e far uscire una bozza col suo numero. La pagina, il
// file XML e la spedizione dalla PEC arrivano nei pezzi successivi.
//
// ⚠️ Il numero NON si scrive mai da qui: lo dà `emetti_fattura()` nel
// database, sotto lucchetto, quando la fattura esce dalla bozza.

import { supabase } from "../supabase";

export async function listClientiFattura({ soloAttivi = true } = {}) {
  let q = supabase.from("clienti_fattura").select("*").order("denominazione").order("cognome");
  if (soloAttivi) q = q.eq("attivo", true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function salvaClienteFattura(cliente) {
  const { id, ...campi } = cliente;
  const q = id
    ? supabase.from("clienti_fattura").update({ ...campi, aggiornato_il: new Date().toISOString() }).eq("id", id)
    : supabase.from("clienti_fattura").insert(campi);
  const { data, error } = await q.select().single();
  if (error) throw error;
  return data;
}

export async function listFattureEmesse({ anno } = {}) {
  let q = supabase
    .from("fatture_emesse")
    .select("*, cliente:clienti_fattura(id, denominazione, nome, cognome), righe:fatture_emesse_righe(*)")
    .order("data", { ascending: false })
    .order("numero", { ascending: false, nullsFirst: true });
  if (anno) q = q.eq("anno", anno);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/** Fa uscire la bozza: il database le dà il numero e congela i totali. */
export async function emettiFattura(fatturaId) {
  const { data, error } = await supabase.rpc("emetti_fattura", { p_fattura: fatturaId });
  if (error) throw error;
  return data;
}
