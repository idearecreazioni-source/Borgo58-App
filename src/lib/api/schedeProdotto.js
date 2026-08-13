import { supabase } from "../supabase";

// Le schede dei prodotti: quello che un prodotto nato da una fattura non
// ha (allergeni, stagionalità, conservazione, durata, temperatura di
// ricevimento, scarto) e che l'assistente propone.
//
// ⚠️ Nessun limite su queste liste: sono elenchi di lavoro che si
// svuotano man mano, e una lista tagliata sembra finita quando non lo è.

export async function listProdottiDaCompilare() {
  const { data, error } = await supabase.rpc("prodotti_da_compilare");
  if (error) throw error;
  return data ?? [];
}

// Una chiamata sola per tutti i prodotti: il costo di un giro sta quasi
// tutto nelle istruzioni, non nei nomi.
export async function compilaSchede(ids) {
  const { data, error } = await supabase.functions.invoke("schede-prodotto", {
    body: ids?.length ? { prodotti: ids } : {},
  });
  if (error) {
    let messaggio = error.message;
    try {
      const corpo = await error.context?.json();
      if (corpo?.errore?.messaggio) messaggio = corpo.errore.messaggio;
    } catch {
      // risposta senza corpo JSON: si tiene il messaggio generico
    }
    throw new Error(messaggio);
  }
  return data;
}

// I prodotti i cui allergeni sono ancora solo una stima del modello.
// Finché sono qui dentro non valgono per la stampa del menu.
export async function listAllergeniStimati() {
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, allergens, allergeni_tracce, origine_allergeni, alimentare")
    .eq("active", true)
    .eq("origine_allergeni", "stimati")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

// Scrittura su una sola tabella: categoria A del contratto, niente
// corridoio. La barriera è `is_titolare()` dentro la funzione.
export async function confermaAllergeni(id, allergeni, tracce = []) {
  const { data, error } = await supabase.rpc("conferma_allergeni", {
    p_ingredient_id: id,
    p_allergeni: allergeni,
    p_tracce: tracce,
  });
  if (error) throw error;
  return data;
}

// Tutti in un colpo, e in una transazione sola: o si confermano tutti o
// nessuno. Confermare uno alla volta significa che al quinto ci si
// stanca e i rimasti restano «stimati» senza che nessuno se lo ricordi.
export async function confermaTutti(scelte) {
  const { data, error } = await supabase.rpc("conferma_allergeni_tutti", {
    p_scelte: scelte,
  });
  if (error) throw error;
  return data;
}
