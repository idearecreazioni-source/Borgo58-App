import { supabase } from "../supabase";
import { createTask, updateTask } from "./tasks";

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
  const { data: invoice, error } = await supabase
    .from("supplier_invoices")
    .insert({
      entity_id: entityId,
      supplier_id: supplierId,
      invoice_number: invoiceNumber || null,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      amount,
      document_reference: documentReference || null,
      note: note || null,
    })
    .select(SELECT)
    .single();
  if (error) throw error;

  if (dueDate) {
    // Il titolo contiene fornitore e importo: riservato al titolare. La
    // visibilità la decide il trigger dal valore di origine_modulo (§3.18,
    // migrazione 20260804000001), non questa chiamata.
    const task = await createTask({
      title: `Pagare fattura ${invoiceNumber ? `#${invoiceNumber} ` : ""}— ${invoice.supplier.name} (${amount}€)`,
      due_date: dueDate,
      category: "fatture_fornitori",
      origine_modulo: "fatture_fornitori",
    });
    const { data: updated, error: updateError } = await supabase
      .from("supplier_invoices")
      .update({ task_id: task.id })
      .eq("id", invoice.id)
      .select(SELECT)
      .single();
    if (updateError) throw updateError;
    return updated;
  }

  return invoice;
}

export async function markInvoicePaid(id, { paymentMethod }) {
  const { data: invoice, error } = await supabase
    .from("supplier_invoices")
    .update({
      status: "pagata",
      paid_at: new Date().toISOString(),
      payment_method: paymentMethod,
    })
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) throw error;

  if (invoice.task_id) {
    await updateTask(invoice.task_id, { status: "completato" });
  }

  return invoice;
}

export async function deleteSupplierInvoice(id) {
  const { error } = await supabase.from("supplier_invoices").delete().eq("id", id);
  if (error) throw error;
}
