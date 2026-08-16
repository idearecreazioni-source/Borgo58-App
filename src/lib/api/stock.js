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
    .select("*, ingredient:ingredient_id(id, name, unit), supplier:supplier_id(id, name)")
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
    ingredient: l.ingredient_id ? { id: l.ingredient_id, name: l.ingredient_name, unit: l.unit } : null,
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

// Cosa il magazzino NON ha potuto scaricare chiudendo i conti: voci
// libere, ricette che non dicono cosa togliere, giacenze che non
// bastavano. Solo titolare (il database rifiuta gli altri, non risponde
// con un elenco vuoto: una schermata vuota direbbe "è andato tutto
// bene", che qui sarebbe falso).
export async function listScarichiNonRiusciti({ dal, al } = {}) {
  const { data, error } = await supabase.rpc("scarichi_non_riusciti", {
    p_dal: dal ?? null,
    p_al: al ?? null,
  });
  if (error) throw error;
  return data ?? [];
}

// Rimossa listStockConsumptions (audit 08/08/2026): nessuna pagina la
// usava. Il codice morto non e' innocuo — invecchia senza che nessuno se
// ne accorga, e prima o poi qualcuno lo richiama credendolo collaudato.
// La tabella stock_consumptions resta e continua a essere scritta da
// consumeStock: se servira' leggerla, si riscrive la query allora, sapendo
// cosa deve mostrare.

/**
 * Quanto è costato ciò che è uscito dalla cella senza essere venduto:
 * vitto del personale, sprechi, rettifiche (16/08/2026).
 *
 * ⚠️ NON entra nel food cost dei piatti venduti — quello si calcola sui
 * soli scarichi legati a un conto — ed è il punto: senza questa
 * separazione il cibo mangiato dalla brigata farebbe cercare un problema
 * in cucina che non esiste.
 */
export async function scarichiSenzaRicavo(entityId, dal, al) {
  const { data, error } = await supabase.rpc("scarichi_senza_ricavo", {
    p_entity_id: entityId,
    p_dal: dal ?? null,
    p_al: al ?? null,
  });
  if (error) throw error;
  return data ?? [];
}
