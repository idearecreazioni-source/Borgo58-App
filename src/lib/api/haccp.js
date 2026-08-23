import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// =====================================================================
// ⚠️ NON AGGIUNGERE `.limit()` alle funzioni di elenco di questo file
// =====================================================================
// Trovato durante l'audit del 05/08/2026, prima di commettere l'errore:
// le liste di questo file NON alimentano solo le pagine a schermo, ma
// anche `ManualeCompleto.jsx` — il PDF del piano di autocontrollo, cioè
// il documento che si mostra a un ispettore ASL.
//
// Un limite messo "per prudenza" qui produrrebbe un registro che SEMBRA
// completo ma non lo è: un danno molto peggiore della lentezza che
// vorrebbe curare, e per giunta silenzioso. Vale lo stesso per l'export
// CSV della prima nota (`listCashMovements` in cash.js).
//
// La regola generale del progetto (§7 protocollo 6 del brief) va quindi
// letta così: il limite si mette sulle liste **di sola visualizzazione**,
// mai su ciò che alimenta un documento esibibile. Per contenere questi
// registri quando cresceranno la strada giusta NON è il numero di righe
// ma un **filtro di periodo** sul manuale (un ispettore chiede sempre un
// intervallo di date, non "tutto dall'apertura") — vedi §3.19.
// =====================================================================

// ---------------------------------------------------------------------
// Filtro di periodo (§3.19 punto 5) — il modo GIUSTO di contenere questi
// registri quando crescono: un ispettore chiede un intervallo di date,
// non "tutto dall'apertura". Senza periodo le liste restano complete,
// come prima.
//
// I confini arrivano come date del calendario LOCALE (AAAA-MM-GG) e
// diventano istanti: dal = mezzanotte locale, al = fine giornata locale.
// NON si confronta la data col testo su una colonna oraria: una
// rilevazione dell'1 agosto alle 00:30 è ancora il 31 luglio in UTC, e
// finirebbe nel giorno sbagliato (la trappola di CLAUDE.md §8).
// ---------------------------------------------------------------------
function conPeriodo(query, colonna, periodo) {
  if (periodo?.dal) query = query.gte(colonna, new Date(`${periodo.dal}T00:00:00`).toISOString());
  if (periodo?.al) query = query.lte(colonna, new Date(`${periodo.al}T23:59:59.999`).toISOString());
  return query;
}

// Variante per le colonne che sono GIÀ date di calendario (niente orario):
// il confronto testuale è corretto e non passa da UTC.
function conPeriodoData(query, colonna, periodo) {
  if (periodo?.dal) query = query.gte(colonna, periodo.dal);
  if (periodo?.al) query = query.lte(colonna, periodo.al);
  return query;
}

