import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";
import { oggiLocale } from "../constants";

// Piatti del menu attivo, sicuri per lo staff (§3.18) — vedi menu_items_display.
export async function listMenuForOrder() {
  const { data, error } = await supabase.from("menu_items_display").select("*");
  if (error) throw error;
  return data;
}

// LE DUE STRINGHE DELLA `select` VIVONO QUI, una accanto all'altra: quando
// una riga di comanda acquista un pezzo nuovo che entra nel conto, i posti
// da cambiare sono due e si vedono insieme. Divergendo, a restare indietro
// sarebbe l'elenco dei tavoli aperti — che e' la prima cosa che si guarda.
const OPEN_ORDERS_SELECT =
  "*, items:order_items(id, quantity, unit_price, voided_at, sent_at, sostituzioni:order_item_sostituzioni(allergene, costo_aggiuntivo, descrizione)), tavoli:order_tables(dining_table_id, etichetta_al_momento), prenotazione:reservation_id(id, customer_name, party_size, reservation_time)";

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
      // ⚠️ `prenotazione` è il legame scritto dal giro D1 e che fino al D2
      // NESSUNA SCHERMATA MOSTRAVA — per chi usa l'app, un dato scritto che
      // nessuno può vedere è indistinguibile da un dato non scritto.
      // L'incorporamento funziona perché è una vera chiave esterna
      // (orders.reservation_id → reservations.id).
      // ⚠️ `sostituzioni` non e' un di piu' nemmeno qui: dal 24/08/2026 una
      // riga puo' portare un supplemento (senza lattosio, +1,00), e senza
      // questo pezzo di select il totale dei tavoli aperti risulterebbe piu'
      // basso del vero SENZA NESSUN ERRORE — la stessa forma di `sent_at`
      // qui sopra.
      OPEN_ORDERS_SELECT
    )
    .eq("status", "aperto")
    .order("opened_at", { ascending: true });
  if (error) throw error;
  return data;
}

const ORDER_SELECT =
  // ⚠️ DELLA RICETTA ARRIVANO ANCHE TIPO E CATEGORIA (24/08/2026), e non
  // sono un di più: servono a distinguere in sala **un bis** (una riga che
  // punta a un finger) da un piatto, e a sapere su quale riga si può
  // chiedere un bis (un piatto di categoria finger food). Senza, la sala
  // dovrebbe fare una seconda lettura per ogni riga della comanda.
  // ⚠️ E LE SOSTITUZIONI DI ALLERGENE (24/08/2026): sono la frase che la
  // cucina deve leggere sulla riga del piatto e il supplemento che va sul
  // conto. Fuori da qui, il conto sarebbe piu' basso del vero in silenzio.
  "*, device:device_id(name), items:order_items(*, recipe:recipe_id(name, recipe_type, category), sostituzioni:order_item_sostituzioni(id, allergene, costo_aggiuntivo, descrizione)), tavoli:order_tables(dining_table_id, etichetta_al_momento), prenotazione:reservation_id(id, customer_name, party_size, reservation_time, notes), cliente:customer_id(id, name, phone)";

