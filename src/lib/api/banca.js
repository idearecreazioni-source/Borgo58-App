import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";
import { leggiAPagine } from "../calcoli/investimento";

// I MOVIMENTI DELLA BANCA E LE FATTURE ELETTRONICHE, DA FILE (24/10/2026).
//
// ⚠️ Caricare i movimenti NON scrive in prima nota: un movimento di banca
// entra in `movimenti_banca` e resta «da abbinare» finché Alessio non dice
// cos'è (una fattura pagata, un movimento già scritto, una spesa nuova).
// Il sistema propone, lui conferma.
//
// Le tre operazioni che toccano più tabelle passano dal corridoio (B4);
// le altre toccano una riga sola e vanno dritte, con la RLS e il portiere
// della funzione come barriera.

export async function registraFatturaElettronica(entityId, fattura) {
  return eseguiOperazione("registra_fattura_elettronica", {
    p_entity_id: entityId,
    p_fattura: fattura,
  });
}

export async function caricaMovimentiBanca(iban, flusso, movimenti) {
  const { data, error } = await supabase.rpc("carica_movimenti_banca", {
    p_iban: iban,
    p_flusso: flusso,
    p_movimenti: movimenti,
  });
  if (error) throw error;
  return data;
}

// ⚠️ Letti a pagine: la tabella cresce ogni settimana, e una lettura senza
// pagine tornerebbe più corta di mille righe senza dirlo.
export async function listMovimentiBanca() {
  return leggiAPagine(async (da, a) => {
    const { data, error } = await supabase
      .from("movimenti_banca")
      .select(
        "*, conto:conti_bancari(nome, entity_id), " +
          "registrato:cash_movements(id, business_purpose, supplier_invoice_id, causale:cash_causali(label))",
      )
      .order("data_contabile", { ascending: false })
      .order("id")
      .range(da, a);
    if (error) throw error;
    return data;
  });
}

export async function proposteMovimentoBanca(movimentoId) {
  const { data, error } = await supabase.rpc("proposte_movimento_banca", { p_movimento: movimentoId });
  if (error) throw error;
  return data ?? [];
}

/**
 * Un'entrata della banca incassa una fattura ai clienti (13/11/2026): scrive
 * l'incasso in prima nota e lo abbina. Tre tabelle: dal corridoio.
 */
export async function incassaFatturaDaMovimentoBanca(movimentoId, fatturaId) {
  return eseguiOperazione("incassa_fattura_da_movimento_banca", {
    p_movimento: movimentoId,
    p_fattura: fatturaId,
  });
}

/**
 * Dopo il caricamento dell'estratto conto (13/11/2026, deciso da Alessio:
 * «si riconciliano in automatico quando carico l'estratto conto»): le
 * entrate con UNA sola fattura ai clienti possibile e un indizio nel testo
 * si incassano da sole. Il resto resta proposto.
 * @returns {Promise<{incassate: number, elenco: {fattura: string, importo: number, data: string}[]}>}
 */
export async function incassaDaSoliBonifici() {
  return eseguiOperazione("incassa_da_soli_bonifici", {});
}

export async function pagaFatturaDaMovimentoBanca(movimentoId, fatturaId) {
  return eseguiOperazione("paga_fattura_da_movimento_banca", {
    p_movimento: movimentoId,
    p_fattura: fatturaId,
  });
}

export async function abbinaMovimentoBanca(movimentoId, cashMovementId) {
  const { error } = await supabase.rpc("abbina_movimento_banca", {
    p_movimento: movimentoId,
    p_cash_movement: cashMovementId,
  });
  if (error) throw error;
}

export async function registraMovimentoBanca(movimentoId, { causaleId, tipoDocumento, descrizione }) {
  return eseguiOperazione("registra_movimento_banca", {
    p_movimento: movimentoId,
    p_causale: causaleId,
    p_tipo_documento: tipoDocumento,
    p_descrizione: descrizione?.trim() || null,
  });
}

export async function ignoraMovimentoBanca(movimentoId, perche) {
  const { error } = await supabase.rpc("ignora_movimento_banca", {
    p_movimento: movimentoId,
    p_perche: perche,
  });
  if (error) throw error;
}

// ⚠️ Riaprire scioglie il collegamento e basta: quello che è già scritto in
// prima nota resta lì. Toglierlo è un gesto a sé, dalla Prima nota.
export async function riapriMovimentoBanca(movimentoId) {
  const { error } = await supabase.rpc("riapri_movimento_banca", { p_movimento: movimentoId });
  if (error) throw error;
}

// GLI AVVISI DELLA BANCA (12/11/2026, PR B1 del piano «avvisi banca e
// posta»). Le mail che la banca manda alla sua casella non passano da MEMO:
// si raccolgono in `avvisi_banca`, e qui si leggono e basta. Il lettore che
// le trasforma in movimenti arriva quando ne conosciamo il formato vero.
//
// ⚠️ Solo gli ultimi `quanti`, col numero totale accanto: il testo di una
// mail può essere lungo, e per sapere «arrivano?» bastano i più recenti.
export async function listAvvisiBanca(quanti = 30) {
  const { data, error, count } = await supabase
    .from("avvisi_banca")
    .select("id, ricevuta_il, mittente, oggetto, testo, stato", { count: "exact" })
    .order("ricevuta_il", { ascending: false })
    .order("id")
    .limit(quanti);
  if (error) throw error;
  return { avvisi: data ?? [], totale: count ?? (data ?? []).length };
}
