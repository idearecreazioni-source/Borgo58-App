// Le fatture ai clienti (13/11/2026) — l'archivio nel database.
//
// Pezzi 1-3 del piano approvato da Alessio il 13/11: leggere, salvare il
// cliente e la bozza, emettere e mandare dalla PEC.
//
// ⚠️ Il numero NON si scrive mai da qui: lo dà `emetti_fattura()` nel
// database, sotto lucchetto, quando la fattura esce dalla bozza.

import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";
import { chiamaFunzione } from "../chiamaFunzione";

export async function listClientiFattura({ soloAttivi = true } = {}) {
  let q = supabase.from("clienti_fattura").select("*").order("denominazione").order("cognome");
  if (soloAttivi) q = q.eq("attivo", true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function salvaClienteFattura(cliente) {
  const { id, ...campi } = cliente;
  const q = id
    ? supabase.from("clienti_fattura").update({ ...campi, aggiornato_il: new Date().toISOString() }).eq("id", id)
    : supabase.from("clienti_fattura").insert(campi);
  const { data, error } = await q.select().single();
  if (error) throw error;
  return data;
}

export async function listFattureEmesse({ anno } = {}) {
  let q = supabase
    .from("fatture_emesse")
    .select(
      "*, cliente:clienti_fattura(id, denominazione, nome, cognome), righe:fatture_emesse_righe(*), " +
        "invii:fatture_emesse_invii(id, stato, nome_file, creato_il)"
    )
    .order("data", { ascending: false })
    .order("numero", { ascending: false, nullsFirst: true });
  if (anno) q = q.eq("anno", anno);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/**
 * Emette e manda (pezzo 3, 13/11/2026): la funzione `fattura-spedisci` dà
 * il numero alla bozza e la spedisce dalla PEC allo SdI. Una «da inviare»
 * (un invio non riuscito) o una «scartata» corretta ripartono con lo stesso
 * numero. ⚠️ Il numero NON si dà da qui con emetti_fattura: una fattura
 * numerata e non spedita resterebbe a metà senza che nessuno la mandi.
 * Su Prova e a casa l'invio è simulato, e il risultato lo dice (`simulato`).
 * @returns {Promise<{numero: string, nome_file: string, destinatario: string, simulato: boolean}>}
 */
export async function spedisciFattura(fatturaId) {
  const data = await chiamaFunzione("fattura-spedisci", { fattura_id: fatturaId }, "mandare la fattura");
  return data?.risultato ?? null;
}

/**
 * Un invio rimasto «in partenza» (la PEC si è interrotta dopo aver preso il
 * messaggio, o la funzione si è fermata): il titolare ha guardato nella
 * posta inviata della PEC e dice se c'è. Due tabelle (l'invio e la
 * fattura): passa dal corridoio.
 */
export async function sbloccaInvioFattura(invioId, partito) {
  return eseguiOperazione("sblocca_invio_fattura", { p_invio: invioId, p_partito: partito });
}

/** Prova utente e password della PEC, senza mandare niente. */
export async function provaLaPec() {
  const data = await chiamaFunzione("fattura-spedisci", { verifica_pec: true }, "provare la PEC");
  return data?.risultato ?? null;
}

/**
 * Salva la bozza con tutte le righe, tutto o niente: due tabelle, quindi
 * passa dal corridoio (operazioni-atomiche → salva_bozza_fattura).
 * Senza id ne crea una nuova; con l'id la riscrive (bozza o scartata).
 */
export async function salvaBozzaFattura(id, testata, righe) {
  return eseguiOperazione("salva_bozza_fattura", {
    p_fattura_id: id ?? null,
    p_testata: testata,
    p_righe: righe,
  });
}

/** Butta una bozza (le righe vanno con lei). Una fattura numerata il database la rifiuta. */
export async function eliminaBozzaFattura(id) {
  const { error } = await supabase.from("fatture_emesse").delete().eq("id", id).eq("stato", "bozza");
  if (error) throw error;
}
