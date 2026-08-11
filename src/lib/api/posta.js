import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// La posta in arrivo (§ modulo del 12/08/2026). Tutto qui dentro è
// visibile al solo titolare: la barriera vera è la RLS sulle tabelle,
// queste funzioni non aggiungono permessi.

/**
 * La posta che aspetta una decisione.
 *
 * Nessun `.limit()`: sono i messaggi non ancora decisi, quindi pochi per
 * costruzione, e troncarli nasconderebbe proprio quello dimenticato —
 * stessa ragione delle liste HACCP e di prima nota.
 */
export async function listPostaInAttesa() {
  const { data, error } = await supabase
    .from("posta_ricevuta")
    .select("*, allegati:posta_allegati(id, file_name, mime, dimensione, storage_path, errore)")
    .in("stato", ["da_leggere", "proposta"])
    .order("ricevuta_il", { ascending: false });
  if (error) throw error;
  return data;
}

export async function contaPostaInAttesa() {
  const { count, error } = await supabase
    .from("posta_ricevuta")
    .select("id", { count: "exact", head: true })
    .in("stato", ["da_leggere", "proposta"]);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Conferma: la mail diventa un documento dell'Archivio.
 *
 * Passa dal corridoio perché sono tre scritture in una sola decisione
 * (documento, promemoria della scadenza, chiusura della mail) — regola B4
 * del contratto. Mai in sequenza da qui.
 */
export async function archiviaPosta({
  postaId, title, docType, documentDate, counterparties, amount, expiryDate, note, entityId,
}) {
  return eseguiOperazione("archivia_posta", {
    p_posta_id: postaId,
    p_title: title,
    p_doc_type: docType || null,
    p_document_date: documentDate || null,
    p_counterparties: counterparties || null,
    p_amount: amount === "" || amount == null ? null : Number(amount),
    p_expiry_date: expiryDate || null,
    p_note: note || null,
    p_entity_id: entityId || null,
  });
}

/**
 * Scarto: una riga sola, nessuna conseguenza altrove — quindi scrittura
 * diretta con la RLS come barriera (categoria A del contratto).
 *
 * La mail non si cancella subito: resta visibile fra le scartate finché
 * la pulizia automatica non la porta via, così un "no" dato per sbaglio
 * si può ancora rivedere.
 */
export async function scartaPosta(postaId) {
  const { error } = await supabase
    .from("posta_ricevuta")
    .update({ stato: "scartata" })
    .eq("id", postaId);
  if (error) throw error;
}

/** Link temporaneo per aprire un allegato (il bucket è privato). */
export async function getAllegatoUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
