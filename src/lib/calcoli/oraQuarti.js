// =====================================================================
// QUALI ORE E QUALI MINUTI SI POSSONO SCEGLIERE — 20/09/2026
// =====================================================================
// ⚠️ STA IN UN FILE SUO PER POTERLO PROVARE senza disegnare niente: la
//    parte che può sbagliare è *quali voci compaiono nel menu*, e quella si
//    interroga con una chiamata invece che cercando delle opzioni a schermo.

export const QUARTI_DI_ORA = ["00", "15", "30", "45"];

const due = (n) => String(n).padStart(2, "0");

/** Le ventiquattro ore, come le scrive un orologio. */
export function oreDaOfferire() {
  return Array.from({ length: 24 }, (_, i) => due(i));
}

/**
 * I minuti che il menu offre, dato quello che c'è scritto adesso.
 *
 * 🔴 UN MINUTO FUORI QUARTO NON SPARISCE: comparirebbe vuoto un campo che
 *    invece un valore ce l'ha, e salvando si riscriverebbe un orario che
 *    nessuno aveva chiesto di cambiare. Resta, marcato per quello che è —
 *    e appena si sceglie altro non torna più.
 */
export function minutiDaOfferire(minutiAttuali) {
  const quarti = QUARTI_DI_ORA.map((m) => ({ valore: m, etichetta: m }));
  const m = (minutiAttuali || "").slice(0, 2);
  if (!m || QUARTI_DI_ORA.includes(m)) return quarti;
  // ⚠️ In coda e non in testa: la voce vecchia è un'eccezione, non la prima
  //    cosa che si legge.
  return [...quarti, { valore: m, etichetta: `${m} (scritto prima)` }];
}

/** «20» e «15» diventano «20:15». */
export function oraComposta(ore, minuti) {
  if (!ore) return "";
  return `${due(ore.slice(0, 2))}:${due((minuti || "00").slice(0, 2))}`;
}

/** L'orario è su un quarto d'ora? Serve a dire, non a impedire. */
export function suUnQuarto(valore) {
  const m = (valore || "").slice(3, 5);
  return m === "" ? true : QUARTI_DI_ORA.includes(m);
}
