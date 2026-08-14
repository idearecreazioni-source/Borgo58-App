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
