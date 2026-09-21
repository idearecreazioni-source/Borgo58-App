// =====================================================================
// QUALI DOCUMENTI SI POSSONO COLLEGARE A UNA FATTURA — 21/09/2026
// =====================================================================
// 🔴 PERCHE' ESISTE. La regola viveva dentro una riga sola della schermata
// delle Fatture Fornitori, e da li' non la poteva provare nessuno. Non e' una
// finezza: quella riga decide se un DDT arrivato dal fornitore si possa
// agganciare alla fattura che documenta, e **il modo in cui sbagliava era
// silenzioso** — non un errore, un elenco vuoto con scritto «Nessun documento
// libero di questa societa'».
//
// 🔴 IL DIFETTO CHE HA FATTO NASCERE QUESTO FILE, misurato il 21/09. I
// documenti nati dalla **posta** non avevano nessuna societa': la funzione
// `esegui_azione_posta` chiamava `create_document` senza passargliela. Qui la
// societa' del documento veniva confrontata con quella della fattura, e un
// valore assente non combacia mai — quindi **un DDT archiviato dalla posta non
// compariva fra i collegabili, mai, per nessuna fattura**.
//
// ⚠️ E LE DUE META' DELLA REGOLA VANNO TENUTE INSIEME, perche' curarne una
// sola rompe l'altra:
//   · un documento di CUI SI SA la societa' dev'essere offerto sulle fatture
//     di quella societa' — ed e' la meta' che non funzionava;
//   · un documento di cui NON si sa la societa' **non** dev'essere offerto,
//     ed e' la meta' che funzionava e che va conservata. Offrirlo «tanto poi
//     si vede» vorrebbe dire far comparire sulle fatture della S.r.l.s. un
//     documento che potrebbe essere dell'azienda agricola, senza che niente
//     lo dica. *Un'assenza di informazione non e' un permesso.*
//
// ⚠️ NON SI INDOVINA, ed e' la ragione per cui questa funzione non ha un
// ripiego: il posto dove la societa' si scrive e' il momento in cui il
// documento nasce — la scheda dell'Archivio o la scheda della Posta — non
// questo elenco.

/**
 * Un documento e' collegabile a una fattura quando:
 *   1. non e' gia' collegato a un'altra fattura;
 *   2. si sa a quale societa' appartiene;
 *   3. e' la stessa societa' della fattura.
 *
 * @param documento riga di `documents` (serve `entity_id`, `supplier_invoice_id`)
 * @param fattura   riga di `supplier_invoices` (serve `entity_id`)
 */
export function documentoCollegabile(documento, fattura) {
  if (!documento || !fattura) return false;
  if (documento.supplier_invoice_id) return false;
  // ⚠️ `?? null` prima del confronto: un documento senza societa' puo'
  //    arrivare con `null` o con `undefined` a seconda di come e' stato letto,
  //    e `undefined === null` e' falso. Senza questa riga la stessa riga si
  //    comporterebbe in due modi a seconda della query che l'ha portata.
  const societaDocumento = documento.entity_id ?? null;
  const societaFattura = fattura.entity_id ?? null;
  if (societaDocumento === null || societaFattura === null) return false;
  return societaDocumento === societaFattura;
}

/** I documenti collegabili a quella fattura, nell'ordine in cui arrivano. */
export function documentiCollegabili(documenti, fattura) {
  if (!Array.isArray(documenti)) return [];
  return documenti.filter((d) => documentoCollegabile(d, fattura));
}

/**
 * Quanti documenti restano fuori **solo** perche' non si sa di che societa'
 * siano. Serve alla schermata per dire la verita' quando l'elenco e' vuoto:
 * «non ce n'e' nessuno» e «ce ne sono, ma non si sa di chi» sono due fatti
 * diversi, e il secondo ha un rimedio — aprire il documento e scrivere la
 * societa'.
 */
export function senzaSocieta(documenti) {
  if (!Array.isArray(documenti)) return 0;
  return documenti.filter((d) => d && !d.supplier_invoice_id && (d.entity_id ?? null) === null).length;
}
