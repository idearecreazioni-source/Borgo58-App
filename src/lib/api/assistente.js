import { supabase } from "../supabase";
import { chiamaFunzione } from "../chiamaFunzione";

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
  const data = await chiamaFunzione(
    "assistente-archivio",
    { domanda },
    "chiedere all'archivio"
  );
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
  const data = await chiamaFunzione(
    "documento-leggi",
    { documento_id: documentoId, rileggi },
    "leggere il documento"
  );
  return data?.risultato ?? null;
}

/**
 * LEGGE UN FILE CHE L'ARCHIVIO NON HA ANCORA VISTO, e propone la scheda.
 *
 * 🔴 IL VERSO DEL GESTO SI È ROVESCIATO — 10/09/2026, Blocco 4 del mandato.
 * Prima si scriveva la scheda a mano e il file era un allegato in fondo;
 * adesso si sceglie il file, il gestionale lo legge, e la scheda arriva
 * **già compilata**. Copiare a mano nome, tipo e data da un foglio che si
 * ha davanti è il posto dove nascono gli errori che nessuno rilegge.
 *
 * 🔴 E QUI NON SI SCRIVE NIENTE, DA NESSUNA PARTE. Il file viaggia dentro
 * la richiesta, viene letto, e finisce lì: non tocca il deposito e non
 * tocca il database. È la stessa forma di `leggi-foto` (25/08), e rende la
 * promessa «niente entra nell'Archivio prima del Salva» una **proprietà**
 * invece che un controllo — non c'è nessun posto da cui togliere qualcosa.
 */
export async function leggiFileDaArchiviare(file) {
  const base64 = await inBase64(file);
  const data = await chiamaFunzione(
    "documento-leggi",
    { file: base64, nome_file: file.name },
    "leggere il file"
  );
  return data?.risultato ?? null;
}

/**
 * ⚠️ A PEZZI, e non `String.fromCharCode(...tutto)`: su un file di qualche
 * megabyte quella forma passa centinaia di migliaia di argomenti a una
 * funzione, e il browser si ferma. È un guasto che compare solo sui file
 * grandi — cioè proprio quelli che si archiviano.
 */
function inBase64(file) {
  return new Promise((risolvi, rifiuta) => {
    const lettore = new FileReader();
    lettore.onerror = () => rifiuta(new Error("Non riesco a leggere il file dal disco."));
    lettore.onload = () => {
      const byte = new Uint8Array(lettore.result);
      let s = "";
      const passo = 0x8000;
      for (let i = 0; i < byte.length; i += passo) {
        s += String.fromCharCode(...byte.subarray(i, i + passo));
      }
      risolvi(btoa(s));
    };
    lettore.readAsArrayBuffer(file);
  });
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
/**
 * Lo stesso confronto, ma sul PRODOTTO invece che sulla versione di un
 * fornitore: è la strada della spesa al mercato, dove una dicitura non
 * c'è (decisione di Alessio, 19/08).
 *
 * ⚠️ La regola è la stessa e sta in un posto solo: `variazione_prezzo`
 * qui sopra passa dalla medesima funzione del database.
 */
export async function variazionePrezzoProdotto({ ingredienteId, prezzo }) {
  const { data, error } = await supabase.rpc("variazione_prezzo_su", {
    p_ingredient_id: ingredienteId,
    p_articolo_id: null,
    p_prezzo: prezzo,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}
export async function variazionePrezzo({ articoloId, prezzo }) {
  const { data, error } = await supabase.rpc("variazione_prezzo", {
    p_articolo_id: articoloId,
    p_prezzo: prezzo,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

/**
 * Le versioni di un ingrediente che sono state comprate davvero: marca,
 * formato, fornitore, ultimo prezzo per unità — dalla più conveniente.
 *
 * Risponde a «chi me lo fa meglio», che è una decisione e non un allarme:
 * due fornitori hanno prezzi diversi per mille ragioni lecite, e un
 * avviso su ognuna sarebbe rumore.
 */
export async function variantiIngrediente(ingredienteId) {
  const { data, error } = await supabase.rpc("varianti_ingrediente", {
    p_ingredient_id: ingredienteId,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * Dichiara che due diciture sono lo stesso identico prodotto.
 *
 * Lo decide Alessio: il gestionale vede due stringhe di fornitori diversi
 * e non può sapere che dentro c'è la stessa cosa. Collegate, il confronto
 * dei prezzi le tratta insieme — ed è lì che «lo stesso prodotto da B lo
 * paghi 3 invece di 2» diventa un avviso invece di una cosa da notare a
 * occhio.
 */
/**
 * Dice di CHI è una dicitura.
 *
 * Le diciture nate leggendo una fattura portano con sé il fornitore di
 * quella fattura — ma solo se in quel momento il fornitore era già in
 * anagrafica. Le prime fatture di collaudo sono entrate quando di
 * fornitori non ce n'era nessuno, e quelle diciture sono rimaste senza
 * padrone: la lista della spesa poteva raggrupparle, ma l'ordine non
 * poteva chiamarle come le chiama lui.
 *
 * Lo dice Alessio, una volta: nessuno può indovinarlo al posto suo, e
 * indovinare male vorrebbe dire mandare a un fornitore le parole di un
 * altro.
 */
export async function assegnaFornitoreArticolo(articoloId, supplierId) {
  const { error } = await supabase
    .from("articoli_fornitore")
    .update({ supplier_id: supplierId || null })
    .eq("id", articoloId);
  if (error) {
    // Quel fornitore ha già una dicitura identica: sono la stessa riga,
    // non due. Meglio dirlo con parole sue che col codice del database.
    if (error.code === "23505") {
      throw new Error(
        "Questo fornitore ha già una versione con la stessa dicitura: sono la stessa cosa."
      );
    }
    throw error;
  }
}

export async function collegaArticoli(articoloId, stessoDi) {
  const { error } = await supabase.rpc("collega_articoli", {
    p_articolo: articoloId,
    p_stesso_di: stessoDi ?? null,
  });
  if (error) throw error;
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
