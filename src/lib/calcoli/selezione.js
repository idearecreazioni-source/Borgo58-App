// =====================================================================
// SI SELEZIONA UN TAVOLO O UN TAVOLONE, MAI DUE TAVOLI LONTANI
// =====================================================================
// 🔴 NATA DA UN DIFETTO TROVATO DA ALESSIO col tablet in mano, 21/08/2026:
// ogni tocco SOMMAVA alla selezione. Si potevano prendere T1 e T9 — i due
// capi della sala — e aprirci sopra **una comanda sola**. Non è una comanda:
// è un errore che nessuno vede finché non arriva il preconto.
//
// ⚠️ QUI NON SI DECIDE COSA SIA UN TAVOLONE. Quello lo conta il database
// (`coperti_del_giorno`) e lo ridice `insiemiPerTavolo` — **la stessa mappa
// che colora la sala**. Questa funzione riceve l'insieme già fatto.
//
// ⚠️ Ed è la ragione per cui la regola vive qui e non dentro la schermata:
// una regola dentro un componente non la guarda nessuna prova, e in questo
// progetto **nessuna prova apre una schermata**.

/**
 * Che cosa resta selezionato dopo un tocco.
 *
 * @param selezione  gli id selezionati adesso
 * @param insieme    il tavolo toccato col suo tavolone (un tavolo singolo è
 *                   un insieme di uno)
 * @returns          la selezione nuova
 *
 * I quattro casi, che sono quelli chiesti da Alessio:
 *   · niente selezionato        → si seleziona l'insieme toccato
 *   · toccato un ALTRO tavolo   → si CAMBIA selezione, non si somma
 *   · ritoccato lo stesso       → si annulla
 *   · toccato un altro tavolo
 *     dello STESSO tavolone     → si annulla (è lo stesso insieme)
 */
export function selezioneDopoIlTocco(selezione = [], insieme = []) {
  if (insieme.length === 0) return selezione;
  const stessoInsieme =
    selezione.length === insieme.length && insieme.every((id) => selezione.includes(id));
  return stessoInsieme ? [] : [...insieme];
}
