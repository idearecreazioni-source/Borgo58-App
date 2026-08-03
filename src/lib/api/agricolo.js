import { supabase } from "../supabase";

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
export async function createCession(
  { sellerEntityId, buyerEntityId, ingredientId, productDescription, quantity, unit, unitPrice, vatRate, cessionDate, fiscalDocumentType, invoiceReference, notes },
  { updateIngredientCost } = {}
) {
  const total = Number(quantity) * Number(unitPrice);
  const { data, error } = await supabase
    .from("intercompany_cessions")
    .insert({
      seller_entity_id: sellerEntityId,
      buyer_entity_id: buyerEntityId,
      ingredient_id: ingredientId || null,
      product_description: productDescription,
      quantity: Number(quantity),
      unit,
      unit_price: Number(unitPrice),
      vat_rate: vatRate ? Number(vatRate) : null,
      total_amount: Number(total.toFixed(2)),
      cession_date: cessionDate,
      fiscal_document_type: fiscalDocumentType || null,
      invoice_reference: invoiceReference || null,
      notes: notes || null,
    })
    .select(CESSION_SELECT)
    .single();
  if (error) throw error;

  if (updateIngredientCost && ingredientId) {
    const { error: priceError } = await supabase.rpc("update_ingredient_price", {
      p_ingredient_id: ingredientId,
      p_new_price: Number(unitPrice),
      p_source: "cessione_interna",
      p_note: `Cessione intercompany del ${cessionDate}`,
      p_supplier_id: null,
    });
    if (priceError) throw priceError;
  }

  return data;
}

export async function deleteCession(id) {
  const { error } = await supabase.from("intercompany_cessions").delete().eq("id", id);
  if (error) throw error;
}
