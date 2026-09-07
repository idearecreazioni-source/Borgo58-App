// =====================================================================
// LA VIA D'USCITA A MANO — le regole pure
// =====================================================================
// Stanno qui e non dentro l'hook per la ragione di sempre: una regola
// dentro un componente si prova solo aprendo quel componente, e in questo
// progetto nessuna prova automatica guarda uno schermo.

/** Il nome del parametro nell'indirizzo, scritto una volta sola. */
export const PARAMETRO = "daVoce";

/**
 * L'indirizzo per finire a mano un'azione: `/cassa/prima-nota?daVoce=…`.
 *
 * ⚠️ NELL'INDIRIZZO VA SOLO L'IDENTIFICATIVO, mai i campi: importi, nomi di
 * fornitori e note non finiscono in una query string — e la schermata li
 * chiede al database, dove non possono essere diversi da quelli dell'azione.
 *
 * ⚠️ Senza percorso restituisce `null` invece di un indirizzo a metà: è il
 * caso della nota non capita, dove non si sa dove mandare. Un collegamento
 * che porta da nessuna parte è peggio di nessun collegamento.
 */
export function indirizzoAMano(percorso, id) {
  if (!percorso || !id) return null;
  // 🔴 SE IL PERCORSO HA GIA' UNA DOMANDA, SI ATTACCA CON LA «E» —
  //    07/09/2026. Con un secondo «?» l'indirizzo non e' rotto in modo
  //    visibile: il browser lo accetta e il parametro finisce dentro il
  //    valore del primo. La spesa dalla tasca porta gia'
  //    `?soggetto=tasca`, quindi sarebbe arrivata su una schermata senza
  //    niente di precompilato — cioe' avrebbe buttato via quello che il
  //    gestionale aveva capito, senza dare nessun errore.
  const attacco = percorso.includes("?") ? "&" : "?";
  return `${percorso}${attacco}${PARAMETRO}=${encodeURIComponent(id)}`;
}

/**
 * Applica i campi capiti senza cancellare quelli che non lo erano.
 *
 * ⚠️ È la regola che rende innocuo il precompilamento: un campo che
 * l'assistente non ha capito NON arriva, e quello che c'era — la data
 * proposta dalla serata, il mezzo predefinito — deve restare. Sovrascrivere
 * con un vuoto sarebbe peggio che non precompilare affatto.
 */
export function conCampi(attuale, campi, mappa) {
  const fuori = { ...attuale };
  for (const [daVoce, nelModulo] of Object.entries(mappa)) {
    const v = campi?.[daVoce];
    if (v !== undefined && v !== null && v !== "") fuori[nelModulo] = v;
  }
  return fuori;
}
