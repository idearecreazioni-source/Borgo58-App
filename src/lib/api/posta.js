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

/** Quante mail sistemate mostra la scheda «Sistemate»: le più recenti. */
export const SISTEMATE_MAX = 50;

/**
 * Le mail già sistemate (diventate documenti), per la scheda «Sistemate»
 * (08/11/2026). Queste sì con un tetto: crescono ogni giorno, e la scheda
 * serve a ritrovare le ultime, non a fare l'archivio — l'archivio vero è
 * in Documenti. La schermata dice quante ne mostra.
 */
export async function listPostaSistemata() {
  const { data, error } = await supabase
    .from("posta_ricevuta")
    .select(
      "*, allegati:posta_allegati(id, file_name, mime, dimensione, storage_path, errore)," +
        " azioni:posta_azioni(id, tipo, titolo, descrizione, perche, parametri, stato)"
    )
    // E le mail messe da parte dal filtro (11/11/2026): si vedono, per
    // accorgersi se il filtro ha preso una mail buona.
    // ⚠️ Riconosciute dalla nota, non dalla regola: tolta la regola
    //    (`filtrata_da` torna vuoto) le mail che aveva messo da parte devono
    //    restare in vista (revisione ECC dell'11/11).
    .or("stato.eq.archiviata,and(stato.eq.scartata,lettura_note.like.Filtrata*)")
    .order("ricevuta_il", { ascending: false })
    .limit(SISTEMATE_MAX);
  if (error) throw error;
  return data;
}

/**
 * Rimette una mail tolta per sbaglio (l'«Annulla» dopo «Togli la mail»).
 * Torna nello stato che aveva: `da_leggere` o `proposta`. Una riga sola,
 * con la RLS come barriera, come lo scarto.
 */
export async function rimettiPosta(postaId, stato) {
  const { data, error } = await supabase
    .from("posta_ricevuta")
    .update({ stato: stato === "da_leggere" ? "da_leggere" : "proposta", filtrata_da: null })
    .eq("id", postaId)
    .eq("stato", "scartata")
    .select("id");
  if (error) throw error;
  // Nessuna riga toccata: la mail non è più fra le tolte (cancellata dalla
  // pulizia, o rimessa da un'altra parte). Si dice, invece di far finta.
  if (!data?.length) throw new Error("Non riesco a rimetterla: questa mail non è più fra quelle tolte.");
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
 * Registra fra le Fatture fornitori la fattura elettronica arrivata dalla
 * PEC (08/11/2026). Sempre su Borgo 58, con i dati che `posta-leggi` ha
 * letto dall'XML: qui non si passa nessun dato della fattura, solo quale
 * proposta si conferma. Dal corridoio: fornitore, fattura e proposta
 * cambiano insieme.
 */
export async function registraFatturaDallaPosta(azioneId) {
  return eseguiOperazione("registra_fattura_dalla_posta", { p_azione_id: azioneId });
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
  // Solo una mail ancora aperta: una già sistemata (magari da un'altra
  // finestra) non torna indietro a «tolta» (revisione ECC dell'08/11).
  const { data, error } = await supabase
    .from("posta_ricevuta")
    .update({ stato: "scartata" })
    .eq("id", postaId)
    .in("stato", ["da_leggere", "proposta"])
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Questa mail è già stata sistemata: ricarica la pagina.");
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

/**
 * MEMO sta leggendo la posta su questo gestionale, oppure no?
 *
 * 🔴 La risposta esisteva nel database dal 12/08 (`lavori_in_silenzio()`) e
 * nessuna schermata poteva leggerla: era eseguibile dal solo proprietario.
 * Intanto la Posta prometteva «la lettura parte da sola entro un quarto
 * d'ora» su mail ferme da nove giorni, su un gestionale dove non girava
 * nessun lavoro pianificato.
 *
 * ⚠️ Non decide niente da sé: `lettore_posta_fermo()` lo CHIEDE a
 * `lavori_in_silenzio()`, che è l'unico posto dove si stabilisce quando un
 * lavoro è muto — con la sua tolleranza scritta in `lavori_sorvegliati`.
 */
export async function lettorePostaFermo() {
  const { data, error } = await supabase.rpc("lettore_posta_fermo");
  if (error) return null;
  const r = Array.isArray(data) ? data[0] : data;
  return r ?? null;
}

/**
 * Chiede a MEMO di fare un giro di lettura adesso.
 *
 * ⚠️ Costa: ogni giro chiama il modello. È un gesto esplicito di Alessio, e
 * per questo esiste un pulsante invece di un ritentativo automatico — la
 * regola del 12/08 sui ritentativi che si pagano.
 */
export async function chiediLetturaAdesso() {
  const { error } = await supabase.rpc("chiedi_lettura_posta");
  if (error) throw error;
}

/**
 * «Ignora le mail come questa» (11/11/2026): una regola mittente + tipo di
 * oggetto, oppure tutto il mittente se `tuttoMittente`. Mette da parte
 * anche questa mail. Due tabelle: dal corridoio. La PEC dello SdI la
 * rifiuta il database.
 */
export async function aggiungiFiltroPosta(postaId, tuttoMittente = false) {
  return eseguiOperazione("aggiungi_filtro_posta", {
    p_posta_id: postaId,
    p_tutto_mittente: !!tuttoMittente,
  });
}

/** Le regole del filtro, le più recenti prima. */
export async function listFiltriPosta() {
  const { data, error } = await supabase
    .from("posta_filtri")
    .select("id, mittente, oggetto_tipo, modo, nota, creato_il")
    .order("creato_il", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Toglie una regola. Le mail che aveva messo da parte restano fra le
 * filtrate in «Sistemate» (si riconoscono dalla nota): si rimettono una per una.
 * Una riga sola, con la RLS come barriera.
 */
export async function togliFiltroPosta(filtroId) {
  const { data, error } = await supabase.from("posta_filtri").delete().eq("id", filtroId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Questa regola non c'è più.");
}
