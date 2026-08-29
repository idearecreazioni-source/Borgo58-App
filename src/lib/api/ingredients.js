import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

const SELECT = "*, supplier:supplier_id(id, name), producer_entity:producer_entity_id(id, name)";

// I semilavorati hanno una riga qui dentro, ma solo per poter avere dei
// lotti in magazzino: nel Ricettario NON sono ingredienti. Mostrarli
// darebbe due modi di mettere il ragù in una ricetta — come ingrediente e
// come preparazione — e due strade per la stessa cosa finiscono per dire
// due numeri diversi. In magazzino invece si vedono, ed è giusto: quanto
// ragù c'è in cella è una domanda vera.
// ⚠️ `alimentare` NON è un filtro come gli altri, ed è il motivo per cui
// ha un valore predefinito: dal 29/08 gli Ingredienti sono **solo gli
// alimenti**, e i materiali di consumo (carta, detersivi, imballaggi)
// hanno una sezione loro in Magazzino — decisione di Alessio, scelta fra
// due. Chi non lo nomina ottiene gli alimenti; chi vuole i materiali lo
// chiede con `alimentare: false`; chi li vuole tutti passa `null`.
// ⚠️ Il predefinito è `true` e non «tutti» apposta: le nove schermate che
// già chiamano questa funzione parlano tutte di cibo — ricette, cessioni
// agricole, raccolta propria, fatture — e con «tutti» avrebbero
// continuato a mescolare il baccalà con lo sgrassatore in silenzio.
// ESISTE GIÀ UN INGREDIENTE CON QUESTO NOME? — 29/08/2026, punto 2c.
//
// 🔴 Nasce da un difetto misurato, non da una precauzione. Da MEMO foto il
// percorso è `/fotografa` → «Apri la scheda di un prodotto nuovo» →
// `create_ingredient`, e `create_ingredient` **non accorpa niente**:
// nessun `nome_ingrediente_chiave`, nessun `on conflict`, e su
// `ingredients` non esiste nessun indice unico sul nome. Fotografare
// l'etichetta di una seconda marca di un prodotto che c'è già fa nascere
// **un secondo ingrediente generico** — cioè il difetto che la separazione
// del 27/08 era andata a togliere, rientrato dalla porta principale.
//
// ⚠️ NON È UN VINCOLO, ed è voluto: due prodotti possono legittimamente
// chiamarsi quasi uguali, e se accorpare lo decide l'assistente
// (decisione del 25/08). Questa serve a DIRLO prima di salvare, con la
// via d'uscita — un rifiuto senza gesto d'uscita è un vicolo cieco.
export async function ingredienteConQuestoNome(nome) {
  const pulito = (nome ?? "").trim();
  if (!pulito) return [];
  const { data, error } = await supabase.rpc("ingrediente_con_questo_nome", {
    p_nome: pulito,
  });
  if (error) throw error;
  return data ?? [];
}

