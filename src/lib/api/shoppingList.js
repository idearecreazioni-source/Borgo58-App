import { supabase } from "../supabase";

// Titolare: lista completa, inclusi importi/metodo di pagamento.
export async function listShoppingList() {
  const { data, error } = await supabase
    .from("shopping_list_items")
    .select("*, ingredient:ingredient_id(id, name, unit), supplier:supplier_id(id, name)")
    .order("status")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Staff: stessa lista senza importi/metodo di pagamento. La vista non ha
// foreign key (niente embed automatico via PostgREST): i nomi arrivano
// appiattiti e vanno ricomposti qui nella stessa forma di listShoppingList.
export async function listShoppingListDisplay() {
  const { data, error } = await supabase
    .from("shopping_list_display")
    .select("*")
    .order("status")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((item) => ({
    ...item,
    ingredient: item.ingredient_id
      ? { id: item.ingredient_id, name: item.ingredient_name, unit: item.ingredient_unit }
      : null,
    supplier: item.supplier_id ? { id: item.supplier_id, name: item.supplier_name } : null,
  }));
}

export async function addShoppingListItem({
  ingredientId,
  customName,
  supplierId,
  quantityNeeded,
  unit,
  note,
}) {
  const { data, error } = await supabase.rpc("add_shopping_list_item", {
    p_ingredient_id: ingredientId ?? null,
    p_custom_name: customName ?? null,
    p_supplier_id: supplierId ?? null,
    p_quantity_needed: quantityNeeded ?? null,
    p_unit: unit ?? null,
    p_note: note ?? null,
  });
  if (error) throw error;
  return data;
}

// Ritorna quanti articoli sono stati aggiunti.
export async function addBelowThresholdItems() {
  const { data, error } = await supabase.rpc("add_below_threshold_items");
  if (error) throw error;
  return data;
}

export async function removeShoppingListItem(itemId) {
  const { error } = await supabase.rpc("remove_shopping_list_item", { p_item_id: itemId });
  if (error) throw error;
}

export async function closeShoppingListItem({
  itemId,
  purchasedAmount,
  paymentMethod,
  quantityReceived,
  documentReference,
  expiryDate,
}) {
  const { error } = await supabase.rpc("close_shopping_list_item", {
    p_item_id: itemId,
    p_purchased_amount: purchasedAmount,
    p_payment_method: paymentMethod,
    p_quantity_received: quantityReceived ?? null,
    p_document_reference: documentReference ?? null,
    p_expiry_date: expiryDate ?? null,
  });
  if (error) throw error;
}
