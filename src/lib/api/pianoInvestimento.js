import { supabase } from "../supabase";

// IL PIANO DELL'INVESTIMENTO — lettura e scrittura (07/11/2026).
// Le tabelle sono del solo titolare (RLS, migrazione 20261107000001): uno
// staff riceverebbe elenchi vuoti, ma la pagina sta dietro RequireTitolare.
//
// ⚠️ Una lettura fallita LANCIA, non restituisce []: un piano vuoto si
//    leggerebbe «non hai previsto niente» (regola del 19/08).

/** Tutto il piano in una volta: data di apertura, voci vive e archiviate, rate. */
export async function leggiPiano() {
  const [imp, voci, rate] = await Promise.all([
    supabase.from("piano_impostazioni").select("mese_apertura").maybeSingle(),
    supabase.from("piano_voci").select("*").order("gruppo").order("ordine").order("created_at"),
    supabase.from("piano_rate").select("id, voce_id, mese_rel, importo").order("mese_rel"),
  ]);
  for (const r of [imp, voci, rate]) if (r.error) throw r.error;
  if (!imp.data) throw new Error("Manca la data di apertura del piano.");
  return { meseApertura: imp.data.mese_apertura, voci: voci.data, rate: rate.data };
}

export async function cambiaApertura(meseApertura) {
  const { error } = await supabase
    .from("piano_impostazioni")
    .update({ mese_apertura: meseApertura, aggiornato_il: new Date().toISOString() })
    .eq("id", true);
  if (error) throw error;
}

function campiVoce(v) {
  return {
    gruppo: v.gruppo,
    descrizione: String(v.descrizione ?? "").trim(),
    importo_ivato: Math.round(Number(v.importo_ivato) * 100) / 100,
    aliquota_iva: Number(v.aliquota_iva),
    stato: v.stato,
    dilazione: v.dilazione,
    nota: v.nota?.trim() ? v.nota.trim() : null,
  };
}

/**
 * Salva una voce e le sue rate.
 * @param voce   la voce (con `id` se esiste già)
 * @param rate   [{mese_rel, importo}] — i mesi vuoti o a zero si tolgono
 * @returns l'id della voce
 *
 * ⚠️ NON È UN GESTO SOLO: prima la voce, poi le rate scritte, poi quelle
 *    tolte. Se si ferma a metà, la voce resta con le rate di prima più
 *    quelle nuove, e il ✗ lo fa vedere: è una simulazione, si ricorregge.
 *    Il messaggio lo dice (vedi la pagina).
 */
export async function salvaVoce(voce, rate) {
  let id = voce.id;
  if (id) {
    const { error } = await supabase.from("piano_voci").update(campiVoce(voce)).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("piano_voci")
      .insert({ ...campiVoce(voce), ordine: Number(voce.ordine ?? 0) })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id;
  }

  // 🔴 DA QUI LA VOCE ESISTE: se le rate si fermano, l'errore porta con sé
  //    l'id, così il modulo riprova con un aggiornamento e non crea una
  //    seconda voce uguale.
  const conId = (error) => Object.assign(new Error(error.message), { idVoce: id, causa: error });
  const piene = (rate ?? [])
    .map((r) => ({ voce_id: id, mese_rel: Number(r.mese_rel), importo: Math.round(Number(r.importo) * 100) / 100 }))
    .filter((r) => Number.isFinite(r.importo) && r.importo > 0);
  if (piene.length > 0) {
    const { error } = await supabase.from("piano_rate").upsert(piene, { onConflict: "voce_id,mese_rel" });
    if (error) throw conId(error);
  }
  const tenute = piene.map((r) => r.mese_rel);
  let via = supabase.from("piano_rate").delete().eq("voce_id", id);
  if (tenute.length > 0) via = via.not("mese_rel", "in", `(${tenute.join(",")})`);
  const { error } = await via;
  if (error) throw conId(error);
  return id;
}

/** Archivia o riprende una voce: non si cancella, perché potrà avere spese collegate. */
export async function archiviaVoce(id, archiviata) {
  const { error } = await supabase
    .from("piano_voci")
    .update({ archiviata_il: archiviata ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}
