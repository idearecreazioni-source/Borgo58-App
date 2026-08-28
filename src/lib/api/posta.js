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
        // `descrizione` va chiesta per nome: PostgREST, quando si elencano
        // le colonne di una tabella collegata, restituisce SOLO quelle —
        // e questa mancava dall'elenco fin da quando è nata. La schermata
        // ripiegava sul titolo senza dirlo, quindi la riga in italiano coi
        // dati dentro — il punto della critica di Alessio del 12/08 — non
        // è mai comparsa. Un difetto che non produce nessun errore: solo
        // una schermata più povera di quella che credevamo di avere.
        " azioni:posta_azioni(id, tipo, titolo, descrizione, perche, parametri, stato)"
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

/**
 * Dopo quanti tentativi falliti MEMO smette di riprovare a leggere.
 *
 * ⚠️ Vive nel database e non qui: la schermata e la funzione online che
 * legge devono usare LO STESSO numero, altrimenti la Posta racconta uno
 * stato di lettura che non corrisponde a quello vero — ed è esattamente
 * da lì che nasceva la frase «la lettura parte da sola entro un quarto
 * d'ora» su una mail che il lettore aveva già abbandonato.
 *
 * Se la lettura fallisce si restituisce `null`: chi chiama ripiega su un
 * valore dichiarato invece di far sparire la schermata.
 */
export async function getMaxTentativiLettura() {
  const { data, error } = await supabase
    .from("service_settings")
    .select("max_tentativi_lettura_posta")
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.max_tentativi_lettura_posta ?? null;
}

/**
 * Rimette in coda una mail che MEMO aveva abbandonato.
 *
 * 🔴 La funzione esisteva nel database dal 12/08 e NESSUNA schermata la
 * chiamava: una mail arresa restava `da_leggere` per sempre, esclusa
 * dalle letture future, e l'unico gesto offerto era buttarla via. Stessa
 * famiglia della soglia di magazzino del 13/08 — tutto acceso, e muto.
 *
 * Azzera i tentativi e la nota: una riga sola, con il portiere dentro la
 * funzione (categoria A, la RLS resta la barriera).
 */
export async function riprovaLettura(postaId) {
  const { error } = await supabase.rpc("riprova_lettura_posta", { p_posta_id: postaId });
  if (error) throw error;
}