// --- Raccolta propria (§3.17) — erbe spontanee/prodotti autoraccolti ---
export async function listForagedItems(periodo) {
  let query = supabase
    .from("foraged_items")
    .select("*, ingredient:ingredient_id(id, name)")
    .order("harvest_date", { ascending: false });
  query = conPeriodoData(query, "harvest_date", periodo);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createForagedItem(payload) {
  const { data, error } = await supabase
    .from("foraged_items")
    .insert(payload)
    .select("*, ingredient:ingredient_id(id, name)")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteForagedItem(id) {
  const { error } = await supabase.from("foraged_items").delete().eq("id", id);
  if (error) throw error;
}

// --- Attrezzature (struttura, solo titolare in scrittura — RLS) ---
export async function listEquipment() {
  const { data, error } = await supabase
    .from("haccp_equipment")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data;
}

export async function createEquipment({ name, storageType, targetMinC, targetMaxC }) {
  const { data, error } = await supabase
    .from("haccp_equipment")
    .insert({
      name,
      storage_type: storageType || null,
      target_min_c: targetMinC ?? null,
      target_max_c: targetMaxC ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --- Registro temperature ---
export async function listTemperatureLogs(equipmentId, periodo) {
  let query = supabase
    .from("v_haccp_temperature_logs")
    .select("*")
    .order("recorded_at", { ascending: false });
  if (equipmentId) query = query.eq("equipment_id", equipmentId);
  query = conPeriodo(query, "recorded_at", periodo);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ⚠️ Passa dal corridoio (B4) e non è più una insert diretta: una lettura
// fuori range apre da sé una non conformità, quindi sono due tabelle in
// una transazione sola. La lettura si salva SEMPRE — anche fuori range,
// anche senza rimedio: una misurazione persa è irrecuperabile, un rimedio
// scritto dopo è ancora un rimedio.
export async function addTemperatureLog({ equipmentId, recordedTempC, note, correctiveAction }) {
  return eseguiOperazione("registra_temperatura", {
    p_equipment_id: equipmentId,
    p_recorded_temp_c: recordedTempC,
    p_note: note || null,
    p_corrective_action: correctiveAction || null,
  });
}

// --- Ricevimento merci ---
export async function listGoodsReceiving(periodo) {
  let query = supabase
    .from("haccp_goods_receiving")
    .select("*, supplier:supplier_id(id, name)")
    .order("received_at", { ascending: false });
  query = conPeriodo(query, "received_at", periodo);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ⚠️ Anche questa passa dal corridoio (B4): merce non conforme o
// imballaggio non integro aprono da sé la non conformità. Prima restava
// scritto che la merce era da respingere ed era entrata comunque, senza
// nessuna traccia di cosa si fosse deciso.
export async function addGoodsReceiving({
  supplierId,
  productDescription,
  temperatureC,
  packagingOk,
  conformity,
  note,
  azione,
}) {
  return eseguiOperazione("registra_ricevimento_merci", {
    p_supplier_id: supplierId || null,
    p_product_description: productDescription,
    p_temperature_c: temperatureC ?? null,
    p_packaging_ok: packagingOk,
    p_conformity: conformity,
    p_note: note || null,
    p_azione: azione || null,
  });
}

// --- Pulizia e sanificazione ---
export async function listCleaningTasks() {
  const { data, error } = await supabase
    .from("haccp_cleaning_tasks")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data;
}

export async function createCleaningTask({ name, area, frequency }) {
  const { data, error } = await supabase
    .from("haccp_cleaning_tasks")
    .insert({ name, area: area || null, frequency })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listCleaningLogs(taskId, periodo) {
  let query = supabase
    .from("haccp_cleaning_logs")
    .select("*, task:task_id(id, name, area, frequency)")
    .order("completed_at", { ascending: false });
  if (taskId) query = query.eq("task_id", taskId);
  query = conPeriodo(query, "completed_at", periodo);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function addCleaningLog({ taskId, note }) {
  const { error } = await supabase.from("haccp_cleaning_logs").insert({
    task_id: taskId,
    note: note || null,
  });
  if (error) throw error;
}

// --- Disinfestazione ---
export async function listPestControlLogs(periodo) {
  let query = supabase
    .from("haccp_pest_control_logs")
    .select("*")
    .order("performed_at", { ascending: false });
  query = conPeriodo(query, "performed_at", periodo);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function addPestControlLog({ performedBy, type, findings, note }) {
  const { error } = await supabase.from("haccp_pest_control_logs").insert({
    performed_by: performedBy || null,
    type,
    findings: findings || null,
    note: note || null,
  });
  if (error) throw error;
}

// --- Non conformità ---
// Col periodo attivo, le non conformità APERTE restano SEMPRE incluse:
// filtrare via un problema non risolto da un documento per l'ispettore
// somiglierebbe a nasconderlo, che è l'esatto contrario di §8 del brief.
export async function listNonConformities(periodo) {
  let query = supabase
    .from("haccp_non_conformities")
    .select("*")
    .order("detected_at", { ascending: false });
  if (periodo?.dal || periodo?.al) {
    const condizioni = [];
    if (periodo.dal)
      condizioni.push(`detected_at.gte.${new Date(`${periodo.dal}T00:00:00`).toISOString()}`);
    if (periodo.al)
      condizioni.push(`detected_at.lte.${new Date(`${periodo.al}T23:59:59.999`).toISOString()}`);
    query = query.or(`resolved.eq.false,and(${condizioni.join(",")})`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function addNonConformity({ category, description, note }) {
  const { error } = await supabase.from("haccp_non_conformities").insert({
    category,
    description,
    note: note || null,
  });
  if (error) throw error;
}

// La via di ritorno di «Risolvi» (difetto n. 3 del collaudo, 17/08). Una
// non conformità chiusa per sbaglio restava chiusa per sempre: stessa
// famiglia dei vicoli ciechi del Blocco 5 — un gesto irreversibile senza
// il gesto che lo disfa.
//
// ⚠️ Il rimedio scritto NON si cancella: resta lì, e lo si rilegge quando
// si richiude. Cancellarlo farebbe perdere quello che era stato scritto —
// e su un registro che si esibisce, riaprire una riga è già abbastanza
// delicato senza aggiungerci una perdita di informazione. Chi richiude
// scrive il rimedio nuovo, che sovrascrive.
//
// ⚠️ Non è una scrittura da nascondere: `resolved_at` torna vuoto, quindi
// nel manuale quella riga torna fra le aperte — che è esattamente ciò che
// si vuole, perché il fatto è ancora aperto.
export async function riapriNonConformita(id) {
  const { error } = await supabase
    .from("haccp_non_conformities")
    .update({ resolved: false, resolved_at: null })
    .eq("id", id);
  if (error) throw error;
}

export async function resolveNonConformity(id, { correctiveAction }) {
  const { error } = await supabase
    .from("haccp_non_conformities")
    .update({ resolved: true, resolved_at: new Date().toISOString(), corrective_action: correctiveAction || null })
    .eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Le pulizie come LISTA DI OGGI (24/08/2026)
// ---------------------------------------------------------------------
// ⚠️ La regola di quando una pulizia è dovuta e di quanti giorni è in
// ritardo vive nel DATABASE (`pulizie_di_oggi`), non qui: la stessa
// risposta serve alla schermata e al manuale esibibile, e due calcoli
// per la stessa domanda finiscono per dire due cose diverse.
export async function pulizieDiOggi() {
  const { data, error } = await supabase.rpc("pulizie_di_oggi");
  if (error) throw error;
  return data ?? [];
}

export async function pulizieDelMese(anno, mese) {
  const { data, error } = await supabase.rpc("pulizie_del_mese", { p_anno: anno, p_mese: mese });
  if (error) throw error;
  return data ?? [];
}

export async function pulizieMesiConDati() {
  const { data, error } = await supabase.rpc("pulizie_mesi_con_dati");
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------
// Temperature e non conformità: oggi in evidenza, il resto in archivio
// (24/08/2026)
// ---------------------------------------------------------------------
// ⚠️ L'archivio si chiede un MESE alla volta, e non è una comodità: la
// tabella delle rilevazioni cresce di qualche riga al giorno per sempre,
// e una lettura senza limite torna al massimo di mille righe senza dirlo.
// Un perimetro mensile toglie il caso invece di sorvegliarlo.
export async function temperatureDiOggi() {
  const { data, error } = await supabase.rpc("temperature_di_oggi");
  if (error) throw error;
  return data ?? [];
}

export async function temperatureDelMese(anno, mese) {
  const { data, error } = await supabase.rpc("temperature_del_mese", { p_anno: anno, p_mese: mese });
  if (error) throw error;
  return data ?? [];
}

export async function temperatureMesiConDati() {
  const { data, error } = await supabase.rpc("temperature_mesi_con_dati");
  if (error) throw error;
  return data ?? [];
}

export async function nonConformitaDelMese(anno, mese) {
  const { data, error } = await supabase.rpc("non_conformita_del_mese", { p_anno: anno, p_mese: mese });
  if (error) throw error;
  return data ?? [];
}

export async function nonConformitaMesiConDati() {
  const { data, error } = await supabase.rpc("non_conformita_mesi_con_dati");
  if (error) throw error;
  return data ?? [];
}

// I numeri della schermata iniziale HACCP, contati sulla SERATA di
// servizio come li conta il registro sotto.
//
// 🔴 Prima la schermata leggeva TUTTE le rilevazioni (732 sul progetto di
// prova, e crescono ogni giorno) e le filtrava nel browser col giorno di
// CALENDARIO — mentre il registro sotto usa la serata. Alle 03:00 i due
// metri danno risposte diverse, e il badge diceva «zero fuori range»
// mentre il registro ne mostrava tre.
export async function riepilogoHaccpOggi() {
  const { data, error } = await supabase.rpc("haccp_riepilogo_oggi");
  if (error) throw error;
  return data?.[0] ?? null;
}
