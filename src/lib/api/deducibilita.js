// Deducibilità dei costi — §9 del mandato «personale e tesoreria».
//
// ⚠️ QUI NON SI CALCOLA NIENTE, ed è il punto del file. Le regole e il
// calcolo vivono nel database (`regole_deducibilita`, `quota_deducibile`),
// perché fino al 15/08/2026 vivevano in `src/lib/constants.js` e
// `src/lib/deducibility.js` — cioè in JavaScript, dentro il bundle
// pubblico, con sopra scritto «unica fonte di verità». Costruire
// l'attributo del mandato accanto a quell'elenco avrebbe dato al gestionale
// due risposte alla stessa domanda.
//
// Quindi queste funzioni chiedono e riportano. Se un giorno serve un numero
// nuovo, si aggiunge alla funzione Postgres, non qui.

import { supabase } from "../supabase";

// --- Le regole (le governa Alessio) ---------------------------------

export async function listRegoleDeducibilita({ soloAttive = false } = {}) {
  let q = supabase.from("regole_deducibilita").select("*").order("ordine").order("etichetta");
  if (soloAttive) q = q.eq("attiva", true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createRegolaDeducibilita(payload) {
  const { data, error } = await supabase
    .from("regole_deducibilita")
    .insert({
      etichetta: payload.etichetta.trim(),
      percentuale_deducibile: Number(payload.percentuale_deducibile),
      vieta_contante: Boolean(payload.vieta_contante),
      soggetta_a_plafond: Boolean(payload.soggetta_a_plafond),
      riferimento_normativo: payload.riferimento_normativo?.trim() || null,
      nota: payload.nota?.trim() || null,
      verificata_il: payload.verificata_il || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRegolaDeducibilita(id, patch) {
  const { data, error } = await supabase
    .from("regole_deducibilita")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --- L'attributo sulle righe -----------------------------------------
// Una tabella sola per gesto: categoria A del Contratto, chiamata diretta.
// A rendere necessario il corridoio è la seconda tabella, non il numero di
// righe (§5 del Contratto, stessa ragione di `completa_task`).

const setRegola = (tabella) => async (id, regolaId) => {
  const { error } = await supabase
    .from(tabella)
    .update({ regola_deducibilita_id: regolaId || null })
    .eq("id", id);
  if (error) throw error;
};

/** La regola ABITUALE di una causale: le uscite di prima nota la ereditano. */
export const setRegolaCausale = setRegola("cash_causali");
/** La scelta esplicita su un movimento: vince sull'eredità dalla causale. */
export const setRegolaMovimento = setRegola("cash_movements");
/** La regola abituale di un fornitore: le sue fatture la ereditano. */
export const setRegolaFornitore = setRegola("suppliers");
/** La scelta esplicita su una fattura: vince sull'eredità dal fornitore. */
export const setRegolaFattura = setRegola("supplier_invoices");
/** La regola di una spesa del modulo Deduzioni. */
export const setRegolaSpesa = setRegola("deductible_expenses");

// --- Le letture -------------------------------------------------------

/**
 * Le due basi del mandato: quanto si deduce, quanto no, e — separato da
 * entrambi — quanto nessuno ha ancora classificato. Porta con sé
 * l'avvertenza: il numero e il suo limite non si separano.
 */
export async function getRettificheFiscali(entityId, anno) {
  const { data, error } = await supabase.rpc("rettifiche_fiscali", {
    p_entity_id: entityId,
    p_anno: anno,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

/** Cosa manca da classificare: un rimprovero senza elenco non è una lista di lavoro. */
export async function listCostiDaClassificare(entityId, anno) {
  const { data, error } = await supabase.rpc("costi_da_classificare", {
    p_entity_id: entityId,
    p_anno: anno,
  });
  if (error) throw error;
  return data ?? [];
}

/** Le spese del modulo Deduzioni, già valorizzate dal database (mai ricalcolate qui). */
export async function listSpeseValorizzate(entityId, anno) {
  const { data, error } = await supabase.rpc("spese_deducibili_valorizzate", {
    p_entity_id: entityId,
    p_anno: anno,
  });
  if (error) throw error;
  return data ?? [];
}
