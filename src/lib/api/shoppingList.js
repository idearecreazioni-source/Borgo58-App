import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// Titolare: la lista con i numeri VERI accanto a ogni riga — giacenza e
// soglia lette dallo stesso conteggio del magazzino, non congelate quando
// la riga è nata. Se nel frattempo la merce è arrivata, la riga lo dice
// invece di far comprare due volte.
export async function listaSpesa() {
  const { data, error } = await supabase.rpc("lista_spesa");
  if (error) throw error;
  return data ?? [];
}

// Quantità, nota e fornitore di una riga: una tabella sola, nessuna
// conseguenza altrove — scrittura diretta con la RLS come barriera.
export async function updateShoppingListItem(itemId, fields) {
  const { error } = await supabase.from("shopping_list_items").update(fields).eq("id", itemId);
  if (error) throw error;
}

// Titolare: lista completa, inclusi importi/metodo di pagamento.
export async function listShoppingList() {
  const { data, error } = await supabase
    .from("shopping_list_items")
    .select("*, ingredient:ingredient_id(id, name, unit), supplier:supplier_id(id, name)")
    .order("status")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Staff: stessa lista senza importi/metodo di pagamento. La vista non ha
// foreign key (niente embed automatico via PostgREST): i nomi arrivano
// appiattiti e vanno ricomposti qui nella stessa forma di listShoppingList.
export async function listShoppingListDisplay() {
  const { data, error } = await supabase
    .from("shopping_list_display")
    .select("*")
    .order("status")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((item) => ({
    ...item,
    ingredient: item.ingredient_id
      ? { id: item.ingredient_id, name: item.ingredient_name, unit: item.ingredient_unit }
      : null,
    supplier: item.supplier_id ? { id: item.supplier_id, name: item.supplier_name } : null,
  }));
}

export async function addShoppingListItem({
  ingredientId,
  customName,
  supplierId,
  quantityNeeded,
  unit,
  note,
}) {
  const { data, error } = await supabase.rpc("add_shopping_list_item", {
    p_ingredient_id: ingredientId ?? null,
    p_custom_name: customName ?? null,
    p_supplier_id: supplierId ?? null,
    p_quantity_needed: quantityNeeded ?? null,
    p_unit: unit ?? null,
    p_note: note ?? null,
  });
  if (error) throw error;
  return data;
}

// Ritorna quanti articoli sono stati aggiunti.
export async function addBelowThresholdItems() {
  const { data, error } = await supabase.rpc("add_below_threshold_items");
  if (error) throw error;
  return data;
}

export async function removeShoppingListItem(itemId) {
  const { error } = await supabase.rpc("remove_shopping_list_item", { p_item_id: itemId });
  if (error) throw error;
}

// I TRE ESITI di una riga chiusa a mano — mandato del 17/08, blocco 2.
//
//   comprata  → costo, merce dentro, E l'uscita vera in prima nota
//   gratis    → nessun costo, MA la merce entra lo stesso
//   non_presa → la riga sparisce e basta
//
// ⚠️ Confondere gli ultimi due mette in magazzino merce mai arrivata.
// ⚠️ Tre tabelle in una transazione (riga, lotto, prima nota), quindi
// corridoio (Contratto B4): a metà sarebbe merce comprata che non risulta
// arrivata, o soldi usciti dal cassetto per roba che non c'è.
export async function chiudiRigaLista({
  itemId,
  esito,
  importo,
  metodoPagamento,
  quantitaRicevuta,
  scadenza,
  riferimentoDocumento,
  causaleId,
}) {
  return eseguiOperazione("chiudi_riga_lista", {
    p_item_id: itemId,
    p_esito: esito,
    p_importo: importo ?? null,
    p_metodo_pagamento: metodoPagamento ?? null,
    p_quantita_ricevuta: quantitaRicevuta ?? null,
    p_scadenza: scadenza ?? null,
    p_riferimento_documento: riferimentoDocumento ?? null,
    p_causale_id: causaleId ?? null,
  });
}

// «È arrivato, chiudo la riga»: la via del DOCUMENTO, e si distingue dalla
// chiusura a mano proprio in questo — non scrive nessun costo e non carica
// nessun lotto. Il lotto c'è già (l'ha creato il carico) e il costo sta
// nella fattura: la lista non scrive mai un'uscita.
// Una tabella sola, nessuna conseguenza altrove → niente corridoio.
export async function chiudiRigaArrivata(itemId) {
  const { error } = await supabase.rpc("chiudi_riga_arrivata", { p_item_id: itemId });
  if (error) throw error;
}

// Quali righe della lista aspettano questo prodotto, con l'indicazione di
// quella che riceverà l'arrivo se nessuno dice il contrario.
// ⚠️ Serve PRIMA di confermare un carico, non dopo: dopo non è più una
// correzione, è una riparazione (Alessio, 19/08).
export async function righeListaAperte(ingredientId) {
  if (!ingredientId) return [];
  const { data, error } = await supabase.rpc("righe_lista_aperte", {
    p_ingredient_id: ingredientId,
  });
  if (error) throw error;
  return data ?? [];
}
