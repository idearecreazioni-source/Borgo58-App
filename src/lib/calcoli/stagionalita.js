// LA STAGIONALITÀ DI UN PRODOTTO — 29/08/2026.
//
// Decisione di Alessio, e vale nei due versi:
//   · dodici mesi accesi diventano «tutto l'anno»;
//   · togliendo un mese da «tutto l'anno», restano undici mesi accesi.
//
// ⚠️ **METÀ DELLA REGOLA VIVE NEL DATABASE E METÀ QUI, e non è un
// doppione.** Sono due domande diverse, e il discriminante è il 17/08:
// direbbero *esattamente* la stessa cosa? No.
//   · il database riceve un ELENCO e lo normalizza — dodici mesi sono
//     «tutto l'anno», da qualunque porta arrivi il dato (la mano, MEMO,
//     una fattura, domani la voce). Quella parte è un trigger, ed è là
//     perché una schermata sola ne coprirebbe una porta su quattro.
//   · qui si risponde a *«cosa succede se tocco QUESTO mese»*, e il
//     database non può saperlo: gli arriva un elenco, non un gesto.
//     «Tutto l'anno meno agosto» sono undici mesi, e quali undici lo sa
//     solo chi ha toccato.
//
// ⚠️ E la parte che sta qui **non è la barriera**: se domani una schermata
// nuova mandasse dodici mesi, il trigger li normalizzerebbe lo stesso.

export const MESI_DELL_ANNO = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

export const TUTTO_ANNO = "tutto_anno";

// L'ordine è quello del calendario, non quello dell'alfabeto: «ago» prima
// di «apr» si legge come un errore di battitura.
const inOrdine = (mesi) => MESI_DELL_ANNO.filter((m) => mesi.includes(m));

/**
 * L'elenco dei mesi come va SCRITTO nel database.
 * Dodici mesi (o «tutto l'anno» accompagnato dai mesi) diventano
 * «tutto l'anno» e basta.
 */
export function stagionalitaNormalizzata(mesi) {
  const scelti = Array.from(new Set(mesi ?? []));
  if (scelti.includes(TUTTO_ANNO)) return [TUTTO_ANNO];
  const soloMesi = inOrdine(scelti);
  if (soloMesi.length === MESI_DELL_ANNO.length) return [TUTTO_ANNO];
  return soloMesi;
}

/**
 * Cosa diventa la stagionalità quando si tocca una casella.
 *
 * ⚠️ È QUI CHE VIVE IL VERSO CHE IL DATABASE NON PUÒ FARE: partendo da
 * «tutto l'anno» e spegnendo agosto, l'elenco si apre nei dodici mesi e
 * poi ne toglie uno — undici. Senza questo passaggio, togliere un mese da
 * «tutto l'anno» non toglierebbe niente, perché «tutto l'anno» il mese
 * non ce l'ha dentro.
 */
export function stagionalitaDopoIlTocco(mesi, toccato) {
  const scelti = Array.from(new Set(mesi ?? []));

  // La casella «Tutto l'anno» è un interruttore: o è tutto, o è niente.
  // ⚠️ Spegnendola resta VUOTO, che in questo gestionale vuol dire
  // «nessuno l'ha ancora detto» — non «non è disponibile mai».
  if (toccato === TUTTO_ANNO) {
    return scelti.includes(TUTTO_ANNO) ? [] : [TUTTO_ANNO];
  }

  const base = scelti.includes(TUTTO_ANNO) ? [...MESI_DELL_ANNO] : inOrdine(scelti);
  const dopo = base.includes(toccato)
    ? base.filter((m) => m !== toccato)
    : [...base, toccato];

  return stagionalitaNormalizzata(dopo);
}

/**
 * Se una casella si deve vedere accesa.
 * Con «tutto l'anno» scritto nel database, i dodici mesi si vedono accesi
 * lo stesso: a schermo la risposta è la stessa, ed è quello che uno si
 * aspetta guardando.
 */
export function meseAcceso(mesi, valore) {
  const scelti = mesi ?? [];
  if (valore === TUTTO_ANNO) return scelti.includes(TUTTO_ANNO);
  return scelti.includes(valore) || scelti.includes(TUTTO_ANNO);
}