export async function listIngredients({
  search,
  category,
  includiPreparazioni,
  includiNonAttivi,
  alimentare = true,
} = {}) {
  let query = supabase
    .from("ingredients")
    .select(SELECT)
    .order("name");

  // ⚠️ Di norma si vedono solo quelli in elenco. Ma senza un modo di
  // guardare quelli messi da parte non si potrebbero piu' RIMETTERE — e
  // un gesto che non si puo' disfare non e' «mettere da parte», e'
  // cancellare con un altro nome.
  if (!includiNonAttivi) query = query.eq("active", true);

  if (!includiPreparazioni) query = query.is("preparazione_id", null);

  // `null` vuol dire «tutti e due»: è il solo caso in cui non si filtra.
  if (alimentare !== null && alimentare !== undefined) {
    query = query.eq("alimentare", alimentare);
  }

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
    p_waste_percentage_default: payload.waste_percentage_default ?? 0,
    // ⚠️ Il PARAMETRO della funzione resta col nome vecchio: rinominarlo
    // romperebbe le chiamate per nome del corridoio. A cambiare e la
    // COLONNA, che dal 23/08/2026 si chiama temperatura_attesa perche
    // quel campo non e mai stato una misurazione.
    p_haccp_receiving_temp: payload.temperatura_attesa ?? null,
    p_haccp_notes: payload.haccp_notes ?? null,
    // Scorta minima: vuota vuol dire «non entrare mai in lista da solo».
    // Zero non è ammesso — sarebbe una soglia che non scatta mai, cioè un
    // campo compilato che non fa niente.
    p_stock_minimum_threshold: payload.stock_minimum_threshold ?? null,
    // 🔴 QUESTE DUE MANCAVANO (23/08/2026), e la casella «È un alimento»
    // esiste sulla scheda dal 12/08: si vedeva, si toglieva, si salvava
    // senza errore e non arrivava — ogni prodotto nuovo nasceva alimentare.
    // È la trappola del 16/08 alla terza ricomparsa: un valore che si vede
    // nella schermata non è un valore che arriva al database.
    p_alimentare: payload.alimentare ?? true,
    p_tenuto_in_magazzino: payload.tenuto_in_magazzino ?? true,
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

/**
 * LE CATEGORIE, che dal 27/08/2026 sono DATI e non piu' un enum.
 *
 * ⚠️ NON esiste piu' un elenco scritto in `constants.js`, ed e' voluto: era
 *    lo specchio di un enum, e uno specchio di una TABELLA sarebbe una
 *    seconda verita' che il giorno in cui Alessio aggiunge una categoria
 *    resterebbe indietro — cioe' un valore legittimo che non si puo'
 *    scegliere, il caso silenzioso che la rete dei vocabolari esiste per
 *    chiudere. Qui si legge la tabella, quindi non c'e' niente da tenere
 *    d'accordo.
 *
 * ⚠️ Solo le ACCESE: una categoria spenta resta legale per gli ingredienti
 *    che la portano, ma non si propone piu'.
 */
export async function listCategorieIngrediente(ambito = "alimenti") {
  const { data, error } = await supabase.rpc("categorie_proponibili", { p_ambito: ambito });
  if (error) throw error;
  return (data ?? []).map((c) => ({ value: c.codice, label: c.nome }));
}

/**
 * Aggiunge una categoria MENTRE si sta inserendo un prodotto — richiesta di
 * Alessio del 27/08/2026: se manca quella giusta, prima ci si fermava.
 *
 * ⚠️ Se esiste gia' NON fa finta di crearla: risponde `nuova: false` e dice
 *    quale, perche' due categorie che si somigliano sono il doppione che il
 *    catalogo esiste per evitare.
 */
/**
 * LE UNITA DI MISURA, che dal 29/08/2026 sono DATI come le categorie.
 *
 * ⚠️ `ambito` dice in quale dei due mondi si sta: su una carta forno non si
 *    offrono kg, g e mazzo. Le unita che servono a tutti e due — il litro,
 *    il pezzo — stanno in una riga sola con ambito «entrambi», perche
 *    sdoppiarle darebbe due righe che dicono la stessa cosa.
 *
 * ⚠️ NON c e un «aggiungi unita» come per le categorie, ed e dichiarato:
 *    `ingredients.unit` e ancora un vocabolario chiuso del database, quindi
 *    un unita creata al volo verrebbe RIFIUTATA al salvataggio. Un gesto
 *    che riesce a meta e peggio di un gesto che non c e.
 */
export async function listUnita(ambito = "alimenti") {
  const { data, error } = await supabase.rpc("unita_proponibili", { p_ambito: ambito });
  if (error) throw error;
  return (data ?? []).map((u) => ({ value: u.codice, label: u.nome }));
}

export async function aggiungiCategoriaIngrediente(nome, ambito = "alimenti") {
  const { data, error } = await supabase.rpc("aggiungi_categoria_ingrediente", {
    p_nome: nome,
    p_ambito: ambito,
  });
  if (error) throw error;
  return data;
}

/**
 * Media, estremi e variazione dei prezzi di un ingrediente — o di una sua
 * sola versione, passando `articoloId`.
 *
 * ⚠️ RESTITUISCE `null` QUANDO NON C'E' NESSUNO STORICO, e chi chiama deve
 *    dire «non lo so» invece di mostrare zeri: uno zero qui si leggerebbe
 *    «questo ingrediente non e' mai rincarato», che e' un'altra cosa.
 *
 * ⚠️ Solo il titolare: sono prezzi d'acquisto. Chi non deve vederli riceve
 *    un RIFIUTO, non un elenco vuoto — una schermata vuota e' una
 *    rassicurazione falsa (regola del 13/08).
 */
export async function andamentoPrezzo(ingredientId, articoloId = null) {
  const { data, error } = await supabase.rpc("andamento_prezzo", {
    p_ingredient_id: ingredientId,
    p_articolo_id: articoloId,
  });
  if (error) throw error;
  return data?.[0] ?? null;
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
// conservazione, temperatura di ricevimento, percentuale di scarto
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

// ---------------------------------------------------------------------
// Togliere un ingrediente: due strade, e il gestionale dice quale
// ---------------------------------------------------------------------
// 🔴 Fino al 24/08/2026 nella scheda c'era solo «Salva modifiche»: nessun
// modo di eliminare un ingrediente, nessuno di metterlo da parte — mentre
// nella scheda del fornitore «Disattiva» esisteva già. Il concetto c'era,
// agli ingredienti non era stato dato. E ⚠️ `ingredients.active` era in
// tabella dal primo giorno: tutto acceso, e muto.

/**
 * Dove compare questo ingrediente, e quante volte.
 * ⚠️ Serve PRIMA di offrire il pulsante: un «Elimina» che a volte funziona
 * e a volte no, senza spiegare, è peggio di un pulsante che non c'è.
 */
export async function usiDellIngrediente(id) {
  const { data, error } = await supabase.rpc("usi_dell_ingrediente", { p_id: id });
  if (error) throw error;
  return data ?? [];
}

/**
 * Lo toglie dagli elenchi senza staccarlo da niente. È la strada normale.
 */
export async function mettiDaParteIngrediente(id, attivo) {
  const { data, error } = await supabase.rpc("metti_da_parte_ingrediente", {
    p_id: id,
    p_attivo: attivo,
  });
  if (error) throw error;
  return data;
}

/**
 * Lo cancella davvero — e solo se non l'ha mai usato nessuno.
 * ⚠️ Passa dal corridoio anche se tocca una tabella sola: il controllo sta
 * nella funzione (tredici tabelle da guardare) e la forma è quella che
 * rende l'elenco delle cancellazioni controllabile.
 */
export async function eliminaIngrediente(id) {
  return eseguiOperazione("elimina_ingrediente", { p_id: id });
}
