// Il calcolo del conto — MODULO PURO, senza altri import che il gemello.
//
// Vive qui e non in api/orders.js per due ragioni (Attività B del
// pacchetto rifiniture, 09/08/2026):
//  1. e' matematica, non accesso ai dati: non deve trascinarsi dietro la
//     creazione del client Supabase;
//  2. le prove di unità devono girare su una MACCHINA PULITA, senza
//     .env: prima il test importava (via orders.js) il modulo che crea il
//     client, che senza chiavi esplode — e il gancio pre-commit
//     certificava una suite che altrove non partiva nemmeno.
//
// Preconto, chiusura conto e totale a schermo devono dire lo STESSO
// numero: questo e' l'unico posto dove il conto si calcola. Le righe
// annullate non contano; il coperto si somma a parte perche' sul
// preconto va mostrato come voce propria ("4 coperti × 5,00 €").
// ⚠️ Dal 16/08/2026 (Blocco 4.2 del mandato di correzione, decisione di
// Alessio) una riga MAI MANDATA IN CUCINA non si addebita: non e' un
// piatto servito, e alla chiusura non deve nemmeno scaricare il magazzino.
//
// ⚠️ Ma non spariscono in silenzio: `nonInviate` esce insieme al totale,
// perche' chi chiude deve VEDERLO dichiarato. Una riga che se ne va dal
// conto senza una frase e' indistinguibile da un piatto dimenticato — ed
// e' la stessa forma dell'avvertenza che viaggia insieme al numero delle
// imposte.
//
// ⚠️ DAL 24/08/2026 UNA RIGA PUO' PORTARE UN SUPPLEMENTO: la sostituzione
// di un allergene («senza lattosio: burro → burro senza lattosio, +1,00»).
// Sta FUORI da `unit_price` per non sporcare il prezzo di carta del piatto,
// e la somma la fa `totaleRiga()` — lo stesso posto da cui la legge ogni
// schermata. Il gemello nel database e' `totale_conto()`, che restituisce
// anche `supplementi` a parte.
//
// 🔴 E SE `sostituzioni` NON ARRIVA NELLA `select`, QUESTO CONTO E' PIU'
// BASSO DEL VERO E NON LO DICE NESSUNO. E' la trappola del 16/08 sulle
// mance, allo specchio: li' un campo non arrivava al database, qui non
// arriva alla schermata. Per questo la stringa della `select` sta in un
// posto solo (`ORDER_SELECT` / `OPEN_ORDERS_SELECT` in api/orders.js) e una
// prova pura confronta questo totale con un conto che ha un supplemento.
import { supplementoRiga, totaleRiga } from "./righeComanda";

export function orderTotals(order, copertoPrice) {
  const vive = (order?.items ?? []).filter((i) => !i.voided_at);
  const items = vive.filter((i) => i.sent_at);
  const nonInviate = vive.filter((i) => !i.sent_at);
  const itemsTotal = items.reduce((s, i) => s + totaleRiga(i), 0);
  const supplementi = items.reduce((s, i) => s + i.quantity * supplementoRiga(i), 0);
  const nonInviateTotal = nonInviate.reduce((s, i) => s + totaleRiga(i), 0);
  const coperti = order?.coperti ?? 0;
  // Su un conto gia' chiuso vale il prezzo fotografato allora, non quello di oggi.
  const unit = Number(order?.coperto_unit_price ?? copertoPrice ?? 0);
  const copertoTotal = coperti * unit;
  return {
    items,
    itemsTotal,
    supplementi,
    nonInviate,
    nonInviateTotal,
    coperti,
    copertoUnitPrice: unit,
    copertoTotal,
    total: itemsTotal + copertoTotal,
  };
}
