// UNA RIGA DI COMANDA — come si chiama e quanto vale. MODULO PURO.
//
// 🔴 NASCE IL 24/08/2026 PERCHÉ LA STESSA RIGA AVEVA QUATTRO NOMI. Misurato:
// `lineLabel` esisteva in **quattro copie** — Sala, Bar, Preconto, Chiusura
// conto — e **una sola** (quella della Sala) sapeva riconoscere un bis. Il
// risultato era che il bis di un finger si vedeva come «bis di X» solo sul
// tablet di chi lo batteva, e diventava il nudo nome del bocconcino **sul
// biglietto della cucina**, sul preconto e sul conto.
//
// ⚠️ Alessio l'aveva chiesto esplicitamente: *«la cucina deve vederlo
// arrivare come una richiesta a sé»*. Non era una spunta mancante: era una
// frase composta nel posto sbagliato, e le altre tre copie non l'hanno mai
// saputa. Stessa forma di `orderTotals()`: tre schermate che ricalcolano da
// sole finiscono per dire tre numeri diversi davanti al cliente.
//
// Vive qui e non in `api/orders.js` per la stessa ragione di `conto.js`: è
// matematica e parole, non accesso ai dati, e le prove di unità devono
// girare senza `.env`.

// È un bis? — la domanda in un posto solo.
//
// ⚠️ Una riga che punta a un FINGER è per forza un bis: un finger non si
// vende da solo, e il vincolo del menu non lo lascerebbe entrare come
// piatto. Una colonna «è_un_bis» direbbe esattamente la stessa cosa di
// `recipe_type = 'finger'` — col discriminante del 17/08 sarebbe un
// doppione da togliere, non un dato in più.
export const eUnBis = (item) => item?.recipe?.recipe_type === "finger";

// Su quali righe si può chiedere un bis: i piatti di finger food.
export const puoBissare = (item) => item?.recipe?.category === "finger_food";

// ⚠️ E la parola «bis» sta QUI e non nel database: se finisse nel nome
// della riga, un domani si leggerebbe «bis di bis di …».
export function nomeRiga(item) {
  if (!item) return "";
  if (eUnBis(item)) return `bis di ${item.recipe.name}`;
  return item.recipe?.name || item.free_text_name || "";
}

// IL SUPPLEMENTO DI UNA PORZIONE — le sostituzioni per allergene
// (24/08/2026, blocco 1 del mandato del collaudo).
//
// ⚠️ STA FUORI DA `unit_price` APPOSTA, ed è la richiesta di Alessio: il
// prezzo di carta del piatto deve restare quello, o ogni statistica sullo
// scontrino medio di quel piatto direbbe un numero inventato. Sul conto ci
// va lo stesso — altrimenti il locale regala una cosa che gli costa.
export function supplementoRiga(item) {
  return (item?.sostituzioni ?? []).reduce(
    (s, x) => s + Number(x.costo_aggiuntivo ?? 0),
    0
  );
}

// ⚠️ Il supplemento si moltiplica per la quantità: due porzioni senza
// lattosio sono due sostituzioni, non una.
export function totaleRiga(item) {
  return item.quantity * (Number(item.unit_price) + supplementoRiga(item));
}

// Cosa si legge sotto la riga, in cucina e sul conto. La frase è
// FOTOGRAFATA sulla sostituzione al momento del gesto: se domani Alessio
// riscrive la sostituzione nel Ricettario, questo conto non cambia.
export function frasiSostituzioni(item) {
  return (item?.sostituzioni ?? [])
    .map((x) => x.descrizione)
    .filter(Boolean)
    .sort();
}

// Quali allergeni sono stati tolti da questa riga — senza ripetizioni,
// perché un allergene può portarsi dietro più di una sostituzione.
export function allergeniTolti(item) {
  return [...new Set((item?.sostituzioni ?? []).map((x) => x.allergene))].sort();
}
