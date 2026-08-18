import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";
import { oggiLocale } from "../constants";

// Piatti del menu attivo, sicuri per lo staff (§3.18) — vedi menu_items_display.
export async function listMenuForOrder() {
  const { data, error } = await supabase.from("menu_items_display").select("*");
  if (error) throw error;
  return data;
}

export async function listOpenOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(
      // ⚠️ `sent_at` serve al CALCOLO, non solo alla schermata: dal
      // 16/08/2026 una riga mai mandata in cucina non entra nel conto.
      // Senza questa colonna nella select, ogni riga risulterebbe non
      // inviata e il totale del Bar crollerebbe ai soli coperti — in
      // silenzio, che è il modo peggiore. È la lezione del 16/08 sulle
      // mance, allo specchio: lì un campo non arrivava al database, qui
      // non arriva alla schermata.
      "*, items:order_items(id, quantity, unit_price, voided_at, sent_at), tavoli:order_tables(dining_table_id, etichetta_al_momento)"
    )
    .eq("status", "aperto")
    .order("opened_at", { ascending: true });
  if (error) throw error;
  return data;
}

const ORDER_SELECT =
  "*, device:device_id(name), items:order_items(*, recipe:recipe_id(name)), tavoli:order_tables(dining_table_id, etichetta_al_momento)";

export async function getOrder(id) {
  const { data, error } = await supabase.from("orders").select(ORDER_SELECT).eq("id", id).single();
  if (error) throw error;
  // Righe più vecchie per prime, coerente con l'ordine con cui sono state aggiunte.
  data.items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return data;
}

// Apre UN conto su uno o più tavoli (14/08/2026, blocco Sala).
//
// ⚠️ È il cuore del blocco: TRE TAVOLI ACCOSTATI SONO UNA COMANDA, NON
// TRE. Prima il conto identificava il tavolo con una stringa e valeva «un
// solo conto aperto per tavolo»: davanti a un tavolo da dieci o il
// cameriere apriva tre conti, o il vincolo gli bloccava il secondo.
//
// Conto + righe di collegamento sono due tabelle che devono riuscire o
// fallire insieme: corridoio (B4). L'invariante «un tavolo non sta su due
// conti aperti» è un indice unico nel database, non un controllo qui:
// fra la lettura di questa schermata e la scrittura passano millisecondi,
// e in quei millisecondi l'altro tablet può essere arrivato primo.
//
// entity_id non si passa: le comande sono sempre della S.r.l.s. e lo
// decide un default lato database (20260804000006).
export async function apriConto(tavoliIds, { deviceId, note } = {}) {
  const esito = await eseguiOperazione("apri_conto", {
    p_tavoli: tavoliIds,
    p_device_id: deviceId || null,
    p_note: note || null,
  });
  return esito?.order_id ?? null;
}

// Cambia l'insieme dei tavoli di un conto aperto: è lo «sposta» del
// 09/08 (§3.2.2), che ora sa anche unire e separare. Righe di
// collegamento + etichetta stampata del conto → corridoio.
export async function spostaConto(orderId, tavoliIds) {
  return eseguiOperazione("sposta_conto", { p_order_id: orderId, p_tavoli: tavoliIds });
}

// Il conto aperto su un certo tavolo, letto ADESSO dal database: serve a
// non aprirne un secondo quando un altro tablet l'ha appena aperto.
export async function findOpenOrderByTable(diningTableId) {
  const { data, error } = await supabase
    .from("order_tables")
    .select("order_id")
    .eq("dining_table_id", diningTableId)
    .eq("conto_aperto", true)
    .maybeSingle();
  if (error) throw error;
  return data?.order_id ?? null;
}

// --- Coperti e impostazioni di sala (§3.2.1) ---

