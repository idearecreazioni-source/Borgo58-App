import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// L'entità viaggia insieme alla fattura, e non è un di più: il «da pagare»
// sommava S.r.l.s. e azienda agricola in un numero solo, che non è il
// debito di nessuna delle due. Per separarlo in schermata serve sapere di
// chi è ogni riga.
const SELECT = "*, supplier:supplier_id(id, name), entity:entity_id(id, name)";

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
export async function markInvoicePaid(id, { paymentMethod, dataUscita, riferimento }) {
  return eseguiOperazione("pay_supplier_invoice", {
    p_invoice_id: id,
    p_payment_method: paymentMethod,
    p_data_uscita: dataUscita || null,
    p_riferimento: riferimento?.trim() || null,
  });
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
