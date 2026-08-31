import { supabase } from "../supabase";

// LA CANTINA — 31/08/2026
//
// 🔴 PERCHE' ESISTE UN GESTO SOLO PER LE BOTTIGLIE, e non basta la giacenza.
// Una bottiglia stappata e venduta a meta' fa dire al magazzino «0,667
// bottiglie»: un numero giusto che in cantina non si vede. Li' ci sono *una
// bottiglia aperta con quattro calici dentro* e le altre intere.
//
// ⚠️ E APRIRE NON SCARICA NIENTE: scaricano i calici quando si vendono
// (`fabbisogno_conto` toglie gia' 1/porzioni_per_unita a ogni calice). Qui si
// registra solo che quella bottiglia non e' piu' intera.

export async function bottiglieAperte() {
  const { data, error } = await supabase.rpc("bottiglie_aperte_adesso");
  if (error) throw error;
  return data ?? [];
}

export async function apriBottiglia(ingredientId, nota = null) {
  const { data, error } = await supabase.rpc("apri_bottiglia", {
    p_ingredient_id: ingredientId,
    p_nota: nota,
  });
  if (error) throw error;
  return data;
}

// ⚠️ «finita» e «buttata» sono DUE FATTI DIVERSI e restano distinti nei
// conti: la prima non scarica niente (l'hanno gia' scaricata i calici
// venduti), la seconda scarica il fondo come SPRECO. Confonderli farebbe
// sparire il vino buttato dentro la rettifica del conteggio — cioe' dentro
// «non torna» invece che dentro «l'ho buttato».
export async function chiudiBottiglia(id, come, porzioniButtate = null, nota = null) {
  const { data, error } = await supabase.rpc("chiudi_bottiglia", {
    p_id: id,
    p_come: come,
    p_porzioni_buttate: porzioniButtate,
    p_nota: nota,
  });
  if (error) throw error;
  return data;
}

// L'inventario in BOTTIGLIE E IN EURO — com'e' stato chiesto. Un valore da
// solo non dice se manca una bottiglia da cento o dieci da dieci, e sono due
// problemi diversi.
export async function inventarioCantina(dal = null, al = null) {
  const { data, error } = await supabase.rpc("inventario_cantina", {
    p_dal: dal,
    p_al: al,
  });
  if (error) throw error;
  return data ?? [];
}
