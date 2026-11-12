import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

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
    supabase.from("piano_voci").select("id, gruppo, ordine, descrizione, madre_id").is("archiviata_il", null).order("gruppo").order("ordine").order("descrizione"),
    supabase.from("piano_rate").select("id, voce_id, mese_rel, importo").order("mese_rel"),
  ]);
  for (const r of [imp, voci, rate]) if (r.error) throw r.error;
  return { meseApertura: imp.data?.mese_apertura ?? null, voci: vociSceglibili(voci.data ?? []), rate: rate.data ?? [] };
}

/**
 * 12/11/2026, le sottovoci: una voce divisa in sottovoci non prende spese
 * (le prendono le sottovoci, lo pretende il database), e una sottovoce si
 * legge «Madre › Sottovoce», subito sotto la sua madre.
 */
export function vociSceglibili(voci) {
  const perId = new Map(voci.map((v) => [v.id, v]));
  const madri = new Set(voci.filter((v) => v.madre_id).map((v) => v.madre_id));
  const fuori = [];
  for (const v of voci) {
    if (v.madre_id) continue;
    if (!madri.has(v.id)) fuori.push(v);
    for (const f of voci.filter((x) => x.madre_id === v.id)) {
      fuori.push({ ...f, gruppo: v.gruppo, descrizione: `${v.descrizione} › ${f.descrizione}` });
    }
  }
  // Una sottovoce la cui madre non è fra le vive non resta fuori dalla scelta.
  for (const f of voci) if (f.madre_id && !perId.has(f.madre_id)) fuori.push(f);
  return fuori;
}

/**
 * Segna una spesa «investimento» e la collega alla voce, per quello che
 * ne resta da assegnare.
 * @param fonte "prima_nota" | "anticipazione" | "fattura"
 */
export async function segnaConVoce(fonte, id, voce) {
  if (!voce?.voceId) throw new Error("Scegli la voce del piano a cui va questa spesa.");
  // 🔴 DAL CORRIDOIO, come ogni scrittura su più tabelle (Contratto B4): la
  //    spunta e il collegamento insieme, o niente.
  await eseguiOperazione("segna_investimento", {
    p_fonte: fonte,
    p_id: id,
    p_voce_id: voce.voceId,
    p_rata_id: voce.rataId || null,
  });
}

/** Toglie la spunta e i collegamenti al piano. */
export async function togliSpunta(fonte, id) {
  await eseguiOperazione("togli_investimento", { p_fonte: fonte, p_id: id });
}
