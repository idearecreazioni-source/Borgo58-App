import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// LA SPESA SPICCIOLA — 23/08/2026, blocco 8 del mandato del collaudo.
//
// ⚠️ SEPARATA DALLA LISTA DELLA SPESA, ed è la prima riga del mandato:
// quella nasce dalle soglie del magazzino e finisce in un ordine a un
// fornitore, questa è la roba che si compra di persona al supermercato.
// Non tocca giacenze, non scrive costi, non entra in nessun totale.
//
// ⚠️ UNA TABELLA SOLA E NESSUNA CONSEGUENZA ALTROVE: scritture dirette
// con la RLS come barriera (categoria A del Contratto), niente corridoio.
// Il corridoio serve dove una scrittura a metà lascerebbe il gestionale
// a raccontare due cose diverse — qui non c'è nessun altrove.

export async function listSpesaSpicciola() {
  const { data, error } = await supabase
    .from("spesa_spicciola")
    .select("*")
    .order("categoria", { nullsFirst: false })
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

// Le categorie già scritte, per proporle invece di farle riscrivere.
// ⚠️ Si ricavano dai dati e non da un elenco nel codice: le categorie
// della spesa sono sue, come le causali di cassa. Un vocabolario chiuso
// scritto da me vorrebbe dire una migrazione per aggiungere una parola.
export async function categorieSpesaSpicciola() {
  const { data, error } = await supabase.rpc("categorie_spesa_spicciola");
  if (error) throw error;
  return data ?? [];
}

// 🔴 CON `azioneDettataId` (aperta da MEMO voce) È L'ECCEZIONE alla
// categoria A qui sopra, dal 26/10/2026: le scritture sono due — la voce e
// la chiusura della cosa detta — e passano dal corridoio in una
// transazione (20261026000002). Erano due chiamate, e un errore fra le due
// lasciava la voce scritta e la cosa ancora «da fare»: la volta dopo,
// la stessa cosa due volte in lista. Senza voce, l'insert diretto di sempre.
export async function aggiungiSpesaSpicciola({ articolo, categoria, nota }, { azioneDettataId = null } = {}) {
  if (azioneDettataId) {
    const id = await eseguiOperazione("aggiungi_spesa_spicciola", {
      p_articolo: articolo,
      p_categoria: categoria ?? null,
      p_nota: nota ?? null,
      p_azione_dettata_id: azioneDettataId,
    });
    const { data, error } = await supabase.from("spesa_spicciola").select().eq("id", id).single();
    // ⚠️ Scritta e chiusa: una rilettura fallita non è un salvataggio fallito.
    return error ? { id } : data;
  }
  const { data, error } = await supabase
    .from("spesa_spicciola")
    .insert({
      articolo: articolo.trim(),
      categoria: categoria?.trim() || null,
      nota: nota?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ⚠️ «Sparisce dall'elenco» non vuol dire cancellato: passa fra le cose
// prese, e da lì si torna indietro con un tocco. Davanti allo scaffale si
// tocca per sbaglio, e un gesto che si può solo fare e mai disfare è un
// vicolo cieco. La data di quando è stato preso la scrive il database
// insieme allo stato, così i due non possono contraddirsi.
export async function metti(id, nelCarrello) {
  const { error } = await supabase
    .from("spesa_spicciola")
    .update({ nel_carrello: nelCarrello })
    .eq("id", id);
  if (error) throw error;
}

export async function togliSpesaSpicciola(id) {
  const { error } = await supabase.from("spesa_spicciola").delete().eq("id", id);
  if (error) throw error;
}
