// LA META' DI `calcoli/versione.js` CHE TOCCA LA PAGINA.
//
// La regola sta di la' ed e' provabile da sola; qui c'e' soltanto il modo di
// chiedere al sito com'e' fatta la versione servita adesso, e di confrontarla
// con quella che sta girando. Il perche' di tutto questo e' nel cappello di
// `src/lib/calcoli/versione.js`.

import { impronta, ceUnAggiornamento } from "./calcoli/versione";
import { fotografa } from "./bozza";

// Ogni quanto si torna a chiedere, mentre la schermata e' sotto gli occhi.
//
// ⚠️ NON E' IL MECCANISMO PRINCIPALE, ed e' per questo che puo' essere cosi'
// largo: il caso vero e' **il tablet ripreso in mano**, e quello lo prende
// `visibilitychange` nell'istante in cui torna visibile. Questo battito
// copre solo il tablet che resta acceso tutta la sera senza che nessuno lo
// posi mai. Mezz'ora di ritardo li' non fa danno; chiedere ogni minuto
// sarebbe una richiesta al minuto per dispositivo, per sempre.
const OGNI_MINUTI = 30;

// ⚠️ SI CHIEDE `/`, NON L'INDIRIZZO SU CUI SIAMO. Sono lo stesso file — la
// regola `/*  /index.html  200` fa rispondere `index.html` a qualunque
// indirizzo — ma `/` non porta dietro filtri ne' ancore, quindi la risposta
// e' sempre la stessa cosa e la si puo' confrontare con se stessa.
const DOVE = "/";

const ascoltatori = new Set();
let trovato = false; // una volta trovato, non si torna indietro
let battito = null;

export function aggiornamentoDisponibile() {
  return trovato;
}

export function ascoltaAggiornamento(fn) {
  ascoltatori.add(fn);
  return () => ascoltatori.delete(fn);
}

/**
 * L'impronta della versione CHE STA GIRANDO ADESSO.
 *
 * ⚠️ Si legge dalla TESTA della pagina, non da uno stato del programma: li'
 * dentro ci sono esattamente i tag che il sito ha servito quando questa
 * pagina e' partita. Un valore messo da parte all'avvio sarebbe di nuovo
 * una seconda risposta alla stessa domanda.
 */
export function improntaDiQuestaPagina() {
  if (typeof document === "undefined") return null;
  return impronta(document.head?.innerHTML || "");
}

/**
 * L'impronta della versione SERVITA ADESSO, chiesta al sito.
 *
 * ⚠️ Qualunque cosa vada storta torna `null`, cioe' **non lo so**: rete
 * caduta, risposta non buona, pagina di un portale wifi. Vedi `confronta`
 * di la' per il perche' quel terzo stato non si puo' schiacciare su
 * «e' cambiata».
 */
export async function improntaServita() {
  try {
    // `no-store` scavalca la memoria del browser: senza, si rischia di
    // confrontare la versione servita con una copia di se stessi.
    const risposta = await fetch(DOVE, { cache: "no-store" });
    if (!risposta.ok) return null;

    // 🔴 L'ALTRA META' DELLA DIFESA CONTRO IL PORTALE WIFI (06/09, dalla
    // revisione). Una rete che chiede di accedere da una pagina sua risponde
    // «va tutto bene» **dirottando** la richiesta sul proprio indirizzo: la
    // pagina che torna e' regolare, e' completa, e non e' la nostra. Qui si
    // guarda da DOVE e' arrivata davvero la risposta, non cosa contiene.
    // ⚠️ Le due meta' prendono due portali diversi e servono tutt'e due:
    // questa prende quello che dirotta, la forma dell'`index.html` prende
    // quello che risponde al posto nostro senza spostare l'indirizzo.
    if (risposta.url) {
      const arrivata = new URL(risposta.url, window.location.href);
      if (arrivata.origin !== window.location.origin) return null;
    }

    return impronta(await risposta.text());
  } catch {
    return null;
  }
}

/** Guarda una volta. Torna `true` se da adesso c'e' un aggiornamento. */
export async function controllaAdesso() {
  if (trovato) return true;
  const qui = improntaDiQuestaPagina();
  if (!qui) return false; // mentre si sviluppa non c'e' nessuna impronta
  if (!ceUnAggiornamento(qui, await improntaServita())) return false;
  trovato = true;
  // Trovato quello che c'era da trovare: non c'e' piu' niente da chiedere.
  if (battito) { clearInterval(battito); battito = null; }
  for (const fn of ascoltatori) fn(true);
  return true;
}

/**
 * PRENDE l'aggiornamento: e' l'unica strada che ricarica, e la percorre
 * solo un dito.
 *
 * 🔴 NON ESISTE NESSUNA RICARICA AUTOMATICA, e non e' una cautela: e' la
 * forma. Ricaricare da soli mentre qualcuno sta compilando un modulo
 * significherebbe portargli via quello che sta scrivendo — quindi non c'e'
 * nessun caso da elencare in cui e' concesso, perche' non c'e' nessun
 * codice che lo faccia.
 *
 * ⚠️ E PRIMA DI RICARICARE SI FOTOGRAFA quello che c'e' scritto. Non e' un
 * secondo meccanismo: `fotografa()` e' **la stessa e unica** funzione che
 * gia' conserva le bozze, chiamata da un innesco in piu'. Cosi' «premere
 * Aggiorna non porta via niente» diventa una proprieta' di questo codice,
 * che si puo' provare — invece di una fiducia in cio' che il browser manda
 * prima di lasciare la pagina.
 */
export function prendiLAggiornamento() {
  fotografa();
  window.location.reload();
}

/** Si accende una volta sola, all'avvio della pagina. */
export function accendiLaSorveglianzaVersione() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // ⚠️ NON si guarda all'avvio: la pagina e' appena stata servita dal sito,
  // quindi per costruzione e' quella di adesso. Una richiesta li' sarebbe
  // buttata via a ogni apertura.
  document.addEventListener("visibilitychange", () => {
    // 🔴 QUESTO E' IL CASO VERO: il tablet in carica sul bancone, ripreso in
    // mano la mattina dopo. E' lo stesso momento su cui si appoggia l'avviso
    // della fine serata in Comande — se aspettasse un gesto, coprirebbe
    // tutti i casi tranne quello per cui esiste.
    if (document.visibilityState === "visible") controllaAdesso();
  });

  battito = setInterval(controllaAdesso, OGNI_MINUTI * 60 * 1000);
}
