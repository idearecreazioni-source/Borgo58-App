import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";
import { oggiLocale } from "../constants";

// --- Causali (editabili dal titolare, §3.4) ---
//
// ⚠️ Le causali di SISTEMA restano fuori da questo elenco (15/08/2026,
// segnalato da Alessio guardando il menu della prima nota). «Versamento in
// banca», «Differenza di cassa in meno/in più» e «Rimborso al titolare»
// non le sceglie lui: le scrive il gestionale quando conta il cassetto,
// versa o rimborsa. Sceglierne una a mano per una spesa vera **la farebbe
// sparire dai costi in silenzio**, perché quelle causali sono trattate
// come spostamenti di denaro e non come spese. Restano visibili in
// «Cassa → Causali», che serve a vederle tutte.
export async function listCausali(kind) {
  let query = supabase
    .from("cash_causali")
    .select("*")
    .eq("active", true)
    .eq("di_sistema", false)
    .order("label");
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listAllCausali() {
  const { data, error } = await supabase.from("cash_causali").select("*").order("kind").order("label");
  if (error) throw error;
  return data;
}

export async function createCausale({ label, kind }) {
  const { data, error } = await supabase
    .from("cash_causali")
    .insert({ label: label.trim(), kind })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deactivateCausale(id) {
  const { error } = await supabase.from("cash_causali").update({ active: false }).eq("id", id);
  if (error) throw error;
}

// Quali uscite sono costi fissi lo decide Alessio, non un elenco di
// parole scritto da noi: il giorno che aggiunge una causale nuova,
// indovinarla la farebbe finire dalla parte sbagliata in silenzio.
// Serve allo scostamento della Proiezione (14/08/2026).
export async function setCausaleNeiFissi(id, valore) {
  const { error } = await supabase
    .from("cash_causali")
    .update({ conta_nei_fissi: valore })
    .eq("id", id);
  if (error) throw error;
}

// --- Movimenti di cassa (prima nota) ---
const MOVEMENT_SELECT = "*, causale:causale_id(id, label)";

// ⚠️ NIENTE `.limit()` qui: alimenta anche l'export CSV della prima nota
// (PrimaNota.jsx usa lo stesso array per la tabella e per il file), quindi
// un limite produrrebbe un export fiscale incompleto ma dall'aspetto
// normale. È già contenuta dai filtri di periodo `from`/`to`, che sono la
// strada giusta. Stessa avvertenza estesa in cima a haccp.js.
export async function listCashMovements({ entityId, from, to, direction } = {}) {
  let query = supabase
    .from("cash_movements")
    .select(MOVEMENT_SELECT)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (entityId) query = query.eq("entity_id", entityId);
  if (direction) query = query.eq("direction", direction);
  if (from) query = query.gte("movement_date", from);
  if (to) query = query.lte("movement_date", to);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createCashMovement(payload) {
  const { data, error } = await supabase
    .from("cash_movements")
    .insert(payload)
    .select(MOVEMENT_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCashMovement(id) {
  const { error } = await supabase.from("cash_movements").delete().eq("id", id);
  if (error) throw error;
}

// Saldo di cassa (contante atteso) per entità.
// --- La tesoreria (15/08/2026, Blocco 6a) ---------------------------
// L'UNICA risposta a «quanto contante ho nel cassetto». Comprende gli
// incassi in contante dei conti chiusi, che il database LEGGE dalla sala
// invece di riscriverli in prima nota: così non c'è nessuna riga doppia da
// togliere il giorno del registratore telematico. Porta con sé
// l'avvertenza, come tutte le funzioni che restituiscono un numero e il
// suo limite.
// ⚠️ Le uscite già scritte e non ancora avvenute, e quelle entrate nel
// saldo OGGI. Serve a spiegare un saldo che cambia da solo alla
// mezzanotte: senza questi due numeri, la prima volta che succede sembra
// un errore del gestionale (condizione posta da Alessio il 17/08).
// ⚠️ Con un orizzonte, risponde anche quante uscite cadono OLTRE (17/08/2026,
// difetto n. 1 del collaudo): la previsione guarda 30 giorni per
// impostazione predefinita, e un assegno datato al 31° sparisce da tutte e
// due le schermate — dal saldo perché non è ancora avvenuto, dalla
// previsione perché è fuori orizzonte. Senza orizzonte quei numeri sono
// zero, ed è giusto: chi non ha un orizzonte non ha un «oltre».
export async function getUsciteFuture(entityId, finoAl) {
  const { data, error } = await supabase.rpc("uscite_future", {
    p_entity_id: entityId,
    p_fino_al: finoAl ?? null,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function getSaldoTesoreria(entityId) {
  const { data, error } = await supabase.rpc("saldo_tesoreria", { p_entity_id: entityId });
  if (error) throw error;
  return data?.[0] ?? null;
}

// Conteggio del cassetto e versamento in banca toccano due tabelle
// ciascuno, quindi passano dal corridoio (Contratto B4).
// ⚠️ `presoAtto` NON è un dettaglio: senza, il database rifiuta di chiudere
// la giornata finché restano conti incassati senza documento fiscale. È
// l'unica rete di questo blocco — *un elenco che nessuno guarda non è una
// rete* — e il permesso, quando serve, **resta scritto** sul conteggio.
export async function registraConteggioCassa({ entityId, contato, data, nota, presoAtto }) {
  return eseguiOperazione("registra_conteggio_cassa", {
    p_entity_id: entityId,
    p_contato: contato,
    p_data: data,
    p_nota: nota ?? null,
    p_preso_atto: presoAtto === true,
  });
}

export async function versaInBanca({ entityId, importo, data, nota }) {
  return eseguiOperazione("versa_in_banca", {
    p_entity_id: entityId,
    p_importo: importo,
    p_data: data,
    p_nota: nota ?? null,
  });
}

// --- «Ce la faccio al 16?» (15/08/2026, Blocco 6b) -------------------
// La domanda che chiude i ristoranti non è «quanto ho» ma «arrivo alla
// scadenza con i soldi sul conto». Tutto qui sotto LEGGE: le fatture da
// pagare e le imposte il gestionale le sa già, e riscriverle come scadenze
// le conterebbe due volte.

export async function getPrevisioneCassa(entityId, finoAl) {
  const { data, error } = await supabase.rpc("previsione_cassa", {
    p_entity_id: entityId,
    p_fino_al: finoAl ?? null,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function getPosInTransito(entityId) {
  const { data, error } = await supabase.rpc("pos_in_transito", { p_entity_id: entityId });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function listMovimentiAttesi(entityId, finoAl) {
  const { data, error } = await supabase.rpc("movimenti_attesi", {
    p_entity_id: entityId,
    p_fino_al: finoAl ?? null,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getImpostazioniTesoreria(entityId) {
  const { data, error } = await supabase
    .from("impostazioni_tesoreria")
    .select("*")
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function salvaImpostazioniTesoreria(entityId, campi) {
  const { data, error } = await supabase
    .from("impostazioni_tesoreria")
    .upsert({
      entity_id: entityId,
      // Vuoto resta vuoto: «non l'ha ancora detto la banca» è una risposta
      // diversa da zero, e zero commissioni sarebbe una risposta inventata.
      giorni_accredito_pos:
        campi.giorniAccredito === "" || campi.giorniAccredito == null
          ? null
          : Number(campi.giorniAccredito),
      commissione_pos_percento:
        campi.commissione === "" || campi.commissione == null ? null : Number(campi.commissione),
      aggiornato_il: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ⚠️ `includiChiuse` esiste perché una scadenza chiusa con «non serve
// più» spariva dall'elenco e non c'era più nessun posto da cui riaprirla
// (Blocco 5.2 del mandato di correzione, 16/08/2026).
export async function listScadenzePreviste(entityId, { includiChiuse = false } = {}) {
  let query = supabase
    .from("scadenze_previste")
    .select("*")
    .eq("entity_id", entityId)
    .order("scade_il");
  if (!includiChiuse) query = query.is("chiusa_il", null);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createScadenzaPrevista(payload) {
  const { data, error } = await supabase
    .from("scadenze_previste")
    .insert({
      entity_id: payload.entityId,
      descrizione: payload.descrizione.trim(),
      importo: Number(payload.importo),
      scade_il: payload.scadeIl,
      ogni_mesi: Number(payload.ogniMesi ?? 0),
      mezzo: payload.mezzo ?? "banca",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function chiudiScadenzaPrevista(id) {
  // ⚠️ `oggiLocale()` e non `toISOString().slice(0,10)`: quella è la data
  // UTC, e fra mezzanotte e le due restituisce IERI. Per un'osteria che
  // chiude all'una vuol dire chiudere la scadenza col giorno sbagliato
  // (§8, trovata in 14 punti nell'audit dell'08/08).
  const { error } = await supabase
    .from("scadenze_previste")
    .update({ chiusa_il: oggiLocale() })
    .eq("id", id);
  if (error) throw error;
}

// Le due vie di ritorno di una scadenza fissa: riaprirla se è stata
// chiusa per sbaglio, e correggerla se l'importo o la data erano
// sbagliati. Prima c'era solo «non serve più», che è una porta a senso
// unico: l'unico rimedio era ricrearla, perdendo da quanto tempo esiste.
export async function riapriScadenzaPrevista(id) {
  const { error } = await supabase
    .from("scadenze_previste")
    .update({ chiusa_il: null })
    .eq("id", id);
  if (error) throw error;
}

export async function aggiornaScadenzaPrevista(id, payload) {
  const patch = {};
  if (payload.descrizione !== undefined) patch.descrizione = payload.descrizione.trim();
  if (payload.importo !== undefined) patch.importo = Number(payload.importo);
  if (payload.scadeIl !== undefined) patch.scade_il = payload.scadeIl;
  if (payload.ogniMesi !== undefined) patch.ogni_mesi = Number(payload.ogniMesi ?? 0);
  if (payload.mezzo !== undefined) patch.mezzo = payload.mezzo;
  const { error } = await supabase.from("scadenze_previste").update(patch).eq("id", id);
  if (error) throw error;
}

export async function listConteggiCassa(entityId, limite = 10) {
  const { data, error } = await supabase
    .from("conteggi_cassa")
    .select("*")
    .eq("entity_id", entityId)
    .order("contato_il", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data;
}

export async function getCashBalance(entityId) {
  const { data, error } = await supabase
    .from("v_cash_balance")
    .select("*")
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Cosa non torna fra le fatture fornitore e la prima nota.
//
// Il grosso è impedito per costruzione (pagare una fattura scrive da sé
// l'uscita, e una fattura non può produrre due movimenti): qui restano i
// casi che nessun vincolo può prevenire — fatture pagate prima che quel
// collegamento esistesse, e uscite battute a mano che non agganciano
// niente. Quando arriveranno gli estratti conto, è lo stesso elenco che
// si riempirà con le righe della banca senza corrispondenza.
export async function listQuadraturaPagamenti({ from, to } = {}) {
  const { data, error } = await supabase.rpc("quadratura_pagamenti", {
    p_dal: from || null,
    p_al: to || null,
  });
  if (error) throw error;
  return data ?? [];
}

// --- Device (tablet) — segnalazione silenziosa sconti/omaggi (§3.4) ---
export async function listPosDevices() {
  const { data, error } = await supabase.from("pos_devices").select("*").eq("active", true).order("name");
  if (error) throw error;
  return data;
}

export async function createPosDevice({ name, isOwnerDevice }) {
  const { data, error } = await supabase
    .from("pos_devices")
    .insert({ name: name.trim(), is_owner_device: !!isOwnerDevice })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --- Sconti e omaggi ---
const DG_SELECT =
  "*, causale:causale_id(id, label), customer:customer_id(id, name, phone), device:device_id(id, name, is_owner_device)";

export async function listDiscountsGifts({ entityId, from, to } = {}) {
  let query = supabase
    .from("discounts_gifts")
    .select(DG_SELECT)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (entityId) query = query.eq("entity_id", entityId);
  if (from) query = query.gte("movement_date", from);
  if (to) query = query.lte("movement_date", to);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createDiscountGift(payload) {
  const { data, error } = await supabase
    .from("discounts_gifts")
    .insert(payload)
    .select(DG_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDiscountGift(id) {
  const { error } = await supabase.from("discounts_gifts").delete().eq("id", id);
  if (error) throw error;
}

// Aggregazione mensile (base TD27 per gli omaggi).
export async function listDiscountsGiftsMonthly(entityId) {
  let query = supabase
    .from("v_discounts_gifts_monthly")
    .select("*")
    .order("month", { ascending: false });
  if (entityId) query = query.eq("entity_id", entityId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// --- Incassato contro scontrinato (16/08/2026) ----------------------
// Due totali, non uno: quanto è entrato e quanto ha un documento fiscale.
// ⚠️ La differenza NON sparisce da sola — resta finché non la si chiude,
// come le fatture da pagare. Un elenco che si svuota da solo è un elenco
// che non serve a niente.
export async function getQuadraturaFiscale(entityId, dal, al) {
  const { data, error } = await supabase.rpc("quadratura_fiscale", {
    p_entity_id: entityId,
    p_dal: dal ?? null,
    p_al: al ?? null,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function listContiDaFiscalizzare(entityId, dal, al) {
  const { data, error } = await supabase.rpc("conti_da_fiscalizzare", {
    p_entity_id: entityId,
    p_dal: dal ?? null,
    p_al: al ?? null,
  });
  if (error) throw error;
  return data ?? [];
}

// --- I PRESTITI DI PRIVATI (22/08/2026) ------------------------------
//
// ⚠️ NON sono ricavi e NON sono incassi: sono denaro che sta in cassa e va
// restituito. Il gestionale deve saper rispondere a due domande che prima
// avevano la stessa risposta — «quanti soldi ho?» e «quanti sono miei?».

export async function listPrestiti(entityId) {
  const { data, error } = await supabase.rpc("prestiti_aperti", { p_entity_id: entityId });
  if (error) throw error;
  return data ?? [];
}

// 🔴 IL NUMERO CHE CONTA, ed è il secondo non il primo: *sapere di dovere
// 30.000 non serve a decidere niente; sapere che oggi puoi restituirne 3.000
// sì.* Dietro non c'è nessun calcolo nuovo — è «Ce la faccio?» chiesto a sei
// mesi invece che a trenta giorni, meno la riserva.
export async function getSpazioDiManovra(entityId) {
  const { data, error } = await supabase.rpc("spazio_di_manovra", { p_entity_id: entityId });
  if (error) throw error;
  return data?.[0] ?? null;
}

// Il prestito e il movimento che ne consegue: due tabelle, quindi passa dal
// corridoio (Contratto B4). I soldi sono entrati davvero e il saldo deve
// vederli — ma con un nome che non sia «incasso».
export async function registraPrestito({ entityId, daChi, importo, mezzo, ricevutoIl, causaleId, nota }) {
  return eseguiOperazione("registra_prestito_privato", {
    p_entity_id: entityId,
    p_da_chi: daChi,
    p_importo: importo,
    p_mezzo: mezzo,
    p_ricevuto_il: ricevutoIl,
    p_causale_id: causaleId ?? null,
    p_nota: nota ?? null,
  });
}

export async function registraRestituzione({ prestitoId, importo, mezzo, restituitoIl, causaleId, nota }) {
  return eseguiOperazione("registra_restituzione_prestito", {
    p_prestito_id: prestitoId,
    p_importo: importo,
    p_mezzo: mezzo,
    p_restituito_il: restituitoIl,
    p_causale_id: causaleId ?? null,
    p_nota: nota ?? null,
  });
}
