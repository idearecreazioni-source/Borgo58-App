import { supabase } from "../supabase";

// Giacenza per ingrediente (soglia, prossima scadenza) — vista sicura,
// nessun dato economico: stessa query per titolare e staff.
export async function listStockLevels() {
  const { data, error } = await supabase
    .from("v_stock_levels")
    .select("*")
    .order("ingredient_name");
  if (error) throw error;
  return data;
}

// Lotti con costo — solo titolare (RLS li nega comunque allo staff).
export async function listStockLots(ingredientId) {
  let query = supabase
    .from("stock_lots")
    .select("*, supplier:supplier_id(id, name)")
    .order("expiry_date", { ascending: true, nullsFirst: false })
    .order("received_at", { ascending: false });
  if (ingredientId) query = query.eq("ingredient_id", ingredientId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Stessa cosa, senza unit_cost — per lo staff. La vista non ha foreign key
// (niente embed automatico via PostgREST), quindi il nome del fornitore
// arriva appiattito e va ricomposto qui nella stessa forma di listStockLots.
export async function listStockLotsDisplay(ingredientId) {
  let query = supabase
    .from("stock_lots_display")
    .select("*")
    .order("expiry_date", { ascending: true, nullsFirst: false })
    .order("received_at", { ascending: false });
  if (ingredientId) query = query.eq("ingredient_id", ingredientId);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((l) => ({
    ...l,
    supplier: l.supplier_id ? { id: l.supplier_id, name: l.supplier_name } : null,
  }));
}

export async function registerStockDelivery({
  ingredientId,
  quantity,
  supplierId,
  expiryDate,
  note,
  unitCost,
}) {
  const { data, error } = await supabase.rpc("register_stock_delivery", {
    p_ingredient_id: ingredientId,
    p_quantity: quantity,
    p_supplier_id: supplierId ?? null,
    p_expiry_date: expiryDate ?? null,
    p_note: note ?? null,
    p_unit_cost: unitCost ?? null,
  });
  if (error) throw error;
  return data;
}

export async function recordStockConsumption({ ingredientId, quantity, reason = "consumo", note }) {
  const { error } = await supabase.rpc("record_stock_consumption", {
    p_ingredient_id: ingredientId,
    p_quantity: quantity,
    p_reason: reason,
    p_note: note ?? null,
  });
  if (error) throw error;
}

export async function listStockConsumptions(ingredientId) {
  let query = supabase
    .from("stock_consumptions")
    .select("*")
    .order("created_at", { ascending: false });
  if (ingredientId) query = query.eq("ingredient_id", ingredientId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
