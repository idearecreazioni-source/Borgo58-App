// RILEGGERE OGNI TANTO, MA SOLO SE QUALCUNO GUARDA — 27/10/2026
//
// Bar e Cucina rileggono gli ordini ogni pochi secondi. Fino a oggi lo
// facevano anche col tablet in standby o con la scheda nascosta: sei
// richieste al minuto per reparto, per ogni schermo aperto, che nessuno
// leggeva. Qui il giro salta finché la pagina non si vede, e quando torna
// visibile rilegge SUBITO: chi riaccende il tablet vede gli ordini di adesso,
// non quelli di quando l'ha spento.

/**
 * Chiama `leggi` ogni `ms` millisecondi mentre la pagina è visibile, e una
 * volta in più appena torna visibile. Restituisce la funzione che smette.
 */
export function ogniTantoSeVisibile(leggi, ms, doc = globalThis.document) {
  const visibile = () => !doc || doc.visibilityState !== "hidden";
  const giro = setInterval(() => {
    if (visibile()) leggi();
  }, ms);
  const alRitorno = () => {
    if (visibile()) leggi();
  };
  doc?.addEventListener?.("visibilitychange", alRitorno);
  return () => {
    clearInterval(giro);
    doc?.removeEventListener?.("visibilitychange", alRitorno);
  };
}
