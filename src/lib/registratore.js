// IL PUNTO IN CUI IL GESTIONALE PARLA COL REGISTRATORE TELEMATICO.
//
// 🔴 È UNO SOLO, ED È IL MOTIVO PER CUI ESISTE QUESTO FILE (20/08/2026,
// blocco 1 del mandato). Oggi non parla con niente: il registratore non è
// ancora stato scelto. Ma il simulatore che verrà — quello che deve saper
// fare la stampante muta, la risposta a metà, la doppia stampa e la pagina
// bianca — deve poter prendere il posto di **questa funzione e basta**. Se
// le schermate chiamassero l'apparecchio ognuna per conto suo, il simulatore
// dovrebbe infilarsi in dieci posti.
//
// ⚠️ E il gesto che si sta proteggendo è questo: per il cameriere «chiudo il
// conto» è UN gesto, per la macchina sono DUE — chiudere e stampare. Il
// secondo può fallire da solo, e quando fallisce il cliente è già fuori.
//
// ⚠️ CHIUDERE IL CONTO NON DIPENDE DA QUI: la sala non si blocca mai davanti
// al cliente. Se lo scontrino non esce, il conto resta senza documento e
// finisce nell'elenco «da fiscalizzare» — che a fine serata si fa notare da
// solo, alla chiusura della giornata.

export const ESITI = {
  FATTO: "fatto",
  NON_COLLEGATO: "non_collegato",
  MUTO: "muto",
  A_META: "a_meta",
  ERRORE: "errore",
};

/**
 * Chiede al registratore di emettere lo scontrino di un conto.
 *
 * Oggi risponde sempre `non_collegato`, ed è la verità: non c'è nessun
 * apparecchio. ⚠️ **Non risponde `fatto`**, che sarebbe la bugia comoda —
 * segnerebbe i conti come scontrinati e svuoterebbe l'elenco che è l'unica
 * rete di questo blocco.
 *
 * Restituisce `{ esito, numero, messaggio }`.
 */
// eslint-disable-next-line no-unused-vars
export async function emettiScontrino(conto) {
  return {
    esito: ESITI.NON_COLLEGATO,
    numero: null,
    messaggio:
      "Il registratore telematico non è ancora collegato: il conto resta fra quelli da fiscalizzare.",
  };
}

// ⚠️ Solo `fatto` vale come «lo scontrino è uscito». Tutto il resto — muto,
// a metà, non collegato — lascia il conto senza documento. È scritto qui e
// non nelle schermate perché la domanda «è uscito?» abbia una risposta sola.
export function scontrinoEmesso(risposta) {
  return risposta?.esito === ESITI.FATTO && !!risposta?.numero;
}
