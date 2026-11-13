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
  const dovuto = importoDaAnticipare(fattura);
  if (dovuto === null) return null;
  if (Math.round(nota * 100) === Math.round(dovuto * 100)) return null;
  return "Per segnare la fattura pagata con l'anticipo la nota deve valere quanto resta da pagare.";
}

// ---------------------------------------------------------------------
// «HO PAGATO IO» DA FATTURE FORNITORI — 13/11/2026
// ---------------------------------------------------------------------
// Richiesta di Alessio (Fabio Lorito 1992/2026, 235 €, pagata coi suoi
// contanti): nel menu «Come paghi» una scelta «Ho pagato io» che fa
// ESATTAMENTE quello del riquadro «Ho pagato io» in /cassa/personale.
// ⚠️ UNA LOGICA SOLA: si salva con la stessa `createAnticipazione` →
//    `registra_anticipazione` (anticipo collegato, fattura «pagata
//    (anticipo)», cassa ferma, debito verso di lui). Qui c'è solo il modo di
//    riempirne i campi partendo da una fattura.

/**
 * Il valore che la scelta «Ho pagato io» ha nel menu «Come paghi».
 * ⚠️ NON è un `payment_method` e non sta in PAYMENT_METHODS: il database la
 *    scrive «anticipo» da solo (`registra_anticipazione`), e una fattura
 *    segnata così senza una nota dietro risulterebbe pagata da nessuno.
 */
export const SCELTA_HO_PAGATO_IO = "ho_pagato_io";

/** Quanto deve valere l'anticipo per pagare questa fattura: quello che resta da pagare. */
export function importoDaAnticipare(fattura) {
  if (!fattura) return null;
  const dovuto = Number(fattura.da_pagare ?? fattura.amount);
  return Number.isFinite(dovuto) ? dovuto : null;
}

/**
 * I campi per `createAnticipazione` quando l'anticipo nasce dalla fattura.
 * Stessa forma del modulo di /cassa/personale: la società è quella della
 * fattura, l'importo è quello che resta da pagare, la spunta «investimento»
 * nasce spenta (se la fattura è segnata, la passa il database da solo).
 */
export function anticipoDallaFattura(fattura, { pagataIl, tagId, fondi = "contanti", nota = "" } = {}) {
  const importo = importoDaAnticipare(fattura);
  return {
    entityId: fattura.entity_id,
    importo: importo === null ? "" : String(importo),
    pagataIl,
    tagId,
    fondi,
    supplierInvoiceId: fattura.id,
    documento: "",
    nota,
    eInvestimento: false,
  };
}