// I CONTI CHE NOMINANO QUESTE PRENOTAZIONI — è così che si sa chi è arrivato.
//
// ⚠️ SI CHIEDE «ESISTE UN CONTO IN QUESTA SERATA», NON «C'È UN CONTO APERTO»,
// ed è la differenza che fa funzionare la cosa: con la seconda domanda, un
// tavolo che ha cenato e pagato tornerebbe in ritardo nel momento in cui il
// conto si chiude — ogni sera, su ogni tavolo, dopo che è andato tutto bene.
// Per questo qui NON si filtra per stato: gli stati li pesa
// `contoProvaArrivo()` in lib/calcoli/ritardo.js, che è l'unico posto dove
// sta scritto quale conto prova un arrivo e quale no.
//
// ⚠️ E si passa per il LEGAME, non per il tavolo: un tavolo con due turni
// può avere addosso il conto del turno precedente, e contarlo per tavolo
// direbbe «arrivato» a chi non è ancora entrato.
export async function listContiPerPrenotazioni(reservationIds = []) {
  if (reservationIds.length === 0) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("id, reservation_id, status")
    .in("reservation_id", reservationIds);
  if (error) throw error;
  return data ?? [];
}

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
// ⚠️ LA SERATA SI PASSA, non la calcola il database — ed è la condizione
// scritta nel giro C: «se serve sapere che sera è, si usa UN SOLO POSTO e
// lo si nomina». Quel posto è `serataDiServizio()`. Calcolarla dentro la
// funzione SQL avrebbe scritto il dodicesimo punto dell'elenco dei posti
// dove il database chiede da sé che giorno è, e la serata di un locale che
// chiude all'una non coincide col giorno di calendario.
//
// Serve perché il conto si aggancia alla PRENOTAZIONE di quella serata su
// quel tavolo. Senza serata il legame resta vuoto: si perde
// l'informazione, non si scrive quella sbagliata.
export async function apriConto(tavoliIds, { deviceId, note, serata } = {}) {
  const esito = await eseguiOperazione("apri_conto", {
    p_tavoli: tavoliIds,
    p_device_id: deviceId || null,
    p_note: note || null,
    p_serata: serata || null,
  });
  return esito?.order_id ?? null;
}

