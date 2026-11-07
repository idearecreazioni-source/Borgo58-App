import { supabase } from "../supabase";

// LA SPUNTA «INVESTIMENTO» CON LA SUA VOCE (parte 6 del piano, 07/11/2026).
//
// 🔴 SPUNTARE VUOL DIRE SCEGLIERE LA VOCE (richiesta C di Alessio): il
//    database lo pretende per ogni spunta nuova (migrazione 20261107000003)
//    e segna_investimento() mette spunta e collegamento in un gesto solo.
//    Togliere la spunta toglie anche i collegamenti: la spesa esce dal piano.
// ⚠️ Le righe segnate prima del 07/11 senza voce restano come sono: si
//    collegano dalla pagina del piano, nelle «Spese da assegnare».

/** Le voci vive del piano, con le rate, per scegliere dove va una spesa. */
export async function vociPerLaSpunta() {
  const [imp, voci, rate] = await Promise.all([
    supabase.from("piano_impostazioni").select("mese_apertura").maybeSingle(),
    supabase.from("piano_voci").select("id, gruppo, ordine, descrizione").is("archiviata_il", null).order("gruppo").order("ordine").order("descrizione"),
    supabase.from("piano_rate").select("id, voce_id, mese_rel, importo").order("mese_rel"),
  ]);
  for (const r of [imp, voci, rate]) if (r.error) throw r.error;
  return { meseApertura: imp.data?.mese_apertura ?? null, voci: voci.data ?? [], rate: rate.data ?? [] };
}

/**
 * Segna una spesa «investimento» e la collega alla voce, per quello che
 * ne resta da assegnare.
 * @param fonte "prima_nota" | "anticipazione" | "fattura"
 */
export async function segnaConVoce(fonte, id, voce) {
  if (!voce?.voceId) throw new Error("Scegli la voce del piano a cui va questa spesa.");
  const { error } = await supabase.rpc("segna_investimento", {
    p_fonte: fonte,
    p_id: id,
    p_voce_id: voce.voceId,
    p_rata_id: voce.rataId || null,
  });
  if (error) throw error;
}

/** Toglie la spunta e i collegamenti al piano. */
export async function togliSpunta(fonte, id) {
  const { error } = await supabase.rpc("togli_investimento", { p_fonte: fonte, p_id: id });
  if (error) throw error;
}
