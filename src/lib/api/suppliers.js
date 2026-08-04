import { supabase } from "../supabase";

export async function listSuppliers(entityId) {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("entity_id", entityId)
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data;
}

// Staff: identità + contatti + giorni di consegna, niente di amministrativo
// (vista sicura — §3.18).
export async function listSuppliersDisplay() {
  const { data, error } = await supabase
    .from("suppliers_display")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

export async function getSupplier(id) {
  const { data, error } = await supabase.from("suppliers").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

const supplierPayload = ({
  entityId,
  name,
  category,
  contactPhone,
  contactEmail,
  contactPerson,
  taxCode,
  paymentTerms,
  deliveryDays,
  isOccasional,
  notes,
}) => ({
  ...(entityId ? { entity_id: entityId } : {}),
  name,
  category: category || null,
  contact_phone: contactPhone || null,
  contact_email: contactEmail || null,
  contact_person: contactPerson || null,
  tax_code: taxCode || null,
  // Un fornitore occasionale non compila condizioni di pagamento/giorni di
  // consegna (§3.11) — anche se il form li manda comunque, li scartiamo qui
  // per non lasciare dati a metà su un profilo pensato per restare minimo.
  payment_terms: isOccasional ? null : paymentTerms || null,
  delivery_days: isOccasional ? null : deliveryDays || null,
  is_occasional: !!isOccasional,
  notes: notes || null,
});

export async function createSupplier(input) {
  const { data, error } = await supabase
    .from("suppliers")
    .insert(supplierPayload(input))
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSupplier(id, input) {
  const { data, error } = await supabase
    .from("suppliers")
    .update(supplierPayload(input))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deactivateSupplier(id) {
  const { error } = await supabase.from("suppliers").update({ active: false }).eq("id", id);
  if (error) throw error;
}

// Storico automatico (§3.11 — "non inserito a mano"). Due fonti già esistenti,
// non una nuova tabella: prezzi dal Ricettario, consegne dal Magazzino
// (i carichi diretti e le chiusure di Lista della spesa scrivono entrambi
// su stock_lots).
export async function listSupplierPriceHistory(supplierId) {
  const { data, error } = await supabase
    .from("price_history")
    .select("id, price, recorded_at, source, ingredient:ingredient_id(name, unit)")
    .eq("supplier_id", supplierId)
    .order("recorded_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function listSupplierDeliveries(supplierId) {
  const { data, error } = await supabase
    .from("stock_lots")
    .select("id, quantity_received, unit_cost, received_at, ingredient:ingredient_id(name, unit)")
    .eq("supplier_id", supplierId)
    .order("received_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}
