import { supabase } from "../supabase";

// LO STORICO DEI COSTI — blocco 3 del mandato dei finger food (20/08/2026).
//
// ⚠️ Le voci le scrive il DATABASE, mai queste funzioni: qui si legge e
// basta. Se a registrare fossero le schermate, prima o poi una delle sei
// strade per cui un costo cambia si dimenticherebbe, e il registro
// sembrerebbe completo saltandone un pezzo.
export async function storicoCostoRicetta(recipeId) {
  const { data, error } = await supabase.rpc("storico_costo_ricetta", {
    p_recipe_id: recipeId,
  });
  if (error) throw error;
  return data ?? [];
}

// 🔴 L ISTANTE SI CHIEDE AL DATABASE, NON ALL OROLOGIO DEL BROWSER: i due
// non sono lo stesso orologio, e bastano pochi millisecondi di scarto perche
// il confronto scelga la voce di prima. Trovato da una prova diventata rossa
// il 20/08 (diceva 12,00 invece di 18,00). Se serve «adesso», si prende il
// campo `rilevato_il` dell ultima voce, non `new Date()`.
//
// ⚠️ Quanto costava a una certa data. Se non c'è nessuna voce prima di quel
// momento la risposta è VUOTA, e non è un errore: vuol dire «di quel giorno
// non so niente», che è diverso da «costava zero».
export async function costoRicettaAllaData(recipeId, quando) {
  const { data, error } = await supabase.rpc("costo_ricetta_alla_data", {
    p_recipe_id: recipeId,
    p_quando: quando,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}
