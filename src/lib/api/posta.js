import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// La posta in arrivo (§ modulo del 12/08/2026). Tutto qui dentro è
// visibile al solo titolare: la barriera vera è la RLS sulle tabelle,
// queste funzioni non aggiungono permessi.
//
// La forma è quella decisa da Alessio il 12/08: il gestionale non
// compila una scheda, **propone cose da fare**, e lui conferma o rifiuta
// una riga alla volta.

/**
 * La posta che aspetta una decisione, con le azioni proposte.
 *
 * Nessun `.limit()`: sono i messaggi non ancora decisi, quindi pochi per
 * costruzione, e troncarli nasconderebbe proprio quello dimenticato —
 * stessa ragione delle liste HACCP e di prima nota.
 */
export async function listPostaInAttesa() {
  const { data, error } = await supabase
    .from("posta_ricevuta")
    .select(
      "*, allegati:posta_allegati(id, file_name, mime, dimensione, storage_path, errore)," +
        " azioni:posta_azioni(id, tipo, titolo, perche, parametri, stato)"
    )
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
 * Conferma di una singola azione proposta.
 *
 * Passa dal corridoio perché una conferma può toccare tre tabelle in una
 * sola decisione — nasce il documento, nasce il promemoria della sua
 * scadenza, la mail si chiude quando non resta niente di indeciso
 * (regola B4 del contratto). `parametri` viaggia con le eventuali
 * correzioni di Alessio: quello che conferma è ciò che vede, non ciò che
 * l'assistente aveva scritto.
 */
export async function confermaAzione(azioneId, parametri) {
  return eseguiOperazione("esegui_azione_posta", {
    p_azione_id: azioneId,
    p_parametri: parametri ?? null,
  });
}

/**
 * Rifiuto di una singola azione: una riga sola, nessuna conseguenza
 * altrove — scrittura diretta con la RLS come barriera (categoria A).
 */
export async function rifiutaAzione(azioneId) {
  const { error } = await supabase
    .from("posta_azioni")
    .update({ stato: "rifiutata", decisa_il: new Date().toISOString() })
    .eq("id", azioneId);
  if (error) throw error;
}

/**
 * Scarto dell'intera mail: non serve niente di quello che propone.
 *
 * La mail non si cancella subito — resta fra le scartate finché la
 * pulizia automatica non la porta via, così un "no" dato per sbaglio si
 * può ancora rivedere.
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
