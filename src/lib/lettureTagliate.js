// LE LETTURE TAGLIATE — dove si raccolgono, e chi le guarda.
//
// 🔴 IL PROBLEMA (misurato il 19/08/2026). Chiedendo un elenco al database
// senza dire quante righe si vogliono, ne tornano **al massimo mille**, e
// **non arriva nessun errore**: la risposta è più corta e sembra intera. Non
// è una scelta scritta nel nostro codice — è l'impostazione «Max rows» del
// progetto Supabase, di fabbrica 1000. *Un tetto che non sta nel codice non
// si vede leggendo il codice.*
//
// ⚠️ È la stessa regola della sala che non si disegna vuota (19/08): **un
// dato che non si è riusciti a leggere per intero non si mostra come se
// fosse intero.** Con una differenza che lo rende peggiore: lì mancava
// tutto e si vedeva, qui manca solo la coda — e una somma calcolata su un
// elenco tagliato è un numero credibile e falso, che nessuno rilegge.
//
// Questo file è il posto dove le letture tagliate si accumulano; il
// riconoscimento sta in `supabase.js`, dentro l'unico punto da cui passano
// tutte le letture, e chi le mostra è `<AvvisoLettureTagliate>`.
//
// ⚠️ **Non è un registro tecnico**: se finisse in un file di diagnostica non
// lo leggerebbe nessuno, e il difetto resterebbe quello che era — una
// risposta incompleta con l'aria di essere completa.

const tagliate = new Map();
const ascoltatori = new Set();

/**
 * Una lettura è tornata più corta di quello che c'era.
 *
 * @param dove     "cash_movements" — la tabella o la funzione interrogata
 * @param ricevute quante righe sono arrivate
 * @param totali   quante ce n'erano davvero (dichiarate dal database)
 */
export function segnalaLetturaTagliata(dove, ricevute, totali) {
  const prima = tagliate.get(dove);
  // Si tiene il caso PEGGIORE visto per quella tabella: se una schermata
  // legge due volte, la seconda con un filtro più stretto, il numero che
  // conta resta quello che ha mostrato il problema.
  if (prima && prima.totali >= totali) return;
  tagliate.set(dove, { dove, ricevute, totali });
  for (const fn of ascoltatori) fn(elencoLettureTagliate());
}

export function elencoLettureTagliate() {
  return [...tagliate.values()];
}

/**
 * Vero se quella tabella (o funzione) è stata letta a metà.
 *
 * Serve a chi deve decidere di NON fare qualcosa — esportare un file,
 * stampare un documento — invece che limitarsi ad avvisare.
 */
export function letturaTagliata(dove) {
  return tagliate.has(dove);
}

export function ascoltaLettureTagliate(fn) {
  ascoltatori.add(fn);
  return () => ascoltatori.delete(fn);
}

/**
 * ⚠️ Si dimentica solo su richiesta esplicita di chi ha ristretto la
 * ricerca, mai da sola allo scadere di un tempo: un avviso che sparisce
 * per conto suo lascia sullo schermo dei numeri che nessuno sa più essere
 * parziali.
 */
export function dimenticaLettureTagliate() {
  tagliate.clear();
  for (const fn of ascoltatori) fn([]);
}
