import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// LE BOZZE DI RICETTA (Ricettario Fase 1A, 06/10/2026).
//
// ⚠️ DUE STRADE, E NON PER CASO:
//   · le scritture su UNA tabella (la bozza, una sua riga) vanno dirette, con
//     la RLS titolare-only come barriera — categoria A del Contratto;
//   · la CONFERMA (ispirazione o ricetta) passa SOLO dal corridoio
//     `operazioni-atomiche`: crea ricetta, ingredienti e passaggi in una
//     transazione (regola B4). Da qui non si scrive MAI in `recipes`,
//     `recipe_ingredients` o `recipe_steps`, e la prova
//     `tests/unita/bozze-ricetta.test.js` lo controlla leggendo questo file.
//
// ⚠️ I campi che dicono «è diventata ricetta» (`promossa_il`, `ricetta_id`,
//    `gesto_promozione`) non si mandano: il database non li accetta dal
//    browser, per permesso sulla colonna.

const CAMPI_BOZZA = [
  "titolo",
  "origine_tipo",
  "origine_riferimento",
  "sunto",
  "categoria",
  "porzioni",
  "buchi_dichiarati",
];

const solo = (dati, campi) =>
  Object.fromEntries(Object.entries(dati ?? {}).filter(([k]) => campi.includes(k)));

export async function listBozzeRicetta() {
  const { data, error } = await supabase
    .from("bozze_ricetta")
    .select("id, titolo, origine_tipo, stato, promossa_il, ricetta_id, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getBozzaRicetta(id) {
  const [bozza, ingredienti, passaggi] = await Promise.all([
    supabase.from("bozze_ricetta").select("*").eq("id", id).single(),
    supabase
      .from("bozze_ricetta_ingredienti")
      .select("*, ingrediente:ingredient_id(id, name, unit)")
      .eq("bozza_id", id)
      .order("posizione")
      .order("id"),
    supabase
      .from("bozze_ricetta_passaggi")
      .select("*")
      .eq("bozza_id", id)
      .order("posizione")
      .order("id"),
  ]);
  // ⚠️ Una lettura fallita non si mostra come «nessun ingrediente» (19/08):
  //    se una delle tre non torna, la bozza intera non si disegna.
  for (const r of [bozza, ingredienti, passaggi]) if (r.error) throw r.error;
  return { bozza: bozza.data, ingredienti: ingredienti.data ?? [], passaggi: passaggi.data ?? [] };
}

/** La sola bozza che si può aprire da qui: una bozza scritta a mano, vuota. */
export async function creaBozzaManuale(titolo) {
  const { data, error } = await supabase
    .from("bozze_ricetta")
    .insert({ titolo, origine_tipo: "manuale" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function aggiornaBozza(id, dati) {
  const { error } = await supabase
    .from("bozze_ricetta")
    .update(solo(dati, CAMPI_BOZZA))
    .eq("id", id);
  if (error) throw error;
}

/** Scartare e riaprire sono scritture su una riga sola. */
export async function cambiaStatoBozza(id, stato) {
  const { error } = await supabase.from("bozze_ricetta").update({ stato }).eq("id", id);
  if (error) throw error;
}

export async function eliminaBozza(id) {
  const { error } = await supabase.from("bozze_ricetta").delete().eq("id", id);
  if (error) throw error;
}

export async function aggiungiIngredienteBozza(bozzaId, posizione) {
  const { data, error } = await supabase
    .from("bozze_ricetta_ingredienti")
    .insert({ bozza_id: bozzaId, posizione, nome: "nuovo ingrediente" })
    .select("*, ingrediente:ingredient_id(id, name, unit)")
    .single();
  if (error) throw error;
  return data;
}

export async function aggiornaIngredienteBozza(id, dati) {
  const { data, error } = await supabase
    .from("bozze_ricetta_ingredienti")
    .update(solo(dati, ["nome", "quantita", "unita", "ingredient_id", "nota", "posizione"]))
    .eq("id", id)
    .select("*, ingrediente:ingredient_id(id, name, unit)")
    .single();
  if (error) throw error;
  return data;
}

export async function togliIngredienteBozza(id) {
  const { error } = await supabase.from("bozze_ricetta_ingredienti").delete().eq("id", id);
  if (error) throw error;
}

export async function aggiungiPassaggioBozza(bozzaId, posizione) {
  const { data, error } = await supabase
    .from("bozze_ricetta_passaggi")
    .insert({ bozza_id: bozzaId, posizione })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function aggiornaPassaggioBozza(id, dati) {
  const { error } = await supabase
    .from("bozze_ricetta_passaggi")
    .update(solo(dati, ["fase", "descrizione", "posizione"]))
    .eq("id", id);
  if (error) throw error;
}

export async function togliPassaggioBozza(id) {
  const { error } = await supabase.from("bozze_ricetta_passaggi").delete().eq("id", id);
  if (error) throw error;
}

/**
 * LA CONFERMA, dal corridoio. `esito` è «ispirazione» o «ricetta»; `gesto`
 * è l'identificativo del gesto (vedi `nuovoGesto`): ripetuto, dà la stessa
 * risposta invece di una seconda ricetta.
 */
export async function promuoviBozza(bozzaId, esito, gesto) {
  return eseguiOperazione("promuovi_bozza_ricetta", {
    p_bozza_id: bozzaId,
    p_esito: esito,
    p_gesto: gesto,
  });
}