// Prezzo del coperto: sta nel database, non nel codice, cosi' Alessio puo'
// cambiarlo senza toccare il software. Lettura aperta allo staff (serve per
// calcolare il conto), scrittura riservata al titolare dalla RLS.
export async function getServiceSettings() {
  const { data, error } = await supabase
    .from("service_settings")
    // ⚠️ `ora_fine_serata` serve a Comande per sapere QUALE SERA è: alle
    // 00:30, col locale ancora aperto, la data di calendario dice già
    // domani. Il numero sta nel database e non nel codice perché lo stesso
    // valore lo leggeranno le funzioni SQL quando saranno convertite: un
    // numero, due lettori — mai due copie che possono divergere.
    .select("coperto_price, ora_fine_serata")
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

// ⚠️ `is("sent_at", null)` è la rete che qui mancava, ed è la stessa che
// `sendDraftItems` ha dall'audit dell'08/08. Senza, da un secondo tablet
// si poteva cambiare o cancellare una riga GIÀ USCITA dalla stampante
// della cucina — anche a conto chiuso — e nessuno se ne accorgeva: il
// piatto è in cottura, la riga non esiste più, il conto non lo dice.
//
// La rete vera però è nel database (`trg_riga_servita`, 16/08/2026):
// questa qui serve a dare un errore prima, non a essere l'unica difesa.
export async function updateDraftItemQuantity(itemId, quantity) {
  if (quantity <= 0) return removeDraftItem(itemId);
  const { error } = await supabase
    .from("order_items")
    .update({ quantity })
    .eq("id", itemId)
    .is("sent_at", null);
  if (error) throw error;
}

// Valido SOLO per righe ancora in bozza: una riga già inviata a cucina/bar
// non si cancella — si storna con voidSentItem, e lo storno resta scritto.
export async function removeDraftItem(itemId) {
  const { error } = await supabase
    .from("order_items")
    .delete()
    .eq("id", itemId)
    .is("sent_at", null);
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

// Un intero ticket segnato pronto in un colpo solo: al bar si evade il
// giro di bevande di un tavolo, non una riga per volta.
export async function setItemsPrepared(itemIds, prepared) {
  const ids = (itemIds ?? []).filter(Boolean);
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("order_items")
    .update({ prepared_at: prepared ? new Date().toISOString() : null })
    .in("id", ids);
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
    .select("*, recipe:recipe_id(name), order:order_id!inner(table_label, status, note)")
    .eq("destination", destination)
    .eq("order.status", "aperto")
    .not("sent_at", "is", null)
    .is("voided_at", null)
    .order("sent_at", { ascending: true });
  if (error) throw error;
  return data;
}

// --- Conto: un solo calcolo, usato ovunque ---

// Il calcolo vive in lib/calcoli/conto.js come modulo PURO (niente import
// del client: le prove di unita' devono girare senza chiavi). Ri-esportato
// da qui perche' le schermate continuino a importarlo insieme al resto.
export { orderTotals } from "../calcoli/conto";

// --- Chiusura conto ---

// copertoUnitPrice viene fotografato sull'ordine: da domani il coperto puo'
// cambiare, questo conto no (stesso principio di order_items.unit_price).
// Dal 13/08/2026 chiudere un conto fa scendere la giacenza: quattro
// tabelle (conto, lotti, movimenti, righe non scaricate) che devono
// riuscire o fallire insieme. Quindi non è più un update dal browser ma
// una funzione Postgres attraverso il corridoio — regola B4.
//
// Lo scarico è una scrittura di CONSEGUENZA: se qualcosa non torna, il
// conto si chiude lo stesso e l'anomalia resta scritta. Il cliente ha
// pagato e sta aspettando: non è il momento di fermarsi.
// ⚠️ `pagamenti` è la divisione su più mezzi (Blocco 9, 16/08/2026):
// `[{ mezzo: "contante", importo: 30 }, { mezzo: "carta", importo: 20 }]`.
// Passandolo, `paymentMethod` non serve. Le quote devono fare l'incassato
// al centesimo, e a rifiutare è il database: una divisione che non torna
// sarebbe cassa e banca che non tornano più.
export async function closeOrderPaid(orderId, paymentMethod, copertoUnitPrice, pagamenti = null) {
  return eseguiOperazione("close_order_paid", {
    p_order_id: orderId,
    p_payment_method: pagamenti ? null : paymentMethod,
    p_coperto_unit_price: copertoUnitPrice ?? null,
    p_pagamenti: pagamenti,
  });
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
// Registro sconti/omaggi e chiusura del conto vivono nella stessa
// transazione dentro la funzione Postgres close_order_as_discount_gift.
//
// Prima erano due scritture consecutive dal browser, e se la seconda non
// partiva restava un omaggio in cassa per un tavolo ancora aperto — su un
// registro che serve a valutare l'autofattura TD27.
//
// La chiamata passa dal corridoio (Edge Function `operazioni-atomiche`),
// non dalla RPC diretta: regola B4 del Contratto Architetturale,
// confermata da Alessio il 09/08/2026.
//
// `fullAmount` non è l'importo che verrà scritto: è il totale che
// l'operatore ha davanti, che il database confronta col proprio calcolo e
// rifiuta se non coincide.
export async function closeOrderAsDiscountGift(
  orderId,
  { isGift, fullAmount, collectedAmount, causaleId, causaleNote, customerId, deviceId, note }
) {
  return eseguiOperazione("close_order_as_discount_gift", {
    p_order_id: orderId,
    p_is_gift: isGift,
    p_collected_amount: isGift ? 0 : Number(collectedAmount) || 0,
    p_expected_full_amount: fullAmount ?? null,
    p_causale_id: causaleId || null,
    p_causale_note: causaleNote || null,
    p_customer_id: customerId || null,
    p_device_id: deviceId || null,
    p_note: note || null,
  });
}

/**
 * Cosa è stato emesso per un conto: scontrino, fattura da fare, fattura
 * fatta (16/08/2026).
 *
 * ⚠️ Una tabella sola, quindi chiamata diretta (categoria A del
 * Contratto). E `null` è un valore ammesso: vuol dire «non l'ho ancora
 * detto», che è diverso da «niente è stato emesso» — il conto torna
 * nell'elenco di quelli da sistemare.
 */
export async function setDocumentoFiscale(orderId, { tipo, numero, emessoIl }) {
  const patch = {
    documento_fiscale: tipo || null,
    documento_numero: numero?.trim() || null,
    // Una fattura dichiarata emessa senza data la rifiuta il database: è
    // la sola cosa che distingue «fatta» da «promessa».
    documento_emesso_il: tipo === "fattura" ? emessoIl || oggiLocale() : null,
  };
  const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
  if (error) throw error;
}

/**
 * I conti già segnati come scontrinati o fatturati, per poterlo disfare
 * (Blocco 5.2 del mandato di correzione, 16/08/2026).
 *
 * ⚠️ Prima non esisteva nessuna strada: una volta premuto «Scontrino
 * fatto», il conto spariva dall'elenco di quelli da sistemare e non c'era
 * più nessuna schermata da cui dire che era stato un errore. E un conto
 * marcato scontrinato per sbaglio non è un dettaglio: è la differenza fra
 * incassato e fiscalizzato, cioè proprio il numero che quella schermata
 * esiste per far tornare.
 */
export async function listContiFiscalizzati({ entityId, dal, al } = {}) {
  let query = supabase
    .from("orders")
    .select("id, table_label, closed_at, documento_fiscale, documento_numero, documento_emesso_il")
    .not("documento_fiscale", "is", null)
    .in("status", ["chiuso", "omaggiato"])
    .order("closed_at", { ascending: false })
    .limit(50);
  if (entityId) query = query.eq("entity_id", entityId);
  if (dal) query = query.gte("closed_at", `${dal}T00:00:00`);
  if (al) query = query.lte("closed_at", `${al}T23:59:59`);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
