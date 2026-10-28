import { supabase } from "../supabase";

// LE CHIAVI DEI PROMEMORIA PER LUOGO — 28/10/2026.
// Stessa forma delle chiavi della voce (`api/voce.js`), ma chiavi diverse:
// queste stanno nell'automazione «quando arrivo a…» dell'iPhone e servono
// solo a leggere i promemoria di un luogo (migrazione 20261028000003).

export async function chiaviLuogo() {
  const { data, error } = await supabase.rpc("chiavi_luogo_elenco");
  if (error) throw error;
  return data ?? [];
}

/** Crea una chiave e la restituisce IN CHIARO — una volta sola. */
export async function creaChiaveLuogo(nome) {
  const { data, error } = await supabase.rpc("crea_chiave_luogo", { p_nome: nome });
  if (error) throw error;
  return data;
}

export async function revocaChiaveLuogo(id) {
  const { data, error } = await supabase.rpc("revoca_chiave_luogo", { p_id: id });
  if (error) throw error;
  return data;
}

/** L'indirizzo che l'automazione chiama: quello del gestionale aperto. */
export const indirizzoPromemoriaLuogo = () =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/promemoria-luogo`;
