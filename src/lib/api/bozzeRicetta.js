import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";
import { chiamaFunzione } from "../chiamaFunzione";
import { bozzaDaRicettaLetta } from "../calcoli/ricettaDaLink";

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

/**
 * UNA BOZZA DA UN LINK (10/10/2026). Due passi:
 *   1. la funzione online `ricetta-da-link` apre la pagina e restituisce la
 *      ricetta che dichiara — non salva niente;
 *   2. il lettore dell'anteprima da testo la smonta (`bozzaDaRicettaLetta`),
 *      e la bozza nasce dal corridoio, intera: bozza, ingredienti e passaggi
 *      in una transazione (`crea_bozza_da_lettura`, regola B4).
 * `gesto` (vedi `nuovoGesto`): lo stesso gesto ripetuto riceve la stessa
 * bozza invece di crearne una seconda.
 * Restituisce l'identificativo della bozza.
 */
export async function importaRicettaDaLink(url, gesto) {
  const letta = await chiamaFunzione("ricetta-da-link", { url }, "leggere la ricetta dal link");
  const { url: pulito, ricetta } = letta?.risultato ?? {};
  if (!ricetta) throw new Error("La pagina non ha restituito nessuna ricetta.");
  const candidata = bozzaDaRicettaLetta(ricetta, pulito);
  if (!candidata.ok) throw new Error(candidata.messaggio);
  if (!candidata.bozza.titolo) throw new Error("La ricetta letta non ha un titolo: non posso creare la bozza.");
  const esito = await eseguiOperazione("crea_bozza_da_lettura", {
    p_bozza: candidata.bozza,
    p_ingredienti: candidata.ingredienti,
    p_passaggi: candidata.passaggi,
    p_gesto: gesto,
  });
  return esito?.bozza_id;
}
