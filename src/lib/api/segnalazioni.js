// Il quaderno dei difetti (25/10/2026, tappa 1 del piano «MEMO che controlla»).
//
// 🔴 SI SCRIVE DRITTO DAL BROWSER: una segnalazione è una tabella sola e
//    non produce effetti altrove, quindi niente corridoio. La barriera è la
//    RLS: solo il titolare la vede e la scrive.
//
// ⚠️ Dopo la nascita si cambiano solo stato ed esito — il database non
//    concede altro. Testo e contesto sono la testimonianza del momento.

import { supabase } from "../supabase";

export async function creaSegnalazione(riga) {
  const { data, error } = await supabase.from("segnalazioni").insert(riga).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function listSegnalazioni() {
  const { data, error } = await supabase
    .from("segnalazioni")
    .select("id, testo, provenienza, schermata, titolo_schermata, cosa_si_vedeva, stato, esito, creata_il, aggiornata_il")
    .order("creata_il", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function cambiaStatoSegnalazione(id, stato, esito = undefined) {
  const campi = { stato };
  if (esito !== undefined) campi.esito = esito?.trim() ? esito.trim() : null;
  const { error } = await supabase.from("segnalazioni").update(campi).eq("id", id);
  if (error) throw error;
}

export async function eliminaSegnalazione(id) {
  const { error } = await supabase.from("segnalazioni").delete().eq("id", id);
  if (error) throw error;
}
