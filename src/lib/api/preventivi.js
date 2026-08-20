import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// I PREVENTIVI PER GLI EVENTI — blocco 1 del mandato (20/08/2026).
//
// 🔴 UN PREVENTIVO CONSERVA DUE NUMERI DIVERSI, e non vanno mai confusi:
// il **prezzo promesso** al cliente, che è una promessa e non cambia più, e
// il **costo del momento in cui è stato fatto**, che invecchia perché i
// prezzi si muovono. Mescolandoli, fra due mesi nessuno saprebbe se
// «costava 14» era il costo di allora o di adesso.
//
// ⚠️ E il costo NON si calcola qui: lo dice il database, con la stessa
// funzione che usa il magazzino per scaricare davvero. Se il numero mostrato
// al cliente e quello del magazzino nascessero in due posti, prima o poi
// divergerebbero — e la differenza la vedrebbe un ospite.

export async function listPreventivi({ dal, al } = {}) {
  let query = supabase
    .from("preventivi")
    .select("*, righe:preventivo_righe(*)")
    .order("data_evento", { ascending: false })
    .limit(200);
  if (dal) query = query.gte("data_evento", dal);
  if (al) query = query.lte("data_evento", al);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getPreventivo(id) {
  const { data, error } = await supabase
    .from("preventivi")
    .select("*, righe:preventivo_righe(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// ⚠️ Passa dal corridoio: testata e righe si scrivono insieme o non si
// scrivono. A metà resterebbe un preventivo col nome del cliente e senza
// dentro niente — e un costo di zero euro che sembra un numero.
export async function salvaPreventivo({ id, testata, righe }) {
  return eseguiOperazione("salva_preventivo", {
    p_preventivo_id: id ?? null,
    p_testata: testata,
    p_righe: righe ?? [],
  });
}

// Dopo l'accettazione non si sovrascrive: si crea una versione NUOVA
// collegata alla vecchia. ⚠️ Con un acconto versato e un prezzo concordato,
// sapere cosa era stato promesso e quando è la cosa che conta.
export async function nuovaVersionePreventivo(id) {
  return eseguiOperazione("nuova_versione_preventivo", { p_preventivo_id: id });
}

export async function fabbisognoPreventivo(id) {
  const { data, error } = await supabase.rpc("fabbisogno_preventivo", { p_preventivo_id: id });
  if (error) throw error;
  return data ?? [];
}

// ⚠️ Restituisce il prezzo E l'avvertenza che ne dichiara il limite: il
// ricarico si applica al SOLO cibo, e gli extra si sommano dopo. Viaggiano
// insieme perché un avviso scritto nel testo di una schermata non protegge
// la seconda schermata che mostra lo stesso numero.
export async function prezzoPreventivo(id) {
  const { data, error } = await supabase.rpc("prezzo_preventivo", { p_preventivo_id: id });
  if (error) throw error;
  return data?.[0] ?? null;
}
