// =====================================================================
// QUANDO E' STATA PUBBLICATA UNA VERSIONE NUOVA
// =====================================================================
// 🔴 IL DIFETTO, emerso dopo SPEC-0005: un tablet che aveva gia' aperto il
// gestionale continuava a mostrare l'interfaccia di prima anche dopo una
// pubblicazione. E la causa NON e' la cache del browser — e' stata misurata
// il 06/09/2026 chiedendo le intestazioni vere a borgo58.it:
//
//   index.html          Cache-Control: public, max-age=0, must-revalidate
//   /assets/index-….js  nome con l'impronta dentro, quindi mai riusato
//
// Cioe': **una ricarica prende sempre la versione nuova**. Il difetto e' che
// non ricarica nessuno. Non c'e' service worker, e una pagina aperta — o
// un'app aggiunta alla schermata iniziale, ripresa dalla memoria — continua
// a far girare il pacchetto che aveva scaricato quel giorno, per sempre.
// *Il pacchetto non e' vecchio perche' e' conservato male: e' vecchio perche'
// nessuno gli ha mai detto che ne esiste un altro.*
//
// ⚠️ L'IMPRONTA NON E' UN NUMERO DI VERSIONE NUOVO, ed e' la scelta che
// tiene in piedi tutto il resto. Un marcatore scritto al momento della
// costruzione sarebbe una **seconda risposta** alla domanda «quale versione
// e' questa», accanto a quella che il browser usa davvero per decidere cosa
// caricare — e due risposte che *dovrebbero* coincidere sono il difetto che
// `vite.config.js` ha gia' chiuso una volta: «due strade per la stessa
// risposta sono un doppione da togliere, non una difesa in piu'».
// Qui la versione **e'** l'elenco dei file che `index.html` nomina: cambia
// da se' a ogni costruzione che cambia qualcosa, e non puo' divergere dalla
// realta' perche' e' la realta'.
//
// ⚠️ UNA REGOLA SOLA, DUE INGRESSI: la stessa funzione legge l'`index.html`
// servito adesso e la testa della pagina che sta girando. Se leggessero in
// due modi diversi, un giorno direbbero cose diverse senza che nessuno
// abbia cambiato niente.

// COME SI RICONOSCE UNA VERSIONE DEL GESTIONALE.
//
// 🔴 NON BASTA CERCARE LA PAROLA `/assets/` NEL TESTO, ed e' il difetto che
// la revisione del 06/09 ha trovato in questa stessa funzione. Misurato: una
// pagina ESTRANEA che risponde «va tutto bene» e che nomina un proprio file
// — il portale di una rete wifi, la pagina d'errore di un altro sito —
// produceva un'impronta perfettamente valida, quindi «diversa», quindi
// **un aggiornamento annunciato che non esiste**. Cioe' esattamente il falso
// allarme che il terzo stato esiste per evitare, entrato dalla porta di
// fianco: non «non ho letto la risposta», ma «ho letto la risposta
// sbagliata credendo che fosse la mia».
//
// ⚠️ E LA PROVA CHE DOVEVA COPRIRE QUEL CASO ERA PIU' DEBOLE DEL CASO: usava
// un portale **senza** file in `/assets/`, che e' l'unica versione del
// problema che passa da sola. *Una prova costruita sul caso comodo dice che
// il codice regge il caso comodo.*
//
// Quindi si chiedono due cose, e nessuna delle due e' una parola nel testo:
//   1. i riferimenti si prendono dagli ATTRIBUTI `src`/`href` dei tag, non
//      da una stringa che capita di passare di li';
//   2. dentro ci dev'essere il PEZZO PRINCIPALE del gestionale — lo script
//      di modulo che il browser carica per primo. E' la forma che ha
//      l'`index.html` costruito da Vite, e una pagina che non ce l'ha non e'
//      il gestionale, qualunque altra cosa contenga.
//
// ⚠️ IL LIMITE, DICHIARATO: una pagina che imitasse esattamente questa forma
// resterebbe indistinguibile. Non e' una svista — non esiste niente da
// guardare che la distinguerebbe. L'altra meta' della difesa non sta qui: sta
// in `improntaServita`, che scarta una risposta arrivata da un indirizzo
// diverso dal nostro, ed e' quella che prende il portale che dirotta.
//
// ⚠️ E SI SBAGLIA NEL VERSO RUMOROSO: se un giorno Vite cambiasse la forma
// dei suoi tag, questa funzione direbbe «non lo so» e il gestionale
// smetterebbe di annunciare gli aggiornamenti **in silenzio** — che sarebbe
// il difetto di partenza tornato. A impedirlo c'e' una prova che legge il
// pacchetto VERO e pretende che l'impronta esista: diventa rossa da sola.
const TAG = /<(script|link)\b[^>]*>/gi;
const INDIRIZZO = /\b(?:src|href)\s*=\s*["']([^"']+)["']/i;
const DI_MODULO = /\btype\s*=\s*["']module["']/i;
const CON_IMPRONTA = /^\/assets\/[A-Za-z0-9._-]+$/;

/**
 * L'impronta di una versione: i file che quel pezzo di HTML CARICA.
 *
 * Torna `null` quando quello che si sta guardando non e' riconoscibile come
 * il gestionale — che vuol dire **non lo so**, mai «e' cambiata».
 *
 * ⚠️ Si ORDINA e si toglie il doppione: due costruzioni identiche che
 * mettessero i tag in ordine diverso sono la stessa versione, e un avviso
 * che comparisse per quello sarebbe un falso allarme permanente.
 */
export function impronta(html) {
  if (typeof html !== "string") return null;

  const trovati = new Set();
  let cePezzoPrincipale = false;

  for (const [tag, quale] of html.matchAll(TAG)) {
    const indirizzo = tag.match(INDIRIZZO)?.[1];
    if (!indirizzo || !CON_IMPRONTA.test(indirizzo)) continue;
    trovati.add(indirizzo);
    if (quale.toLowerCase() === "script" && DI_MODULO.test(tag) && indirizzo.endsWith(".js")) {
      cePezzoPrincipale = true;
    }
  }

  // Senza il pezzo principale non e' il gestionale: non si sa che pagina sia.
  if (!cePezzoPrincipale) return null;
  return [...trovati].sort().join(" ");
}

/**
 * Le risposte sono TRE, non due.
 *
 * 🔴 «uguale» · «diversa» · **«non lo so»**, ed e' la terza che protegge.
 * Una richiesta caduta, il portale di una rete wifi che risponde con la
 * propria pagina, una risposta a meta': in tutti questi casi non si e'
 * letta la versione servita — e *assenza di informazione non e' informazione
 * di assenza* (regola del 19/08). Rispondendo «diversa» si offrirebbe un
 * aggiornamento che non esiste, ogni volta che la rete fa i capricci: un
 * avviso che compare senza motivo si impara a ignorare, e il giorno che
 * l'aggiornamento c'e' davvero nessuno lo guarda.
 */
export function confronta(quiDentro, laFuori) {
  if (!quiDentro || !laFuori) return "non lo so";
  return quiDentro === laFuori ? "uguale" : "diversa";
}

/** C'e' una versione nuova da prendere? Solo un «diversa» vale un avviso. */
export function ceUnAggiornamento(quiDentro, laFuori) {
  return confronta(quiDentro, laFuori) === "diversa";
}
