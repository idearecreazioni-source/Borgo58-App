import { supabase } from "../supabase";

// LA SCHEDA DI BORGO 58 — lettura e scrittura (21/11/2026, pezzo S3).
// Le tabelle sono del solo titolare (RLS, migrazione 20261120000002): uno
// staff riceverebbe elenchi vuoti, ma la pagina sta dietro RequireTitolare.
//
// ⚠️ Una lettura fallita LANCIA, non restituisce []: una Scheda vuota si
//    leggerebbe «non c'è scritto niente» (regola del 19/08).
// ⚠️ NIENTE SI CANCELLA: non c'è nessun `delete`, e il database lo rifiuta
//    comunque. Una voce si spegne (`attiva = false`) e si può riaccendere.
// ⚠️ I LIMITI (60 voci, 10.000 caratteri) li decide il database: qui si
//    passano i suoi rifiuti alla pagina com'erano.

/** Tutte le voci, attive e spente. */
export async function leggiVoci() {
  const { data, error } = await supabase
    .from("scheda_voci")
    .select("id, numero, sezione, chiave, testo, fonte, valida_dal, verificata_il, rivedere_entro, attiva, ordine, creata_il, aggiornata_il")
    .order("numero");
  if (error) throw error;
  return data ?? [];
}

/** Quante voci attive e quanti caratteri ha il testo composto per MEMO, come li conta il database. */
export async function leggiContatori() {
  const { data, error } = await supabase.rpc("scheda_per_memo");
  if (error) throw error;
  const riga = Array.isArray(data) ? data[0] : data;
  return { voci: Number(riga?.voci) || 0, caratteri: Number(riga?.caratteri) || 0 };
}

function campiVoce(v) {
  return {
    sezione: v.sezione,
    testo: String(v.testo ?? "").trim(),
    fonte: v.fonte,
    valida_dal: v.valida_dal || null,
    verificata_il: v.verificata_il || null,
    rivedere_entro: v.rivedere_entro || null,
  };
}

/** Crea una voce (senza `id`) o ne corregge una (con `id`). Restituisce la riga salvata. */
export async function salvaVoce(voce) {
  const campi = campiVoce(voce);
  const richiesta = voce.id
    ? supabase.from("scheda_voci").update(campi).eq("id", voce.id)
    : supabase.from("scheda_voci").insert({ ...campi, chiave: voce.chiave, ordine: voce.ordine ?? 0 });
  const { data, error } = await richiesta.select().single();
  if (error) throw error;
  return data;
}

/** Spegne o riaccende una voce. Riaccenderla può essere rifiutata se la Scheda è piena. */
export async function accendiVoce(id, attiva) {
  const { data, error } = await supabase.from("scheda_voci").update({ attiva }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/** Cosa è cambiato in una voce, dalla più recente. */
export async function leggiStorico(voceId) {
  const { data, error } = await supabase
    .from("scheda_storico")
    .select("id, testo_prima, testo_dopo, fonte_prima, fonte_dopo, attiva_prima, attiva_dopo, sezione_prima, sezione_dopo, quando")
    .eq("voce_id", voceId)
    .order("quando", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// LE PROPOSTE DI MEMO (B1, migrazione 20261121000002). Nessuna scrittura diretta
// sulla tabella: la riempie `scheda_proposte_genera` e la chiude `scheda_proposta_decidi`.

/** Le proposte in attesa. ⚠️ Una lettura fallita LANCIA: «nessuna proposta» e «non l'ho letto» non sono la stessa cosa. */
export async function leggiProposte() {
  const { data, error } = await supabase
    .from("scheda_proposte")
    .select("id, tipo, origine, chiave, voce_id, sezione, testo_prima, testo_dopo, fonte_prima, fonte_dopo, abbassa_fonte, motivo, stato, creata_il, scade_il")
    .eq("stato", "in_attesa")
    .order("creata_il", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Chiede al database di calcolare le proposte nuove (costo zero, regole fisse).
 * ⚠️ Se non riesce restituisce `null` e la pagina funziona lo stesso: le proposte già nate si leggono comunque.
 */
export async function generaProposte() {
  const { data, error } = await supabase.rpc("scheda_proposte_genera");
  if (error) return null;
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
}

/**
 * Il Sì, il Non farlo o il Correggi del titolare. `esito`: "si" | "no" | "correggi".
 * Lancia se il database rifiuta (privacy, 60 voci, 10.000 caratteri): la proposta resta in attesa.
 * Restituisce `{ esito: "accettata" | "rifiutata" | "obsoleta" | "gia_decisa" | "scaduta", … }`.
 */
export async function decidiProposta(id, esito, testo = null, confermaFonte = false) {
  const { data, error } = await supabase.rpc("scheda_proposta_decidi", {
    p_id: id,
    p_esito: esito,
    p_testo: testo,
    p_conferma_fonte: Boolean(confermaFonte),
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Le parole delicate nel testo (avviso, mai blocco).
 * ⚠️ Restituisce `null` se il controllo non è riuscito: «nessuna parola
 * delicata» e «non ho potuto controllare» non sono la stessa cosa.
 */
export async function paroleDelicate(testo) {
  const { data, error } = await supabase.rpc("scheda_parole_delicate", { p_testo: String(testo ?? "") });
  if (error) return null;
  return Array.isArray(data) ? data : [];
}
