import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

const SELECT = "*, supplier:supplier_id(id, name)";

export async function listSupplierInvoices({ status, supplierId } = {}) {
  let query = supabase
    .from("supplier_invoices")
    .select(SELECT)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("invoice_date", { ascending: false });
  if (status) query = query.eq("status", status);
  if (supplierId) query = query.eq("supplier_id", supplierId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
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
export async function markInvoicePaid(id, { paymentMethod }) {
  return eseguiOperazione("pay_supplier_invoice", {
    p_invoice_id: id,
    p_payment_method: paymentMethod,
  });
}

// Cancella la fattura E completa il promemoria "Pagare fattura" collegato,
// nella stessa transazione (funzione Postgres delete_supplier_invoice).
// Prima il promemoria non veniva toccato affatto: restava pendente in
// Agenda per sempre — difetto trovato dalla verifica di Cowork.
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
