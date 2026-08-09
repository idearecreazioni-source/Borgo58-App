// Il calcolo del conto — MODULO PURO, senza alcun import.
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
export function orderTotals(order, copertoPrice) {
  const items = (order?.items ?? []).filter((i) => !i.voided_at);
  const itemsTotal = items.reduce((s, i) => s + i.quantity * Number(i.unit_price), 0);
  const coperti = order?.coperti ?? 0;
  // Su un conto gia' chiuso vale il prezzo fotografato allora, non quello di oggi.
  const unit = Number(order?.coperto_unit_price ?? copertoPrice ?? 0);
  const copertoTotal = coperti * unit;
  return { items, itemsTotal, coperti, copertoUnitPrice: unit, copertoTotal, total: itemsTotal + copertoTotal };
}
