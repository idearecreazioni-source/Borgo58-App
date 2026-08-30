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
export async function proposteAbbinamento() {
  const { data, error } = await supabase.rpc("abbinamenti_carta_proposti");
  if (error) throw error;
  return data ?? [];
}
