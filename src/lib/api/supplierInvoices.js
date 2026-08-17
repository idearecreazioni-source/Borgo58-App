import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";
import { SELECT_FATTURA } from "../calcoli/selectFatture";

// L'entità viaggia insieme alla fattura, e non è un di più: il «da pagare»
// sommava S.r.l.s. e azienda agricola in un numero solo, che non è il
// debito di nessuna delle due. Per separarlo in schermata serve sapere di
// chi è ogni riga.
// ⚠️ `da_pagare` e `note_scalate` NON sono colonne della tabella: sono
// calcolate dal database e lette come se lo fossero. È il modo per avere
// «250 meno 40 fa 210» scritto in UN posto solo — rifarlo qui in
// JavaScript sarebbe un secondo calcolo dello stesso numero, che è il
// difetto chiuso in nove punti dal mandato di correzione.
//
// `utilizzi` porta le ETICHETTE delle note scalate (quale nota, di che
// data): serve a scrivere «fattura 250, nota −40, pagati 210» senza che
// nessuno debba sommare niente.
//
// La stringa sta in `calcoli/selectFatture.js` perché la prova automatica
// possa usare quella, non una copia: vedi il commento là.
const SELECT = SELECT_FATTURA;

// `dal`/`al` filtrano sulla DATA DELLA FATTURA, non sulla scadenza: è la
// data che si legge sul documento e quella che si ricorda («la fattura di
// marzo»). La scadenza serve a ordinare l'elenco, non a cercarci dentro.
export async function listSupplierInvoices({ status, supplierId, dal, al } = {}) {
  let query = supabase
    .from("supplier_invoices")
    .select(SELECT)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("invoice_date", { ascending: false });
  if (status) query = query.eq("status", status);
  if (supplierId) query = query.eq("supplier_id", supplierId);
  if (dal) query = query.gte("invoice_date", dal);
  if (al) query = query.lte("invoice_date", al);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// «Pagate di recente» mostrava TUTTE le fatture pagate dall'inizio dei
// tempi: fra due anni sarebbe stato un muro sotto la sola lista che serve
// davvero, quella da pagare. Si mostrano le ultime, e si dice quante ce ne
// sono in tutto — un elenco tagliato che non dichiara il taglio è un
// elenco che sembra completo (§8).
//
// ⚠️ Non è la stessa cosa del divieto di mettere limiti sulle liste HACCP
// e di prima nota: quelle alimentano documenti esibibili, dove un taglio
// silenzioso produrrebbe un registro incompleto. Qui è una comodità di
// schermata, e il numero totale resta scritto accanto.
export async function ultimeFatturePagate(limite = 20, { supplierId, dal, al } = {}) {
  let query = supabase
    .from("supplier_invoices")
    .select(SELECT, { count: "exact" })
    .eq("status", "pagata")
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(limite);
  if (supplierId) query = query.eq("supplier_id", supplierId);
  if (dal) query = query.gte("invoice_date", dal);
  if (al) query = query.lte("invoice_date", al);
  const { data, error, count } = await query;
  if (error) throw error;
  return { righe: data ?? [], quante: count ?? 0 };
}

// Se la fattura ha una scadenza, crea anche il promemoria collegato in
// Agenda (origine_modulo) — così non serve ricordarsene a parte.
export async function createSupplierInvoice({
  entityId,
  supplierId,
  invoiceNumber,
  invoiceDate,
  dueDate,
  amount,
  documentReference,
  note,
}) {
  // Fattura + eventuale promemoria di pagamento nella STESSA transazione
  // (funzione Postgres create_supplier_invoice, Contratto B4). Il nome del
  // fornitore nel titolo lo legge il database. Restituisce l'id.
  return eseguiOperazione("create_supplier_invoice", {
    p_entity_id: entityId,
    p_supplier_id: supplierId,
    p_invoice_date: invoiceDate,
    p_amount: amount,
    p_invoice_number: invoiceNumber || null,
    p_due_date: dueDate || null,
    p_document_reference: documentReference || null,
    p_note: note || null,
  });
}

// Pagamento e chiusura del promemoria nella STESSA transazione (funzione
// Postgres pay_supplier_invoice, Contratto B4). Prima la chiusura del task
// era una seconda chiamata separata: se falliva, la fattura risultava
// pagata col promemoria "Pagare fattura" ancora pendente in Agenda. Il
// doppio pagamento viene respinto dal database. Restituisce l'id.
// ⚠️ `dataUscita` è il giorno in cui i soldi ESCONO, non quello in cui si
// registra il pagamento (17/08/2026). Con un assegno a 30 giorni le due
// date sono diverse, e i saldi contano solo ciò che è già avvenuto: senza
// questo parametro la cassa scendeva un mese prima del dovuto.
// `riferimento` è il numero dell'assegno o del bonifico — senza, due
// uscite dello stesso importo allo stesso fornitore sono indistinguibili
// sull'estratto conto.
// ⚠️ `noteDaUsare` sono i crediti che si scelgono di scalare su QUESTA
// fattura (17/08/2026). Quanto di ognuno venga usato non lo decide questa
// riga: lo decide `crediti_da_applicare` nel database, la stessa funzione
// che alimenta l'anteprima — due crediti da 30 su una fattura da 40 si
// applicano per 40 in tutto, non per 60.
export async function markInvoicePaid(id, { paymentMethod, dataUscita, riferimento, noteDaUsare }) {
  return eseguiOperazione("pay_supplier_invoice", {
    p_invoice_id: id,
    p_payment_method: paymentMethod,
    p_data_uscita: dataUscita || null,
    p_riferimento: riferimento?.trim() || null,
    p_note_da_usare: noteDaUsare?.length ? noteDaUsare : null,
  });
}

// ---------------------------------------------------------------------
// Note di credito (n. 8 del collaudo, 17/08/2026)
// ---------------------------------------------------------------------
// La regola decisa da Alessio: se la nota arriva PRIMA del pagamento
// riduce quanto si paga (fattura 250, nota 40 → escono 210); se arriva
// DOPO resta come credito da usare sulla fattura successiva di quel
// fornitore. Il gestionale fa l'una o l'altra a seconda di quando arriva,
// e la differenza è tutta lì.

// Registra la nota e, se la fattura che corregge è ancora da pagare, la
// scala subito su di lei: due tabelle, una decisione (Contratto B4).
export async function registraNotaCredito({
  entityId,
  supplierId,
  data,
  importo,
  fatturaId,
  numero,
  note,
}) {
  return eseguiOperazione("registra_nota_credito", {
    p_entity_id: entityId,
    p_supplier_id: supplierId,
    p_data: data,
    p_importo: importo,
    p_fattura_id: fatturaId || null,
    p_numero: numero?.trim() || null,
    p_note: note?.trim() || null,
  });
}

// ⚠️ Respinta se la nota è già scalata su una fattura pagata: quel
// pagamento è stato più basso proprio per via sua. La via d'uscita è
// annullare il pagamento, e il messaggio del database la nomina.
//
// ⚠️ E RESTITUISCE UNA FRASE che dice cosa ha stornato — «la fattura BASE-058
// torna a 195,69 euro da pagare» — perché sull'altra strada l'effetto si
// storna in silenzio: il «da pagare» di quella fattura risale e niente lo
// dice. Un effetto stornato che nessuno annuncia è indistinguibile da un
// numero che cambia da solo (rilievo di Alessio, 17/08/2026). La frase va
// mostrata, non ignorata.
export async function eliminaNotaCredito(id) {
  return eseguiOperazione("elimina_nota_credito", { p_id: id });
}

// `credito_residuo` è calcolato dal database, come `da_pagare`.
export async function listNoteCredito(entityId) {
  const { data, error } = await supabase
    .from("note_credito")
    .select(
      "*, credito_residuo, supplier:supplier_id(id, name)," +
        " fattura:fattura_id(id, invoice_number, invoice_date, status)"
    )
    .eq("entity_id", entityId)
    .order("data", { ascending: false });
  if (error) throw error;
  return data;
}

// Il credito ancora da usare, per fornitore: si mostra accanto al «da
// pagare» perché un credito che nessuno ricorda sono soldi persi.
export async function creditiFornitore(entityId) {
  const { data, error } = await supabase.rpc("crediti_fornitore", { p_entity_id: entityId });
  if (error) throw error;
  return data ?? [];
}

// Cosa proporre pagando questa fattura, con quanto se ne potrebbe usare.
export async function creditiPerFattura(invoiceId) {
  const { data, error } = await supabase.rpc("crediti_per_fattura", { p_invoice_id: invoiceId });
  if (error) throw error;
  return data ?? [];
}

// I numeri che uscirebbero confermando — chiesti al database, non
// ricostruiti qui: due crediti da 30 su una fattura da 40 si applicano
// per 40, e una somma fatta in schermata direbbe 60.
export async function anteprimaPagamento(invoiceId, noteDaUsare) {
  const { data, error } = await supabase.rpc("anteprima_pagamento", {
    p_invoice_id: invoiceId,
    p_note: noteDaUsare?.length ? noteDaUsare : null,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

// I documenti collegati (DDT, contratti): un collegamento e basta —
// nessun conto ci passa dentro. Una tabella sola, quindi scrittura
// diretta con la RLS come barriera (categoria A del Contratto).
export async function collegaDocumentoAFattura(documentId, invoiceId) {
  const { error } = await supabase
    .from("documents")
    .update({ supplier_invoice_id: invoiceId })
    .eq("id", documentId);
  if (error) throw error;
}

// Cancella la fattura E completa il promemoria "Pagare fattura" collegato,
// nella stessa transazione (funzione Postgres delete_supplier_invoice).
// Prima il promemoria non veniva toccato affatto: restava pendente in
// Agenda per sempre — difetto trovato dalla verifica di Cowork.
// ⚠️ Correggere una fattura sbagliata invece di cancellarla e rifarla
// (Blocco 5.2, 16/08/2026). Una fattura pagata non si può nemmeno
// cancellare — c'è l'uscita in prima nota — quindi senza questa un numero
// digitato male restava sbagliato per sempre.
//
// L'importo NON si tocca da qui quando la fattura è già pagata: quel
// numero è uscito dalla cassa, e cambiarlo scollegherebbe in silenzio la
// fattura dal movimento che la giustifica. Per quello si annulla prima il
// pagamento.
export async function updateSupplierInvoice(id, patch) {
  const { error } = await supabase.from("supplier_invoices").update(patch).eq("id", id);
  if (error) throw error;
}

// ⚠️ Dal 16/08/2026 RESPINGE una fattura già pagata: cancellarla lasciava
// in prima nota l'uscita senza più il documento che la giustifica. Il
// messaggio del database porta importo e data e dice cosa fare prima.
export async function deleteSupplierInvoice(id) {
  return eseguiOperazione("delete_supplier_invoice", { p_invoice_id: id });
}

// La via di ritorno: riporta la fattura a «da pagare», riapre il
// promemoria e toglie l'uscita dalla prima nota, nella stessa
// transazione. Senza, il rifiuto qui sopra sarebbe un vicolo cieco.
export async function annullaPagamentoFattura(id) {
  return eseguiOperazione("annulla_pagamento_fattura", { p_invoice_id: id });
}
