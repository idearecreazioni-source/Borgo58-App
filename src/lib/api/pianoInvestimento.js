import { supabase } from "../supabase";
import { leggiAPagine } from "../calcoli/investimento";

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

// =====================================================================
// PARTE 5 (07/11/2026): LO SPESO E I COLLEGAMENTI
// =====================================================================
// 🔴 LO SPESO SI LEGGE INSIEME AL CONTROLLO. Tre letture:
//    · piano_speso_per_voce(): speso e impegnato di ogni voce;
//    · piano_spese_del_progetto(): le spese segnate «investimento» (Borgo 58
//      e tasca) con quanto è già assegnato;
//    · costo_del_progetto(): il totale per soggetto, la stessa cifra per
//      un'altra strada. La pagina li confronta e, se non tornano, lo dice.
// ⚠️ Le spese si leggono a pagine: è una chiamata a funzione (POST), e il
//    segnale delle letture tagliate a mille righe lì non arriva.

/** Speso, impegnato, spese del progetto, collegamenti e il totale di controllo. */
export async function leggiSpeso() {
  const [speso, spese, costo, collegamenti] = await Promise.all([
    supabase.rpc("piano_speso_per_voce"),
    leggiAPagine(async (da, a) => {
      const { data, error } = await supabase.rpc("piano_spese_del_progetto").range(da, a);
      if (error) throw error;
      return data ?? [];
    }),
    supabase.rpc("costo_del_progetto", { p_dal: null, p_al: null }),
    supabase
      .from("piano_collegamenti")
      .select("id, voce_id, rata_id, cash_movement_id, anticipazione_id, supplier_invoice_id, importo_attribuito")
      .order("created_at")
      .order("id"),
  ]);
  for (const r of [speso, costo, collegamenti]) if (r.error) throw r.error;
  return { speso: speso.data ?? [], spese, costo: costo.data ?? [], collegamenti: collegamenti.data ?? [] };
}

/**
 * Collega una spesa a una voce, per una parte del suo importo.
 * @param spesa {fonte: "prima_nota"|"anticipazione", id}
 * ⚠️ I controlli veri sono nel database (trigger piano_collegamento_controlla):
 *    spesa segnata investimento, non dell'orto, non oltre il suo importo.
 */
export async function collegaSpesa({ voceId, rataId, spesa, importo }) {
  const origine = spesa.fonte === "anticipazione" ? { anticipazione_id: spesa.id } : { cash_movement_id: spesa.id };
  const { error } = await supabase.from("piano_collegamenti").insert({
    voce_id: voceId,
    rata_id: rataId || null,
    ...origine,
    importo_attribuito: Math.round(Number(importo) * 100) / 100,
  });
  if (error) throw error;
}

/** Toglie un collegamento: la spesa torna fra quelle da assegnare. */
export async function scollegaSpesa(id) {
  const { error } = await supabase.from("piano_collegamenti").delete().eq("id", id);
  if (error) throw error;
}
