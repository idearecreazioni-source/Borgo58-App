import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// --- Colture (orto) ---
const CROP_SELECT = "*, ingredient:ingredient_id(id, name, unit)";

export async function listCrops({ status } = {}) {
  let query = supabase
    .from("crops")
    .select(CROP_SELECT)
    .order("expected_harvest_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createCrop(payload) {
  const { data, error } = await supabase.from("crops").insert(payload).select(CROP_SELECT).single();
  if (error) throw error;
  return data;
}

export async function updateCrop(id, patch) {
  const { data, error } = await supabase.from("crops").update(patch).eq("id", id).select(CROP_SELECT).single();
  if (error) throw error;
  return data;
}

export async function deleteCrop(id) {
  const { error } = await supabase.from("crops").delete().eq("id", id);
  if (error) throw error;
}

// --- Cessioni intercompany (agricola → S.r.l.s.) ---
const CESSION_SELECT =
  "*, ingredient:ingredient_id(id, name), seller:seller_entity_id(id, name), buyer:buyer_entity_id(id, name)";

export async function listCessions() {
  const { data, error } = await supabase
    .from("intercompany_cessions")
    .select(CESSION_SELECT)
    .order("cession_date", { ascending: false });
  if (error) throw error;
  return data;
}

// Registra una cessione. Se updateIngredientCost è true e c'è un ingrediente
// collegato, aggiorna anche il costo dell'ingrediente al prezzo di
// trasferimento (§1: costo produzione interna = prezzo cessione). Fonte
// "cessione_interna" nello storico prezzi.
//
// Cessione e aggiornamento del costo vivono nella STESSA transazione
// dentro la funzione Postgres create_intercompany_cession — prima erano
// due scritture separate dal browser, e un fallimento a metà lasciava una
// cessione fatturata senza il costo che la giustifica (materia fiscale).
// Il totale lo calcola il database. La chiamata passa dal corridoio
// (Contratto B4, 09/08/2026). Restituisce l'id della cessione.
export async function createCession(
  { sellerEntityId, buyerEntityId, ingredientId, productDescription, quantity, unit, unitPrice, vatRate, cessionDate, fiscalDocumentType, invoiceReference, notes },
  { updateIngredientCost } = {}
) {
  return eseguiOperazione("create_intercompany_cession", {
    p_seller_entity_id: sellerEntityId,
    p_buyer_entity_id: buyerEntityId,
    p_ingredient_id: ingredientId || null,
    p_product_description: productDescription,
    p_quantity: Number(quantity),
    p_unit: unit,
    p_unit_price: Number(unitPrice),
    p_vat_rate: vatRate ? Number(vatRate) : null,
    p_cession_date: cessionDate,
    p_fiscal_document_type: fiscalDocumentType || null,
    p_invoice_reference: invoiceReference || null,
    p_notes: notes || null,
    p_update_ingredient_cost: Boolean(updateIngredientCost && ingredientId),
  });
}

export async function deleteCession(id) {
  const { error } = await supabase.from("intercompany_cessions").delete().eq("id", id);
  if (error) throw error;
}
