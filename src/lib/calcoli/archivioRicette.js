// =====================================================================
// L'ARCHIVIO DELLE RICETTE — 25/10/2026
// =====================================================================
// Prima dell'apertura Alessio porta nel gestionale molte ricette salvate
// altrove, e solo quelle che proverà davvero verranno collegate al
// magazzino. Le altre restano ARCHIVIO: si cercano per tag, stagione e
// allergeni, senza ingredienti collegati.
//
// 🔴 GLI ALLERGENI DI UNA RICETTA D'ARCHIVIO NON SI POSSONO CONTARE DAI
//    PRODOTTI: `v_recipe_allergens` guarda solo le righe collegate, quindi
//    una ricetta con metà ingredienti da collegare mostrerebbe gli allergeni
//    di quella metà — e il filtro «senza glutine» la farebbe passare. Qui
//    vive la regola che lo impedisce, in un posto solo, per l'elenco e per la
//    scheda.
//
// ⚠️ PURA: niente rete, niente database. Si prova in
//    tests/unita/archivio-ricette.test.js.
// =====================================================================

export const TAG_LUNGHEZZA = 30;

/** Un tag come si conserva: minuscolo, spazi ripuliti, al massimo 30 caratteri. */
export function normalizzaTag(testo) {
  return String(testo ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TAG_LUNGHEZZA)
    .trim();
}

/** Aggiunge un tag (normalizzato, senza doppioni). Un tag vuoto non cambia niente. */
export function aggiungiTag(tags, testo) {
  const t = normalizzaTag(testo);
  const attuali = tags ?? [];
  if (!t || attuali.includes(t)) return attuali;
  return [...attuali, t];
}

export function togliTag(tags, tag) {
  return (tags ?? []).filter((t) => t !== tag);
}

/** Tutti i tag usati in un elenco di righe, in ordine alfabetico. */
export function tagUsati(righe) {
  const tutti = new Set();
  for (const r of righe ?? []) for (const t of r?.tags ?? []) if (t) tutti.add(t);
  return [...tutti].sort((a, b) => a.localeCompare(b, "it"));
}

/**
 * Gli allergeni di una ricetta, e se si conoscono.
 *
 *  · `vista`: la riga di `v_recipe_allergens` (può mancare: nessuna riga
 *    collegata);
 *  · `haDaCollegare`: se la ricetta ha ingredienti non ancora collegati.
 *
 * Regola:
 *  · senza righe da collegare comanda la vista, come sempre — e una vista
 *    assente o «da verificare» vuol dire «non si sa»;
 *  · con righe da collegare comanda l'elenco d'archivio: se nessuno l'ha
 *    detto, «non si sa»; se c'è, gli allergeni sono l'UNIONE con quelli già
 *    contati (un allergene trovato nei prodotti collegati non sparisce perché
 *    l'archivio l'ha dimenticato).
 *
 * Restituisce `{ noti, elenco, origine }` — `origine` è «prodotti»,
 * «proposti» (MEMO, da confermare) o «confermati».
 */
export function allergeniDellaRicetta(ricetta, vista, haDaCollegare) {
  if (haDaCollegare) {
    if (ricetta?.allergeni_archivio == null) return { noti: false, elenco: [], origine: null };
    const elenco = [...new Set([...(vista?.allergens ?? []), ...ricetta.allergeni_archivio])].sort();
    return { noti: true, elenco, origine: ricetta.allergeni_archivio_origine };
  }
  if (!vista || vista.allergeni_da_verificare) return { noti: false, elenco: vista?.allergens ?? [], origine: null };
  return { noti: true, elenco: vista.allergens ?? [], origine: "prodotti" };
}

/**
 * Il filtro «senza X»: passa solo chi si SA che non lo contiene.
 * 🔴 Chi non si sa non è «senza» (19/08): è la salute di qualcuno.
 */
export function eSenza(allergeni, allergene) {
  return allergeni.noti && !allergeni.elenco.includes(allergene);
}

/** Il filtro delle bozze: testo, categoria, tipo, stato e tag, tutti insieme. */
export function filtraBozze(bozze, { testo = "", categoria = "", tipo = "", stato = "", tag = "" } = {}) {
  const cerca = testo.trim().toLowerCase();
  return (bozze ?? []).filter((b) => {
    if (cerca && !(b.titolo ?? "").toLowerCase().includes(cerca)) return false;
    if (categoria && b.categoria !== categoria) return false;
    if (tipo && (b.tipo ?? "piatto_finito") !== tipo) return false;
    if (stato === "diventata" ? !b.promossa_il : stato && (b.promossa_il || b.stato !== stato)) return false;
    if (tag && !(b.tags ?? []).includes(tag)) return false;
    return true;
  });
}

/**
 * Accende o spegne un allergene. ⚠️ Toccare un allergene vuol dire averli
 * guardati: chi parte da «non l'ha detto nessuno» (null) arriva a un elenco.
 */
export function cambiaAllergene(allergeni, allergene) {
  const attuali = allergeni ?? [];
  return attuali.includes(allergene) ? attuali.filter((a) => a !== allergene) : [...attuali, allergene];
}
