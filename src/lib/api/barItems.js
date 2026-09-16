import { supabase } from "./../supabase";

// Vini e bevande in carta (§3.2.1). Tabella propria, non menu_items: una
// bevanda non e' una ricetta. Lettura aperta alla sala (le serve per
// prendere l'ordine), scrittura riservata al titolare dalla RLS.
//
// 🔴 DAL 30/08 LA CARTA NON E' PIU' UN'ISOLA. Ogni voce puo' dire QUALE
// prodotto del magazzino consuma (`ingredient_id`) e quante porzioni si
// ricavano da una confezione (`porzioni_per_unita`): da li' viene lo
// scarico della cantina e il margine. Vuoto vuol dire «non collegata»,
// che e' una risposta diversa da «non scarica» — e la schermata la dice.

const SELECT = "*";

export async function listBarItems({ includeInactive } = {}) {
  let query = supabase
    .from("bar_items")
    .select(SELECT)
    .order("section")
    .order("category")
    .order("position")
    .order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createBarItem(item) {
  const { data, error } = await supabase
    .from("bar_items")
    .insert({
      section: item.section,
      category: item.category.trim(),
      name: item.name.trim(),
      producer: item.producer?.trim() || null,
      serving: item.serving?.trim() || null,
      selling_price: Number(item.selling_price) || 0,
      position: Number(item.position) || 0,
      note: item.note?.trim() || null,
      // ⚠️ Vuoto e non zero: una voce nasce senza prodotto e senza resa, e
      //    il gestionale lo dichiara invece di rispondere al posto suo.
      ingredient_id: item.ingredient_id || null,
      porzioni_per_unita: item.porzioni_per_unita ? Number(item.porzioni_per_unita) : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBarItem(id, patch) {
  const { error } = await supabase.from("bar_items").update(patch).eq("id", id);
  if (error) throw error;
}

// Fuori carta, non cancellata: un vino tolto oggi torna in primavera, e i
// conti gia' chiusi che lo contengono restano leggibili.
export async function setBarItemActive(id, active) {
  return updateBarItem(id, { active });
}

// IL MARGINE DELLA CARTA — quanto paghi una confezione e quanto la incassi.
// ⚠️ Solo il titolare: la funzione del database RIFIUTA agli altri invece di
//    rispondere un elenco vuoto, perche' un elenco vuoto si legge «non c'e'
//    niente in carta».
export async function listMargineCarta() {
  const { data, error } = await supabase.rpc("margine_carta");
  if (error) throw error;
  return data;
}

// LE PROPOSTE DI ABBINAMENTO — 30/08/2026.
//
// 🔴 Il gestionale PROPONE quale prodotto comprato corrisponde a una voce
// della carta, e nella proposta si vedono **produttore, annata e formato**:
// «Grillo» contro «Grillo» è testa o croce (parole di Alessio).
// ⚠️ **Propone e basta**: la funzione del database non scrive niente, e il
//    collegamento nasce solo quando lui tocca «Collega».
// ⚠️ L'annata **non ha una colonna**: per la decisione del 30/08 vive dentro
//    la descrizione della confezione, e la proposta mostra quella per intero.
// I PRODOTTI CHE POSSONO STARE IN CARTA — 31/08/2026
//
// 🔴 IL DIFETTO, MISURATO APRENDO LA SCHERMATA: il menu «Prodotto» di ogni
// riga di carta elencava **tutti i 133 alimenti del magazzino** — aglio,
// agnello, baccala', basilico. Ventisei menu da 116 voci ciascuno, per
// collegare un vino a una bottiglia.
//
// ⚠️ E UN PRODOTTO NON E' UNA RIGA DI CARTA (rilievo di Alessio): la stessa
// bottiglia sta in carta **due volte**, al calice e alla bottiglia, a
// prezzi diversi. Per questo qui non si riversa niente: si dice **cosa si
// puo' mettere**, col conto di quante righe ne escono gia'.
export async function prodottiPerLaCarta(mondo = null) {
  const { data, error } = await supabase.rpc("prodotti_per_la_carta", { p_mondo: mondo });
  if (error) throw error;
  return data ?? [];
}

export async function proposteAbbinamento() {
  const { data, error } = await supabase.rpc("abbinamenti_carta_proposti");
  if (error) throw error;
  return data ?? [];
}

// LO STATO DELLA CARTA STAMPATA — 16/09/2026.
//
// 🔴 LE DUE FUNZIONI ESISTONO DAL 31/08 (migrazione `20260831000003`) E NON
//    LE CHIAMAVA NESSUNO: il gestionale sapeva rispondere e mancava la porta
//    per chiedere. Erano dichiarate «senza schermata» in
//    `tests/app/funzioni-senza-schermata.test.js`. Qui si apre la porta,
//    senza migrazioni nuove.
//
// ⚠️ `carta_da_ristampare()` NON dice SE ristampare: dice da quanto è ferma
//    ogni carta, quante voci sono entrate e uscite da allora, e quante ce ne
//    sono adesso. La decisione resta di Alessio — una soglia inventata qui
//    sarebbe una regola scritta da noi sulle sue cose (commento della
//    migrazione).
// ⚠️ Solo il titolare: la funzione RIFIUTA agli altri invece di rispondere un
//    elenco vuoto, che si leggerebbe «non c'è nessuna carta».
export async function cartaDaRistampare() {
  const { data, error } = await supabase.rpc("carta_da_ristampare");
  if (error) throw error;
  return data ?? [];
}

// ⚠️ NON STAMPA NIENTE: registra che una stampa è già avvenuta, fotografando
//    quante voci aveva la carta in quel momento. Il numero si fotografa e non
//    si ricalcola: ricalcolandolo, «quante voci aveva allora» cambierebbe da
//    solo a ogni bottiglia aggiunta.
// ⚠️ Scrive una riga sola (`stampe_carta`), quindi non passa dal corridoio:
//    quello è per le scritture multi-tabella «tutto o niente» (regola B4).
export async function segnaCartaStampata(sezione, nota = null) {
  const { data, error } = await supabase.rpc("segna_carta_stampata", {
    p_sezione: sezione,
    p_nota: nota?.trim() ? nota.trim() : null,
  });
  if (error) throw error;
  return data;
}
