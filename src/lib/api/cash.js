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
export async function getSaldoTesoreria(entityId) {
  const { data, error } = await supabase.rpc("saldo_tesoreria", { p_entity_id: entityId });
  if (error) throw error;
  return data?.[0] ?? null;
}

// Conteggio del cassetto e versamento in banca toccano due tabelle
// ciascuno, quindi passano dal corridoio (Contratto B4).
export async function registraConteggioCassa({ entityId, contato, data, nota }) {
  return eseguiOperazione("registra_conteggio_cassa", {
    p_entity_id: entityId,
    p_contato: contato,
    p_data: data,
    p_nota: nota ?? null,
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

export async function listScadenzePreviste(entityId) {
  const { data, error } = await supabase
    .from("scadenze_previste")
    .select("*")
    .eq("entity_id", entityId)
    .is("chiusa_il", null)
    .order("scade_il");
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