// CHI PAGA QUESTO TAVOLO — 23/08/2026, blocco 5 del mandato del collaudo.
//
// 🔴 LA REGOLA È DI ALESSIO, e la parte che conta è il verso: **il tavolo
// si associa al cliente PAGANTE, che sia quello della prenotazione o no**.
// Se prenota Tizio e paga Caio, il tavolo va a Caio e la prenotazione
// resta quello che era. Non è un riflesso: sono due domande diverse con
// due risposte diverse, e il cliente della prenotazione è solo il valore
// di partenza che il database mette aprendo il conto.
//
// ⚠️ Corridoio e non scrittura diretta: registrare un cliente nuovo E
// attaccarlo al conto sono due tabelle, e a metà resterebbe una scheda
// che non serve a niente o un conto che nomina un cliente inesistente.
//
// Tre gesti in una funzione sola:
//   · `clienteId`            → aggancia una scheda che c'è già
//   · `nome` e/o `telefono`  → la registra al momento, riusando la scheda
//                              se quel numero è già in anagrafica
//   · niente                 → stacca (la via d'uscita di chi ha sbagliato)
export async function assegnaClienteConto(orderId, { clienteId, nome, telefono } = {}) {
  return eseguiOperazione("assegna_cliente_conto", {
    p_order_id: orderId,
    p_customer_id: clienteId || null,
    p_nome: nome || null,
    p_telefono: telefono || null,
  });
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
    // ⚠️ E `minuti_tolleranza_ritardo` serve alla stessa schermata: dopo
    // quanto un tavolo prenotato su cui nessuno ha aperto la comanda si segna
    // in ritardo. È un numero di Alessio (30), non una costante del codice —
    // e la sala e il calendario devono leggere lo stesso.
    .select("coperto_price, ora_fine_serata, minuti_tolleranza_ritardo")
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

// Di che linea sono i coperti di questo conto: chi CENA (`sala`) o chi fa
// APERICENA nell'area lunch (`lunch`).
//
// ⚠️ SERVE PER CONFRONTARE LA REALTA' CON LA PREVISIONE. La Proiezione ha
//    sei linee e oggi nessun modulo misura quelle diverse dalla sala —
//    eppure il pareggio con la sola sala chiede piu' coperti di quanti il
//    piano ne preveda. Senza questo dato quel confronto non esiste.
//
// ⚠️ VUOTO NON E' «SALA»: si puo' togliere la scelta, e allora quel conto
//    torna fra i «non dichiarati». Il conteggio li mostra come riga a se',
//    mai sommati alla sala — un conto classificato per sbaglio e'
//    peggio di uno non classificato, perche' nessuno lo va piu' a
//    guardare.
export async function setOrderLinea(orderId, linea) {
  const { error } = await supabase
    .from("orders")
    .update({ linea: linea === "sala" || linea === "lunch" ? linea : null })
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

export async function addDraftItem(orderId, { recipeId, freeTextName, destination, quantity, unitPrice, note, turno }) {
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
      // Il turno con cui questa pietanza esce dalla cucina: lo compone chi
      // serve, e senza indicazione e' il primo — che e' come si lavorava
      // prima del 21/08.
      turno: turno ?? 1,
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
    // ⚠️ `recipe_type` serve a riconoscere un BIS sul biglietto di carta:
    // fino al 24/08 la cucina leggeva il nudo nome del bocconcino, e la
    // parola «bis» esisteva solo sul tablet di chi lo batteva.
    // ⚠️ `sostituzioni` è la richiesta di Alessio scritta per esteso: *«la
    // sostituzione arriva IN CUCINA sulla riga di quel piatto, ben visibile.
    // È il punto dove un errore fa male davvero»*.
    .select(
      "*, recipe:recipe_id(name, recipe_type, category), sostituzioni:order_item_sostituzioni(allergene, descrizione), order:order_id!inner(table_label, status, note)"
    )
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
    // ⚠️ LA DATA LA PASSA CHI CHIAMA, ed è la SERATA del conto (19/08,
    // seconda metà della regola delle 5): un conto e il suo documento
    // fiscale devono stare sulla stessa giornata, o la quadratura fra
    // incassato e scontrinato accusa una differenza che non esiste.
    // `oggiLocale()` resta solo come ultima spiaggia se le impostazioni non
    // si leggono — non è la strada normale.
    // 🔴 LA DATA SI SCRIVE ANCHE SUGLI SCONTRINI (20/08/2026, blocco 1 del
    // mandato del registratore). Prima valeva solo per le fatture, e per gli
    // scontrini veniva azzerata: uno scontrino ristampato tre giorni dopo
    // non aveva nessuna data, quindi lo scarto fra la serata del cliente e
    // il giorno del documento **non era nemmeno rappresentabile**. Ed è
    // esattamente lo scarto che Alessio ha deciso di dichiarare invece di
    // appianare.
    documento_emesso_il: tipo ? emessoIl || oggiLocale() : null,
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
  // 🔴 PASSA DAL DATABASE, non da un `select` più largo (23/08/2026,
  // blocco 5). L'importo di un conto non è una colonna: è
  // `totale_conto()`, che dal 15/08 è **l'unico posto dove si calcola il
  // totale di un conto**. Ricostruirlo qui sarebbe il quarto posto che
  // dice quanto vale un conto.
  //
  // ⚠️ E il filtro passa dalla SERATA, non da `closed_at`: prima tagliava
  // a mezzanotte di calendario, quindi un conto chiuso all'una finiva nel
  // giorno dopo — mentre i totali in cima alla stessa schermata lo
  // contavano nella sera prima.
  //
  // ⚠️ Il `.limit(50)` è sparito con la query: la funzione restituisce
  // l'elenco intero del periodo, come le altre liste di questa schermata.
  // Un elenco di conti che si ferma a 50 sembra completo senza esserlo.
  const { data, error } = await supabase.rpc("conti_fiscalizzati", {
    p_entity_id: entityId ?? null,
    p_dal: dal ?? null,
    p_al: al ?? null,
  });
  if (error) throw error;
  return data ?? [];
}

// LA SEGNALAZIONE DELLA SALA: «questo scontrino non è uscito» (20/08/2026).
//
// ⚠️ La può fare CHIUNQUE sia in sala, non solo il titolare, e non è una
// comodità: esiste un buco che nessun protocollo copre — la stampante che
// risponde «fatto» e stampa una pagina bianca. Solo un occhio umano la vede.
//
// ⚠️ Passa dal corridoio perché tocca due tabelle: il conto torna senza
// documento **e** resta scritto chi l'ha segnalato. A metà sarebbe o un
// conto rimesso in elenco senza che si sappia perché, o una segnalazione
// registrata che non ha rimesso niente in elenco.
export async function segnalaScontrinoNonUscito(orderId, nota) {
  return eseguiOperazione("segnala_scontrino_non_uscito", {
    p_order_id: orderId,
    p_nota: nota ?? null,
  });
}

// I conti fiscalizzati in un giorno diverso dalla serata in cui il cliente
// ha pagato. ⚠️ Non è un errore da correggere: l'incasso resta nella serata
// giusta, e questo elenco dice dove ritrovarlo nella giornata del
// registratore. Spostarlo farebbe risultare quella serata più magra del vero.
export async function listContiFiscalizzatiInRitardo({ entityId, dal, al } = {}) {
  const { data, error } = await supabase.rpc("conti_fiscalizzati_in_ritardo", {
    p_entity_id: entityId,
    p_dal: dal ?? null,
    p_al: al ?? null,
  });
  if (error) throw error;
  return data ?? [];
}

// --- I turni dei pasti (21/08/2026) ---

// «Avanti col prossimo turno»: il biglietto che esce dalla stampante della
// cucina, con la frase e il numero del tavolo.
//
// 🔴 GENERICO E SENZA LIMITAZIONI, deciso da Alessio: non conta i turni, non
// si spegne quando sono finiti, non impedisce di premerlo due volte. La
// cucina ha già la comanda completa e vede da sé cosa resta da cucinare —
// il biglietto dice solo «adesso».
//
// ⚠️ Una tabella sola, nessuna conseguenza altrove → scrittura diretta con
// la RLS come barriera (Contratto, categoria A). L'invariante che conta —
// niente biglietti su un conto chiuso — è un trigger del database, non un
// controllo di schermata.
export async function chiamaProssimoTurno(orderId) {
  const { data: utente } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("chiamate_turno")
    .insert({ order_id: orderId, creata_da: utente?.user?.id ?? null });
  if (error) throw error;
}

// I biglietti ancora da stampare, col tavolo. ⚠️ Nessun limite di tempo: un
// biglietto che nessuno ha stampato resta in coda finché non esce — è il
// pattern §4.2 dell'architettura, dove una stampante spenta non fa perdere
// niente.
export async function listChiamateTurno() {
  const { data, error } = await supabase
    .from("chiamate_turno")
    .select("*, order:order_id!inner(table_label, status)")
    .eq("order.status", "aperto")
    .order("creata_il", { ascending: true });
  if (error) throw error;
  return data;
}

// «È uscito dalla stampante», come `prepared_at` sulle righe: non vuol dire
// che la cucina l'ha letto.
export async function segnaChiamataStampata(id, stampata) {
  const { error } = await supabase
    .from("chiamate_turno")
    .update({ stampata_il: stampata ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

// GLI ALLERGENI DI UNA RIGA DI COMANDA (24/08/2026, blocco 1 del mandato
// del collaudo).
//
// ⚠️ ARRIVANO **TUTTI**, anche quelli che non si possono togliere, ed è la
// richiesta di Alessio: *«quelli non eliminabili si vedono ma sono SPENTI —
// il cameriere sa che deve avvisare il cliente invece di promettere
// qualcosa che non possiamo fare»*. Nasconderli lascerebbe credere che il
// piatto quell'allergene non ce l'abbia.
//
// ⚠️ Si chiedono al TOCCO e non all'apertura della schermata: sono una
// lettura per riga, e quasi sempre per niente — chiedere un piatto senza un
// allergene è la norma, non l'eccezione.
export async function allergeniDellaRiga(orderItemId) {
  const { data, error } = await supabase.rpc("allergeni_della_riga", {
    p_order_item_id: orderItemId,
  });
  if (error) throw error;
  return data ?? [];
}

// Togliere un allergene da una riga: scrive UNA sostituzione per ogni
// ingrediente che quell'allergene lo porta, tutte insieme o nessuna.
//
// ⚠️ IL SUPPLEMENTO NON SI PASSA: lo legge il database dal Ricettario. Se lo
// mandasse il tablet, un prezzo sbagliato finirebbe sul conto di un cliente
// senza che nessun vincolo se ne accorga.
export async function applicaSostituzione(orderItemId, allergene) {
  return eseguiOperazione("applica_sostituzione_riga", {
    p_order_item_id: orderItemId,
    p_allergene: allergene,
  });
}

export async function togliSostituzioneRiga(orderItemId, allergene) {
  return eseguiOperazione("togli_sostituzione_riga", {
    p_order_item_id: orderItemId,
    p_allergene: allergene,
  });
}
