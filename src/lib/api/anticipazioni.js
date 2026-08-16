// «Ho messo di tasca mia» — Blocco 7 del mandato «personale e tesoreria».
//
// ⚠️ Non è lo spazio dei soldi personali di Alessio: è il registro dei
// pagamenti che fa con fondi propri PER CONTO della società. Il verso
// opposto — prendere dalla cassa per spese personali — è stato escluso da
// lui e non esiste nessuna funzione che lo faccia.
//
// La cosa da non perdere di vista leggendo questo file: quando paga di
// tasca sua nascono DUE fatti — una spesa e un debito verso di lui — e il
// rimborso chiude il secondo senza essere una seconda spesa. Il conteggio
// dei costi lo fa il database, e conta una volta sola.

import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// --- Il vocabolario dei tag (chiuso, lo governa lui) -----------------

export async function listTagAnticipazioni({ soloAttivi = false } = {}) {
  let q = supabase.from("tag_anticipazioni").select("*").order("ordine").order("etichetta");
  if (soloAttivi) q = q.eq("attivo", true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createTagAnticipazione(etichetta) {
  const { data, error } = await supabase
    .from("tag_anticipazioni")
    .insert({ etichetta: etichetta.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function disattivaTagAnticipazione(id) {
  const { error } = await supabase.from("tag_anticipazioni").update({ attivo: false }).eq("id", id);
  if (error) throw error;
}

// --- Le note ---------------------------------------------------------

export async function listAnticipazioni(entityId, { soloAperte = false } = {}) {
  let q = supabase
    .from("anticipazioni_socio")
    .select("*, tag:tag_anticipazioni(etichetta)")
    .eq("entity_id", entityId)
    .order("pagata_il", { ascending: false });
  if (soloAperte) q = q.is("pareggiata_il", null);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createAnticipazione(payload) {
  const { data, error } = await supabase
    .from("anticipazioni_socio")
    .insert({
      entity_id: payload.entityId,
      importo: Number(payload.importo),
      pagata_il: payload.pagataIl,
      tag_id: payload.tagId,
      fondi: payload.fondi ?? "contanti",
      supplier_invoice_id: payload.supplierInvoiceId || null,
      documento_riferimento: payload.documento?.trim() || null,
      nota: payload.nota?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ⚠️ Una nota già rimborsata NON si cancella: il rifiuto arriva dal
// database e dice cosa fare prima. Cancellarla lasciava in cassa
// l'uscita del rimborso senza più il perché — il difetto n. 10 del
// mandato di correzione, terzo esemplare.
export async function deleteAnticipazione(id) {
  return eseguiOperazione("delete_anticipazione", { p_anticipazione_id: id });
}

// La via di ritorno del rifiuto qui sopra: riapre la nota e toglie
// l'uscita dalla prima nota, nella stessa transazione. Senza, il rifiuto
// sarebbe un vicolo cieco.
export async function annullaPareggioAnticipazione(id) {
  return eseguiOperazione("annulla_pareggio_anticipazione", { p_anticipazione_id: id });
}

// ⚠️ Il pareggio tocca due tabelle — chiude la nota E fa uscire il
// rimborso dalla cassa — quindi passa dal corridoio (Contratto B4). Non
// esiste uno stato in cui una avviene e l'altra no: è il criterio 12 del
// mandato.
export async function pareggiaAnticipazione(id, data) {
  return eseguiOperazione("pareggia_anticipazione", {
    p_anticipazione_id: id,
    p_data: data ?? null,
  });
}

// --- Le letture ------------------------------------------------------

export async function getSaldoAnticipazioni(entityId) {
  const { data, error } = await supabase.rpc("saldo_anticipazioni", { p_entity_id: entityId });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function listAnticipazioniPerTag(entityId, anno) {
  const { data, error } = await supabase.rpc("anticipazioni_per_tag", {
    p_entity_id: entityId,
    p_anno: anno,
  });
  if (error) throw error;
  return data ?? [];
}

export async function listDaComunicare(entityId, anno, mese) {
  const { data, error } = await supabase.rpc("anticipazioni_da_comunicare", {
    p_entity_id: entityId,
    p_anno: anno,
    p_mese: mese,
  });
  if (error) throw error;
  return data ?? [];
}
