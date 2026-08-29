import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// Registrare una produzione tocca quattro tabelle — la produzione, i
// lotti da cui si scarica, i movimenti e il lotto nuovo del semilavorato
// — e devono riuscire o fallire insieme: passa dal corridoio (B4).
//
// I DUE numeri sono obbligatori tutti e due: quante dosi e quanto ne è
// uscito. Con uno solo, un calo e mezza dose sono indistinguibili.
export async function registraProduzione({ recipeId, dosi, quantitaOttenuta, scadenza, note }) {
  return eseguiOperazione("registra_produzione", {
    p_recipe_id: recipeId,
    p_dosi: dosi,
    p_quantita_ottenuta: quantitaOttenuta,
    p_scadenza: scadenza ?? null,
    p_note: note ?? null,
  });
}

// Quanto esce davvero da una dose, contro quanto dice la ricetta. Serve a
// proporre il numero la volta dopo — precompilato, mai scritto da solo.
export async function resePreparazione(recipeId) {
  const { data, error } = await supabase.rpc("rese_preparazione", { p_recipe_id: recipeId });
  if (error) throw error;
  return data?.[0] ?? null;
}

// LE PREPARAZIONI COL LORO STORICO — 29/08/2026, punti 3b e 3c.
//
// In ordine ALFABETICO (scelta esplicita di Alessio contro «le più
// frequenti in cima»), ognuna con quante volte è stata fatta, la resa e —
// al solo titolare — quanto è costata le ultime due volte. Serve a vedere
// il paragone MENTRE si registra: se stavolta costa il doppio, ci si
// accorge lì.
//
// ⚠️ Il conto lo fa il database e non questa schermata: `listProduzioni()`
// legge al massimo cento produzioni, e contare «quante volte» da lì
// darebbe un numero giusto oggi e silenziosamente più basso fra sei mesi.
export async function riepilogoPreparazioni() {
  const { data, error } = await supabase.rpc("riepilogo_preparazioni");
  if (error) throw error;
  return data ?? [];
}

// LE COSE DA FARE — 29/08/2026, punto 3e.
// Con da quanti giorni sono lì: una lista senza età diventa un cimitero.
export async function coseDaFare() {
  const { data, error } = await supabase.rpc("cose_da_fare");
  if (error) throw error;
  return data ?? [];
}

// ⚠️ NON si duplica, e non si rompe: se c'è già lo DICE. Aggiungere due
// volte la stessa cosa non è un guasto, è un gesto normale di chi non si
// ricorda. La barriera vera è un indice unico nel database — le porte che
// scrivono sono tre (il pulsante, la voce, il ricorrente notturno).
export async function aggiungiDaFare(recipeId, nota) {
  const { data, error } = await supabase.rpc("aggiungi_da_fare", {
    p_recipe_id: recipeId,
    p_nota: nota ?? null,
  });
  if (error) throw error;
  return data;
}

export async function togliDaFare(recipeId) {
  const { error } = await supabase.rpc("togli_da_fare", { p_recipe_id: recipeId });
  if (error) throw error;
}

// COSA MANCA PER FARLA — e da chi si compra.
// ⚠️ AVVISA, NON BLOCCA (decisione di Alessio): si comincia lo stesso e si
// compra quello che manca. I fornitori sono un ELENCO, non uno: lo stesso
// ingrediente si compra da più parti, e la riga deve dirlo — altrimenti si
// ordina tre volte credendo di ordinare una.
export async function ingredientiCheMancano(recipeId, dosi = 1) {
  const { data, error } = await supabase.rpc("ingredienti_che_mancano", {
    p_recipe_id: recipeId,
    p_dosi: dosi,
  });
  if (error) throw error;
  return data ?? [];
}

// ⚠️ `ogniGiorni` vuoto SPEGNE la ricorrenza, non la cancella: la memoria
// di quando è stata messa l'ultima volta resta, e riaccendendola non
// rientra il giorno stesso.
export async function impostaRicorrenza(recipeId, ogniGiorni) {
  const { error } = await supabase.rpc("imposta_ricorrenza", {
    p_recipe_id: recipeId,
    p_ogni_giorni: ogniGiorni ?? null,
  });
  if (error) throw error;
}

// Le preparazioni che si possono produrre: sono ricette, non ingredienti.
export async function listPreparazioni() {
  const { data, error } = await supabase
    .from("recipes")
    .select("id, name, yield_quantity, yield_unit")
    .eq("recipe_type", "preparazione")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

// Titolare: con il costo. Staff: la vista senza.
export async function listProduzioni({ titolare } = {}) {
  const da = titolare ? "produzioni" : "produzioni_display";
  const campi = titolare
    ? "*, recipe:recipe_id(id, name)"
    : "*";
  const { data, error } = await supabase
    .from(da)
    .select(campi)
    .order("creato_il", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    ...p,
    preparazione: p.preparazione ?? p.recipe?.name ?? "—",
  }));
}
