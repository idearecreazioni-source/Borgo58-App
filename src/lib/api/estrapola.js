import { supabase } from "../supabase";

// «ESTRAPOLA» (R11, 11/10/2026): dalle ricette scelte agli ingredienti che
// servono, e da lì alla lista della spesa.
//
// ⚠️ Il calcolo vive nel database (`estrapola_ricette`), che riusa
//    l'esplosione dello scarico vero: semilavorati, scarto e righe
//    opzionali si comportano come quando il magazzino scende.
// ⚠️ `estrapola_ricette` solo LEGGE. Scrive soltanto `aggiungiEstrapolazione`,
//    con le righe che Alessio ha tenuto dopo averle guardate.

/** scelte: [{ tipo: "ricetta" | "bozza", id, porzioni }] */
export async function estrapolaRicette(scelte) {
  const { data, error } = await supabase.rpc("estrapola_ricette", { p_scelte: scelte });
  if (error) throw error;
  return data ?? [];
}

/** righe: [{ ingredient_id, nome, quantita, unita, nota }] — restituisce quante ne sono entrate. */
export async function aggiungiEstrapolazione(righe) {
  const { data, error } = await supabase.rpc("aggiungi_estrapolazione", { p_righe: righe });
  if (error) throw error;
  return data ?? 0;
}
