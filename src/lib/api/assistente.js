import { supabase } from "../supabase";

// L'assistente che risponde sui documenti archiviati (12/08/2026).
//
// Non passa dal corridoio delle operazioni atomiche perché non scrive
// niente di quello che si vede: legge l'Archivio e risponde (categoria B2
// del contratto — la chiave dell'account AI è un segreto, quindi Edge
// Function, ma nessuna scrittura multi-tabella da rendere atomica).

/**
 * Fa una domanda all'Archivio.
 *
 * Restituisce la risposta insieme a **quanti documenti sono stati
 * guardati e quali letti davvero**: senza quei numeri una risposta
 * parziale sembra completa, ed è il modo più facile per fidarsi di un
 * "non risulta" che vuol dire solo "non ho guardato lì".
 */
export async function chiediAllArchivio(domanda) {
  const { data, error } = await supabase.functions.invoke("assistente-archivio", {
    body: { domanda },
  });

  if (error) {
    // La funzione risponde { errore: { messaggio } } con frasi scritte per
    // Alessio ("Limite di spesa raggiunto"): vanno mostrate intatte, non
    // sostituite da un generico "non-2xx".
    let messaggio = error.message;
    try {
      const corpo = await error.context?.json();
      if (corpo?.errore?.messaggio) messaggio = corpo.errore.messaggio;
    } catch {
      // risposta senza corpo JSON: si tiene il messaggio generico
    }
    throw new Error(messaggio);
  }

  return data?.risultato ?? null;
}

/**
 * Mette il contenuto dentro un documento già archiviato.
 *
 * Serve per i documenti entrati **prima** che il contenuto si conservasse
 * da solo: senza, l'assistente ne conosce solo la scheda e risponde «non
 * ce l'ho» a domande la cui risposta è nel file, a un centimetro.
 *
 * `rileggi` sovrascrive un contenuto già presente: costa e cancella,
 * quindi si chiede per nome.
 */
export async function leggiContenutoDocumento(documentoId, { rileggi = false } = {}) {
  const { data, error } = await supabase.functions.invoke("documento-leggi", {
    body: { documento_id: documentoId, rileggi },
  });

  if (error) {
    let messaggio = error.message;
    try {
      const corpo = await error.context?.json();
      if (corpo?.errore?.messaggio) messaggio = corpo.errore.messaggio;
    } catch {
      // risposta senza corpo JSON: si tiene il messaggio generico
    }
    throw new Error(messaggio);
  }

  return data?.risultato ?? null;
}

/**
 * Cosa si pagava prima quel prodotto da quel fornitore, e di quanto si è
 * saliti.
 *
 * Serve a mostrare il rincaro **prima** che Alessio confermi il carico: se
 * il fornitore ha sbagliato la fattura, se ne accorge mentre può ancora
 * non registrarla. La stessa regola è applicata dal database quando il
 * carico viene eseguito — qui si legge soltanto.
 */
export async function variazionePrezzo({ ingredienteId, fornitoreId, prezzo }) {
  const { data, error } = await supabase.rpc("variazione_prezzo", {
    p_ingredient_id: ingredienteId,
    p_supplier_id: fornitoreId ?? null,
    p_prezzo: prezzo,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

/**
 * Le domande già fatte, con quanto sono costate.
 *
 * Limite esplicito: è una lista che cresce a ogni domanda e non alimenta
 * nessun documento esibibile (§8 di CLAUDE.md — la trappola vale per
 * HACCP e prima nota, non qui).
 */
export async function listDomandeArchivio(quante = 20) {
  const { data, error } = await supabase
    .from("domande_archivio")
    .select("*")
    .order("creato_il", { ascending: false })
    .limit(quante);
  if (error) throw error;
  return data;
}
