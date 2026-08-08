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

// Conto aperto per un tavolo, letto ADESSO dal database.
// Serve a due cose: evitare di crearne un secondo quando un altro tablet
// l'ha appena aperto, e ritrovare quello esistente se il vincolo
// uniq_conto_aperto_per_tavolo ha respinto il nostro tentativo.
export async function findOpenOrderByTable(tableLabel) {
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("table_label", tableLabel)
    .eq("status", "aperto")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Apre il tavolo: riusa il conto che c'e', altrimenti ne crea uno.
//
// Il controllo "esiste gia'?" non basta da solo — fra la lettura e la
// scrittura passano dei millisecondi, e in quei millisecondi l'altro
// tablet puo' aver creato il conto. Per questo il database ha un vincolo
// (migrazione 20260808000002) e qui si gestisce il suo rifiuto: errore
// 23505 = qualcuno e' arrivato primo, si apre il suo conto invece di
// mostrare un errore a un cameriere che ha un tavolo che aspetta.
export async function openOrderForTable(tableLabel, { deviceId } = {}) {
  const esistente = await findOpenOrderByTable(tableLabel);
  if (esistente) return esistente.id;

  try {
    const creato = await createOrder({ tableLabel, deviceId });
    return creato.id;
  } catch (e) {
    if (e?.code !== "23505") throw e;
    const altrui = await findOpenOrderByTable(tableLabel);
    if (!altrui) throw e;
    return altrui.id;
  }
}

// Griglia tavoli (§3.2, ridisegno): elenco minimo di etichette, configurato
// una volta dal titolare — non una gestione tavoli (niente pianta/capienza).
export async function listDiningTables() {
  const { data, error } = await supabase
    .from("dining_tables")
    .select("*")
    .eq("active", true)
    .order("position");
  if (error) throw error;
  return data;
}

// Aggiunta in blocco (un tavolo per riga): la configurazione iniziale di una
// decina di tavoli uno alla volta era un fastidio inutile, segnalato da
// Alessio dopo aver provato "Gestisci tavoli" — un solo inserimento invece
// di N andata/ritorno.
export async function createDiningTables(labels, startPosition = 0) {
  const rows = labels.map((label, i) => ({ label, position: startPosition + i }));
  const { data, error } = await supabase.from("dining_tables").insert(rows).select();
  if (error) throw error;
  return data;
}

export async function deactivateDiningTable(id) {
  const { error } = await supabase.from("dining_tables").update({ active: false }).eq("id", id);
  if (error) throw error;
}

// --- Coperti e impostazioni di sala (§3.2.1) ---

// Prezzo del coperto: sta nel database, non nel codice, cosi' Alessio puo'
// cambiarlo senza toccare il software. Lettura aperta allo staff (serve per
// calcolare il conto), scrittura riservata al titolare dalla RLS.
export async function getServiceSettings() {
  const { data, error } = await supabase
    .from("service_settings")
    .select("coperto_price")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data;
}

export async function updateCopertoPrice(price) {
  const { error } = await supabase
    .from("service_settings")
    .update({ coperto_price: Number(price) })
    .eq("id", 1);
  if (error) throw error;
}

// Il contatore coperti e' libero per tutto il servizio, non solo
// all'apertura del tavolo: e' il caso limite "coperti che si aggiungono a
// tavolo gia' aperto" (§3.2.2), l'unico gia' risolto.
export async function setOrderCoperti(orderId, coperti) {
  const { error } = await supabase
    .from("orders")
    .update({ coperti: Math.max(0, Number(coperti) || 0) })
    .eq("id", orderId);
  if (error) throw error;
}

// Nota generale del tavolo (allergie, "tutti insieme", "bimbo piccolo"):
// vale per l'intero conto, non per una riga. Nella versione precedente il
// campo esisteva a schermo ma il testo non veniva mai salvato da nessuna
// parte — scritto, e perso all'invio.
export async function updateOrderNote(orderId, note) {
  const { error } = await supabase
    .from("orders")
    .update({ note: note?.trim() ? note.trim() : null })
    .eq("id", orderId);
  if (error) throw error;
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

// Nota della singola riga (es. "senza glutine"), distinta dalla nota
// generale dell'ordine: senza questa non e' possibile segnalare
// un'esigenza legata a UN piatto invece che a tutto il tavolo (§3.2.1).
// Modificabile anche dopo l'invio: la cucina lavora sul ticket di carta,
// ma la riga resta la fonte per il ticket ristampato.
export async function updateItemNote(itemId, note) {
  const { error } = await supabase
    .from("order_items")
    .update({ note: note?.trim() ? note.trim() : null })
    .eq("id", itemId);
  if (error) throw error;
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

// Manda in cucina/bar SOLO le righe indicate — quelle che chi preme il
// pulsante ha davanti agli occhi.
//
// Prima mandava "tutte le righe non ancora inviate di questo tavolo", che
// con due tablet (§3.2.1: anche il Bar prende ordini) significa spedire in
// cucina la comanda che il collega sta ancora componendo. Trovato
// nell'audit dell'08/08/2026.
//
// `is("sent_at", null)` resta come rete: se nel frattempo l'altro tablet
// ha gia' inviato quella riga, non le si riscrive l'orario di invio.
export async function sendDraftItems(orderId, itemIds) {
  const ids = (itemIds ?? []).filter(Boolean);
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("order_items")
    .update({ sent_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .in("id", ids)
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

// --- Conto: un solo calcolo, usato ovunque ---

// Preconto, chiusura conto e totale a schermo devono dire lo STESSO numero.
// Tenere il calcolo qui evita che tre schermate lo rifacciano ognuna a modo
// suo — e' il tipo di divergenza che si scopre davanti al cliente.
// Le righe annullate non contano; il coperto si somma a parte perche' sul
// preconto va mostrato come voce propria ("4 coperti × 5,00 €").
export function orderTotals(order, copertoPrice) {
  const items = (order?.items ?? []).filter((i) => !i.voided_at);
  const itemsTotal = items.reduce((s, i) => s + i.quantity * Number(i.unit_price), 0);
  const coperti = order?.coperti ?? 0;
  // Su un conto gia' chiuso vale il prezzo fotografato allora, non quello di oggi.
  const unit = Number(order?.coperto_unit_price ?? copertoPrice ?? 0);
  const copertoTotal = coperti * unit;
  return { items, itemsTotal, coperti, copertoUnitPrice: unit, copertoTotal, total: itemsTotal + copertoTotal };
}

// --- Chiusura conto ---

// copertoUnitPrice viene fotografato sull'ordine: da domani il coperto puo'
// cambiare, questo conto no (stesso principio di order_items.unit_price).
export async function closeOrderPaid(orderId, paymentMethod, copertoUnitPrice) {
  const { error } = await supabase
    .from("orders")
    .update({
      status: "chiuso",
      payment_method: paymentMethod,
      coperto_unit_price: copertoUnitPrice ?? null,
      closed_at: new Date().toISOString(),
    })
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
  { entityId, isGift, fullAmount, collectedAmount, causaleId, causaleNote, customerId, deviceId, note, copertoUnitPrice }
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
      coperto_unit_price: copertoUnitPrice ?? null,
      closed_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) throw error;
}
