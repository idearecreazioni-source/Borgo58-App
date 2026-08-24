// IL PERCORSO INVERSO — 24/08/2026, blocco 2(a) del mandato del collaudo.
//
// 🔴 IL CASO, con le parole di Alessio: *«se da una ricetta entro in una
// preparazione, e da lì in un'altra, tornando indietro finisco sempre in
// "Ricette" invece che al passo precedente»*. E peggiora da solo: la
// scomposizione che ha voluto lui — un ragù che contiene un soffritto che
// contiene altro — rende gli annidamenti profondi la norma, non
// l'eccezione.
//
// ⚠️ PERCHÉ NON `navigate(-1)`, che sarebbe stato una riga sola: il tasto
// indietro del browser torna *da dove si è arrivati*, che non è sempre il
// passo precedente — e soprattutto **non sa dirlo**. Un pulsante che dice
// «← Ragù alla siciliana» è un'informazione; uno che dice «←» è una
// scommessa. Qui il nome del passo precedente si vede prima di toccarlo.
//
// ⚠️ E IL PERCORSO VIAGGIA NELLO STATO DELLA NAVIGAZIONE, non in un
// deposito globale: due schede aperte sulla stessa app hanno due percorsi
// diversi, ed è giusto così. Il prezzo, dichiarato: un indirizzo copiato e
// incollato arriva senza percorso — e allora il ritorno è l'elenco, che è
// esattamente il comportamento di oggi.

/**
 * Il passo da aggiungere entrando in una ricetta figlia.
 *
 * ⚠️ SE SI TORNA SU UN PASSO GIÀ FATTO, IL PERCORSO SI ACCORCIA invece di
 * allungarsi. Senza questo, il giro A → B → A → B (che si fa senza
 * accorgersene, perché ogni ricetta elenca sia i suoi componenti sia le
 * ricette che la usano) allungherebbe la catena all'infinito, e il
 * ritorno indietro diventerebbe un labirinto lungo quanto la sessione.
 */
export function percorsoEntrando(percorso, passo) {
  const attuale = Array.isArray(percorso) ? percorso : [];
  if (!passo?.id) return attuale;

  const giaFatto = attuale.findIndex((p) => p.id === passo.id);
  if (giaFatto >= 0) return attuale.slice(0, giaFatto);

  return [...attuale, { id: passo.id, nome: passo.nome ?? "" }];
}

/**
 * Dove porta il tasto indietro, e come si chiama.
 *
 * Restituisce sempre una destinazione: senza percorso è l'elenco, che è
 * il comportamento di prima. ⚠️ Il percorso che si porta dietro è quello
 * **senza l'ultimo passo**, altrimenti tornando indietro si rientrerebbe
 * in sé stessi al giro dopo.
 */
export function ritornoIndietro(percorso, { elenco, etichettaElenco }) {
  const attuale = Array.isArray(percorso) ? percorso : [];
  const ultimo = attuale[attuale.length - 1];

  if (!ultimo) return { a: elenco, etichetta: etichettaElenco, percorso: [] };

  return {
    a: ultimo.a ?? `/ricettario/ricette/${ultimo.id}`,
    // ⚠️ Un passo senza nome non deve produrre «← »: capita a un passo
    // costruito male, e una freccia nuda non dice dove porta.
    etichetta: ultimo.nome?.trim() || etichettaElenco,
    percorso: attuale.slice(0, -1),
  };
}
