// =====================================================================
// CHIUDERE UN IMPEGNO, IN UN POSTO SOLO — 12/09/2026
// =====================================================================
// 🔴 PERCHÉ ESISTE. Dalla Dashboard un impegno che si ripete si chiudeva e
//    NON nasceva il successivo (analisi nella #68): la casella scriveva
//    `status = 'completato'` dritto nella tabella, mentre il successivo lo
//    crea soltanto la funzione del database `completa_task` — che l'Agenda
//    usava già, attraverso il corridoio (`completaTask`).
//
// ⚠️ UNA STRADA SOLA PER AGENDA E DASHBOARD. La regola del successivo
//    (quando cade, cosa porta con sé: ora, descrizione, staff, visibilità,
//    categoria, stella, ricorrenza) sta tutta in `completa_task`. Qui non si
//    calcola niente: si manda l'identificativo e basta, così le due
//    schermate non possono chiudere un impegno in due modi diversi.
//
// ⚠️ IL SECONDO TOCCO NON PARTE. Mentre la chiusura di un impegno è in
//    volo, un altro tocco sullo stesso impegno torna subito indietro senza
//    chiamare niente. È la guardia sincrona del 27/08 (`unaVoltaSola` in
//    MEMO): il pulsante che sparisce arriva al render dopo, e fra il tocco e
//    il render chi non vede succedere niente ripreme. Il database resta
//    l'ultima parola: `completa_task` blocca la riga e rifiuta un impegno
//    già fatto, quindi il successivo nasce una volta sola anche se due
//    richieste arrivassero da due schermi diversi.
//
// ⚠️ LA RIGA SPARISCE SUBITO E TORNA SE IL SALVATAGGIO FALLISCE: è
//    `togliSubito`, lo stesso gesto che l'Agenda usa dal 25/08.
import { completaTask } from "./api/tasks";
import { togliSubito } from "./calcoli/tocco";

/** La frase che l'Agenda dice quando è nato il successivo di una ricorrenza. */
export const FRASE_NATO_IL_SUCCESSIVO = "Fatto. Ne è già nato uno nuovo alla prossima scadenza.";

const inCorso = new Set();

/**
 * Chiude l'impegno `id` e lo toglie da `righe` (con `mostra`, lo stato
 * dell'elenco). Restituisce `{ ok, esito }`: `esito` è l'identificativo
 * del successivo se l'impegno si ripete, vuoto se no.
 */
export async function chiudiImpegno({ righe, id, mostra, avvisa }) {
  if (inCorso.has(id)) return { ok: false, esito: undefined };
  inCorso.add(id);
  try {
    return await togliSubito({ righe, id, mostra, avvisa, salva: () => completaTask(id) });
  } finally {
    inCorso.delete(id);
  }
}
