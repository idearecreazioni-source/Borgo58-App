// «Pagata (anticipo)» — 01/11/2026.
//
// Una fattura fornitore collegata a una nota «Anticipo da rimborsarmi» e'
// pagata, ma NON dalla societa': ha pagato Alessio di tasca sua, e il debito
// verso di lui resta fra gli anticipi da rimborsare. Il database la segna
// `pagata` con `payment_method = 'anticipo'` (migrazione 20261101000001).
//
// ⚠️ Queste funzioni sono PURE e vivono qui perche' la schermata delle
//    fatture e quella degli anticipi dicono la stessa cosa con le stesse
//    parole, e la regola sta in un posto solo.

export const METODO_ANTICIPO = "anticipo";

/** La fattura risulta pagata con un anticipo del titolare? */
export function eFatturaPagataConAnticipo(fattura) {
  return fattura?.status === "pagata" && fattura?.payment_method === METODO_ANTICIPO;
}

/**
 * Come si legge il pagamento di una fattura pagata, accanto alla data.
 * «anticipo» non e' un metodo da scegliere: non sta nel menu «Come paghi».
 */
export function etichettaPagamento(fattura, nomeDelMetodo) {
  if (eFatturaPagataConAnticipo(fattura)) return "pagata (anticipo)";
  return fattura?.payment_method ? nomeDelMetodo(fattura.payment_method) : "";
}

/**
 * Vale l'anticipo per questa fattura? Il database accetta il collegamento
 * solo se la nota vale esattamente quanto resta da pagare. Serve alla
 * schermata per dirlo PRIMA di premere «Registra».
 * Ritorna null se va bene o se non si puo' ancora dire, altrimenti la frase.
 */
export function avvisoImportoAnticipo(importo, fattura) {
  if (!fattura) return null;
  const nota = Number(importo);
  if (!importo || !Number.isFinite(nota)) return null;
  const dovuto = Number(fattura.da_pagare ?? fattura.amount);
  if (!Number.isFinite(dovuto)) return null;
  if (Math.round(nota * 100) === Math.round(dovuto * 100)) return null;
  return "Per segnare la fattura pagata con l'anticipo la nota deve valere quanto resta da pagare.";
}
