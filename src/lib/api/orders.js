import { supabase } from "../supabase";
import { createDiscountGift } from "./cash";

// Piatti del menu attivo, sicuri per lo staff (§3.18) — vedi menu_items_display.
export async function listMenuForOrder() {
  const { data, error } = await supabase.from("menu_items_display").select("*");
  if (error) throw error;
  return data;
}

export async function listOpenOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*, items:order_items(id, quantity, unit_price, voided_at)")
    .eq("status", "aperto")
    .order("opened_at", { ascending: true });
  if (error) throw error;
  return data;
}

const ORDER_SELECT =
  "*, device:device_id(name), items:order_items(*, recipe:recipe_id(name))";

export async function getOrder(id) {
  const { data, error } = await supabase.from("orders").select(ORDER_SELECT).eq("id", id).single();
  if (error) throw error;
  // Righe più vecchie per prime, coerente con l'ordine con cui sono state aggiunte.
  data.items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return data;
}

// entity_id NON si passa: le comande sono sempre della S.r.l.s. e lo
// decide un default lato database (20260804000006) — lo staff non ha
// accesso alla tabella entities (P.IVA/codice fiscale, giustamente
// riservata) e non deve averne bisogno per aprire un tavolo.
export async function createOrder({ tableLabel, deviceId, note }) {
  const { data, error } = await supabase
    .from("orders")
    .insert({
      table_label: tableLabel,
      device_id: deviceId || null,
      note: note || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Righe già in bozza (mai inviate) di recente: suggerisce i tavoli usati di
// frequente senza costruire una vera gestione tavoli (esplicitamente fuori
// scope, §3.2 — "niente pagamenti/gestione tavoli").
export async function listRecentTableLabels() {
  const { data, error } = await supabase
    .from("orders")
    .select("table_label")
    .order("opened_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return [...new Set(data.map((o) => o.table_label))].slice(0, 10);
}

// --- Righe della comanda ---

export async function addDraftItem(orderId, { recipeId, freeTextName, destination, quantity, unitPrice, note }) {
  const { data, error } = await supabase
    .from("order_items")
    .insert({
      order_id: orderId,
      recipe_id: recipeId || null,
      free_text_name: freeTextName || null,
      destination,
      quantity,
      unit_price: unitPrice,
      note: note || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDraftItemQuantity(itemId, quantity) {
  if (quantity <= 0) return removeDraftItem(itemId);
  const { error } = await supabase.from("order_items").update({ quantity }).eq("id", itemId);
  if (error) throw error;
}

// Valido SOLO per righe ancora in bozza (sent_at nullo) — mai chiamato su
// una riga già inviata a cucina/bar, che si annulla invece con voidSentItem.
export async function removeDraftItem(itemId) {
  const { error } = await supabase.from("order_items").delete().eq("id", itemId);
  if (error) throw error;
}

// Smista le righe in bozza per reparto e le manda in cucina/bar in blocco —
// stesso "invia comanda" dei due prototipi UX.
export async function sendDraftItems(orderId) {
  const { error } = await supabase
    .from("order_items")
    .update({ sent_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .is("sent_at", null);
  if (error) throw error;
}

export async function voidSentItem(itemId, reason) {
  const { error } = await supabase
    .from("order_items")
    .update({ voided_at: new Date().toISOString(), void_reason: reason })
    .eq("id", itemId);
  if (error) throw error;
}

export async function setItemPrepared(itemId, prepared) {
  const { error } = await supabase
    .from("order_items")
    .update({ prepared_at: prepared ? new Date().toISOString() : null })
    .eq("id", itemId);
  if (error) throw error;
}

// --- Schermate Cucina/Bar (sostituto della stampante finché non c'è la
// postazione locale, §3.6) ---

export async function listRepartoTickets(destination) {
  const { data, error } = await supabase
    .from("order_items")
    .select("*, recipe:recipe_id(name), order:order_id!inner(table_label, status)")
    .eq("destination", destination)
    .eq("order.status", "aperto")
    .not("sent_at", "is", null)
    .is("voided_at", null)
    .order("sent_at", { ascending: true });
  if (error) throw error;
  return data;
}

// --- Chiusura conto ---

export async function closeOrderPaid(orderId, paymentMethod) {
  const { error } = await supabase
    .from("orders")
    .update({ status: "chiuso", payment_method: paymentMethod, closed_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw error;
}

export async function cancelOrder(orderId, reason) {
  const { error } = await supabase
    .from("orders")
    .update({ status: "annullato", cancel_reason: reason, closed_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw error;
}

// Sconto/omaggio: scrive su discounts_gifts (§3.4), non un registro
// parallelo — l'ordine si limita a referenziarlo. isGift=true -> stato
// 'omaggiato' e incassato forzato a 0 (constraint DB già lo impone anche
// lato server); isGift=false -> 'chiuso' comunque (uno sconto è un
// incasso ridotto, passa dall'RT come una vendita normale quando esisterà).
export async function closeOrderAsDiscountGift(
  orderId,
  { entityId, isGift, fullAmount, collectedAmount, causaleId, causaleNote, customerId, deviceId, note }
) {
  const dg = await createDiscountGift({
    entity_id: entityId,
    type: isGift ? "omaggio" : "sconto",
    full_amount: fullAmount,
    collected_amount: isGift ? 0 : Number(collectedAmount) || 0,
    causale_id: causaleId || null,
    causale_note: causaleNote || null,
    customer_id: customerId || null,
    device_id: deviceId || null,
    note: note || null,
  });

  const { error } = await supabase
    .from("orders")
    .update({
      status: isGift ? "omaggiato" : "chiuso",
      discount_gift_id: dg.id,
      closed_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) throw error;
}
