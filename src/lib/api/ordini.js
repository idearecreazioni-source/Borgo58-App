import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// La bozza di un ordine: le righe della lista assegnate a quel fornitore,
// dette con LA SUA dicitura e nelle sue confezioni, più il testo pronto.
// Non scrive niente e non manda niente.
export async function bozzaOrdine(supplierId) {
  const { data, error } = await supabase.rpc("bozza_ordine", { p_supplier_id: supplierId });
  if (error) throw error;
  return data;
}

// Registrare l'ordine tocca tre tabelle (ordine, righe, lista della
// spesa) e devono riuscire o fallire insieme: passa dal corridoio (B4).
export async function registraOrdine({ supplierId, testo, righe, canale = "whatsapp" }) {
  return eseguiOperazione("registra_ordine", {
    p_supplier_id: supplierId,
    p_testo: testo,
    p_righe: righe,
    p_canale: canale,
  });
}

// Annullare riporta le righe in lista: «inviato» è una dichiarazione di
// Alessio, non un fatto che il gestionale possa verificare.
export async function annullaOrdine(ordineId) {
  return eseguiOperazione("annulla_ordine", { p_ordine_id: ordineId });
}

export async function listaOrdini({ dal, al } = {}) {
  const { data, error } = await supabase.rpc("ordini_fatti", {
    p_dal: dal ?? null,
    p_al: al ?? null,
  });
  if (error) throw error;
  return data ?? [];
}

// Segnare arrivato è una scrittura su una riga sola, senza conseguenze
// altrove: la RLS (titolare) è la barriera, non serve il corridoio.
export async function segnaOrdineRicevuto(ordineId) {
  const { error } = await supabase
    .from("ordini_fornitore")
    .update({ stato: "ricevuto", ricevuto_il: new Date().toISOString() })
    .eq("id", ordineId);
  if (error) throw error;
}

// Chi vende questo prodotto, a quanto, e quando l'hai comprato l'ultima
// volta. NON è una funzione nuova: è la tabella disegnata da Alessio il
// 12/08, già ordinata dalla più conveniente. Una domanda, una regola.
export async function confrontoFornitori(ingredientId) {
  const { data, error } = await supabase.rpc("varianti_ingrediente", {
    p_ingredient_id: ingredientId,
  });
  if (error) throw error;
  return data ?? [];
}
