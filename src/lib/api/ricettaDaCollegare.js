import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// GLI INGREDIENTI «DA COLLEGARE» — 25/10/2026, migrazione 20261025000020.
//
// Una ricetta si cataloga anche se i suoi ingredienti non sono ancora
// prodotti del magazzino: quelli restano qui, scritti come li ha scritti
// Alessio, finché non li collega. Non entrano nel costo né negli allergeni
// — e la schermata lo dichiara, non lo tace.
//
// ⚠️ Correggere nome, quantità o nota è una scrittura su una riga sola
//    (categoria A, la RLS è la barriera). COLLEGARE invece tocca due
//    tabelle — la riga nasce fra gli ingredienti veri e sparisce da qui —
//    quindi passa dal corridoio (regola B4).

export async function listDaCollegare(recipeId) {
  const { data, error } = await supabase
    .from("ricetta_ingredienti_da_collegare")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("posizione")
    .order("id");
  if (error) throw error;
  return data;
}

export async function aggiornaDaCollegare(id, campi) {
  const { error } = await supabase.from("ricetta_ingredienti_da_collegare").update(campi).eq("id", id);
  if (error) throw error;
}

export async function togliDaCollegare(id) {
  const { error } = await supabase.from("ricetta_ingredienti_da_collegare").delete().eq("id", id);
  if (error) throw error;
}

export async function collegaIngrediente(rigaId, ingredientId) {
  return eseguiOperazione("collega_ingrediente_ricetta", {
    p_riga: rigaId,
    p_ingredient_id: ingredientId,
  });
}
