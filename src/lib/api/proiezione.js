import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// La rotta economica: previsioni congelate, mesi veri, scostamenti.
//
// ⚠️ QUI DENTRO NON SI CALCOLA NIENTE. Ogni numero arriva da una funzione
// del database — la previsione, il pareggio, le imposte, lo scostamento.
// Il motivo è il vincolo del mandato: **un solo motore fiscale**. Se una
// di queste funzioni ricalcolasse anche solo un totale «per comodità di
// schermata», il gestionale avrebbe due risposte alla stessa domanda e
// nessun modo di sapere quale credere.

// --- Previsioni ---

export async function listaScenari(entityId) {
  let q = supabase
    .from("scenari_proiezione")
    .select("*")
    .order("anno", { ascending: false })
    .order("creato_il", { ascending: false });
  if (entityId) q = q.eq("entity_id", entityId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getScenario(id) {
  const { data, error } = await supabase
    .from("scenari_proiezione")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// I dodici mesi: fotografati se la previsione è chiusa, calcolati se è
// ancora aperta. Lo decide il database, non questa funzione.
export async function proiezioneScenario(id) {
  const { data, error } = await supabase.rpc("proiezione_scenario", { p_scenario_id: id });
  if (error) throw error;
  return data ?? [];
}

export async function riepilogoScenario(id) {
  const { data, error } = await supabase.rpc("riepilogo_scenario", { p_scenario_id: id });
  if (error) throw error;
  return data?.[0] ?? null;
}

// Il collaudo del mandato — «stessi input, stessi numeri» — fatto dalla
// macchina a ogni apertura, non una volta a mano il primo giorno.
export async function confrontoColFoglio(id) {
  const { data, error } = await supabase.rpc("confronto_col_foglio", { p_scenario_id: id });
  if (error) throw error;
  return data ?? [];
}

export async function ingressiScenario(id) {
  const [personale, extra, costiFissi, accessorie, mesi] = await Promise.all([
    supabase.from("scenario_personale").select("*").eq("scenario_id", id),
    supabase.from("scenario_extra").select("*").eq("scenario_id", id),
    supabase.from("scenario_costi_fissi").select("*").eq("scenario_id", id).order("voce"),
    supabase.from("scenario_linee_accessorie").select("*").eq("scenario_id", id),
    supabase.from("scenario_mesi").select("*").eq("scenario_id", id).order("mese"),
  ]);
  for (const r of [personale, extra, costiFissi, accessorie, mesi]) if (r.error) throw r.error;
  return {
    personale: personale.data ?? [],
    extra: extra.data ?? [],
    costiFissi: costiFissi.data ?? [],
    accessorie: accessorie.data ?? [],
    mesi: mesi.data ?? [],
  };
}

// Sei tabelle in una transazione (B4).
export async function creaScenarioDaFoglio(dati) {
  return eseguiOperazione("crea_scenario_proiezione", { p_dati: dati });
}

// Scrive i dodici mesi e poi sigilla, in quest'ordine (B4).
export async function congelaScenario(id) {
  return eseguiOperazione("congela_scenario", { p_scenario_id: id });
}

export async function cancellaScenario(id) {
  const { error } = await supabase.from("scenari_proiezione").delete().eq("id", id);
  if (error) throw error;
}

// --- Imposte: il motore unico ---

export async function calcolaImposte(entityId, imponibile, costoLavoroIncrementale = 0) {
  const { data, error } = await supabase.rpc("calcola_imposte", {
    p_entity_id: entityId,
    p_imponibile: imponibile,
    p_costo_lavoro_incrementale: costoLavoroIncrementale,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function calendarioImposte(entityId, anno, imposteAnno, impostePrecedenti = null) {
  const { data, error } = await supabase.rpc("calendario_imposte", {
    p_entity_id: entityId,
    p_anno: anno,
    p_imposte_anno: imposteAnno,
    p_imposte_anno_precedente: impostePrecedenti,
  });
  if (error) throw error;
  return data ?? [];
}

// --- I mesi veri ---

export async function misureDelMese(entityId, anno, mese) {
  const { data, error } = await supabase.rpc("misure_del_mese", {
    p_entity_id: entityId,
    p_anno: anno,
    p_mese: mese,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function chiudiMese(entityId, anno, mese, note = null) {
  const { data, error } = await supabase.rpc("chiudi_mese", {
    p_entity_id: entityId,
    p_anno: anno,
    p_mese: mese,
    p_note: note,
  });
  if (error) throw error;
  return data;
}

export async function listaConsuntivi(entityId, anno) {
  let q = supabase
    .from("consuntivi_mensili")
    .select("*")
    .order("anno", { ascending: false })
    .order("mese", { ascending: false });
  if (entityId) q = q.eq("entity_id", entityId);
  if (anno) q = q.eq("anno", anno);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// Un mese sbagliato si cancella e si richiude: la copia resta in
// `deleted_records`, perché è una tabella di soldi.
export async function cancellaConsuntivo(id) {
  const { error } = await supabase.from("consuntivi_mensili").delete().eq("id", id);
  if (error) throw error;
}

export async function scostamentoMensile(entityId, anno, mese, scenarioId) {
  const { data, error } = await supabase.rpc("scostamento_mensile", {
    p_entity_id: entityId,
    p_anno: anno,
    p_mese: mese,
    p_scenario_id: scenarioId,
  });
  if (error) throw error;
  return data ?? [];
}

export async function statoConfrontoMensile(entityId, anno, mese) {
  const { data, error } = await supabase.rpc("stato_confronto_mensile", {
    p_entity_id: entityId,
    p_anno: anno,
    p_mese: mese,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

// --- Omaggi ---

export async function budgetOmaggi(entityId, anno, mese, scenarioId) {
  const { data, error } = await supabase.rpc("budget_omaggi", {
    p_entity_id: entityId,
    p_anno: anno,
    p_mese: mese,
    p_scenario_id: scenarioId,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function omaggiPerCausale(entityId, anno, mese) {
  const { data, error } = await supabase.rpc("omaggi_per_causale", {
    p_entity_id: entityId,
    p_anno: anno,
    p_mese: mese,
  });
  if (error) throw error;
  return data ?? [];
}

// --- Periodi anomali ---

export async function listaPeriodiAnomali(entityId) {
  let q = supabase.from("periodi_anomali").select("*").order("dal", { ascending: false });
  if (entityId) q = q.eq("entity_id", entityId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function creaPeriodoAnomalo(payload) {
  const { data, error } = await supabase.from("periodi_anomali").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function cancellaPeriodoAnomalo(id) {
  const { error } = await supabase.from("periodi_anomali").delete().eq("id", id);
  if (error) throw error;
}
