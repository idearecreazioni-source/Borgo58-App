import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

const SELECT = "*, supplier:supplier_id(id, name), producer_entity:producer_entity_id(id, name)";

// I semilavorati hanno una riga qui dentro, ma solo per poter avere dei
// lotti in magazzino: nel Ricettario NON sono ingredienti. Mostrarli
// darebbe due modi di mettere il ragù in una ricetta — come ingrediente e
// come preparazione — e due strade per la stessa cosa finiscono per dire
// due numeri diversi. In magazzino invece si vedono, ed è giusto: quanto
// ragù c'è in cella è una domanda vera.
export async function listIngredients({ search, category, includiPreparazioni } = {}) {
  let query = supabase
    .from("ingredients")
    .select(SELECT)
    .eq("active", true)
    .order("name");

  if (!includiPreparazioni) query = query.is("preparazione_id", null);

  if (search) query = query.ilike("name", `%${search}%`);
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getIngredient(id) {
  const { data, error } = await supabase
    .from("ingredients")
    .select(SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// Ingrediente + prima riga dello storico prezzi nella STESSA transazione
// (funzione Postgres create_ingredient, Contratto B4). Prima erano due
// scritture separate: un fallimento a metà lasciava un ingrediente il cui
// storico non parte mai dal prezzo iniziale, e chi riprovava creava un
// doppione. Restituisce la riga creata (il chiamante naviga con l'id).
export async function createIngredient(payload) {
  return eseguiOperazione("create_ingredient", {
    p_entity_id: payload.entity_id,
    p_name: payload.name,
    p_category: payload.category,
    p_unit: payload.unit,
    p_current_price: payload.current_price ?? 0,
    p_source_type: payload.source_type || "fornitore_esterno",
    p_supplier_id: payload.supplier_id ?? null,
    p_producer_entity_id: payload.producer_entity_id ?? null,
    p_allergens: payload.allergens ?? [],
    p_seasonality: payload.seasonality ?? [],
    p_storage_type: payload.storage_type ?? null,
    p_shelf_life_days: payload.shelf_life_days ?? null,
    p_waste_percentage_default: payload.waste_percentage_default ?? 0,
    p_haccp_receiving_temp: payload.haccp_receiving_temp ?? null,
    p_haccp_notes: payload.haccp_notes ?? null,
    // Scorta minima: vuota vuol dire «non entrare mai in lista da solo».
    // Zero non è ammesso — sarebbe una soglia che non scatta mai, cioè un
    // campo compilato che non fa niente.
    p_stock_minimum_threshold: payload.stock_minimum_threshold ?? null,
  });
}

// Aggiorna gli attributi dell'ingrediente SENZA toccare current_price/storico
// (per quello vedi updateIngredientPrice, che passa dalla funzione DB dedicata).
export async function updateIngredientFields(id, fields) {
  // current_price viene scartato di proposito: si aggiorna solo via
  // updateIngredientPrice(), che tiene lo storico.
  const { current_price: _ignorato, ...rest } = fields;
  const { data, error } = await supabase
    .from("ingredients")
    .update(rest)
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) throw error;
  return data;
}

// ⚠️ Scrive due tabelle — il prezzo dell'ingrediente E lo storico —
// quindi passa dal corridoio (Contratto B4). Era già atomica dentro: dal
// 16/08/2026 (Blocco 3 del mandato di correzione) è anche nella forma
// giusta, che è quella che rende l'elenco delle scritture controllabile.
export async function updateIngredientPrice(id, newPrice, { source = "manuale", note, supplierId } = {}) {
  await eseguiOperazione("update_ingredient_price", {
    p_ingredient_id: id,
    p_new_price: newPrice,
    p_source: source,
    p_note: note ?? null,
    p_supplier_id: supplierId ?? null,
  });
  return getIngredient(id);
}

// Limite sicuro: questa funzione alimenta SOLO il pannello "storico prezzi"
// nella scheda ingrediente, nessun export. Un ingrediente con più di 100
// variazioni di prezzo è già un caso estremo, e a schermo nessuno scorre
// oltre. (Sulle funzioni condivise con gli export vale la regola opposta —
// vedi la nota in cima a haccp.js.)
export async function listPriceHistory(ingredientId, { limit = 100 } = {}) {
  const { data, error } = await supabase
    .from("price_history")
    .select("*")
    .eq("ingredient_id", ingredientId)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function deactivateIngredient(id) {
  const { error } = await supabase
    .from("ingredients")
    .update({ active: false })
    .eq("id", id);
  if (error) throw error;
}

// --- I campi messi dalla macchina (23/08/2026) ---
//
// L'assistente compila cinque campi di un prodotto nuovo — stagionalità,
// conservazione, durata, temperatura di ricevimento, percentuale di scarto
// — e da oggi il database si ricorda **quali**, finché nessuno li guarda.
//
// ⚠️ Cambiare un campo lo toglie da solo dalla lista (ci pensa un trigger).
// Questa funzione serve al caso più frequente, che è l'opposto: la macchina
// ha indovinato, e si vuole dire «va bene così» **senza** toccare il numero.
// Senza, l'unico modo per togliere il segno sarebbe scrivere un valore
// sbagliato e poi rimetterlo.
export async function confermaCampiProdotto(id, campi) {
  const { data, error } = await supabase.rpc("conferma_campi_prodotto", {
    p_ingredient_id: id,
    p_campi: campi,
  });
  if (error) throw error;
  return data ?? [];
}

// Quanti prodotti hanno ancora un campo messo dalla macchina, per campo.
// ⚠️ È la domanda che serve davvero: non «questo prodotto è da confermare?»
// ma «quanti piatti stanno usando uno scarto che nessuno ha guardato?».
export async function listCampiDaConfermare() {
  const { data, error } = await supabase.rpc("campi_da_confermare");
  if (error) throw error;
  return data ?? [];
}
